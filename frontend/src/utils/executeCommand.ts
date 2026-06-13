import type {
  CanvasItem,
  ClearHistoryCommand,
  DrawingCommand,
  ExecutableDrawingCommand,
  ShapeId,
  ShapePatch,
  SvgPart,
} from '../types/drawing';

const MAX_BATCH_DEPTH = 4;

function compactShapePatch(params: ShapePatch): ShapePatch {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== null && value !== undefined),
  ) as ShapePatch;
}

function buildSvgFromParts(parts: SvgPart[], width: number, height: number, viewBox?: string): string {
  const resolvedViewBox = viewBox ?? `0 0 ${width} ${height}`;
  const content = parts.map((part) => part.svg).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${resolvedViewBox}">\n${content}\n</svg>`;
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

function updateSvgPart(
  shapes: CanvasItem[],
  targetId: ShapeId,
  partName: string,
  svg: string,
): CanvasItem[] {
  return shapes.map((shape) => {
    if (shape.id !== targetId || !('kind' in shape) || shape.kind !== 'svg' || !shape.parts?.length) {
      return shape;
    }

    let hasMatchedPart = false;
    const nextParts = shape.parts.map((part) => {
      if (part.part !== partName) {
        return part;
      }

      hasMatchedPart = true;
      return {
        ...part,
        svg,
      };
    });

    if (!hasMatchedPart) {
      return shape;
    }

    return {
      ...shape,
      parts: nextParts,
      svg: buildSvgFromParts(nextParts, shape.width, shape.height, shape.viewBox),
    };
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
      if (!command.svg && !command.parts?.length) {
        return shapes;
      }

      return [
        ...shapes,
        {
          id: command.id ?? crypto.randomUUID(),
          kind: 'svg',
          svg: command.svg ?? buildSvgFromParts(command.parts ?? [], command.width, command.height, command.viewBox),
          viewBox: command.viewBox,
          parts: command.parts,
          x: command.x,
          y: command.y,
          width: command.width,
          height: command.height,
        },
      ];

    case 'updateShape':
      return updateShape(shapes, command.targetId, command.params);

    case 'updateSvgPart':
      return updateSvgPart(shapes, command.targetId, command.part, command.svg);

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
  return command.action !== 'undo' && command.action !== 'clearHistory';
}

export function isClearHistoryCommand(
  command: DrawingCommand,
): command is ClearHistoryCommand {
  return command.action === 'clearHistory';
}
