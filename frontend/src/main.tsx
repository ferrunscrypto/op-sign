import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WalletConnectProvider } from '@btc-vision/walletconnect';
import './index.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
    <StrictMode>
        <WalletConnectProvider theme="dark">
            <App />
        </WalletConnectProvider>
    </StrictMode>,
);
