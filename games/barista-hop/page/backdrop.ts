/** A permanently lost context must not reinstall a renderer whose initialization was already in flight. */
export function attachBackdrop<T extends { dispose(): void }>(
  canvas: EventTarget,
  open: () => Promise<T>,
  show: (renderer: T | null) => void,
  failed: (error: unknown) => void,
) {
  let closed = false;
  let mounted: T | null = null;
  const close = () => {
    if (closed) return;
    closed = true;
    canvas.removeEventListener('webglcontextlost', close);
    mounted?.dispose();
    mounted = null;
    show(null);
  };
  canvas.addEventListener('webglcontextlost', close, { once: true });
  void open().then(renderer => {
    if (closed) renderer.dispose();
    else {
      mounted = renderer;
      show(renderer);
    }
  }).catch(error => { if (!closed) failed(error); });
  return close;
}
