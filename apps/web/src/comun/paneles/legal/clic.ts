import type { MouseEvent as ReactMouseEvent } from 'react';

/** Clic normal: el aviso se abre encima. Ctrl/cmd o botón central siguen el enlace. */
export function keepAppOnLegalClick(event: ReactMouseEvent<HTMLAnchorElement>): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  event.preventDefault();
  return true;
}
