export type ShapeType = 'circle' | 'rect' | 'line' | 'text' | 'polygon' | 'path';

export type ShapeId = string;

export type AnimationProperty =
  | 'x'
  | 'y'
  | 'opacity'
  | 'rotation'
  | 'scaleX'
  | 'scaleY'
  | 'width'
  | 'height';

export type AnimationEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export type AnimationKeyframe = {
  offset: number;
  value: number;
};

export type AnimationTrack = {
  property: AnimationProperty;
  keyframes: AnimationKeyframe[];
};

export type ObjectAnimation = {
  duration?: number;
  delay?: number;
  loop?: boolean;
  easing?: AnimationEasing;
  tracks: AnimationTrack[];
};

export type CanvasState = {
  width: number;
  height: number;
  background: string;
  shapes: CanvasItem[];
};

export type BaseShape = {
  id: ShapeId;
  type: ShapeType;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  animation?: ObjectAnimation;
};

export type CircleShape = BaseShape & {
  type: 'circle';
  x: number;
  y: number;
  radius: number;
};

export type RectShape = BaseShape & {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LineShape = BaseShape & {
  type: 'line';
  points: number[];
};

export type TextShape = BaseShape & {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize?: number;
};

export type PolygonShape = BaseShape & {
  type: 'polygon';
  points: number[];
};

export type PathShape = BaseShape & {
  type: 'path';
  data: string;
};

export type SvgPart = {
  part: string;
  svg: string;
};

export type SvgCanvasItem = {
  id: ShapeId;
  kind: 'svg';
  svg: string;
  viewBox?: string;
  parts?: SvgPart[];
  animation?: ObjectAnimation;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Shape =
  | CircleShape
  | RectShape
  | LineShape
  | TextShape
  | PolygonShape
  | PathShape;

export type CanvasItem = Shape | SvgCanvasItem;

export type ShapePatch = Partial<{
  x: number;
  y: number;
  radius: number;
  width: number;
  height: number;
  points: number[];
  data: string;
  text: string;
  fontSize: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  animation: ObjectAnimation;
}>;

export type DrawShapeCommand = {
  action: 'drawShape';
  shape: Shape;
};

export type DrawSvgCommand = {
  action: 'drawSvg';
  id?: ShapeId;
  svg?: string;
  viewBox?: string;
  parts?: SvgPart[];
  animation?: ObjectAnimation;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type UpdateShapeCommand = {
  action: 'updateShape';
  targetId: ShapeId;
  params: ShapePatch;
};

export type UpdateSvgPartCommand = {
  action: 'updateSvgPart';
  targetId: ShapeId;
  part: string;
  svg: string;
};

export type DeleteShapeCommand = {
  action: 'deleteShape';
  targetId: ShapeId;
};

export type ClearCanvasCommand = {
  action: 'clearCanvas';
};

export type ClearHistoryCommand = {
  action: 'clearHistory';
};

export type BatchCommand = {
  action: 'batch';
  commands: ExecutableDrawingCommand[];
};

export type ExecutableDrawingCommand =
  | DrawShapeCommand
  | DrawSvgCommand
  | UpdateShapeCommand
  | UpdateSvgPartCommand
  | DeleteShapeCommand
  | ClearCanvasCommand
  | BatchCommand;

export type UndoCommand = {
  action: 'undo';
};

export type DrawingCommand =
  | ExecutableDrawingCommand
  | UndoCommand
  | ClearHistoryCommand;

export type CommandResponse = {
  command: DrawingCommand;
  reply: string;
  recognizedText?: string;
};
