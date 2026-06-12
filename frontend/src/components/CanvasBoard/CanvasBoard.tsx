import './CanvasBoard.css';

export function CanvasBoard() {
  return (
    <section className="canvas-board" aria-labelledby="canvas-board-title">
      <div className="canvas-board__header">
        <h2 id="canvas-board-title">画布区域</h2>
        <div className="canvas-board__tools" aria-label="画布工具占位">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="canvas-board__surface">
        <p>画布渲染区域</p>
      </div>
      <footer className="canvas-board__meta">
        <span>画布尺寸：800 x 600</span>
        <span>图形数量：0</span>
      </footer>
    </section>
  );
}
