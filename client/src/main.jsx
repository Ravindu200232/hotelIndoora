import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// The approved design system, ported from the prototype's own stylesheet so a
// page in the application and its page in the prototype are the same design.
import './styles/app.css';
import { App } from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
