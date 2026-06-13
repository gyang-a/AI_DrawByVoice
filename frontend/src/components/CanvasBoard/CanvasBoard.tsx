import { useEffect, useState } from 'react';
import { Circle, Image as KonvaImage, Layer, Line, Path, Rect, Stage, Text } from 'react-konva';
import type { CanvasItem, Shape, SvgCanvasItem } from '../../types/drawing';
import './CanvasBoard.css';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

function sanitizeSvgMarkup(svg: string): string | null {
  const parser = new DOMParser();
  const document = parser.parseFromString(svg, 'image/svg+xml');

  if (document.querySelector('parsererror')) {
    return null;
  }

  const forbiddenTags = new Set(['script', 'iframe', 'object', 'embed', 'foreignobject']);
  const elements = Array.from(document.querySelectorAll('*'));

  for (const element of elements) {
    if (forbiddenTags.has(element.tagName.toLowerCase())) {
      element.remove();
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith('on')) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  const root = document.documentElement;

  if (root.tagName.toLowerCase() !== 'svg') {
    return null;
  }

  if (!root.getAttribute('xmlns')) {
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  return new XMLSerializer().serializeToString(root);
}

function SvgImageShape({ shape }: { shape: SvgCanvasItem }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const sanitizedSvg = sanitizeSvgMarkup(shape.svg);

    if (!sanitizedSvg) {
      setImage(null);
      return;
    }

    const blob = new Blob([sanitizedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const nextImage = new window.Image();

    nextImage.onload = () => {
      setImage(nextImage);
    };
    nextImage.onerror = () => {
      setImage(null);
    };
    nextImage.src = url;

    return () => {
      nextImage.onload = null;
      nextImage.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [shape.svg]);

  if (!image) {
    return null;
  }

  return (
    <KonvaImage
      image={image}
      x={shape.x}
      y={shape.y}
      width={shape.width}
      height={shape.height}
    />
  );
}

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

function renderCanvasItem(item: CanvasItem) {
  if ('type' in item) {
    return renderShape(item);
  }

  return <SvgImageShape key={item.id} shape={item} />;
}

type CanvasBoardProps = {
  shapes: CanvasItem[];
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
          <Layer>{shapes.map(renderCanvasItem)}</Layer>
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
