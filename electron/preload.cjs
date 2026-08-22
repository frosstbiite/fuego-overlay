const {
  contextBridge,
  ipcRenderer,
} = require('electron')

contextBridge.exposeInMainWorld(
  'fuegoUpdater',
  {
    getVersion: () =>
      ipcRenderer.invoke(
        'fuego-updater:get-version',
      ),

    checkForUpdates: () =>
      ipcRenderer.invoke(
        'fuego-updater:check',
      ),
  },
)
