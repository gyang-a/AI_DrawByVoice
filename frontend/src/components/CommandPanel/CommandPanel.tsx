import type { DrawingCommand } from '../../types/drawing';
import './CommandPanel.css';

type CommandPanelProps = {
  currentText: string;
  currentCommand: DrawingCommand | null;
  historyItems: string[];
};

export function CommandPanel({
  currentText,
  currentCommand,
  historyItems,
}: CommandPanelProps) {
  return (
    <section className="command-panel" aria-labelledby="command-panel-title">
      <h2 id="command-panel-title">操作记录</h2>
      <div className="command-panel__section">
        <h3>当前指令</h3>
        <p className="command-panel__box">{currentText}</p>
      </div>
      <div className="command-panel__section">
        <h3>AI 返回的命令（JSON）</h3>
        <pre className="command-panel__json" aria-label="AI 返回命令示例">
          {currentCommand ? JSON.stringify(currentCommand, null, 2) : '等待测试指令。'}
        </pre>
      </div>
      <div className="command-panel__section">
        <h3>历史记录</h3>
        <ol className="command-panel__history">
          {historyItems.length > 0 ? (
            historyItems.map((item, index) => (
              <li key={`${item}_${index}`}>
                <span>{index + 1}</span>
                <p>{item}</p>
              </li>
            ))
          ) : (
            <li>
              <span>0</span>
              <p>暂无历史记录</p>
            </li>
          )}
        </ol>
      </div>
    </section>
  );
}
