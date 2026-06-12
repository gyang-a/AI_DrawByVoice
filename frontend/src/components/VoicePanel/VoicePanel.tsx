import './VoicePanel.css';

export function VoicePanel() {
  const quickCommands = ['画红色圆形', '画蓝色矩形', '撤销', '清空画布'];

  return (
    <section className="voice-panel" aria-labelledby="voice-panel-title">
      <h2 id="voice-panel-title">语音控制</h2>
      <div className="voice-panel__placeholder">
        <button className="voice-panel__mic" type="button" aria-label="开始语音输入">
          🎙
        </button>
        <p>点击开始说话</p>
      </div>
      <div className="voice-panel__section">
        <h3>识别文本</h3>
        <p className="voice-panel__box">画一个红色的圆形</p>
      </div>
      <div className="voice-panel__section">
        <h3>AI 回复</h3>
        <p className="voice-panel__box voice-panel__box--reply">
          好的，已为你画一个红色的圆形。
        </p>
      </div>
      <div className="voice-panel__section">
        <h3>快捷指令（测试用）</h3>
        <div className="voice-panel__quick-actions" aria-label="快捷指令占位">
          {quickCommands.map((command) => (
            <button key={command} type="button">
              {command}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
