/**
 * Arranque en Android/iOS: registramos el componente raíz directamente.
 * (En web hace falta cargar antes CanvasKit; ver bootstrap.web.ts.)
 */
import { registerRootComponent } from 'expo';

import App from './App';
import { installBackKeepsRunning } from './background/backKeepsRunning';
import './consent/restore';

// Antes que ningún componente (ver backKeepsRunning.ts).
// `restore` vuelve a aplicar el consentimiento de Firebase en cuanto arranca el JS.
installBackKeepsRunning();
registerRootComponent(App);
