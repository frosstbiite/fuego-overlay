const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  utilityProcess,
} = require('electron')

const crypto = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const https = require('node:https')
const path = require('node:path')
const { spawn } = require('node:child_process')

const WEB_PORT = 5173
const WEB_HOST = '127.0.0.1'
const UPDATE_POINTER_URL =
  'https://raw.githubusercontent.com/frosstbiite/fuego-overlay/main/updates/latest.json'
const RELEASES_URL =
  'https://github.com/frosstbiite/fuego-overlay/releases/latest'

let controlWindow = null
let splashWindow = null
let webServer = null
let telemetryProcess = null
let updateInProgress = false
let splashShownAt = 0

const singleInstanceLock = app.requestSingleInstanceLock()
if (!singleInstanceLock) app.quit()

app.on('second-instance', () => {
  if (!controlWindow) return
  if (controlWindow.isMinimized()) controlWindow.restore()
  controlWindow.show()
  controlWindow.focus()
})

function mime(filePath) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  })[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

function createSplashWindow() {
  splashShownAt = Date.now()
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
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  splashWindow.loadFile(path.join(app.getAppPath(), 'electron', 'splash.html'))
  splashWindow.once('ready-to-show', () => splashWindow?.show())
  splashWindow.on('closed', () => { splashWindow = null })
}

async function updateSplash(progress, status, detail = '') {
  if (!splashWindow || splashWindow.isDestroyed()) return
  try {
    await splashWindow.webContents.executeJavaScript(
      `window.updateSplash?.(${JSON.stringify({
        progress,
        status,
        detail,
        version: `v${app.getVersion()}`,
      })})`,
      true,
    )
  } catch {}
}

function versionParts(value) {
  return String(value || '').trim().replace(/^v/i, '').split('-')[0]
    .split('.').map((part) => Number.parseInt(part, 10) || 0)
}

function compareVersions(left, right) {
  const a = versionParts(left)
  const b = versionParts(right)
  const count = Math.max(a.length, b.length)
  for (let i = 0; i < count; i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return 1
    if ((a[i] || 0) < (b[i] || 0)) return -1
  }
  return 0
}

function requestBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) return reject(new Error('Too many update redirects.'))
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return reject(new Error('Fuego updates require HTTPS.'))

    const request = https.get(parsed, {
      headers: {
        Accept: 'application/json, application/octet-stream, */*',
        'User-Agent': `Fuego-Overlay/${app.getVersion()}`,
      },
    }, (response) => {
      const status = response.statusCode || 0
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume()
        const next = new URL(response.headers.location, parsed).toString()
        requestBuffer(next, redirects + 1).then(resolve).catch(reject)
        return
      }
      if (status !== 200) {
        response.resume()
        reject(new Error(`Update server returned HTTP ${status}.`))
        return
      }
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks)))
    })
    request.setTimeout(10000, () => request.destroy(new Error('Update request timed out.')))
    request.on('error', reject)
  })
}

async function requestJson(url) {
  return JSON.parse((await requestBuffer(url)).toString('utf8'))
}

function downloadFile(url, destination, progress, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) return reject(new Error('Too many patch redirects.'))
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return reject(new Error('Fuego updates require HTTPS.'))

    const request = https.get(parsed, {
      headers: { 'User-Agent': `Fuego-Overlay/${app.getVersion()}` },
    }, (response) => {
      const status = response.statusCode || 0
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume()
        const next = new URL(response.headers.location, parsed).toString()
        downloadFile(next, destination, progress, redirects + 1).then(resolve).catch(reject)
        return
      }
      if (status !== 200) {
        response.resume()
        reject(new Error(`Patch download returned HTTP ${status}.`))
        return
      }

      fs.mkdirSync(path.dirname(destination), { recursive: true })
      const output = fs.createWriteStream(destination)
      const total = Number(response.headers['content-length']) || 0
      let received = 0
      response.on('data', (chunk) => {
        received += chunk.length
        if (total && progress) progress(received / total)
      })
      response.pipe(output)
      output.on('finish', () => output.close(() => resolve(destination)))
      output.on('error', reject)
    })
    request.setTimeout(30000, () => request.destroy(new Error('Patch download timed out.')))
    request.on('error', reject)
  })
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const input = fs.createReadStream(filePath)
    input.on('data', (chunk) => hash.update(chunk))
    input.on('end', () => resolve(hash.digest('hex')))
    input.on('error', reject)
  })
}

