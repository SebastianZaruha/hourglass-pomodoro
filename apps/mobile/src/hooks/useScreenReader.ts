/**
 * Lector de pantalla (TalkBack / VoiceOver) y refresco para él (1.8.1).
 *
 * La pantalla ya no se re-renderiza 4 veces por segundo (el texto del tiempo
 * se refresca solo). Pero el valor accesible del reloj («quedan 12 minutos»)
 * sale del render de la pantalla: con el lector encendido y el tiempo
 * corriendo, `useRefreshWhile` la vuelve a pintar una vez por segundo para
 * que lo que se lee esté al día. Sin lector, no cuesta nada.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Estado del lector, a mano para `announce` (1.8.4). Se lee una vez al
 * arrancar y se sigue con un solo oyente para toda la app.
 */
let screenReaderOn = false;
AccessibilityInfo.isScreenReaderEnabled()
  .then((on) => {
    screenReaderOn = on;
  })
  .catch(() => {});
AccessibilityInfo.addEventListener('screenReaderChanged', (on: boolean) => {
  screenReaderOn = on;
});

/**
 * Aviso hablado para el lector de pantalla, SOLO si está encendido (1.8.4).
 * En Android, `announceForAccessibility` manda un evento al sistema de
 * accesibilidad aunque no haya lector: los Samsung traen servicios de
 * accesibilidad activos de serie y, en la 1.8.2, el aviso «Ajustes» al abrir
 * el menú coincidía con unos 2 s de retraso. Sin lector no sirve para nada.
 */
export function announce(text: string): void {
  if (screenReaderOn) AccessibilityInfo.announceForAccessibility(text);
}

/** ¿Está encendido el lector ahora mismo? (sin esperar a un render) */
export function isScreenReaderOn(): boolean {
  return screenReaderOn;
}

/** ¿Está encendido el lector de pantalla? Sigue los cambios en vivo. */
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => {
        if (alive) setEnabled(on);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return enabled;
}

/** Re-renderiza el componente cada `ms` mientras `active`. */
export function useRefreshWhile(active: boolean, ms: number): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [active, ms]);
}
