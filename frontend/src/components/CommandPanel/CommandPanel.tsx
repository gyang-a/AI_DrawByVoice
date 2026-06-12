import './CommandPanel.css';

export function CommandPanel() {
  const historyItems = [
    '画一个红色的圆形',
    '把它改成蓝色',
    '画一个蓝色的矩形',
  ];

  return (
    <section className="command-panel" aria-labelledby="command-panel-title">
      <h2 id="command-panel-title">操作记录</h2>
      <div className="command-panel__section">
        <h3>当前指令</h3>
        <p className="command-panel__box">画一个红色的圆形</p>
      </div>
      <div className="command-panel__section">
        <h3>AI 返回的命令（JSON）</h3>
        <pre className="command-panel__json" aria-label="AI 返回命令示例">
{`{
  "action": "drawShape",
  "params": {
    "type": "circle",
    "x": 400,
    "y": 300,
    "radius": 100,
    "fill": "red"
  }
}`}
        </pre>
      </div>
      <div className="command-panel__section">
        <h3>历史记录</h3>
        <ol className="command-panel__history">
          {historyItems.map((item, index) => (
            <li key={item}>
              <span>{index + 1}</span>
              <p>{item}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
