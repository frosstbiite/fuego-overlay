import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ExtraDriverWidgets from './ExtraDriverWidgets.tsx'
import RaceTicker from './RaceTicker.tsx'
import ControlPanel from './ControlPanel.tsx'
import './v111.css'

const parameters = new URLSearchParams(window.location.search)
const selectedView = parameters.get('view')

function DriverOverlay() {
  return (
    <>
      <App />
      <ExtraDriverWidgets />
    </>
  )
}

let Overlay = DriverOverlay
if (selectedView === 'ticker') Overlay = RaceTicker
if (selectedView === 'control') Overlay = ControlPanel

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Overlay />
  </StrictMode>,
)
