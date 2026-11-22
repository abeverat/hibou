import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { api } from './api';
import './styles.css';

// Le style « verre » translucide s'appuie sur le matériau natif de macOS (voir main/index.ts).
document.documentElement.dataset.plateforme = api.plateforme;

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
