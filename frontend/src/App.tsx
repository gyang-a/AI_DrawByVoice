import { useEffect, useMemo, useState } from 'react';
import { CanvasBoard } from './components/CanvasBoard/CanvasBoard';
import { CommandPanel } from './components/CommandPanel/CommandPanel';
import { Header } from './components/Header/Header';
import { MainLayout } from './components/MainLayout/MainLayout';
import { VoicePanel } from './components/VoicePanel/VoicePanel';
import { useStreamingSpeechRecognition } from './hooks/useStreamingSpeechRecognition';
import { parseCommand } from './services/commandApi';
import type { CanvasItem, CommandResponse, DrawingCommand, ExecutableDrawingCommand } from './types/drawing';
import { executeCommand, isClearHistoryCommand, isExecutableCommand } from './utils/executeCommand';
import {
  loadDraftWorkspaceSnapshot,
  loadSavedWorkspaceSnapshot,
  saveDraftWorkspaceSnapshot,
  saveSavedWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from './utils/workspaceStorage';
import './App.css';

type TestCommand = {
  label: string;
  text: string;
};

type DrawingState = {
  shapes: CanvasItem[];
  history: CanvasItem[][];
};

const createTestCommands = (): TestCommand[] => [
  {
    label: '画红色圆形',
    text: '画一个红色的圆形',
  },
  {
    label: '画蓝色矩形',
    text: '画一个蓝色的矩形',
  },
  {
    label: '画红色爱心',
    text: '画一个红色的爱心',
  },
  {
    label: '撤销',
    text: '撤销上一步',
  },
  {
    label: '清空画布',
    text: '清空画布',
  },
];

const DEFAULT_CURRENT_TEXT = '点击快捷指令测试绘图命令。';
const DEFAULT_CURRENT_REPLY = '等待测试指令。';

function App() {
  const testCommands = useMemo(createTestCommands, []);
  const commandThreadId = useMemo(() => crypto.randomUUID(), []);
  const initialWorkspaceSnapshot = useMemo(
    () => loadDraftWorkspaceSnapshot() ?? loadSavedWorkspaceSnapshot(),
    [],
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(initialWorkspaceSnapshot?.savedAt ?? null);
  const [drawingState, setDrawingState] = useState<DrawingState>(() => (
    initialWorkspaceSnapshot?.drawingState ?? {
      shapes: [],
      history: [],
    }
  ));
  const shapes = drawingState.shapes;
  const [currentText, setCurrentText] = useState(() => (
    initialWorkspaceSnapshot?.currentText ?? DEFAULT_CURRENT_TEXT
  ));
  const [currentReply, setCurrentReply] = useState(() => (
    initialWorkspaceSnapshot?.currentReply ?? DEFAULT_CURRENT_REPLY
  ));
  const [currentCommand, setCurrentCommand] = useState<DrawingCommand | null>(() => (
    initialWorkspaceSnapshot?.currentCommand ?? null
  ));
  const [commandHistory, setCommandHistory] = useState<string[]>(() => (
    initialWorkspaceSnapshot?.commandHistory ?? []
  ));
  const [isParsingCommand, setIsParsingCommand] = useState(false);
  const speechRecognition = useStreamingSpeechRecognition({
    scene: shapes,
    threadId: commandThreadId,
    onRecognizedText: (text) => {
      setCurrentText(text);
      setCurrentReply('正在解析指令。');
    },
    onCommand: applyCommandResponse,
    onError: (message) => {
      setCurrentReply(message);
    },
  });

  useEffect(() => {
    const snapshot = persistDraftWorkspace();
    setLastSavedAt(snapshot.savedAt);
  }, [drawingState, commandHistory, currentText, currentReply, currentCommand]);

  function createWorkspacePayload(): Omit<WorkspaceSnapshot, 'version' | 'savedAt'> {
    return {
      drawingState,
      commandHistory,
      currentText,
      currentReply,
      currentCommand,
    };
  }

  function persistDraftWorkspace(): WorkspaceSnapshot {
    return saveDraftWorkspaceSnapshot(createWorkspacePayload());
  }

  function saveWorkspace() {
    const snapshot = saveSavedWorkspaceSnapshot(createWorkspacePayload());
    saveDraftWorkspaceSnapshot(createWorkspacePayload());
    setLastSavedAt(snapshot.savedAt);
    setCurrentReply('作品已保存到本地。');
  }

  function loadWorkspace() {
    const snapshot = loadSavedWorkspaceSnapshot();

    if (!snapshot) {
      setCurrentReply('本地还没有手动保存的作品。');
      return;
    }

    setDrawingState(snapshot.drawingState);
    setCommandHistory(snapshot.commandHistory);
    setCurrentText(snapshot.currentText);
    setCurrentReply('作品已从本地加载。');
    setCurrentCommand(snapshot.currentCommand);
    setLastSavedAt(snapshot.savedAt);
  }

  function applyExecutableCommand(command: ExecutableDrawingCommand) {
    setDrawingState((previousState) => ({
      shapes: executeCommand(previousState.shapes, command),
      history: [...previousState.history, previousState.shapes],
    }));
  }

  function clearHistoryAndScene() {
    setDrawingState({
      shapes: [],
      history: [],
    });
    setCommandHistory([]);
  }

  function undo() {
    setDrawingState((previousState) => {
      const previousShapes = previousState.history.at(-1);

      if (!previousShapes) {
        return previousState;
      }

      return {
        shapes: previousShapes,
        history: previousState.history.slice(0, -1),
      };
    });
  }

  function applyDrawingCommand(command: DrawingCommand) {
    if (isClearHistoryCommand(command)) {
      clearHistoryAndScene();
      return;
    }

    if (isExecutableCommand(command)) {
      applyExecutableCommand(command);
      return;
    }

    undo();
  }

  async function submitTextCommand(text: string) {
    setCurrentText(text);
    setCurrentReply('正在解析指令。');
    setCurrentCommand(null);
    setIsParsingCommand(true);
    setCommandHistory((previousHistory) => [text, ...previousHistory]);

    try {
      const response = await parseCommand({
        text,
        scene: shapes,
        threadId: commandThreadId,
      });

      setCurrentText(response.recognizedText ?? text);
      setCurrentReply(response.reply);
      setCurrentCommand(response.command);

      applyDrawingCommand(response.command);
    } catch {
      setCurrentReply('指令解析失败，请确认后端服务已启动。');
    } finally {
      setIsParsingCommand(false);
    }
  }

  async function applyTestCommand(testCommand: TestCommand) {
    await submitTextCommand(testCommand.text);
  }

  function applyCommandResponse(response: CommandResponse) {
    const recognizedText = response.recognizedText ?? currentText;

    setCurrentText(recognizedText);
    setCurrentReply(response.reply);
    setCurrentCommand(response.command);
    setCommandHistory((previousHistory) => [recognizedText, ...previousHistory]);

    applyDrawingCommand(response.command);
  }

  async function toggleVoiceInput() {
    if (speechRecognition.status === 'idle') {
      setCurrentReply('正在实时监听，说完后会自动识别。');
      await speechRecognition.startListening();
      return;
    }

    speechRecognition.stopListening();
    setCurrentReply('已关闭实时语音监听。');
  }

  return (
    <MainLayout
      header={<Header />}
      voicePanel={
        <VoicePanel
          commands={testCommands}
          currentText={currentText}
          currentReply={currentReply}
          isLoading={isParsingCommand}
          isRecording={speechRecognition.status === 'listening'}
          isRecognizing={speechRecognition.status === 'connecting' || speechRecognition.status === 'recognizing'}
          canRecord={speechRecognition.isSupported}
          recorderError={speechRecognition.errorMessage}
          onVoiceToggle={toggleVoiceInput}
          onCommandSelect={applyTestCommand}
        />
      }
      canvasBoard={(
        <CanvasBoard
          shapes={shapes}
          lastSavedAt={lastSavedAt}
          onLoadWorkspace={loadWorkspace}
          onSaveWorkspace={saveWorkspace}
        />
      )}
      commandPanel={
        <CommandPanel
          currentText={currentText}
          currentCommand={currentCommand}
          historyItems={commandHistory}
        />
      }
    />
  );
}

export default App;
