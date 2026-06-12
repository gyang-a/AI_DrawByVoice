import './CanvasBoard.css';

export function CanvasBoard() {
  return (
    <section className="canvas-board" aria-labelledby="canvas-board-title">
      <div className="canvas-board__header">
        <h2 id="canvas-board-title">画布区域</h2>
        <div className="canvas-board__tools" aria-label="画布工具占位">
          <button type="button" aria-label="缩小">
            −
          </button>
          <button type="button" aria-label="放大">
            +
          </button>
          <button type="button" aria-label="全屏">
            ⛶
          </button>
        </div>
      </div>
      <div className="canvas-board__surface">
        <div className="canvas-board__sample-shape" aria-label="静态圆形示例" />
      </div>
      <footer className="canvas-board__meta">
        <span>画布尺寸：800 x 600</span>
        <span>图形数量：1</span>
      </footer>
    </section>
  );
}
