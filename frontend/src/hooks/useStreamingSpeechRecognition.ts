import { useEffect, useRef, useState } from 'react';
import { createSpeechRecognitionSocket } from '../services/speechApi';
import type { CommandResponse, Shape } from '../types/drawing';

const TARGET_SAMPLE_RATE = 16000;

type AudioContextWindow = {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

type RecognitionStatus = 'idle' | 'connecting' | 'listening' | 'recognizing';

type SpeechSocketMessage =
  | { type: 'ready'; text: string }
  | { type: 'listening'; text: string }
  | { type: 'recognizing'; text: string }
  | { type: 'recognized'; text: string }
  | { type: 'command'; text: string; response: CommandResponse }
  | { type: 'error'; text: string };

type StreamingSpeechRecognitionOptions = {
  scene: Shape[];
  threadId: string;
  onRecognizedText: (text: string) => void;
  onCommand: (response: CommandResponse) => void;
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
  scene,
  threadId,
  onRecognizedText,
  onCommand,
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
  const sceneRef = useRef(scene);
  const threadIdRef = useRef(threadId);
  const isActiveRef = useRef(false);
  const isSocketReadyRef = useRef(false);
  const isClosingSocketRef = useRef(false);

  const AudioContextClass = getAudioContextClass();
  const isSupported = Boolean(
    typeof navigator.mediaDevices?.getUserMedia === 'function' && AudioContextClass,
  );

  useEffect(() => {
    sceneRef.current = scene;
    threadIdRef.current = threadId;
    sendScene();
  }, [scene, threadId]);

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
      startSocket();
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
      const message = '无法访问麦克风，请检查浏览器权限。';
      setErrorMessage(message);
      onError(message);
      stopListening();
    }
  }

  function stopListening() {
    isActiveRef.current = false;
    closeSocket();
    stopAudioStream();
    setStatus('idle');
  }

  function startSocket() {
    closeSocket();
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
        sendScene();
        return;
      }

      if (message.type === 'listening') {
        setStatus('listening');
        return;
      }

      if (message.type === 'recognizing') {
        setStatus('recognizing');
        return;
      }

      if (message.type === 'recognized') {
        onRecognizedText(message.text);
        return;
      }

      if (message.type === 'command') {
        setStatus('listening');
        onCommand(message.response);
        return;
      }

      if (message.type === 'error') {
        setStatus('listening');
        setErrorMessage(message.text);
        onError(message.text);
      }
    };

    socket.onerror = () => {
      const message = '语音连接失败，请确认后端服务状态。';
      setErrorMessage(message);
      onError(message);
    };

    socket.onclose = () => {
      isSocketReadyRef.current = false;

      if (isClosingSocketRef.current) {
        isClosingSocketRef.current = false;
        return;
      }

      if (isActiveRef.current) {
        window.setTimeout(() => {
          if (isActiveRef.current) {
            startSocket();
          }
        }, 500);
      }
    };

    socketRef.current = socket;
  }

  function handleAudioFrame(input: Float32Array) {
    const socket = socketRef.current;

    if (
      !isActiveRef.current ||
      !isSocketReadyRef.current ||
      socket?.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    const pcm = encodePcm16(downsample(input, inputSampleRateRef.current, TARGET_SAMPLE_RATE));
    socket.send(pcm);
  }

  function sendScene() {
    const socket = socketRef.current;

    if (!isSocketReadyRef.current || socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify({
      type: 'scene',
      scene: sceneRef.current,
      threadId: threadIdRef.current,
    }));
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

function parseSocketMessage(data: string): SpeechSocketMessage | null {
  try {
    return JSON.parse(data) as SpeechSocketMessage;
  } catch {
    return null;
  }
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
