import { Circle, Layer, Line, Path, Rect, Stage, Text } from 'react-konva';
import type { Shape } from '../../types/drawing';
import './CanvasBoard.css';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

function renderShape(shape: Shape) {
  switch (shape.type) {
    case 'circle':
      return (
        <Circle
          key={shape.id}
          x={shape.x}
          y={shape.y}
          radius={shape.radius}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
        />
      );

    case 'rect':
      return (
        <Rect
          key={shape.id}
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
        />
      );

    case 'line':
      return (
        <Line
          key={shape.id}
          points={shape.points}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          closed={false}
        />
      );

    case 'text':
      return (
        <Text
          key={shape.id}
          x={shape.x}
          y={shape.y}
          text={shape.text}
          fontSize={shape.fontSize}
          fill={shape.fill}
        />
      );

    case 'polygon':
      return (
        <Line
          key={shape.id}
          points={shape.points}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          closed
        />
      );

    case 'path':
      return (
        <Path
          key={shape.id}
          data={shape.data}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
        />
      );
  }
}

type CanvasBoardProps = {
  shapes: Shape[];
};

export function CanvasBoard({ shapes }: CanvasBoardProps) {
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
        <Stage
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="canvas-board__stage"
        >
          <Layer>{shapes.map(renderShape)}</Layer>
        </Stage>
      </div>
      <footer className="canvas-board__meta">
        <span>
          画布尺寸：{CANVAS_WIDTH} x {CANVAS_HEIGHT}
        </span>
        <span>图形数量：{shapes.length}</span>
      </footer>
    </section>
  );
}
