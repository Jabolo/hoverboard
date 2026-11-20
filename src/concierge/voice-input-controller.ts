export type VoiceSupportKind = 'gemini-live' | 'web-speech' | 'media-recorder' | 'unsupported';
export type VoiceInputState = 'idle' | 'listening' | 'transcribing' | 'error';
export type VoiceLanguage = 'pl-PL' | 'en-US';

export interface VoiceInputControllerOptions {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onStateChange: (state: VoiceInputState) => void;
  onError: (error: string) => void;
  onVolume?: (volumeNormalized: number) => void;
  lang?: VoiceLanguage;
  fetchFn?: typeof fetch;
  webSocketFactory?: (url: string) => WebSocket;
  apiEndpoint?: string;
  maxDurationMs?: number;
}

export function detectVoiceSupport(): VoiceSupportKind {
  if (typeof window === 'undefined') return 'unsupported';
  const hasMediaDevices =
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  const hasWebSocket = typeof WebSocket !== 'undefined';
  const hasAudioContext =
    typeof window !== 'undefined' &&
    Boolean(
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext,
    );

  if (hasMediaDevices && hasWebSocket && hasAudioContext) {
    return 'gemini-live';
  }
  const hasWebSpeech =
    'SpeechRecognition' in window ||
    'webkitSpeechRecognition' in (window as unknown as Record<string, unknown>);
  if (hasWebSpeech) return 'web-speech';
  if (hasMediaDevices && typeof MediaRecorder !== 'undefined') {
    return 'media-recorder';
  }
  return 'unsupported';
}

export function downsampleAndConvertToInt16(
  inputData: Float32Array,
  sourceSampleRate: number,
  targetSampleRate = 16000,
): Int16Array {
  if (sourceSampleRate === targetSampleRate) {
    const output = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i += 1) {
      const s = Math.max(-1, Math.min(1, inputData[i] ?? 0));
      output[i] = Math.round(s < 0 ? s * 0x8000 : s * 0x7fff);
    }
    return output;
  }
  const ratio = sourceSampleRate / targetSampleRate;
  const newLength = Math.max(1, Math.round(inputData.length / ratio));
  const output = new Int16Array(newLength);
  for (let i = 0; i < newLength; i += 1) {
    const srcIndex = Math.min(inputData.length - 1, Math.round(i * ratio));
    const s = Math.max(-1, Math.min(1, inputData[srcIndex] ?? 0));
    output[i] = Math.round(s < 0 ? s * 0x8000 : s * 0x7fff);
  }
  return output;
}

