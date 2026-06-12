import './Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header__brand" aria-label="VoiceCanvas">
        <div className="header__mark" aria-hidden="true">
          <span />
        </div>
        <div>
          <p className="header__name">VoiceCanvas</p>
          <p className="header__subtitle">AI 语音绘图工具</p>
        </div>
      </div>
      <div className="header__actions">
        <div className="header__status" aria-label="当前状态">
          <span className="header__status-dot" aria-hidden="true" />
          <span>就绪 - 说话开始绘图</span>
        </div>
        <div className="header__voice-toggle" aria-label="语音反馈状态">
          <span>语音反馈：开</span>
          <span className="header__switch" aria-hidden="true" />
        </div>
        <button className="header__icon-button" type="button" aria-label="设置">
          ⚙
        </button>
      </div>
    </header>
  );
}