function safeRelativePath(value) {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized || normalized.includes('\0') || normalized.split('/').includes('..')) {
    throw new Error(`Unsafe path in update manifest: ${value}`)
  }
  return normalized
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function runPowerShell(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', ...args,
    ], { windowsHide: true })
    let errorText = ''
    child.stderr?.on('data', (chunk) => { errorText += chunk.toString() })
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(errorText.trim() || `PowerShell exited with code ${code}.`)))
  })
}

async function latestUpdate() {
  const latest = await requestJson(UPDATE_POINTER_URL)
  if (!latest || typeof latest !== 'object' || !latest.version) {
    throw new Error('Invalid Fuego update metadata.')
  }
  return {
    version: String(latest.version),
    notes: String(latest.notes || ''),
    releaseUrl: String(latest.releaseUrl || RELEASES_URL),
    installerUrl: String(latest.installerUrl || latest.releaseUrl || RELEASES_URL),
    patchUrl: String(latest.patchUrl || ''),
    patchSha256: String(latest.patchSha256 || '').toLowerCase(),
    manifestUrl: String(latest.manifestUrl || ''),
    manifestSha256: String(latest.manifestSha256 || '').toLowerCase(),
    minimumUpdaterVersion: String(latest.minimumUpdaterVersion || '1.1.1'),
    requiresInstaller: Boolean(latest.requiresInstaller),
  }
}

async function updateState() {
  if (!app.isPackaged) return { status: 'development', currentVersion: app.getVersion(), latestVersion: app.getVersion() }
  const latest = await latestUpdate()
  const currentVersion = app.getVersion()
  if (compareVersions(latest.version, currentVersion) <= 0) {
    return { status: 'current', currentVersion, latestVersion: latest.version, latest }
  }
  if (
    latest.requiresInstaller ||
    compareVersions(currentVersion, latest.minimumUpdaterVersion) < 0 ||
    !latest.patchUrl || !latest.manifestUrl
  ) {
    return { status: 'installer-required', currentVersion, latestVersion: latest.version, latest }
  }
  return { status: 'available', currentVersion, latestVersion: latest.version, latest }
}

async function stagePatch(latest) {
  const root = path.join(app.getPath('userData'), 'updates', latest.version)
  const zip = path.join(root, 'patch.zip')
  const manifestFile = path.join(root, 'manifest.json')
  const staged = path.join(root, 'staged')
  fs.rmSync(root, { recursive: true, force: true })
  fs.mkdirSync(root, { recursive: true })

  await downloadFile(latest.manifestUrl, manifestFile, (p) => controlWindow?.setProgressBar(.05 + p * .05))
  const manifestHash = String(await sha256File(manifestFile)).toLowerCase()
  if (latest.manifestSha256 && manifestHash !== latest.manifestSha256) {
    throw new Error('The update manifest failed SHA-256 verification.')
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  if (String(manifest.version || '') !== latest.version || !Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error('The update manifest is invalid.')
  }

  await downloadFile(latest.patchUrl, zip, (p) => controlWindow?.setProgressBar(.1 + p * .65))
  const patchHash = String(await sha256File(zip)).toLowerCase()
  if (!latest.patchSha256 || patchHash !== latest.patchSha256) {
    throw new Error('The downloaded patch failed SHA-256 verification.')
  }

  fs.mkdirSync(staged, { recursive: true })
  await runPowerShell(['-Command', `$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath ${psQuote(zip)} -DestinationPath ${psQuote(staged)} -Force`])

  for (const file of manifest.files) {
    const relative = safeRelativePath(file.path)
    const source = path.join(staged, ...relative.split('/'))
    if (!fs.existsSync(source)) throw new Error(`Patch is missing ${relative}.`)
    const expected = String(file.sha256 || '').toLowerCase()
    if (!expected || String(await sha256File(source)).toLowerCase() !== expected) {
      throw new Error(`File verification failed for ${relative}.`)
    }
  }

  return { root, staged, manifest }
}

function createApplyScript(update) {
  const installRoot = path.dirname(process.execPath)
  const scriptPath = path.join(update.root, 'apply-update.ps1')
  const copies = update.manifest.files.map((file) => {
    const relative = safeRelativePath(file.path)
    const source = path.join(update.staged, ...relative.split('/'))
    const destination = path.join(installRoot, ...relative.split('/'))
    return `$source=${psQuote(source)}\r\n$destination=${psQuote(destination)}\r\nNew-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null\r\nCopy-Item -LiteralPath $source -Destination $destination -Force`
  }).join('\r\n\r\n')

  fs.writeFileSync(scriptPath, [
    '$ErrorActionPreference="Stop"',
    `$fuegoPid=${process.pid}`,
    'try { Wait-Process -Id $fuegoPid -Timeout 30 -ErrorAction SilentlyContinue } catch {}',
    'Start-Sleep -Milliseconds 600',
    copies,
    'Start-Sleep -Milliseconds 300',
    `Start-Process -FilePath ${psQuote(process.execPath)}`,
  ].join('\r\n\r\n'), 'utf8')
  return scriptPath
}

async function applyPatch(update) {
  const script = createApplyScript(update)
  const child = spawn('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
  ], { detached: true, windowsHide: true, stdio: 'ignore' })
  child.unref()
  updateInProgress = true
  app.quit()
}

