import 'maplibre-gl/dist/maplibre-gl.css'
import '#web/styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '#web/app.tsx'

const root = document.getElementById('root')
if (root === null) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
