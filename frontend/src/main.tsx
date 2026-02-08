import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Debug: Log to confirm main.tsx is loading
console.log('🚀 main.tsx loaded');

// Temporarily disable service worker to debug
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js')
//       .then((reg) => console.log('SW registered:', reg.scope))
//       .catch((err) => console.log('SW registration failed:', err));
//   });
// }

const rootElement = document.getElementById('root');
console.log('🎯 Root element:', rootElement);

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  console.log('✅ React mounted');
} else {
  console.error('❌ Root element not found!');
}
