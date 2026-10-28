import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "./App"
import { LocaleProvider } from "./i18n/LocaleProvider"
import { listenForBeforeInstallPrompt } from "./pwa/beforeInstallPrompt"
import "./index.css"

// Chromium fires this once, before React mounts; capturing it here is what lets
// the install card trigger the native prompt later.
listenForBeforeInstallPrompt(window)

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Root element #root was not found in index.html")
}

createRoot(rootElement).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
)
