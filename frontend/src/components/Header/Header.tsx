import './Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header__brand" aria-label="VoiceCanvas">
        <div className="header__mark" aria-hidden="true" />
        <div>
          <p className="header__name">VoiceCanvas</p>
          <p className="header__subtitle">AI 语音绘图工具</p>
        </div>
      </div>
      <div className="header__status" aria-label="当前状态">
        <span className="header__status-dot" aria-hidden="true" />
        <span>页面布局骨架</span>
      </div>
    </header>
  );
}
