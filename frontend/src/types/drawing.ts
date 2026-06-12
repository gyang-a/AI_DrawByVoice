export type ShapeType = 'circle' | 'rect' | 'line' | 'text' | 'polygon';

export type ShapeId = string;

export type CanvasState = {
  width: number;
  height: number;
  background: string;
  shapes: Shape[];
};

export type BaseShape = {
  id: ShapeId;
  type: ShapeType;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
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

export type Shape =
  | CircleShape
  | RectShape
  | LineShape
  | TextShape
  | PolygonShape;

export type ShapePatch = Partial<{
  x: number;
  y: number;
  radius: number;
  width: number;
  height: number;
  points: number[];
  text: string;
  fontSize: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}>;

export type DrawShapeCommand = {
  action: 'drawShape';
  shape: Shape;
};

export type UpdateShapeCommand = {
  action: 'updateShape';
  targetId: ShapeId;
  params: ShapePatch;
};

export type DeleteShapeCommand = {
  action: 'deleteShape';
  targetId: ShapeId;
};

export type ClearCanvasCommand = {
  action: 'clearCanvas';
};

export type BatchCommand = {
  action: 'batch';
  commands: ExecutableDrawingCommand[];
};

export type ExecutableDrawingCommand =
  | DrawShapeCommand
  | UpdateShapeCommand
  | DeleteShapeCommand
  | ClearCanvasCommand
  | BatchCommand;

export type UndoCommand = {
  action: 'undo';
};

export type DrawingCommand =
  | ExecutableDrawingCommand
  | UndoCommand;

export type CommandResponse = {
  command: DrawingCommand;
  reply: string;
  recognizedText?: string;
};