async function offerUpdate(state) {
  if (state.status === 'development') {
    await dialog.showMessageBox(controlWindow, {
      type: 'info',
      title: 'Fuego Overlay Development Build',
      message: 'In-app patch updates are available in packaged Fuego builds.',
      detail: 'Use the normal source workflow while running Fuego from VS Code.',
      buttons: ['OK'],
    })
    return state
  }

  if (state.status === 'current') {
    await dialog.showMessageBox(controlWindow, {
      type: 'info', title: 'Fuego Overlay',
      message: `Fuego Overlay v${state.currentVersion} is up to date.`, buttons: ['OK'],
    })
    return state
  }

  if (state.status === 'installer-required') {
    const result = await dialog.showMessageBox(controlWindow, {
      type: 'info', title: 'Fuego Overlay Update',
      message: `Fuego Overlay v${state.latestVersion} requires a full installer.`,
      detail: state.latest?.notes || 'This update cannot be applied as a small patch.',
      buttons: ['Open Release', 'Later'], defaultId: 0, cancelId: 1,
    })
    if (result.response === 0) await shell.openExternal(state.latest?.installerUrl || RELEASES_URL)
    return state
  }

  if (state.status !== 'available') return state
  const choice = await dialog.showMessageBox(controlWindow, {
    type: 'info', title: 'Fuego Overlay Update Available',
    message: `Fuego Overlay v${state.latestVersion} is available.`,
    detail: `${state.latest?.notes || 'A Fuego patch is ready.'}\n\nInstalled: v${state.currentVersion}`,
    buttons: ['Install Update', 'View Release', 'Later'], defaultId: 0, cancelId: 2,
  })
  if (choice.response === 1) {
    await shell.openExternal(state.latest?.releaseUrl || RELEASES_URL)
    return state
  }
  if (choice.response !== 0 || updateInProgress) return state

  try {
    updateInProgress = true
    const staged = await stagePatch(state.latest)
    controlWindow?.setProgressBar(-1)
    const ready = await dialog.showMessageBox(controlWindow, {
      type: 'info', title: 'Fuego Update Ready',
      message: `Fuego Overlay v${state.latestVersion} is ready to install.`,
      detail: 'Fuego will close, apply the verified patch, and restart automatically.',
      buttons: ['Restart and Update', 'Cancel'], defaultId: 0, cancelId: 1,
    })
    if (ready.response === 0) await applyPatch(staged)
    else updateInProgress = false
  } catch (error) {
    updateInProgress = false
    controlWindow?.setProgressBar(-1)
    await dialog.showMessageBox(controlWindow, {
      type: 'error', title: 'Fuego Update Failed',
      message: 'Fuego could not safely apply this update.',
      detail: `${error?.message || error}\n\nYour installed files were not changed.`, buttons: ['OK'],
    })
  }
  return state
}

ipcMain.handle('fuego-updater:get-version', () => app.getVersion())
ipcMain.handle('fuego-updater:check', async () => {
  try {
    const state = await updateState()
    await offerUpdate(state)
    return state
  } catch (error) {
    await dialog.showMessageBox(controlWindow, {
      type: 'error', title: 'Update Check Unavailable',
      message: 'Fuego could not check GitHub for updates.', detail: error?.message || String(error), buttons: ['OK'],
    })
    return { status: 'error', currentVersion: app.getVersion(), message: error?.message || String(error) }
  }
})

