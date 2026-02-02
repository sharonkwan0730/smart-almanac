// index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// 💡 加入這行，解決 index.css 404 報錯
import './index.css'; 

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
