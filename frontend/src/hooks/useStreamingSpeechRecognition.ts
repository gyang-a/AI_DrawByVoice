import { useRef, useState } from 'react';
import { createSpeechRecognitionSocket } from '../services/speechApi';

const TARGET_SAMPLE_RATE = 16000;
const SPEECH_THRESHOLD = 0.018;
const SILENCE_TIMEOUT_MS = 900;
const FINAL_TIMEOUT_MS = 3500;
const RESTART_DELAY_MS = 250;

type AudioContextWindow = {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

type RecognitionStatus = 'idle' | 'connecting' | 'listening' | 'recognizing';

type StreamingSpeechRecognitionOptions = {
  onPartialText: (text: string) => void;
  onFinalText: (text: string) => void;
  onError: (message: string) => void;
};

type StreamingSpeechRecognition = {
  status: RecognitionStatus;
  errorMessage: string | null;
  isSupported: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
};

export function useStreamingSpeechRecognition({
  onPartialText,
  onFinalText,
  onError,
}: StreamingSpeechRecognitionOptions): StreamingSpeechRecognition {
  const [status, setStatus] = useState<RecognitionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const inputSampleRateRef = useRef(TARGET_SAMPLE_RATE);
  const isActiveRef = useRef(false);
  const isSocketReadyRef = useRef(false);
  const isClosingSocketRef = useRef(false);
  const isWaitingFinalRef = useRef(false);
  const hasSpeechRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const lastPartialTextRef = useRef('');
  const finalTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);

  const AudioContextClass = getAudioContextClass();
  const isSupported = Boolean(
    typeof navigator.mediaDevices?.getUserMedia === 'function' && AudioContextClass,
  );

  async function startListening() {
    if (!isSupported || status !== 'idle') {
      return;
    }

    if (!AudioContextClass) {
      setErrorMessage('当前浏览器不支持录音');
      return;
    }

    setErrorMessage(null);
    isActiveRef.current = true;
    setStatus('connecting');

    try {
      startRecognitionSession();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);

      inputSampleRateRef.current = audioContext.sampleRate;
      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        handleAudioFrame(event.inputBuffer.getChannelData(0));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;
    } catch {
      setErrorMessage('无法访问麦克风，请检查浏览器权限。');
      onError('无法访问麦克风，请检查浏览器权限。');
      stopListening();
    }
  }

  function stopListening() {
    isActiveRef.current = false;
    clearFinalTimer();
    clearRestartTimer();
    closeSocket();
    stopAudioStream();
    resetUtteranceState();
    setStatus('idle');
  }

  function startRecognitionSession() {
    clearRestartTimer();
    closeSocket();
    resetUtteranceState();
    setStatus('connecting');

    const socket = createSpeechRecognitionSocket();
    socket.binaryType = 'arraybuffer';

    socket.onmessage = (event: MessageEvent<string>) => {
      const message = parseSocketMessage(event.data);

      if (!message) {
        return;
      }

      if (message.type === 'ready') {
        isSocketReadyRef.current = true;
        setStatus('listening');
        return;
      }

      if (message.type === 'partial') {
        lastPartialTextRef.current = message.text;
        onPartialText(message.text);
        return;
      }

      if (message.type === 'final') {
        clearFinalTimer();
        lastPartialTextRef.current = '';
        onFinalText(message.text);
        restartRecognitionSession();
        return;
      }

      if (message.type === 'error') {
        setErrorMessage(message.text);
        onError(message.text);
        restartRecognitionSession();
      }
    };

    socket.onerror = () => {
      const message = '语音识别连接失败，请确认后端 ASR 服务状态。';
      setErrorMessage(message);
      onError(message);
    };

    socket.onclose = () => {
      isSocketReadyRef.current = false;
      if (isClosingSocketRef.current) {
        isClosingSocketRef.current = false;
        return;
      }

      if (isActiveRef.current && !isWaitingFinalRef.current) {
        restartRecognitionSession();
      }
    };

    socketRef.current = socket;
  }

  function restartRecognitionSession() {
    if (!isActiveRef.current) {
      return;
    }

    clearFinalTimer();
    isWaitingFinalRef.current = false;
    isSocketReadyRef.current = false;
    resetUtteranceState();
    closeSocket();
    restartTimerRef.current = window.setTimeout(() => {
      if (isActiveRef.current) {
        startRecognitionSession();
      }
    }, RESTART_DELAY_MS);
  }

  function handleAudioFrame(input: Float32Array) {
    if (!isActiveRef.current || !isSocketReadyRef.current || isWaitingFinalRef.current) {
      return;
    }

    const now = window.performance.now();
    const rms = calculateRms(input);

    if (rms >= SPEECH_THRESHOLD) {
      hasSpeechRef.current = true;
      lastSpeechAtRef.current = now;
    }

    if (!hasSpeechRef.current) {
      return;
    }

    const pcm = encodePcm16(downsample(input, inputSampleRateRef.current, TARGET_SAMPLE_RATE));
    socketRef.current?.send(pcm);

    if (
      hasSpeechRef.current &&
      now - lastSpeechAtRef.current >= SILENCE_TIMEOUT_MS &&
      socketRef.current?.readyState === WebSocket.OPEN
    ) {
      isWaitingFinalRef.current = true;
      isSocketReadyRef.current = false;
      setStatus('recognizing');
      socketRef.current.send('end');
      startFinalTimeout();
    }
  }

  function startFinalTimeout() {
    clearFinalTimer();
    finalTimerRef.current = window.setTimeout(() => {
      const fallbackText = lastPartialTextRef.current.trim();

      if (!isActiveRef.current || !isWaitingFinalRef.current) {
        return;
      }

      if (fallbackText) {
        lastPartialTextRef.current = '';
        onFinalText(fallbackText);
      } else {
        onError('未识别到有效语音文本。');
      }

      restartRecognitionSession();
    }, FINAL_TIMEOUT_MS);
  }

  function closeSocket() {
    const socket = socketRef.current;
    socketRef.current = null;
    isSocketReadyRef.current = false;

    if (
      socket?.readyState === WebSocket.OPEN ||
      socket?.readyState === WebSocket.CONNECTING ||
      socket?.readyState === WebSocket.CLOSING
    ) {
      isClosingSocketRef.current = true;
    }

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send('close');
      socket.close();
    } else if (socket?.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  }

  function resetUtteranceState() {
    hasSpeechRef.current = false;
    lastSpeechAtRef.current = 0;
    isWaitingFinalRef.current = false;
    lastPartialTextRef.current = '';
  }

  function stopAudioStream() {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close();

    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
  }

  function clearRestartTimer() {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }

  function clearFinalTimer() {
    if (finalTimerRef.current !== null) {
      window.clearTimeout(finalTimerRef.current);
      finalTimerRef.current = null;
    }
  }

  return {
    status,
    errorMessage,
    isSupported,
    startListening,
    stopListening,
  };
}

function getAudioContextClass() {
  const audioWindow = window as unknown as AudioContextWindow;
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
}

function parseSocketMessage(data: string): { type: string; text: string } | null {
  try {
    return JSON.parse(data) as { type: string; text: string };
  } catch {
    return null;
  }
}

function calculateRms(samples: Float32Array): number {
  const sum = samples.reduce((total, sample) => total + sample * sample, 0);
  return Math.sqrt(sum / samples.length);
}

function downsample(samples: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) {
    return samples;
  }

  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(samples.length / ratio);
  const result = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const before = Math.floor(sourceIndex);
    const after = Math.min(before + 1, samples.length - 1);
    const weight = sourceIndex - before;
    result[index] = samples[before] * (1 - weight) + samples[after] * weight;
  }

  return result;
}

function encodePcm16(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);

  samples.forEach((sample, index) => {
    const clampedSample = Math.max(-1, Math.min(1, sample));
    view.setInt16(
      index * 2,
      clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff,
      true,
    );
  });

  return buffer;
}