function startWebServer() {
  return new Promise((resolve, reject) => {
    const webRoot = path.join(app.getAppPath(), 'dist')
    webServer = http.createServer((request, response) => {
      try {
        const url = new URL(request.url || '/', `http://${WEB_HOST}:${WEB_PORT}`)
        let requested = decodeURIComponent(url.pathname)
        if (requested === '/') requested = '/index.html'
        requested = requested.replace(/^[/\\]+/, '')
        let filePath = path.resolve(webRoot, requested)
        if (!filePath.startsWith(path.resolve(webRoot))) {
          response.writeHead(403); response.end('Forbidden'); return
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(webRoot, 'index.html')
        response.writeHead(200, { 'Content-Type': mime(filePath), 'Cache-Control': 'no-cache' })
        response.end(fs.readFileSync(filePath))
      } catch (error) {
        console.error('Web-server request failed:', error)
        response.writeHead(500); response.end('Fuego Overlay server error')
      }
    })
    webServer.once('error', reject)
    webServer.listen(WEB_PORT, WEB_HOST, resolve)
  })
}

function startTelemetryService() {
  telemetryProcess = utilityProcess.fork(
    path.join(app.getAppPath(), 'dist-server', 'telemetry.cjs'), [],
    { serviceName: 'Fuego Overlay Telemetry' },
  )
  telemetryProcess.on('exit', () => { telemetryProcess = null })
}

function stopServices() {
  if (telemetryProcess) { telemetryProcess.kill(); telemetryProcess = null }
  if (webServer) { webServer.close(); webServer = null }
}

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 1000, minHeight: 700, show: false,
    autoHideMenuBar: true, title: 'Fuego Overlay Control', backgroundColor: '#0b0f19',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })
  controlWindow.loadURL(`http://${WEB_HOST}:${WEB_PORT}/?view=control`)
  controlWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  controlWindow.on('closed', () => { controlWindow = null })
}

async function revealControlWindow(status, detail) {
  await updateSplash(100, status, detail)
  const remaining = Math.max(0, 3000 - (Date.now() - splashShownAt))
  setTimeout(async () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      try { await splashWindow.webContents.executeJavaScript('window.finishSplash?.()', true) } catch {}
    }
    setTimeout(() => {
      controlWindow?.show()
      controlWindow?.focus()
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close()
    }, 360)
  }, remaining)
}

app.whenReady().then(async () => {
  try {
    createSplashWindow()
    await new Promise((resolve) => splashWindow?.webContents.once('did-finish-load', resolve))
    await updateSplash(12, 'Initializing...', 'Fuego Software')

    if (app.isPackaged) {
      await updateSplash(28, 'Starting telemetry...', 'Connecting Fuego telemetry service')
      startTelemetryService()
      await updateSplash(48, 'Starting overlay server...', `Preparing ${WEB_HOST}:${WEB_PORT}`)
      await startWebServer()
    } else {
      await updateSplash(48, 'Development mode...', 'Using external Vite and telemetry services')
    }

    await updateSplash(68, 'Loading driver profiles...', 'Preparing Fuego Overlay')
    createControlWindow()
    await new Promise((resolve) => controlWindow?.webContents.once('did-finish-load', resolve))

    let status = `READY — v${app.getVersion()}`
    let detail = 'Fuego Overlay is ready'
    let available = null

    if (app.isPackaged) {
      await updateSplash(82, 'Checking for updates...', `Installed version v${app.getVersion()}`)
      try {
        const state = await updateState()
        if (state.status === 'available' || state.status === 'installer-required') {
          available = state
          status = `UPDATE AVAILABLE — v${state.latestVersion}`
          detail = 'A newer Fuego Overlay update is available'
        } else {
          status = `UP TO DATE — v${app.getVersion()}`
          detail = 'Fuego Overlay is current'
        }
      } catch {
        status = 'UPDATE CHECK UNAVAILABLE'
        detail = 'Fuego Overlay will continue normally'
      }
    }

    await updateSplash(94, 'Preparing overlays...', 'Loading Driver and Classic layouts')
    await revealControlWindow(status, detail)
    if (available) setTimeout(() => offerUpdate(available).catch(console.error), 650)
  } catch (error) {
    console.error('Could not start Fuego Overlay:', error)
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close()
    dialog.showErrorBox(
      'Fuego Overlay could not start',
      'Port 5173 may already be in use. Close any old Fuego Overlay or Vite windows, then try again.',
    )
    stopServices()
    app.quit()
  }
})

app.on('before-quit', stopServices)
app.on('window-all-closed', () => { if (!updateInProgress) app.quit() })
