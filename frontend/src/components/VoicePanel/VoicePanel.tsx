import './VoicePanel.css';

export function VoicePanel() {
  return (
    <section className="voice-panel" aria-labelledby="voice-panel-title">
      <h2 id="voice-panel-title">语音控制</h2>
      <div className="voice-panel__placeholder">
        <div className="voice-panel__mic" aria-hidden="true" />
        <p>语音输入区域</p>
      </div>
      <div className="voice-panel__section">
        <h3>识别文本</h3>
        <p className="voice-panel__box">等待后续 PR 接入识别结果。</p>
      </div>
      <div className="voice-panel__section">
        <h3>AI 回复</h3>
        <p className="voice-panel__box">等待后续 PR 接入回复内容。</p>
      </div>
    </section>
  );
}