export function int16ToBase64(int16Array: Int16Array): string {
  const bytes = new Uint8Array(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export class VoiceInputController {
  private options: VoiceInputControllerOptions;
  private state: VoiceInputState = 'idle';
  private support: VoiceSupportKind;
  public lang: VoiceLanguage;

  // Gemini Live WebSocket streaming state
  private ws: WebSocket | null = null;
  private liveSetupComplete = false;
  private accumulatedTranscript = '';
  private scriptProcessor: ScriptProcessorNode | null = null;

  // Web Speech state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;

  // Media & Audio state
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private autoStopTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private volumeTimerId: ReturnType<typeof setInterval> | null = null;

  // MediaRecorder unary fallback state
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private chosenMimeType = '';

  constructor(options: VoiceInputControllerOptions) {
    this.options = options;
    this.support = detectVoiceSupport();

    if (options.lang) {
      this.lang = options.lang;
    } else if (
      typeof navigator !== 'undefined' &&
      navigator.language &&
      navigator.language.toLowerCase().startsWith('pl')
    ) {
      this.lang = 'pl-PL';
    } else {
      this.lang = 'en-US';
    }
  }

  public getSupport(): VoiceSupportKind {
    return this.support;
  }

  public getState(): VoiceInputState {
    return this.state;
  }

  public setLanguage(lang: VoiceLanguage) {
    this.lang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  private setState(newState: VoiceInputState) {
    this.state = newState;
    this.options.onStateChange(newState);
  }

  public async start(): Promise<void> {
    if (this.state === 'listening' || this.state === 'transcribing') {
      return;
    }
    this.cancel();

    if (this.support === 'gemini-live') {
      await this.startGeminiLive();
    } else if (this.support === 'web-speech') {
      this.startWebSpeech();
    } else if (this.support === 'media-recorder') {
      await this.startMediaRecorder();
    } else {
      this.options.onError('Voice input is not supported in this browser.');
      this.setState('error');
    }
  }

  public stop(): void {
    if (this.state !== 'listening') return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            realtimeInput: {
              audioStreamEnd: true,
            },
          }),
        );
      } catch {
        // ignore
      }
      setTimeout(() => {
        this.cleanupLiveResources();
        if (this.state !== 'idle') {
          this.setState('idle');
        }
      }, 350);
      return;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      return;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
  }

  public cancel(): void {
    if (this.autoStopTimeoutId) {
      clearTimeout(this.autoStopTimeoutId);
      this.autoStopTimeoutId = null;
    }
    if (this.volumeTimerId) {
      clearInterval(this.volumeTimerId);
      this.volumeTimerId = null;
    }
    this.cleanupLiveResources();

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch {
        // ignore
      }
      this.mediaRecorder = null;
    }
    this.recordedChunks = [];
    if (this.state !== 'idle') {
      this.setState('idle');
    }
  }

  private cleanupLiveResources(): void {
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {
        // ignore
      }
      this.scriptProcessor = null;
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      this.mediaStream = null;
    }
    if (this.audioContext) {
      try {
        void this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.liveSetupComplete = false;
  }

  private async startGeminiLive(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      this.options.onError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone in browser.'
          : 'Failed to access microphone.',
      );
      this.setState('error');
      return;
    }

    const fetchFn = this.options.fetchFn || fetch;
    const endpoint = this.options.apiEndpoint || '/api/concierge';
    let tokenData: { wsUrl?: string } | null = null;

    try {
      const tokenRes = await fetchFn(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'live-token' }),
      });
      if (tokenRes.ok) {
        tokenData = (await tokenRes.json()) as { wsUrl?: string };
      }
    } catch {
      tokenData = null;
    }

    if (!tokenData || !tokenData.wsUrl) {
      // Clean fallback to Web Speech or MediaRecorder if live token endpoint is unavailable
      if (
        'SpeechRecognition' in window ||
        'webkitSpeechRecognition' in (window as unknown as Record<string, unknown>)
      ) {
        this.startWebSpeech();
        return;
      }
      await this.startMediaRecorder();
      return;
    }

    try {
      const wsUrl = tokenData.wsUrl;
      const wsFactory = this.options.webSocketFactory || ((url: string) => new WebSocket(url));
      this.ws = wsFactory(wsUrl);
      this.liveSetupComplete = false;
      this.accumulatedTranscript = '';

      this.ws.onopen = () => {
        if (!this.ws) return;
        this.ws.send(
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
      };

      this.ws.onmessage = async (event: MessageEvent) => {
        try {
          const rawText =
            typeof event.data === 'string'
              ? event.data
              : event.data instanceof Blob
                ? await event.data.text()
                : '';
          if (!rawText) return;
          const msg = JSON.parse(rawText) as {
            setupComplete?: unknown;
            serverContent?: {
              interimInputTranscription?: { text?: string };
              inputTranscription?: { text?: string };
            };
          };

          if (msg.setupComplete) {
            this.liveSetupComplete = true;
          }

          if (msg.serverContent?.interimInputTranscription?.text) {
            const interim = msg.serverContent.interimInputTranscription.text.trim();
            if (interim) {
              this.accumulatedTranscript = interim;
              this.options.onTranscript(interim, false);
            }
          }

          if (msg.serverContent?.inputTranscription?.text) {
            const final = msg.serverContent.inputTranscription.text.trim();
            if (final) {
              this.accumulatedTranscript = final;
              this.options.onTranscript(final, true);
            }
          }
        } catch {
          // ignore parsing error
        }
      };

      this.ws.onerror = () => {
        if (this.state === 'listening') {
          this.options.onError('Real-time connection interrupted. Switching to speech fallback…');
          this.stop();
        }
      };

      this.ws.onclose = () => {
        if (this.state === 'listening') {
          this.setState('idle');
        }
      };

      // Set up AudioContext & Audio processing
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        const scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
        this.scriptProcessor = scriptProcessor;

        scriptProcessor.onaudioprocess = (e: AudioProcessingEvent) => {
          if (this.state !== 'listening') return;
          const inputChannel = e.inputBuffer.getChannelData(0);
          const sampleRate = this.audioContext?.sampleRate || 16000;
          const pcm16 = downsampleAndConvertToInt16(inputChannel, sampleRate, 16000);

          if (this.options.onVolume) {
            let sumSquares = 0;
            for (let i = 0; i < inputChannel.length; i += 1) {
              const val = inputChannel[i] ?? 0;
              sumSquares += val * val;
            }
            const rms = Math.sqrt(sumSquares / inputChannel.length);
            const normalized = Math.min(1, Math.max(0, rms * 4));
            this.options.onVolume(normalized);
          }

          if (this.ws && this.ws.readyState === WebSocket.OPEN && this.liveSetupComplete) {
            const base64Data = int16ToBase64(pcm16);
            this.ws.send(
              JSON.stringify({
                realtimeInput: {
                  mediaChunks: [
                    {
                      mimeType: 'audio/pcm;rate=16000',
                      data: base64Data,
                    },
                  ],
                },
              }),
            );
          }
        };

        source.connect(scriptProcessor);
        scriptProcessor.connect(this.audioContext.destination);
      }

      this.setState('listening');
      const maxDuration = this.options.maxDurationMs || 15_000;
      this.autoStopTimeoutId = setTimeout(() => {
        this.stop();
      }, maxDuration);
    } catch (err) {
      this.options.onError(
        err instanceof Error ? err.message : 'Failed to initialize live transcription',
      );
      this.setState('error');
    }
  }

  private startWebSpeech(): void {
    const SpeechClass =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechClass) {
      this.options.onError('Speech recognition unavailable');
      this.setState('error');
      return;
    }

    try {
      this.recognition = new SpeechClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.lang;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        const results = event.results || [];
        for (let i = 0; i < results.length; i += 1) {
          const item = results[i];
          if (!item) continue;
          const part = (item[0]?.transcript || '').trim();
          if (item.isFinal) {
            final += (final ? ' ' : '') + part;
          } else {
            interim += (interim ? ' ' : '') + part;
          }
        }
        const text = (final || interim).trim();
        if (text) {
          this.options.onTranscript(text, Boolean(final));
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.recognition.onerror = (event: any) => {
        const error = event.error || 'speech-error';
        if (error === 'not-allowed' || error === 'service-not-allowed') {
          this.options.onError('Microphone access denied. Please grant permission.');
          this.setState('error');
        } else if (error === 'network') {
          if (
            typeof navigator !== 'undefined' &&
            Boolean(navigator.mediaDevices?.getUserMedia) &&
            typeof MediaRecorder !== 'undefined'
          ) {
            this.options.onError('Browser speech offline. Switching to Gemini voice…');
            void this.startMediaRecorder();
            return;
          }
          this.options.onError('Speech recognition network error.');
          this.setState('error');
        } else if (error === 'no-speech') {
          this.options.onError('No speech detected. Please try speaking again.');
          this.setState('error');
        } else {
          this.options.onError(`Speech error: ${error}`);
          this.setState('error');
        }
      };

      this.recognition.onend = () => {
        if (this.state === 'listening') {
          this.setState('idle');
        }
      };

      this.setState('listening');
      this.recognition.start();

      const maxDuration = this.options.maxDurationMs || 15_000;
      this.autoStopTimeoutId = setTimeout(() => {
        this.stop();
      }, maxDuration);

      if (this.options.onVolume) {
        this.volumeTimerId = setInterval(() => {
          if (this.state === 'listening' && this.options.onVolume) {
            const simulated = 0.3 + Math.random() * 0.6;
            this.options.onVolume(simulated);
          }
        }, 120);
      }
    } catch (err) {
      this.options.onError(
        err instanceof Error ? err.message : 'Failed to start speech recognition',
      );
      this.setState('error');
    }
  }

  private async startMediaRecorder(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      this.options.onError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone in browser.'
          : 'Failed to access microphone.',
      );
      this.setState('error');
      return;
    }

    const candidateMimes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];
    this.chosenMimeType = '';
    for (const mime of candidateMimes) {
      if (
        typeof MediaRecorder.isTypeSupported === 'function' &&
        MediaRecorder.isTypeSupported(mime)
      ) {
        this.chosenMimeType = mime;
        break;
      }
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 32;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        this.volumeTimerId = setInterval(() => {
          if (this.state === 'listening' && this.options.onVolume) {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i += 1) {
              sum += dataArray[i] ?? 0;
            }
            const avg = sum / (dataArray.length * 255);
            this.options.onVolume(Math.min(1, Math.max(0, avg * 2)));
          }
        }, 100);
      }
    } catch {
      // AudioContext optional for equalizer
    }

    this.recordedChunks = [];
    const recorderOptions: MediaRecorderOptions = {};
    if (this.chosenMimeType) {
      recorderOptions.mimeType = this.chosenMimeType;
    }

    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStream, recorderOptions);
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        void this.handleMediaRecorderStopped();
      };

      this.setState('listening');
      this.mediaRecorder.start(250);

      const maxDuration = this.options.maxDurationMs || 15_000;
      this.autoStopTimeoutId = setTimeout(() => {
        this.stop();
      }, maxDuration);
    } catch (err) {
      this.options.onError(err instanceof Error ? err.message : 'Failed to start audio recording');
      this.setState('error');
    }
  }

  private async handleMediaRecorderStopped(): Promise<void> {
    if (this.volumeTimerId) {
      clearInterval(this.volumeTimerId);
      this.volumeTimerId = null;
    }
    if (this.autoStopTimeoutId) {
      clearTimeout(this.autoStopTimeoutId);
      this.autoStopTimeoutId = null;
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      this.mediaStream = null;
    }
    if (this.audioContext) {
      try {
        void this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }

    if (this.recordedChunks.length === 0) {
      this.setState('idle');
      return;
    }

    this.setState('transcribing');
    const blob = new Blob(this.recordedChunks, {
      type: this.chosenMimeType || 'audio/webm',
    });
    this.recordedChunks = [];

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const commaIdx = result.indexOf(',');
          resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
        };
        reader.onerror = () => reject(new Error('Failed to read recorded audio'));
        reader.readAsDataURL(blob);
      });

      const endpoint = this.options.apiEndpoint || '/api/concierge';
      const fetchFn = this.options.fetchFn || fetch;
      const res = await fetchFn(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'transcribe',
          audio: base64Data,
          mimeType: this.chosenMimeType || 'audio/webm',
        }),
      });

      if (!res.ok) {
        throw new Error(`Audio transcription failed (HTTP ${res.status})`);
      }

      const json = (await res.json()) as { status: string; transcript?: string };
      if (json.status === 'ok' && typeof json.transcript === 'string') {
        const trimmed = json.transcript.trim();
        if (trimmed) {
          this.options.onTranscript(trimmed, true);
        } else {
          this.options.onError('No speech detected in audio.');
        }
      } else {
        throw new Error('Invalid transcription response');
      }
      this.setState('idle');
    } catch (err) {
      this.options.onError(
        err instanceof Error ? err.message : 'Transcription service unavailable',
      );
      this.setState('error');
    }
  }
}
