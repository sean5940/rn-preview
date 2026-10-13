import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

const root = document.getElementById('root');
if (root === null) throw new Error('Could not find #root');

createRoot(root).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
