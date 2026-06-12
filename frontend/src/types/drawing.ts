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
  x?: number;
  y?: number;
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

export type Shape = CircleShape | RectShape | LineShape | TextShape | PolygonShape;

export type CircleShapeDraft = Omit<CircleShape, 'id'> & { id?: ShapeId };
export type RectShapeDraft = Omit<RectShape, 'id'> & { id?: ShapeId };
export type LineShapeDraft = Omit<LineShape, 'id'> & { id?: ShapeId };
export type TextShapeDraft = Omit<TextShape, 'id'> & { id?: ShapeId };
export type PolygonShapeDraft = Omit<PolygonShape, 'id'> & { id?: ShapeId };

export type ShapeDraft =
  | CircleShapeDraft
  | RectShapeDraft
  | LineShapeDraft
  | TextShapeDraft
  | PolygonShapeDraft;

export type ShapePatch =
  | Partial<Omit<CircleShape, 'id' | 'type'>>
  | Partial<Omit<RectShape, 'id' | 'type'>>
  | Partial<Omit<LineShape, 'id' | 'type'>>
  | Partial<Omit<TextShape, 'id' | 'type'>>
  | Partial<Omit<PolygonShape, 'id' | 'type'>>;

export type DrawShapeCommand = {
  action: 'drawShape';
  params: ShapeDraft;
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

export type UndoCommand = {
  action: 'undo';
};

export type BatchCommand = {
  action: 'batch';
  commands: DrawingCommand[];
};

export type DrawingCommand =
  | DrawShapeCommand
  | UpdateShapeCommand
  | DeleteShapeCommand
  | ClearCanvasCommand
  | UndoCommand
  | BatchCommand;

export type CommandResponse = {
  command: DrawingCommand;
  reply: string;
};
