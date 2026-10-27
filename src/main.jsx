// src/main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { db } from './db/localDb';

db.init(); // ← obrigatório

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);