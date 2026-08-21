const {
  app,
  BrowserWindow,
  dialog,
  shell,
  utilityProcess,
} = require('electron')

const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const WEB_PORT = 5173
const WEB_HOST = '127.0.0.1'

let controlWindow = null
let splashWindow = null
let webServer = null
let telemetryProcess = null

const singleInstanceLock = app.requestSingleInstanceLock()

if (!singleInstanceLock) {
  app.quit()
}

app.on('second-instance', () => {
  if (!controlWindow) return
  if (controlWindow.isMinimized()) controlWindow.restore()
  controlWindow.show()
  controlWindow.focus()
})

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  }
  return mimeTypes[extension] || 'application/octet-stream'
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 900,
    height: 675,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    center: true,
    backgroundColor: '#020712',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  splashWindow.loadFile(
    path.join(app.getAppPath(), 'electron', 'splash.html'),
  )

  splashWindow.once('ready-to-show', () => splashWindow?.show())
  splashWindow.on('closed', () => { splashWindow = null })
}

async function updateSplash(progress, status, detail = '') {
  if (!splashWindow || splashWindow.isDestroyed()) return

  try {
    await splashWindow.webContents.executeJavaScript(
      `window.updateSplash?.(${JSON.stringify({ progress, status, detail })})`,
      true,
    )
  } catch {
    // Splash may still be loading or closing.
  }
}

function startWebServer() {
  return new Promise((resolve, reject) => {
    const webRoot = path.join(app.getAppPath(), 'dist')

    webServer = http.createServer((request, response) => {
      try {
        const requestUrl = new URL(
          request.url || '/',
          `http://${WEB_HOST}:${WEB_PORT}`,
        )

        let requestedPath = decodeURIComponent(requestUrl.pathname)
        if (requestedPath === '/') requestedPath = '/index.html'
        requestedPath = requestedPath.replace(/^[/\\]+/, '')

        let filePath = path.resolve(webRoot, requestedPath)
        if (!filePath.startsWith(path.resolve(webRoot))) {
          response.writeHead(403)
          response.end('Forbidden')
          return
        }

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(webRoot, 'index.html')
        }

        response.writeHead(200, {
          'Content-Type': getMimeType(filePath),
          'Cache-Control': 'no-cache',
        })
        response.end(fs.readFileSync(filePath))
      } catch (error) {
        console.error('Web-server request failed:', error)
        response.writeHead(500)
        response.end('Fuego Overlay server error')
      }
    })

    webServer.once('error', reject)
    webServer.listen(WEB_PORT, WEB_HOST, () => {
      console.log(
        `Fuego Overlay web server listening on http://${WEB_HOST}:${WEB_PORT}`,
      )
      resolve()
    })
  })
}

function startTelemetryService() {
  const telemetryPath = path.join(
    app.getAppPath(),
    'dist-server',
    'telemetry.cjs',
  )

  telemetryProcess = utilityProcess.fork(telemetryPath, [], {
    serviceName: 'Fuego Overlay Telemetry',
  })

  telemetryProcess.on('spawn', () => {
    console.log('Fuego Overlay telemetry service started')
  })

  telemetryProcess.on('exit', (code) => {
    console.log(`Telemetry service exited with code ${code}`)
    telemetryProcess = null
  })
}

function stopBackgroundServices() {
  if (telemetryProcess) {
    telemetryProcess.kill()
    telemetryProcess = null
  }

  if (webServer) {
    webServer.close()
    webServer = null
  }
}

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'Fuego Overlay Control',
    backgroundColor: '#0b0f19',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  controlWindow.loadURL(
    `http://${WEB_HOST}:${WEB_PORT}/?view=control`,
  )

  controlWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  controlWindow.on('closed', () => { controlWindow = null })
}

async function revealControlWindow() {
  if (!controlWindow || controlWindow.isDestroyed()) return

  await updateSplash(100, 'Ready', 'Fuego Overlay Management System')

  if (splashWindow && !splashWindow.isDestroyed()) {
    try {
      await splashWindow.webContents.executeJavaScript(
        'window.finishSplash?.()',
        true,
      )
    } catch {
      // Splash may already be closing.
    }
  }

  setTimeout(() => {
    controlWindow?.show()
    controlWindow?.focus()
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close()
  }, 360)
}

app.whenReady().then(async () => {
  try {
    createSplashWindow()

    await new Promise((resolve) => {
      splashWindow?.webContents.once('did-finish-load', resolve)
    })

    await updateSplash(12, 'Initializing...', 'Fuego Software')

    if (app.isPackaged) {
      await updateSplash(
        30,
        'Starting telemetry...',
        'Connecting Fuego telemetry service',
      )
      startTelemetryService()

      await updateSplash(
        52,
        'Starting overlay server...',
        `Preparing ${WEB_HOST}:${WEB_PORT}`,
      )
      await startWebServer()
    } else {
      await updateSplash(
        52,
        'Development mode...',
        'Using external Vite and telemetry services',
      )
    }

    await updateSplash(
      76,
      'Loading driver profiles...',
      'Preparing Race Control',
    )

    createControlWindow()

    await new Promise((resolve) => {
      controlWindow?.webContents.once('did-finish-load', resolve)
    })

    await updateSplash(
      92,
      'Preparing overlays...',
      'Loading driver and ticker views',
    )

    await revealControlWindow()
  } catch (error) {
    console.error('Could not start Fuego Overlay:', error)

    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close()

    dialog.showErrorBox(
      'Fuego Overlay could not start',
      'Port 5173 may already be in use. Close any old Fuego Overlay or Vite windows, then try again.',
    )

    stopBackgroundServices()
    app.quit()
  }
})

app.on('before-quit', () => {
  stopBackgroundServices()
})

app.on('window-all-closed', () => {
  app.quit()
})
