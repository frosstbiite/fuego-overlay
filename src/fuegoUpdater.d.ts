export {}

declare global {
  interface Window {
    fuegoUpdater?: {
      getVersion: () => Promise<string>
      checkForUpdates: () => Promise<{
        status: string
        currentVersion?: string
        latestVersion?: string
        message?: string
      }>
    }
  }
}
