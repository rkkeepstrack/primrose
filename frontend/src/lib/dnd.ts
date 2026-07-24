// Drag & drop of tree items, as one shared vocabulary: a custom MIME type
// carrying the item's path (used by Tree rows and the sidebar root zone).

const PATH_MIME = 'application/x-primrose-path';

export function startPathDrag(e: DragEvent, path: string) {
  e.dataTransfer?.setData(PATH_MIME, path);
  e.dataTransfer!.effectAllowed = 'move';
}

export function carriesPath(e: DragEvent): boolean {
  return e.dataTransfer?.types.includes(PATH_MIME) ?? false;
}

// call from a dragover handler: accepts the drag and marks it as a move
export function acceptPathDrag(e: DragEvent) {
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
}

export function readPathDrag(e: DragEvent): string | null {
  return e.dataTransfer?.getData(PATH_MIME) || null;
}
