import type {
  DrawingCommand,
  ExecutableDrawingCommand,
  Shape,
  ShapeId,
  ShapePatch,
} from '../types/drawing';

function updateShape(
  shapes: Shape[],
  targetId: ShapeId,
  params: ShapePatch,
): Shape[] {
  return shapes.map((shape) => {
    if (shape.id !== targetId) {
      return shape;
    }

    return {
      ...shape,
      ...params,
      id: shape.id,
      type: shape.type,
    } as Shape;
  });
}

export function executeCommand(
  shapes: Shape[],
  command: ExecutableDrawingCommand,
): Shape[] {
  switch (command.action) {
    case 'drawShape':
      return [...shapes, command.shape];

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