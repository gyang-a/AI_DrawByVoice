import { useMemo, useState } from 'react';
import { CanvasBoard } from './components/CanvasBoard/CanvasBoard';
import { CommandPanel } from './components/CommandPanel/CommandPanel';
import { Header } from './components/Header/Header';
import { MainLayout } from './components/MainLayout/MainLayout';
import { VoicePanel } from './components/VoicePanel/VoicePanel';
import { useStreamingSpeechRecognition } from './hooks/useStreamingSpeechRecognition';
import { parseCommand } from './services/commandApi';
import type { DrawingCommand, ExecutableDrawingCommand, Shape } from './types/drawing';
import { executeCommand, isExecutableCommand } from './utils/executeCommand';
import './App.css';

type TestCommand = {
  label: string;
  text: string;
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

function App() {
  const testCommands = useMemo(createTestCommands, []);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [history, setHistory] = useState<Shape[][]>([]);
  const [currentText, setCurrentText] = useState('点击快捷指令测试绘图命令。');
  const [currentReply, setCurrentReply] = useState('等待测试指令。');
  const [currentCommand, setCurrentCommand] = useState<DrawingCommand | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [isParsingCommand, setIsParsingCommand] = useState(false);
  const speechRecognition = useStreamingSpeechRecognition({
    onPartialText: (text) => {
      setCurrentText(text);
      setCurrentReply('正在听你说话。');
    },
    onFinalText: (text) => {
      void submitTextCommand(text);
    },
    onError: (message) => {
      setCurrentReply(message);
    },
  });

  function applyExecutableCommand(command: ExecutableDrawingCommand) {
    setHistory((previousHistory) => [...previousHistory, shapes]);
    setShapes((previousShapes) => executeCommand(previousShapes, command));
  }

  function undo() {
    const previousShapes = history.at(-1);

    if (!previousShapes) {
      return;
    }

    setShapes(previousShapes);
    setHistory((previousHistory) => previousHistory.slice(0, -1));
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
      });

      setCurrentText(response.recognizedText ?? text);
      setCurrentReply(response.reply);
      setCurrentCommand(response.command);

      if (isExecutableCommand(response.command)) {
        applyExecutableCommand(response.command);
        return;
      }

      undo();
    } catch {
      setCurrentReply('指令解析失败，请确认后端服务已启动。');
    } finally {
      setIsParsingCommand(false);
    }
  }

  async function applyTestCommand(testCommand: TestCommand) {
    await submitTextCommand(testCommand.text);
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
      canvasBoard={<CanvasBoard shapes={shapes} />}
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
