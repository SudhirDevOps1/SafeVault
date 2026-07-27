import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Set Chrome extension popup dimensions dynamically
if (typeof window !== 'undefined' && (window as any).chrome && (window as any).chrome.runtime && (window as any).chrome.runtime.id) {
  const style = document.createElement('style');
  style.innerHTML = `
    html {
      width: 380px !important;
      height: 550px !important;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    body {
      width: 380px !important;
      height: 550px !important;
      margin: 0;
      padding: 0;
      overflow-y: auto !important;
      overflow-x: hidden !important;
    }
    body::-webkit-scrollbar {
      display: none;
    }
  `;
  document.head.appendChild(style);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
