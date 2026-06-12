import { useMemo, useRef, useState } from 'react';
import { CanvasBoard } from './components/CanvasBoard/CanvasBoard';
import { CommandPanel } from './components/CommandPanel/CommandPanel';
import { Header } from './components/Header/Header';
import { MainLayout } from './components/MainLayout/MainLayout';
import { VoicePanel } from './components/VoicePanel/VoicePanel';
import type { DrawingCommand, ExecutableDrawingCommand, Shape } from './types/drawing';
import { executeCommand, isExecutableCommand } from './utils/executeCommand';
import './App.css';

type TestCommand = {
  label: string;
  text: string;
  reply: string;
  createCommand: (id: string) => DrawingCommand;
};

const createTestCommands = (): TestCommand[] => [
  {
    label: '画红色圆形',
    text: '画一个红色的圆形',
    reply: '好的，已为你画一个红色的圆形。',
    createCommand: (id) => ({
      action: 'drawShape',
      shape: {
        id,
        type: 'circle',
        x: 400,
        y: 300,
        radius: 100,
        fill: '#ef233c',
        stroke: '#111827',
        strokeWidth: 3,
      },
    }),
  },
  {
    label: '画蓝色矩形',
    text: '画一个蓝色的矩形',
    reply: '好的，已为你画一个蓝色的矩形。',
    createCommand: (id) => ({
      action: 'drawShape',
      shape: {
        id,
        type: 'rect',
        x: 96,
        y: 96,
        width: 180,
        height: 112,
        fill: '#3b82f6',
        stroke: '#1d4ed8',
        strokeWidth: 2,
      },
    }),
  },
  {
    label: '撤销',
    text: '撤销上一步',
    reply: '已撤销上一步操作。',
    createCommand: () => ({
      action: 'undo',
    }),
  },
  {
    label: '清空画布',
    text: '清空画布',
    reply: '画布已清空。',
    createCommand: () => ({
      action: 'clearCanvas',
    }),
  },
];

function App() {
  const testCommands = useMemo(createTestCommands, []);
  const shapeSequence = useRef(0);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [history, setHistory] = useState<Shape[][]>([]);
  const [currentText, setCurrentText] = useState('点击快捷指令测试绘图命令。');
  const [currentReply, setCurrentReply] = useState('等待测试指令。');
  const [currentCommand, setCurrentCommand] = useState<DrawingCommand | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);

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

  function applyTestCommand(testCommand: TestCommand) {
    shapeSequence.current += 1;
    const command = testCommand.createCommand(`shape_test_${shapeSequence.current}`);

    setCurrentText(testCommand.text);
    setCurrentReply(testCommand.reply);
    setCurrentCommand(command);
    setCommandHistory((previousHistory) => [testCommand.text, ...previousHistory].slice(0, 5));

    if (isExecutableCommand(command)) {
      applyExecutableCommand(command);
      return;
    }

    undo();
  }

  return (
    <MainLayout
      header={<Header />}
      voicePanel={
        <VoicePanel
          commands={testCommands}
          currentText={currentText}
          currentReply={currentReply}
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
