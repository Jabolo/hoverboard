import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  detectVoiceSupport,
  downsampleAndConvertToInt16,
  int16ToBase64,
  VoiceInputController,
} from './voice-input-controller';

describe('VoiceInputController', () => {
  const originalSpeechRecognition = (window as unknown as Record<string, unknown>)[
    'SpeechRecognition'
  ];
  const originalWebkitSpeechRecognition = (window as unknown as Record<string, unknown>)[
    'webkitSpeechRecognition'
  ];
  const originalMediaDevices = navigator.mediaDevices;
  const originalMediaRecorder = window.MediaRecorder;
  const originalAudioContext = window.AudioContext;
  const originalWebSocket = window.WebSocket;

  afterEach(() => {
    (window as unknown as Record<string, unknown>)['SpeechRecognition'] = originalSpeechRecognition;
    (window as unknown as Record<string, unknown>)['webkitSpeechRecognition'] =
      originalWebkitSpeechRecognition;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      configurable: true,
      writable: true,
    });
    window.MediaRecorder = originalMediaRecorder;
    window.AudioContext = originalAudioContext;
    window.WebSocket = originalWebSocket;
  });

  describe('detectVoiceSupport', () => {
    it('detects gemini-live when getUserMedia, WebSocket, and AudioContext exist', () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: jest.fn() },
        configurable: true,
        writable: true,
      });
      window.WebSocket = class {} as unknown as typeof WebSocket;
      window.AudioContext = class {} as unknown as typeof AudioContext;

      expect(detectVoiceSupport()).toBe('gemini-live');
    });

    it('detects web-speech when AudioContext is missing but SpeechRecognition exists', () => {
      // @ts-expect-error test cleanup
      delete window.AudioContext;
      (window as unknown as Record<string, unknown>)['SpeechRecognition'] = class {};
      expect(detectVoiceSupport()).toBe('web-speech');
    });

    it('detects web-speech when webkitSpeechRecognition exists and AudioContext missing', () => {
      // @ts-expect-error test cleanup
      delete window.AudioContext;
      delete (window as unknown as Record<string, unknown>)['SpeechRecognition'];
      (window as unknown as Record<string, unknown>)['webkitSpeechRecognition'] = class {};
      expect(detectVoiceSupport()).toBe('web-speech');
    });

    it('detects media-recorder when SpeechRecognition is missing and WebSocket is missing but MediaRecorder exists', () => {
      // @ts-expect-error test cleanup
      delete window.WebSocket;
      delete (window as unknown as Record<string, unknown>)['SpeechRecognition'];
      delete (window as unknown as Record<string, unknown>)['webkitSpeechRecognition'];
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: jest.fn() },
        configurable: true,
        writable: true,
      });
      window.MediaRecorder = class {} as unknown as typeof MediaRecorder;
      expect(detectVoiceSupport()).toBe('media-recorder');
    });

    it('detects unsupported when all are missing', () => {
      // @ts-expect-error test cleanup
      delete window.AudioContext;
      // @ts-expect-error test cleanup
      delete window.WebSocket;
      delete (window as unknown as Record<string, unknown>)['SpeechRecognition'];
      delete (window as unknown as Record<string, unknown>)['webkitSpeechRecognition'];
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      // @ts-expect-error test cleanup
      delete window.MediaRecorder;
      expect(detectVoiceSupport()).toBe('unsupported');
    });
  });

  describe('downsampleAndConvertToInt16 & int16ToBase64', () => {
    it('converts float32 audio to 16-bit PCM cleanly at same sample rate', () => {
      const input = new Float32Array([0.0, 0.5, -0.5, 1.0, -1.0]);
      const int16 = downsampleAndConvertToInt16(input, 16000, 16000);
      expect(int16).toHaveLength(5);
      expect(int16[0]).toBe(0);
      expect(int16[1]).toBe(Math.round(0.5 * 32767));
      expect(int16[2]).toBe(Math.round(-0.5 * 32768));
      expect(int16[3]).toBe(32767);
      expect(int16[4]).toBe(-32768);
    });

    it('downsamples from 48000Hz to 16000Hz (3x reduction)', () => {
      const input = new Float32Array(4800);
      for (let i = 0; i < input.length; i += 1) {
        input[i] = Math.sin(i / 10);
      }
      const int16 = downsampleAndConvertToInt16(input, 48000, 16000);
      expect(int16.length).toBe(1600);
    });

    it('encodes Int16Array to valid base64 string', () => {
      const int16 = new Int16Array([0, 1000, -1000]);
      const base64 = int16ToBase64(int16);
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);
      const decoded = atob(base64);
      expect(decoded.length).toBe(6); // 3 samples * 2 bytes
    });
  });

  describe('Gemini Live WebSocket streaming execution', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockTrack: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockStream: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockWsInstance: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockAudioContextInstance: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scriptProcessorOnaudioprocess: ((e: any) => void) | null = null;

    beforeEach(() => {
      mockTrack = { stop: jest.fn() };
      mockStream = { getTracks: () => [mockTrack] };

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: jest.fn(async () => mockStream),
        },
        configurable: true,
        writable: true,
      });

      mockWsInstance = {
        readyState: 1, // OPEN
        send: jest.fn(),
        close: jest.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
      };

      const mockSource = { connect: jest.fn() };
      const mockProcessor = {
        connect: jest.fn(),
        disconnect: jest.fn(),
        set onaudioprocess(fn: (e: unknown) => void) {
          scriptProcessorOnaudioprocess = fn;
        },
      };

      mockAudioContextInstance = {
        sampleRate: 16000,
        createMediaStreamSource: jest.fn(() => mockSource),
        createScriptProcessor: jest.fn(() => mockProcessor),
        destination: {},
        close: jest.fn(),
      };

      window.AudioContext = jest.fn(
        () => mockAudioContextInstance,
      ) as unknown as typeof AudioContext;
      window.WebSocket = jest.fn(() => mockWsInstance) as unknown as typeof WebSocket;
      // @ts-expect-error static field
      window.WebSocket.OPEN = 1;
    });

    it('fetches live-token, opens WebSocket, sends setup, streams PCM, and receives real-time transcripts', async () => {
      const onTranscript = jest.fn();
      const onStateChange = jest.fn();
      const onError = jest.fn();
      const onVolume = jest.fn();

      const fetchFn = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          token: 'auth_tokens/test-token',
          wsUrl: 'wss://generativelanguage.googleapis.com/ws/...',
          model: 'gemini-3.5-transcribe-live',
        }),
      })) as unknown as typeof fetch;

      const controller = new VoiceInputController({
        onTranscript,
        onStateChange,
        onError,
        onVolume,
        fetchFn,
        webSocketFactory: () => mockWsInstance,
      });

      expect(controller.getSupport()).toBe('gemini-live');
      await controller.start();

      expect(controller.getState()).toBe('listening');
      expect(onStateChange).toHaveBeenCalledWith('listening');
      expect(fetchFn).toHaveBeenCalledTimes(1);

      // Trigger WS onopen
      mockWsInstance.onopen();
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          setup: {
            model: 'models/gemini-3.5-transcribe-live',
            generationConfig: {
              responseModalities: ['TEXT'],
            },
            inputAudioTranscription: {
              mode: 'smart',
            },
          },
        }),
      );

      // Server acknowledges setup
      await mockWsInstance.onmessage({
        data: JSON.stringify({ setupComplete: {} }),
      });

      // Audio processor processes buffer and streams PCM chunk
      expect(scriptProcessorOnaudioprocess).toBeDefined();
      const fakeBuffer = new Float32Array(2048);
      fakeBuffer[10] = 0.5;
      scriptProcessorOnaudioprocess!({
        inputBuffer: {
          getChannelData: () => fakeBuffer,
        },
      });

      expect(onVolume).toHaveBeenCalled();
      expect(mockWsInstance.send).toHaveBeenCalledTimes(2);
      const sentAudioMsg = JSON.parse(
        String((mockWsInstance.send as jest.Mock).mock.calls[1]![0]),
      ) as {
        realtimeInput: { mediaChunks: Array<{ mimeType: string; data: string }> };
      };
      expect(sentAudioMsg.realtimeInput.mediaChunks[0]!.mimeType).toBe('audio/pcm;rate=16000');

      // Server sends real-time interim speech transcription
      await mockWsInstance.onmessage({
        data: JSON.stringify({
          serverContent: {
            interimInputTranscription: { text: 'Kto mówi' },
          },
        }),
      });
      expect(onTranscript).toHaveBeenCalledWith('Kto mówi', false);

      // Server sends finalized speech transcription
      await mockWsInstance.onmessage({
        data: JSON.stringify({
          serverContent: {
            inputTranscription: { text: 'Kto mówi o AI?' },
          },
        }),
      });
      expect(onTranscript).toHaveBeenCalledWith('Kto mówi o AI?', true);

      // User taps stop
      controller.stop();
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          realtimeInput: {
            audioStreamEnd: true,
          },
        }),
      );
    });
  });

  describe('Web Speech API execution', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockRecognitionInstance: any;

    beforeEach(() => {
      // @ts-expect-error test cleanup
      delete window.AudioContext;
      // @ts-expect-error test cleanup
      delete window.WebSocket;

      mockRecognitionInstance = {
        continuous: false,
        interimResults: false,
        lang: 'en-US',
        start: jest.fn(),
        stop: jest.fn(),
        abort: jest.fn(),
        onresult: null,
        onerror: null,
        onend: null,
      };

      (window as unknown as Record<string, unknown>)['SpeechRecognition'] = jest.fn(
        () => mockRecognitionInstance,
      );
      delete (window as unknown as Record<string, unknown>)['webkitSpeechRecognition'];
    });

    it('starts listening and dispatches transcript updates', async () => {
      const onTranscript = jest.fn();
      const onStateChange = jest.fn();
      const onError = jest.fn();

      const controller = new VoiceInputController({
        onTranscript,
        onStateChange,
        onError,
        lang: 'pl-PL',
      });

      expect(controller.getSupport()).toBe('web-speech');
      await controller.start();

      expect(controller.getState()).toBe('listening');
      expect(onStateChange).toHaveBeenCalledWith('listening');
      expect(mockRecognitionInstance.start).toHaveBeenCalledTimes(1);
      expect(mockRecognitionInstance.lang).toBe('pl-PL');

      // Simulate interim speech event
      mockRecognitionInstance.onresult({
        resultIndex: 0,
        results: [[{ transcript: 'gdzie jest sala' }]],
      });
      expect(onTranscript).toHaveBeenCalledWith('gdzie jest sala', false);

      // Simulate final speech event
      const finalResult = [{ transcript: 'gdzie jest sala classroom' }];
      // @ts-expect-error mock field
      finalResult.isFinal = true;
      mockRecognitionInstance.onresult({
        resultIndex: 0,
        results: [finalResult],
      });
      expect(onTranscript).toHaveBeenCalledWith('gdzie jest sala classroom', true);

      // Simulate recognition end
      mockRecognitionInstance.onend();
      expect(controller.getState()).toBe('idle');
      expect(onStateChange).toHaveBeenCalledWith('idle');
    });

    it('maps permission errors to user-friendly messages', async () => {
      const onTranscript = jest.fn();
      const onStateChange = jest.fn();
      const onError = jest.fn();

      const controller = new VoiceInputController({
        onTranscript,
        onStateChange,
        onError,
      });

      await controller.start();
      mockRecognitionInstance.onerror({ error: 'not-allowed' });

      expect(onError).toHaveBeenCalledWith('Microphone access denied. Please grant permission.');
      expect(controller.getState()).toBe('error');
    });

    it('cancels recognition cleanly', async () => {
      const controller = new VoiceInputController({
        onTranscript: jest.fn(),
        onStateChange: jest.fn(),
        onError: jest.fn(),
      });

      await controller.start();
      controller.cancel();

      expect(mockRecognitionInstance.abort).toHaveBeenCalled();
      expect(controller.getState()).toBe('idle');
    });
  });

  describe('MediaRecorder fallback execution', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockTrack: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockStream: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockRecorderInstance: any;

    beforeEach(() => {
      // @ts-expect-error test cleanup
      delete window.AudioContext;
      // @ts-expect-error test cleanup
      delete window.WebSocket;
      delete (window as unknown as Record<string, unknown>)['SpeechRecognition'];
      delete (window as unknown as Record<string, unknown>)['webkitSpeechRecognition'];

      mockTrack = {
        stop: jest.fn(),
      };
      mockStream = {
        getTracks: () => [mockTrack],
      };

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: jest.fn(async () => mockStream),
        },
        configurable: true,
        writable: true,
      });

      mockRecorderInstance = {
        state: 'inactive',
        start: jest.fn(() => {
          mockRecorderInstance.state = 'recording';
        }),
        stop: jest.fn(() => {
          mockRecorderInstance.state = 'inactive';
          if (mockRecorderInstance.onstop) {
            mockRecorderInstance.onstop();
          }
        }),
        ondataavailable: null,
        onstop: null,
      };

      const MockMediaRecorder = jest.fn(
        () => mockRecorderInstance,
      ) as unknown as typeof MediaRecorder;
      MockMediaRecorder.isTypeSupported = jest.fn((mime: string) => mime.includes('audio/webm'));
      window.MediaRecorder = MockMediaRecorder;
    });

    it('records audio, stops tracks, and posts to /api/concierge for transcription', async () => {
      const onTranscript = jest.fn();
      const onStateChange = jest.fn();
      const onError = jest.fn();

      const fetchFn = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          transcript: 'Kto mówi o AI?',
          model: 'gemini-3.5-flash-lite',
        }),
      })) as unknown as typeof fetch;

      const controller = new VoiceInputController({
        onTranscript,
        onStateChange,
        onError,
        fetchFn,
      });

      expect(controller.getSupport()).toBe('media-recorder');
      await controller.start();

      expect(controller.getState()).toBe('listening');
      expect(mockRecorderInstance.start).toHaveBeenCalled();

      // Simulate audio chunk recorded
      const chunk = new Blob(['sample-audio-bytes'], { type: 'audio/webm' });
      mockRecorderInstance.ondataavailable({ data: chunk });

      // Stop recording
      controller.stop();

      // Wait for async FileReader and fetch to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTrack.stop).toHaveBeenCalled();
      expect(fetchFn).toHaveBeenCalledTimes(1);

      const fetchCalls = (fetchFn as unknown as jest.Mock).mock.calls;
      const requestBody = JSON.parse(String((fetchCalls[0]![1] as { body?: string }).body)) as {
        mode: string;
        audio: string;
        mimeType: string;
      };
      expect(requestBody.mode).toBe('transcribe');
      expect(requestBody.mimeType).toBe('audio/webm;codecs=opus');
      expect(onTranscript).toHaveBeenCalledWith('Kto mówi o AI?', true);
      expect(controller.getState()).toBe('idle');
    });

    it('auto-stops after maxDurationMs', async () => {
      jest.useFakeTimers();

      const controller = new VoiceInputController({
        onTranscript: jest.fn(),
        onStateChange: jest.fn(),
        onError: jest.fn(),
        maxDurationMs: 5000,
      });

      await controller.start();
      expect(controller.getState()).toBe('listening');

      jest.advanceTimersByTime(5000);
      expect(mockRecorderInstance.stop).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});
