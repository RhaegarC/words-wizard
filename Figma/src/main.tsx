import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const manifest = document.createElement('link')
manifest.rel = 'manifest'
manifest.href = '/manifest.webmanifest'
document.head.appendChild(manifest)

const theme = document.createElement('meta')
theme.name = 'theme-color'
theme.content = '#126147'
document.head.appendChild(theme)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
