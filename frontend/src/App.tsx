import { CanvasBoard } from './components/CanvasBoard/CanvasBoard';
import { CommandPanel } from './components/CommandPanel/CommandPanel';
import { Header } from './components/Header/Header';
import { MainLayout } from './components/MainLayout/MainLayout';
import { VoicePanel } from './components/VoicePanel/VoicePanel';
import './App.css';

function App() {
  return (
    <MainLayout
      header={<Header />}
      voicePanel={<VoicePanel />}
      canvasBoard={<CanvasBoard />}
      commandPanel={<CommandPanel />}
    />
  );
}

export default App;
