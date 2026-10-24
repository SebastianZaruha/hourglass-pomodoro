/**
 * «Atrás» en la pantalla principal = salir SIN cerrar (1.8.6).
 *
 * La regla de Sebastián: salir con «atrás» (o el gesto de volver) es como
 * salir con el gesto de inicio: la cuenta sigue, con la notificación y la
 * ventana flotante, y al volver la app está tal cual. Lo de Android por
 * defecto depende de la versión y de cómo se abrió la app (en algunos casos
 * cierra la actividad y, al volver, se crea de nuevo). Así que lo decidimos
 * nosotros: la app se va al fondo (`moveTaskToBack`), sin cerrar nada.
 *
 * Se registra al cargar el módulo (en bootstrap.ts), ANTES que cualquier
 * otro: React Native llama primero al último registrado, así que el menú,
 * la información y las ayudas (que lo registran al abrirse) siguen
 * cerrándose con «atrás» como siempre; esto solo actúa si nadie más lo hizo.
 */
import { BackHandler, Platform } from 'react-native';

import { BackgroundTimer } from '../../modules/background-timer';

let installed = false;

export function installBackKeepsRunning(): void {
  if (installed || Platform.OS !== 'android') return;
  installed = true;
  BackHandler.addEventListener('hardwareBackPress', () => {
    // APK anteriores a la 1.8.6 no tienen moveToBack: lo de siempre.
    if (typeof BackgroundTimer?.moveToBack !== 'function') return false;
    try {
      return BackgroundTimer.moveToBack();
    } catch {
      return false;
    }
  });
}
