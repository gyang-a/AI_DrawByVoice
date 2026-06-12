import { useRef, useState } from 'react';

const TARGET_SAMPLE_RATE = 16000;

type AudioContextWindow = {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

type RecorderStatus = 'idle' | 'recording';

type AudioRecorder = {
  status: RecorderStatus;
  errorMessage: string | null;
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
};

export function useAudioRecorder(): AudioRecorder {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef(TARGET_SAMPLE_RATE);

  const AudioContextClass = getAudioContextClass();
  const isSupported = Boolean(
    typeof navigator.mediaDevices?.getUserMedia === 'function' && AudioContextClass,
  );

  async function startRecording() {
    if (!isSupported || status === 'recording') {
      return;
    }

    if (!AudioContextClass) {
      setErrorMessage('当前浏览器不支持录音');
      return;
    }

    setErrorMessage(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      sampleRateRef.current = audioContext.sampleRate;
      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        const channel = event.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(channel));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;
      setStatus('recording');
    } catch {
      setErrorMessage('无法访问麦克风，请检查浏览器权限。');
      stopStream();
    }
  }

  async function stopRecording() {
    if (status !== 'recording') {
      return null;
    }

    const samples = mergeSamples(chunksRef.current);
    const wavBlob = encodeWavBlob(
      downsample(samples, sampleRateRef.current, TARGET_SAMPLE_RATE),
      TARGET_SAMPLE_RATE,
    );

    stopStream();
    setStatus('idle');

    return wavBlob;
  }

  function stopStream() {
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
    startRecording,
    stopRecording,
  };
}

function getAudioContextClass() {
  const audioWindow = window as unknown as AudioContextWindow;
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
}

function mergeSamples(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Float32Array(length);
  let offset = 0;

  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });

  return result;
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

function encodeWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeText(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeText(view, 8, 'WAVE');
  writeText(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeText(view, 36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = headerSize;
  samples.forEach((sample) => {
    const clampedSample = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff, true);
    offset += bytesPerSample;
  });

  return new Blob([view], { type: 'audio/wav' });
}

function writeText(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}
