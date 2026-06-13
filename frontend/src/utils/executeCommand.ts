import type {
  CanvasItem,
  DrawingCommand,
  ExecutableDrawingCommand,
  ShapeId,
  ShapePatch,
} from '../types/drawing';

const MAX_BATCH_DEPTH = 4;

function compactShapePatch(params: ShapePatch): ShapePatch {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== null && value !== undefined),
  ) as ShapePatch;
}

function updateShape(
  shapes: CanvasItem[],
  targetId: ShapeId,
  params: ShapePatch,
): CanvasItem[] {
  return shapes.map((shape) => {
    if (shape.id !== targetId) {
      return shape;
    }

    const nextParams = compactShapePatch(params);

    return {
      ...shape,
      ...nextParams,
      id: shape.id,
      ...('type' in shape ? { type: shape.type } : { kind: shape.kind }),
    } as CanvasItem;
  });
}

export function executeCommand(
  shapes: CanvasItem[],
  command: ExecutableDrawingCommand,
  batchDepth = 0,
): CanvasItem[] {
  switch (command.action) {
    case 'drawShape':
      return [...shapes, command.shape];

    case 'drawSvg':
      return [
        ...shapes,
        {
          id: command.id ?? crypto.randomUUID(),
          kind: 'svg',
          svg: command.svg,
          x: command.x,
          y: command.y,
          width: command.width,
          height: command.height,
        },
      ];

    case 'updateShape':
      return updateShape(shapes, command.targetId, command.params);

    case 'deleteShape':
      return shapes.filter((shape) => shape.id !== command.targetId);

    case 'clearCanvas':
      return [];

    case 'batch':
      if (batchDepth >= MAX_BATCH_DEPTH) {
        return shapes;
      }

      return command.commands.reduce(
        (currentShapes, subCommand) => executeCommand(currentShapes, subCommand, batchDepth + 1),
        shapes,
      );

    default: {
      const exhaustiveCheck: never = command;
      return shapes;
    }
  }
}

export function isExecutableCommand(
  command: DrawingCommand,
): command is ExecutableDrawingCommand {
  return command.action !== 'undo';
}
