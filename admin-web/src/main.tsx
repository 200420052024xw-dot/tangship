import React from 'react';import ReactDOM from 'react-dom/client';import App from './App';import './styles.css';import './operations.css';
window.addEventListener('admin-session-expired',()=>{location.hash='/login';location.reload()});
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
