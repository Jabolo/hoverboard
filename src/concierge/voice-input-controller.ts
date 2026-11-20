export type VoiceSupportKind = 'web-speech' | 'media-recorder' | 'unsupported';
export type VoiceInputState = 'idle' | 'listening' | 'transcribing' | 'error';
export type VoiceLanguage = 'pl-PL' | 'en-US';

export interface VoiceInputControllerOptions {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onStateChange: (state: VoiceInputState) => void;
  onError: (error: string) => void;
  onVolume?: (volumeNormalized: number) => void;
  lang?: VoiceLanguage;
  fetchFn?: typeof fetch;
  apiEndpoint?: string;
  maxDurationMs?: number;
}

export function detectVoiceSupport(): VoiceSupportKind {
  if (typeof window === 'undefined') return 'unsupported';
  const hasWebSpeech =
    'SpeechRecognition' in window ||
    'webkitSpeechRecognition' in (window as unknown as Record<string, unknown>);
  if (hasWebSpeech) return 'web-speech';
  if (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  ) {
    return 'media-recorder';
  }
  return 'unsupported';
}

export class VoiceInputController {
  private options: VoiceInputControllerOptions;
  private state: VoiceInputState = 'idle';
  private support: VoiceSupportKind;
  public lang: VoiceLanguage;

  // Web Speech state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;

  // MediaRecorder fallback state
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private chosenMimeType = '';
  private autoStopTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private audioContext: AudioContext | null = null;
  private volumeTimerId: ReturnType<typeof setInterval> | null = null;

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

    if (this.support === 'web-speech') {
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

    if (this.support === 'web-speech') {
      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch {
          // ignore
        }
      }
    } else if (this.support === 'media-recorder') {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop();
        } catch {
          // ignore
        }
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
    this.recordedChunks = [];
    if (this.state !== 'idle') {
      this.setState('idle');
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
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = this.lang;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        const results = event.results || [];
        for (let i = event.resultIndex || 0; i < results.length; i += 1) {
          const item = results[i];
          if (!item) continue;
          if (item.isFinal) {
            final += item[0]?.transcript || '';
          } else {
            interim += item[0]?.transcript || '';
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
        } else if (error === 'no-speech') {
          this.options.onError('No speech detected. Please try speaking again.');
        } else if (error === 'network') {
          this.options.onError('Speech recognition network error.');
        } else {
          this.options.onError(`Speech error: ${error}`);
        }
        this.setState('error');
      };

      this.recognition.onend = () => {
        if (this.state === 'listening') {
          this.setState('idle');
        }
      };

      this.setState('listening');
      this.recognition.start();

      // Web Speech simulated volume pulses for lively visual EQ
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
