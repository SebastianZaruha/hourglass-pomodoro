import { useCallback, useEffect, useState } from 'react';

import { readLandscapePauseHintSeen, writeLandscapePauseHintSeen } from './landscapePauseHintStore';

/**
 * Pista única al entrar en la pausa de lado (reloj difuminado). No bloquea el
 * temporizador; se cierra con un toque.
 */
export function useLandscapePauseHint(active: boolean) {
  const [loaded, setLoaded] = useState(false);
  const [seen, setSeen] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    readLandscapePauseHintSeen().then((stored) => {
      if (!alive) return;
      setSeen(stored);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded || seen || !active) return;
    setOpen(true);
  }, [active, loaded, seen]);

  useEffect(() => {
    if (active || !open) return;
    setOpen(false);
  }, [active, open]);

  const dismiss = useCallback(() => {
    setOpen(false);
    setSeen(true);
    void writeLandscapePauseHintSeen();
  }, []);

  return { visible: open && active, dismiss };
}
