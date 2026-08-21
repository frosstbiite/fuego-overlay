# Fuego Overlay

Fuego Overlay is a customizable Windows broadcast overlay for iRacing drivers and streamers. It combines live iRacing telemetry with a driver information card, scrolling race ticker, dynamic flag states, track map, sponsor branding, and reusable driver profiles.

## Features

- Live speed, RPM, gear, position, lap, and session data
- Green, yellow, white, checkered, and pacing graphic states
- Scrolling leaderboard ticker
- Dynamic oval track maps with live car markers
- Driver profiles with names, car numbers, colors, portraits, and sponsor logos
- Toggleable driver card, race ticker, track map, and sponsor panel
- Desktop control application built with Electron
- OBS Browser Source support
- Included Frost No. 21 demonstration profile

## Requirements

- Windows 10 or Windows 11, 64-bit
- iRacing installed on the telemetry computer
- OBS Studio for streaming use

## Installing

1. Download `Fuego-Overlay-Setup-1.0.0.exe` from the repository's Releases page.
2. Run the installer.
3. Open **Fuego Overlay** from the desktop shortcut or Start menu.
4. Start or join an iRacing session.
5. Select a driver profile in Race Control and click **Apply Profile**.

Unsigned Windows applications may display a SmartScreen warning. Review the publisher and file source before continuing.

## OBS browser sources

With Fuego Overlay running, add these as OBS Browser Sources:

- Driver overlay: `http://127.0.0.1:5173/`
- Race ticker: `http://127.0.0.1:5173/?view=ticker`

The control panel shows connection status and provides copy buttons for both URLs.

## Development

Install dependencies:

```powershell
npm.cmd install
```

Run the telemetry service, Vite development server, and Electron control panel:

```powershell
npm.cmd start
```

Build the web application and telemetry service:

```powershell
npm.cmd run build
```

Create the Windows installer:

```powershell
npm.cmd run dist
```

The installer is written to the `release` folder.

## Technology

- React
- TypeScript
- Vite
- Electron
- `irsdk-node`
- WebSockets

## Ownership

Copyright © 2026 Fuego AutoSport. All rights reserved.

This repository is source-available for inspection and personal use. It is not licensed for resale, rebranding, or commercial redistribution. Third-party names and marks remain the property of their respective owners.

