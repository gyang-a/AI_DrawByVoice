import Konva from 'konva';
import { useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { Circle, Image as KonvaImage, Layer, Line, Path, Rect, Stage, Text } from 'react-konva';
import type {
  AnimationEasing,
  AnimationKeyframe,
  AnimationProperty,
  CanvasItem,
  ObjectAnimation,
  Shape,
  SvgCanvasItem,
} from '../../types/drawing';
import './CanvasBoard.css';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const DEFAULT_ANIMATION_DURATION = 600;
const WEBM_EXPORT_DURATION_MS = 5000;
const WEBM_EXPORT_FPS = 60;
const MIN_ANIMATION_DURATION = 120;
const MAX_LOOP_ANIMATION_DURATION = 12000;

function clampDurationMs(duration?: number): number {
  const resolvedDuration = duration ?? DEFAULT_ANIMATION_DURATION;

  return Math.min(Math.max(resolvedDuration, MIN_ANIMATION_DURATION), MAX_LOOP_ANIMATION_DURATION);
}

function easeProgress(progress: number, easing: AnimationEasing = 'easeOut'): number {
  switch (easing) {
    case 'linear':
      return progress;
    case 'easeIn':
      return progress * progress;
    case 'easeInOut':
      return progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    case 'easeOut':
    default:
      return 1 - Math.pow(1 - progress, 2);
  }
}

function normalizeKeyframes(keyframes: AnimationKeyframe[]): AnimationKeyframe[] {
  return keyframes
    .filter((keyframe) => Number.isFinite(keyframe.offset) && Number.isFinite(keyframe.value))
    .map((keyframe) => ({
      offset: Math.min(Math.max(keyframe.offset, 0), 1),
      value: keyframe.value,
    }))
    .sort((first, second) => first.offset - second.offset);
}

function interpolateKeyframes(keyframes: AnimationKeyframe[], progress: number): number | null {
  const normalizedKeyframes = normalizeKeyframes(keyframes);

  if (normalizedKeyframes.length === 0) {
    return null;
  }

  if (progress <= normalizedKeyframes[0].offset) {
    return normalizedKeyframes[0].value;
  }

  const lastKeyframe = normalizedKeyframes[normalizedKeyframes.length - 1];

  if (progress >= lastKeyframe.offset) {
    return lastKeyframe.value;
  }

  for (let index = 1; index < normalizedKeyframes.length; index += 1) {
    const previousKeyframe = normalizedKeyframes[index - 1];
    const nextKeyframe = normalizedKeyframes[index];

    if (progress <= nextKeyframe.offset) {
      const range = nextKeyframe.offset - previousKeyframe.offset;
      const localProgress = range === 0 ? 1 : (progress - previousKeyframe.offset) / range;

      return previousKeyframe.value + (nextKeyframe.value - previousKeyframe.value) * localProgress;
    }
  }

  return lastKeyframe.value;
}

function getNodeValue(node: Konva.Node, property: AnimationProperty): number {
  switch (property) {
    case 'x':
      return node.x();
    case 'y':
      return node.y();
    case 'opacity':
      return node.opacity();
    case 'rotation':
      return node.rotation();
    case 'scaleX':
      return node.scaleX();
    case 'scaleY':
      return node.scaleY();
    case 'width':
      return 'width' in node && typeof node.width === 'function' ? node.width() : 0;
    case 'height':
      return 'height' in node && typeof node.height === 'function' ? node.height() : 0;
    default: {
      const exhaustiveCheck: never = property;
      return exhaustiveCheck;
    }
  }
}

function setNodeValue(node: Konva.Node, property: AnimationProperty, value: number) {
  node.setAttr(property, value);
}

function configureTransformOrigin(node: Konva.Node, animation: ObjectAnimation) {
  const animatesTransform = animation.tracks.some((track) => (
    track.property === 'rotation' || track.property === 'scaleX' || track.property === 'scaleY'
  ));

  if (!animatesTransform || node instanceof Konva.Circle) {
    return null;
  }

  const originalAttrs = {
    offsetX: node.offsetX(),
    offsetY: node.offsetY(),
    x: node.x(),
    y: node.y(),
  };

  if (node instanceof Konva.Image || node instanceof Konva.Rect || node instanceof Konva.Text) {
    const centerX = node.width() / 2;
    const centerY = node.height() / 2;

    (node as Konva.Node).setAttrs({
      offsetX: centerX,
      offsetY: centerY,
      x: node.x() + centerX,
      y: node.y() + centerY,
    });

    return originalAttrs;
  }

  const rect = node.getClientRect({ skipTransform: true });
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  node.setAttrs({
    offsetX: centerX,
    offsetY: centerY,
    x: centerX,
    y: centerY,
  });

  return originalAttrs;
}

function useObjectAnimation<TNode extends Konva.Node>(
  animation: ObjectAnimation | null | undefined,
  trigger: unknown,
) {
  const nodeRef = useRef<TNode | null>(null);

  useEffect(() => {
    const node = nodeRef.current;

    if (!node || !animation) {
      return;
    }

    let animationFrameId = 0;
    let startTime = 0;
    const duration = clampDurationMs(animation.duration);
    const transformOriginAttrs = configureTransformOrigin(node, animation);
    const originalValues = Object.fromEntries(
      animation.tracks.map((track) => [track.property, getNodeValue(node, track.property)]),
    ) as Partial<Record<AnimationProperty, number>>;

    const tick = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const rawProgress = animation.loop ? (elapsed % duration) / duration : Math.min(elapsed / duration, 1);
      const progress = easeProgress(rawProgress, animation.easing);

      for (const track of animation.tracks) {
        const value = interpolateKeyframes(track.keyframes, progress);

        if (value !== null) {
          setNodeValue(node, track.property, value);
        }
      }

      node.getLayer()?.batchDraw();

      if (animation.loop || elapsed < duration) {
        animationFrameId = window.requestAnimationFrame(tick);
      }
    };

    const timeoutId = window.setTimeout(() => {
      animationFrameId = window.requestAnimationFrame(tick);
    }, animation.delay ?? 0);

    return () => {
      window.clearTimeout(timeoutId);
      window.cancelAnimationFrame(animationFrameId);
      node.setAttrs({
        ...originalValues,
        ...transformOriginAttrs,
      });
      node.getLayer()?.batchDraw();
    };
  }, [
    JSON.stringify(animation?.tracks),
    animation?.duration,
    animation?.delay,
    animation?.loop,
    animation?.easing,
    trigger,
  ]);

  return nodeRef;
}

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
  const imageRef = useObjectAnimation<Konva.Image>(shape.animation, image);

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
      ref={imageRef}
      image={image}
      x={shape.x}
      y={shape.y}
      width={shape.width}
      height={shape.height}
    />
  );
}

