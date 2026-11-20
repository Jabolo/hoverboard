import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { detectVoiceSupport, VoiceInputController } from './voice-input-controller';

describe('VoiceInputController', () => {
  const originalSpeechRecognition = (window as unknown as Record<string, unknown>)[
    'SpeechRecognition'
  ];
  const originalWebkitSpeechRecognition = (window as unknown as Record<string, unknown>)[
    'webkitSpeechRecognition'
  ];
  const originalMediaDevices = navigator.mediaDevices;
  const originalMediaRecorder = window.MediaRecorder;

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
  });

  describe('detectVoiceSupport', () => {
    it('detects web-speech when SpeechRecognition exists', () => {
      (window as unknown as Record<string, unknown>)['SpeechRecognition'] = class {};
      expect(detectVoiceSupport()).toBe('web-speech');
    });

    it('detects web-speech when webkitSpeechRecognition exists', () => {
      delete (window as unknown as Record<string, unknown>)['SpeechRecognition'];
      (window as unknown as Record<string, unknown>)['webkitSpeechRecognition'] = class {};
      expect(detectVoiceSupport()).toBe('web-speech');
    });

    it('detects media-recorder when SpeechRecognition is missing but MediaRecorder + getUserMedia exist', () => {
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

    it('detects unsupported when both are missing', () => {
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

  describe('Web Speech API execution', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockRecognitionInstance: any;

    beforeEach(() => {
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
