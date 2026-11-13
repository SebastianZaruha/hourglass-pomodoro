import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { instalarPruebas } from './pruebas';
import '@fontsource/manrope/latin-200.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import './estilo/tokens.css';
import './styles.css';
import './estilo/vidrio.css';

instalarPruebas();
document.documentElement.classList.add('pagina');
document.body.classList.add('pagina');

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
