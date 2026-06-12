import { Circle, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type { Shape } from '../../types/drawing';
import './CanvasBoard.css';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const previewShapes: Shape[] = [
  {
    id: 'shape_preview_circle',
    type: 'circle',
    x: 400,
    y: 300,
    radius: 100,
    fill: '#ef233c',
    stroke: '#111827',
    strokeWidth: 3,
  },
  {
    id: 'shape_preview_rect',
    type: 'rect',
    x: 84,
    y: 72,
    width: 180,
    height: 112,
    fill: '#3b82f6',
    stroke: '#1d4ed8',
    strokeWidth: 2,
  },
  {
    id: 'shape_preview_line',
    type: 'line',
    points: [560, 130, 700, 220, 620, 280],
    stroke: '#12b886',
    strokeWidth: 5,
  },
  {
    id: 'shape_preview_text',
    type: 'text',
    x: 96,
    y: 490,
    text: 'VoiceCanvas',
    fontSize: 32,
    fill: '#182033',
  },
  {
    id: 'shape_preview_polygon',
    type: 'polygon',
    points: [610, 430, 690, 470, 660, 550, 560, 545, 535, 465],
    fill: '#ffd43b',
    stroke: '#f08c00',
    strokeWidth: 2,
  },
];

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
  }
}

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
        <Stage
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="canvas-board__stage"
        >
          <Layer>{previewShapes.map(renderShape)}</Layer>
        </Stage>
      </div>
      <footer className="canvas-board__meta">
        <span>
          画布尺寸：{CANVAS_WIDTH} x {CANVAS_HEIGHT}
        </span>
        <span>图形数量：{previewShapes.length}</span>
      </footer>
    </section>
  );
}
