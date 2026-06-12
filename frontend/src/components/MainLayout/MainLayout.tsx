import './MainLayout.css';

type MainLayoutProps = {
  header: React.ReactNode;
  voicePanel: React.ReactNode;
  canvasBoard: React.ReactNode;
  commandPanel: React.ReactNode;
};

export function MainLayout({
  header,
  voicePanel,
  canvasBoard,
  commandPanel,
}: MainLayoutProps) {
  return (
    <div className="main-layout">
      <div className="main-layout__header">{header}</div>
      <main className="main-layout__content" aria-label="VoiceCanvas 工作区">
        <aside className="main-layout__side" aria-label="语音控制">
          {voicePanel}
        </aside>
        <section className="main-layout__canvas" aria-label="画布区域">
          {canvasBoard}
        </section>
        <aside className="main-layout__side" aria-label="操作记录">
          {commandPanel}
        </aside>
      </main>
    </div>
  );
}
