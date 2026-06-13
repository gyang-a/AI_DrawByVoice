import type {
  CanvasItem,
  DrawingCommand,
  ExecutableDrawingCommand,
  ShapeId,
  ShapePatch,
} from '../types/drawing';

function updateShape(
  shapes: CanvasItem[],
  targetId: ShapeId,
  params: ShapePatch,
): CanvasItem[] {
  return shapes.map((shape) => {
    if (shape.id !== targetId) {
      return shape;
    }

    return {
      ...shape,
      ...params,
      id: shape.id,
      ...('type' in shape ? { type: shape.type } : { kind: shape.kind }),
    } as CanvasItem;
  });
}

export function executeCommand(
  shapes: CanvasItem[],
  command: ExecutableDrawingCommand,
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
      return command.commands.reduce(
        (currentShapes, subCommand) => executeCommand(currentShapes, subCommand),
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
