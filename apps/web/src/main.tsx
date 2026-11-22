import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app';
import { ahorraDatos } from './comun/fondo';
import '@fontsource/manrope/200.css';
import '@fontsource/manrope/300.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import './app/app.css';

function arrancarMotor() {
  if (ahorraDatos()) return;
  try {
    const prueba = document.createElement('canvas');
    const gl = prueba.getContext('webgl2') ?? prueba.getContext('webgl');
    if (!gl) return;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    return;
  }
  void import('./comun/frasco-3d/motor');
  const mascara = new Image();
  mascara.src = '/frasco/jar-mask.webp';
}

arrancarMotor();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
