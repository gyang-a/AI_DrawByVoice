import type { CanvasItem, DrawingCommand } from '../types/drawing';

const DRAFT_WORKSPACE_STORAGE_KEY = 'voice-canvas.workspace.draft.v1';
const SAVED_WORKSPACE_STORAGE_KEY = 'voice-canvas.workspace.saved.v1';

export type DrawingStateSnapshot = {
  shapes: CanvasItem[];
  history: CanvasItem[][];
};

export type WorkspaceSnapshot = {
  version: 1;
  savedAt: string;
  drawingState: DrawingStateSnapshot;
  commandHistory: string[];
  currentText: string;
  currentReply: string;
  currentCommand: DrawingCommand | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWorkspaceSnapshot(value: unknown): value is WorkspaceSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  const drawingState = value.drawingState;

  return (
    value.version === 1
    && typeof value.savedAt === 'string'
    && isRecord(drawingState)
    && Array.isArray(drawingState.shapes)
    && Array.isArray(drawingState.history)
    && Array.isArray(value.commandHistory)
    && value.commandHistory.every((item) => typeof item === 'string')
    && typeof value.currentText === 'string'
    && typeof value.currentReply === 'string'
    && (value.currentCommand === null || isRecord(value.currentCommand))
  );
}

function loadWorkspaceSnapshotFromKey(key: string): WorkspaceSnapshot | null {
  try {
    const rawSnapshot = window.localStorage.getItem(key);

    if (!rawSnapshot) {
      return null;
    }

    const snapshot: unknown = JSON.parse(rawSnapshot);

    if (!isWorkspaceSnapshot(snapshot)) {
      return null;
    }

    return snapshot;
  } catch {
    return null;
  }
}

function saveWorkspaceSnapshotToKey(
  key: string,
  snapshot: Omit<WorkspaceSnapshot, 'version' | 'savedAt'>,
): WorkspaceSnapshot {
  const nextSnapshot: WorkspaceSnapshot = {
    version: 1,
    savedAt: new Date().toISOString(),
    ...snapshot,
  };

  window.localStorage.setItem(key, JSON.stringify(nextSnapshot));

  return nextSnapshot;
}

export function loadDraftWorkspaceSnapshot(): WorkspaceSnapshot | null {
  return loadWorkspaceSnapshotFromKey(DRAFT_WORKSPACE_STORAGE_KEY);
}

export function loadSavedWorkspaceSnapshot(): WorkspaceSnapshot | null {
  return loadWorkspaceSnapshotFromKey(SAVED_WORKSPACE_STORAGE_KEY);
}

export function saveDraftWorkspaceSnapshot(
  snapshot: Omit<WorkspaceSnapshot, 'version' | 'savedAt'>,
): WorkspaceSnapshot {
  return saveWorkspaceSnapshotToKey(DRAFT_WORKSPACE_STORAGE_KEY, snapshot);
}

export function saveSavedWorkspaceSnapshot(
  snapshot: Omit<WorkspaceSnapshot, 'version' | 'savedAt'>,
): WorkspaceSnapshot {
  return saveWorkspaceSnapshotToKey(SAVED_WORKSPACE_STORAGE_KEY, snapshot);
}
