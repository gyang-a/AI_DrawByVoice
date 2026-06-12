const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

type SpeechRecognitionResponse = {
  text: string;
};

export async function recognizeSpeech(audio: Blob): Promise<SpeechRecognitionResponse> {
  const formData = new FormData();
  formData.append('audio', audio, 'voice-command.wav');

  const response = await fetch(`${API_BASE_URL}/api/speech/asr`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Recognize speech failed with status ${response.status}`);
  }

  return response.json() as Promise<SpeechRecognitionResponse>;
}
