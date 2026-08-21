const {
  app,
  BrowserWindow,
  dialog,
  shell,
  utilityProcess,
} = require('electron')

const fs = require('node:fs')
const http = require('node:http')
const https = require('node:https')
const path = require('node:path')

const WEB_PORT = 5173
const WEB_HOST = '127.0.0.1'
const RELEASE_API =
  'https://api.github.com/repos/frosstbiite/fuego-overlay/releases/latest'

let controlWindow = null
let splashWindow = null
let webServer = null
let telemetryProcess = null

const singleInstanceLock = app.requestSingleInstanceLock()

if (!singleInstanceLock) app.quit()

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

  splashWindow.loadFile(path.join(app.getAppPath(), 'electron', 'splash.html'))
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

function normalizeVersion(version) {
  return String(version || '')
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
}

function isNewerVersion(latest, current) {
  const latestParts = normalizeVersion(latest)
  const currentParts = normalizeVersion(current)
  const length = Math.max(latestParts.length, currentParts.length)

  for (let index = 0; index < length; index += 1) {
    const latestPart = latestParts[index] || 0
    const currentPart = currentParts[index] || 0
    if (latestPart > currentPart) return true
    if (latestPart < currentPart) return false
  }
  return false
}

function getLatestRelease() {
  return new Promise((resolve) => {
    const request = https.get(
      RELEASE_API,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `Fuego-Overlay/${app.getVersion()}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => { body += chunk })
        response.on('end', () => {
          if (response.statusCode !== 200) {
            resolve(null)
            return
          }

          try {
            const release = JSON.parse(body)
            resolve({
              version: release.tag_name,
              url: release.html_url,
            })
          } catch {
            resolve(null)
          }
        })
      },
    )

    request.setTimeout(3000, () => request.destroy())
    request.on('error', () => resolve(null))
  })
}

async function showUpdateAvailable(release) {
  const result = await dialog.showMessageBox(controlWindow, {
    type: 'info',
    title: 'Fuego Overlay Update Available',
    message: `Fuego Overlay ${release.version} is available.`,
    detail: `You are currently running v${app.getVersion()}. Would you like to open the Fuego Overlay Releases page?`,
    buttons: ['Download Update', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  })

  if (result.response === 0 && release.url) {
    await shell.openExternal(release.url)
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
    webServer.listen(WEB_PORT, WEB_HOST, () => resolve())
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

  controlWindow.loadURL(`http://${WEB_HOST}:${WEB_PORT}/?view=control`)
  controlWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  controlWindow.on('closed', () => { controlWindow = null })
}

async function revealControlWindow(finalStatus, finalDetail) {
  if (!controlWindow || controlWindow.isDestroyed()) return
  await updateSplash(100, finalStatus, finalDetail)

  // Keep the finished splash on screen long enough to serve as branding.
  await new Promise((resolve) => setTimeout(resolve, 5000))

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
      await updateSplash(28, 'Starting telemetry...', 'Connecting Fuego telemetry service')
      startTelemetryService()

      await updateSplash(48, 'Starting overlay server...', `Preparing ${WEB_HOST}:${WEB_PORT}`)
      await startWebServer()
    } else {
      await updateSplash(48, 'Development mode...', 'Using external Vite and telemetry services')
    }

    await updateSplash(68, 'Loading driver profiles...', 'Preparing Driver Profile')
    createControlWindow()
    await new Promise((resolve) => {
      controlWindow?.webContents.once('did-finish-load', resolve)
    })

    await updateSplash(82, 'Checking for updates...', `Installed version v${app.getVersion()}`)
    const latestRelease = await getLatestRelease()
    const availableUpdate =
      latestRelease && isNewerVersion(latestRelease.version, app.getVersion())
        ? latestRelease
        : null

    let updateStatus = `UP TO DATE — v${app.getVersion()}`
    let updateDetail = 'Fuego Overlay is current'

    if (!latestRelease) {
      updateStatus = 'UPDATE CHECK UNAVAILABLE'
      updateDetail = 'Fuego Overlay will continue normally'
    } else if (availableUpdate) {
      updateStatus = `UPDATE AVAILABLE — ${availableUpdate.version}`
      updateDetail = 'A newer Fuego Overlay release is available'
    }

    await updateSplash(94, 'Preparing overlays...', 'Loading driver and ticker views')
    await revealControlWindow(updateStatus, updateDetail)

    if (availableUpdate) {
      setTimeout(() => {
        showUpdateAvailable(availableUpdate).catch((error) => {
          console.error('Could not show update notification:', error)
        })
      }, 500)
    }
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
