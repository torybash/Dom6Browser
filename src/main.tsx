import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import './styles/index.css';
import { installStatTips } from './ui/statTip';

installStatTips();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
