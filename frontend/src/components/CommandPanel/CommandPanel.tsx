import './CommandPanel.css';

export function CommandPanel() {
  return (
    <section className="command-panel" aria-labelledby="command-panel-title">
      <h2 id="command-panel-title">操作记录</h2>
      <div className="command-panel__section">
        <h3>当前指令</h3>
        <p className="command-panel__box">等待后续 PR 接入用户指令。</p>
      </div>
      <div className="command-panel__section">
        <h3>命令结果</h3>
        <p className="command-panel__box command-panel__box--large">
          等待后续 PR 展示结构化命令。
        </p>
      </div>
      <div className="command-panel__section">
        <h3>历史记录</h3>
        <p className="command-panel__box">等待后续 PR 接入历史记录。</p>
      </div>
    </section>
  );
}