function ShapeNode({ shape }: { shape: Shape }) {
  const nodeRef = useObjectAnimation<Konva.Node>(shape.animation, shape.id);

  switch (shape.type) {
    case 'circle':
      return (
        <Circle
          key={shape.id}
          ref={nodeRef as Ref<Konva.Circle>}
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
          ref={nodeRef as Ref<Konva.Rect>}
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
          ref={nodeRef as Ref<Konva.Line>}
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
          ref={nodeRef as Ref<Konva.Text>}
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
          ref={nodeRef as Ref<Konva.Line>}
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
          ref={nodeRef as Ref<Konva.Path>}
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
    return <ShapeNode key={item.id} shape={item} />;
  }

  return <SvgImageShape key={item.id} shape={item} />;
}

type CanvasBoardProps = {
  shapes: CanvasItem[];
  lastSavedAt: string | null;
  onLoadWorkspace: () => void;
  onSaveWorkspace: () => void;
};

export function CanvasBoard({
  shapes,
  lastSavedAt,
  onLoadWorkspace,
  onSaveWorkspace,
}: CanvasBoardProps) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const [isExportingWebm, setIsExportingWebm] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  function downloadBlob(blob: Blob, extension: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    link.href = url;
    link.download = `voice-canvas-${timestamp}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function getStageCanvas(): HTMLCanvasElement | null {
    return stageRef.current?.container().querySelector('canvas') ?? null;
  }

  function exportPng() {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const dataUrl = stage.toDataURL({
      mimeType: 'image/png',
      pixelRatio: 2,
    });
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    link.href = dataUrl;
    link.download = `voice-canvas-${timestamp}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function exportWebm() {
    const canvas = getStageCanvas();

    if (!canvas || typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      setExportMessage('当前浏览器不支持 WebM 动画导出。');
      return;
    }

    const supportedMimeType = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));

    if (!supportedMimeType) {
      setExportMessage('当前浏览器不支持 WebM 编码。');
      return;
    }

    const stream = canvas.captureStream(WEBM_EXPORT_FPS);
    const recorder = new MediaRecorder(stream, { mimeType: supportedMimeType });
    const chunks: BlobPart[] = [];

    setIsExportingWebm(true);
    setExportMessage('正在录制 5 秒 WebM 动画。');

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      setIsExportingWebm(false);
      setExportMessage('WebM 动画已导出。');

      if (chunks.length === 0) {
        setExportMessage('WebM 动画导出失败。');
        return;
      }

      downloadBlob(new Blob(chunks, { type: supportedMimeType }), 'webm');
    };

    recorder.onerror = () => {
      stream.getTracks().forEach((track) => track.stop());
      setIsExportingWebm(false);
      setExportMessage('WebM 动画导出失败。');
    };

    recorder.start();
    window.setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, WEBM_EXPORT_DURATION_MS);
  }

  return (
    <section className="canvas-board" aria-labelledby="canvas-board-title">
      <div className="canvas-board__header">
        <h2 id="canvas-board-title">画布区域</h2>
        <div className="canvas-board__tools" aria-label="作品工具">
          <button type="button" onClick={onSaveWorkspace}>
            保存
          </button>
          <button type="button" onClick={onLoadWorkspace}>
            加载
          </button>
          <button type="button" onClick={exportPng}>
            导出 PNG
          </button>
          <button type="button" disabled={isExportingWebm} onClick={exportWebm}>
            {isExportingWebm ? '录制中' : '导出 WebM'}
          </button>
        </div>
      </div>
      <div className="canvas-board__surface">
        <Stage
          ref={stageRef}
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
        <span>
          {lastSavedAt ? `保存时间：${new Date(lastSavedAt).toLocaleString()}` : '尚未保存'}
        </span>
        {exportMessage ? <span>{exportMessage}</span> : null}
      </footer>
    </section>
  );
}
