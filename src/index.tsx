import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import './styles/shared-components.css';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 