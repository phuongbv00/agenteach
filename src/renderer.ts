import 'electron-log/renderer'; // forwards console.* to main-process log file
import './renderer/assets/index.css';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import App from './renderer/App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(createElement(App));
}
