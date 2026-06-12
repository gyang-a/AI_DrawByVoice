import type { CommandResponse, Shape } from '../types/drawing';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

type ParseCommandRequest = {
  text: string;
  scene: Shape[];
};

export async function parseCommand(request: ParseCommandRequest): Promise<CommandResponse> {
  const response = await fetch(`${API_BASE_URL}/api/commands/parse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Parse command failed with status ${response.status}`);
  }

  return response.json() as Promise<CommandResponse>;
}
