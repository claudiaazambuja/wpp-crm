import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Portfolio from './Portfolio.jsx';
import './styles.css';
const portfolio = new URLSearchParams(window.location.search).get('view') === 'portfolio';
if (portfolio) document.title = 'Próxima · Seu cuidado, sempre por perto';
createRoot(document.getElementById('root')).render(<React.StrictMode>{portfolio ? <Portfolio /> : <App />}</React.StrictMode>);
