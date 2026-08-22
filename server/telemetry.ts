import { IRacingSDK } from 'irsdk-node'
import { WebSocket, WebSocketServer } from 'ws'

const PORT = 3200
const HIGH_UPDATE_INTERVAL = 16
const NORMAL_UPDATE_INTERVAL = 33

type FlagState = 'pacing' | 'green' | 'yellow' | 'white' | 'checkered'
type ClientType = 'driver' | 'ticker' | 'control' | 'unknown'
type Layout = Record<string, Record<string, unknown>>

type OverlaySettings = {
  selectedCarNumber: string
  showDriverBar: boolean
  showTicker: boolean
  showTrackMap: boolean
  showSponsorLogo: boolean
  trackOverride: string
  overlayLayout: 'classic' | 'driver' | 'cockpit'
  driverLayout: Layout
  rememberLastLayout: boolean
  defaultOverlayLayout: 'classic' | 'driver' | 'cockpit'
  showConditionalWidgetsInEditor: boolean
  canvasPreset: '720p' | '1080p' | '1440p' | '4k'
  autoScaleOverlay: boolean
  showSafeAreaGuides: boolean
  speedUnit: 'mph' | 'kph'
  fuelUnit: 'liters' | 'gallons' | 'percent'
  temperatureUnit: 'fahrenheit' | 'celsius'
  telemetryRate: 'normal' | 'high'
  uiScale: number
  overlayAnimations: boolean
  animationSpeed: 'slow' | 'normal' | 'fast'
  overlayOpacity: number
}

type DriverProfile = {
  id: string
  factory: boolean
  profileName: string
  firstName: string
  nickname: string
  lastName: string
  teamName: string
  manufacturer: string
  carNumber: string
  primaryColor: string
  secondaryColor: string
  trimColor: string
  numberColor: string
  textColor: string
  portrait: string
  portraitSource: string
  portraitZoom: number
  portraitOffsetX: number
  portraitOffsetY: number
  sponsorLogo: string
}

type ControlMessage = {
  type?: string
  clientType?: ClientType
  settings?: Partial<OverlaySettings>
  profile?: DriverProfile
}

type SessionDriver = {
  CarIdx: number
  CarNumber: string
  UserName?: string
  AbbrevName?: string
  TeamName?: string
  IsSpectator?: number
  CarIsPaceCar?: number
  UserID?: number
  UserId?: number
  CustomerID?: number
  CustomerId?: number
}

type SessionData = {
  WeekendInfo?: { TrackName?: string; TrackDisplayName?: string }
  DriverInfo?: { Drivers?: SessionDriver[] }
}

type LeaderboardDriver = {
  position: number
  carIndex: number
  carNumber: string
  name: string
}

type TrackCar = {
  carIndex: number
  carNumber: string
  name: string
  lapDistancePct: number
}

const defaultDriverLayout: Layout = {
  runningOrder: { x: 2, y: 2, width: 76, height: 8, visible: true },
  raceStatus: { x: 81, y: 2, width: 17, height: 12, visible: true },
  driverIdentity: { x: 2, y: 16, width: 26, height: 22, visible: false },
  telemetry: { x: 2, y: 82, width: 31, height: 15, visible: true },
  trackMap: { x: 36, y: 82, width: 24, height: 15, visible: true },
  lapTiming: { x: 63, y: 82, width: 35, height: 15, visible: true },
  fuel: { x: 2, y: 70, width: 12, height: 10, visible: false },
  pedals: { x: 16, y: 70, width: 18, height: 10, visible: false },
  steering: { x: 36, y: 70, width: 14, height: 10, visible: false },
  brakeBias: { x: 52, y: 70, width: 12, height: 10, visible: false },
  currentLap: { x: 66, y: 70, width: 15, height: 10, visible: false },
  sessionRemaining: { x: 83, y: 70, width: 15, height: 10, visible: false },
  incidents: { x: 2, y: 58, width: 10, height: 9, visible: false },
  pitInfo: { x: 14, y: 58, width: 18, height: 9, visible: false },
  tireInfo: { x: 34, y: 58, width: 26, height: 14, visible: false },
  weather: { x: 62, y: 58, width: 22, height: 12, visible: false },
  gapBattle: { x: 62, y: 44, width: 24, height: 11, visible: false },
}

let overlaySettings: OverlaySettings = {
  selectedCarNumber: '21',
  showDriverBar: true,
  showTicker: true,
  showTrackMap: true,
  showSponsorLogo: true,
  trackOverride: 'auto',
  overlayLayout: 'classic',
  driverLayout: structuredClone(defaultDriverLayout),
  rememberLastLayout: true,
  defaultOverlayLayout: 'classic',
  showConditionalWidgetsInEditor: true,
  canvasPreset: '1080p',
  autoScaleOverlay: true,
  showSafeAreaGuides: false,
  speedUnit: 'mph',
  fuelUnit: 'liters',
  temperatureUnit: 'fahrenheit',
  telemetryRate: 'high',
  uiScale: 1,
  overlayAnimations: true,
  animationSpeed: 'normal',
  overlayOpacity: 1,
}

const sdk = new IRacingSDK({ autoEnableTelemetry: true })
const wss = new WebSocketServer({ port: PORT })
const clients = new Map<WebSocket, ClientType>()
let activeProfile: DriverProfile | null = null
let wasConnected = false
let lastPitLap = 0
let wasPlayerOnPitRoad = false

function readValue<T>(name: string): T | undefined {
  return sdk.getTelemetryVariable<T>(name as never)?.value?.[0]
}

function readArray<T>(name: string): T[] {
  return sdk.getTelemetryVariable<T>(name as never)?.value ?? []
}

function normalizeCarNumber(value: string) {
  const clean = String(value ?? '').trim().toUpperCase()
  return /^\d+$/.test(clean) ? clean.replace(/^0+(?=\d)/, '') || '0' : clean
}

function lastName(value: string) {
  const clean = value.trim()
  const result = clean.includes(',')
    ? clean.split(',')[0].trim()
    : clean.split(/\s+/).at(-1) ?? clean
  return result.replace(/\d+$/, '').trim().toUpperCase()
}

function driverName(driver: SessionDriver) {
  return lastName(driver.UserName || driver.AbbrevName || driver.TeamName || `CAR ${driver.CarNumber}`)
}

function validTime(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

function flagState(flagsValue: number, sessionState: number, currentLap: number, totalLaps: number): FlagState {
  const flags = flagsValue >>> 0
  if ((flags & 0x1) !== 0 || sessionState === 5 || sessionState === 6) return 'checkered'
  if (sessionState < 4) return 'pacing'
  if ((flags & (0x8 | 0x100 | 0x200 | 0x4000 | 0x8000)) !== 0) return 'yellow'
  if ((flags & 0x2) !== 0 || (totalLaps > 0 && currentLap >= totalLaps)) return 'white'
  return 'green'
}

function leaderboard(drivers: SessionDriver[], positions: number[]): LeaderboardDriver[] {
  return drivers
    .filter((d) => d.IsSpectator !== 1 && d.CarIsPaceCar !== 1 && (positions[d.CarIdx] ?? 0) > 0)
    .map((d) => ({
      position: positions[d.CarIdx],
      carIndex: d.CarIdx,
      carNumber: String(d.CarNumber ?? ''),
      name: driverName(d),
    }))
    .sort((a, b) => a.position - b.position)
}

function trackCars(drivers: SessionDriver[], distances: number[]): TrackCar[] {
  return drivers
    .filter((d) => {
      const value = distances[d.CarIdx]
      return d.IsSpectator !== 1 && d.CarIsPaceCar !== 1 && typeof value === 'number' && Number.isFinite(value) && value >= 0
    })
    .map((d) => ({
      carIndex: d.CarIdx,
      carNumber: String(d.CarNumber ?? ''),
      name: driverName(d),
      lapDistancePct: (((distances[d.CarIdx] ?? 0) % 1) + 1) % 1,
    }))
}

function overlayStatus() {
  let driverConnections = 0
  let tickerConnections = 0
  let controlConnections = 0
  for (const type of clients.values()) {
    if (type === 'driver') driverConnections += 1
    if (type === 'ticker') tickerConnections += 1
    if (type === 'control') controlConnections += 1
  }
  return { driverConnections, tickerConnections, controlConnections }
}

function broadcast(data: object) {
  const message = JSON.stringify(data)
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message)
  }
}

function sendProfile(client?: WebSocket) {
  if (!activeProfile) return
  const message = JSON.stringify({ type: 'profile', profile: activeProfile })
  if (client) {
    if (client.readyState === WebSocket.OPEN) client.send(message)
    return
  }
  for (const item of wss.clients) if (item.readyState === WebSocket.OPEN) item.send(message)
}

function updateSettings(incoming: Partial<OverlaySettings>) {
  const nextCar = incoming.selectedCarNumber !== undefined
    ? normalizeCarNumber(String(incoming.selectedCarNumber)).slice(0, 4)
    : overlaySettings.selectedCarNumber

  overlaySettings = {
    ...overlaySettings,
    ...incoming,
    selectedCarNumber: nextCar || overlaySettings.selectedCarNumber,
    trackOverride: typeof incoming.trackOverride === 'string' && incoming.trackOverride.trim()
      ? incoming.trackOverride.trim()
      : overlaySettings.trackOverride,
    overlayLayout: incoming.overlayLayout === 'classic' || incoming.overlayLayout === 'driver' || incoming.overlayLayout === 'cockpit'
      ? incoming.overlayLayout
      : overlaySettings.overlayLayout,
    defaultOverlayLayout: incoming.defaultOverlayLayout === 'classic' || incoming.defaultOverlayLayout === 'driver' || incoming.defaultOverlayLayout === 'cockpit'
      ? incoming.defaultOverlayLayout
      : overlaySettings.defaultOverlayLayout,
    driverLayout: incoming.driverLayout && typeof incoming.driverLayout === 'object'
      ? incoming.driverLayout
      : overlaySettings.driverLayout,
    speedUnit: incoming.speedUnit === 'kph' || incoming.speedUnit === 'mph' ? incoming.speedUnit : overlaySettings.speedUnit,
    fuelUnit: incoming.fuelUnit === 'gallons' || incoming.fuelUnit === 'percent' || incoming.fuelUnit === 'liters' ? incoming.fuelUnit : overlaySettings.fuelUnit,
    temperatureUnit: incoming.temperatureUnit === 'celsius' || incoming.temperatureUnit === 'fahrenheit' ? incoming.temperatureUnit : overlaySettings.temperatureUnit,
    telemetryRate: incoming.telemetryRate === 'normal' || incoming.telemetryRate === 'high' ? incoming.telemetryRate : overlaySettings.telemetryRate,
    animationSpeed: incoming.animationSpeed === 'slow' || incoming.animationSpeed === 'normal' || incoming.animationSpeed === 'fast' ? incoming.animationSpeed : overlaySettings.animationSpeed,
    uiScale: typeof incoming.uiScale === 'number' ? Math.min(1.2, Math.max(.85, incoming.uiScale)) : overlaySettings.uiScale,
    overlayOpacity: typeof incoming.overlayOpacity === 'number' ? Math.min(1, Math.max(.4, incoming.overlayOpacity)) : overlaySettings.overlayOpacity,
  }
}

function tire(prefix: 'LF' | 'RF' | 'LR' | 'RR') {
  return {
    pressure: readValue<number>(`${prefix}coldPressure`) ?? 0,
    tempL: readValue<number>(`${prefix}tempCL`) ?? 0,
    tempM: readValue<number>(`${prefix}tempCM`) ?? 0,
    tempR: readValue<number>(`${prefix}tempCR`) ?? 0,
    wearL: readValue<number>(`${prefix}wearL`) ?? 0,
    wearM: readValue<number>(`${prefix}wearM`) ?? 0,
    wearR: readValue<number>(`${prefix}wearR`) ?? 0,
  }
}

function tick() {
  const connected = sdk.waitForData(overlaySettings.telemetryRate === 'normal' ? NORMAL_UPDATE_INTERVAL : HIGH_UPDATE_INTERVAL)

  if (!connected) {
    if (wasConnected) {
      wasConnected = false
      console.log('Disconnected from iRacing telemetry')
    }
    const trackName = overlaySettings.trackOverride !== 'auto' ? overlaySettings.trackOverride : 'Unknown Track'
    broadcast({
      type: 'telemetry', connected: false, cameraCarIndex: 0, selectedCarIndex: 0,
      selectedCarNumber: overlaySettings.selectedCarNumber, selectedDriverName: '', selectedDriverCustomerId: 0,
      detectedTrackName: 'Unknown Track', trackName, position: 0, selectedLap: 0, gapToLeader: -1,
      onPitRoad: false, lastLapTime: 0, bestLapTime: 0, gear: 0, speedMph: 0, rpm: 0,
      localTelemetryAvailable: false, gapAhead: -1, gapBehind: -1, aheadDriver: null, behindDriver: null,
      airTempC: 0, trackTempC: 0, relativeHumidity: 0, windVelMps: 0, windDirRad: 0, skies: 0,
      tireInfo: null, fuelLevel: 0, fuelLevelPct: 0, throttle: 0, brake: 0, steeringWheelAngle: 0,
      brakeBias: 0, currentLapTime: 0, sessionTimeRemain: 0, incidentCount: 0, lapsSincePit: 0,
      flag: 'pacing', sessionState: 0, currentLap: 0, totalLaps: 0, leaderboard: [], trackCars: [],
      settings: overlaySettings, overlayStatus: overlayStatus(),
    })
    setTimeout(tick, overlaySettings.telemetryRate === 'normal' ? NORMAL_UPDATE_INTERVAL : HIGH_UPDATE_INTERVAL)
    return
  }

  if (!wasConnected) {
    wasConnected = true
    sdk.resetTelemetryVariableCache()
    console.log('Connected to iRacing telemetry')
  }

  const playerCarIndex = readValue<number>('PlayerCarIdx') ?? 0
  const cameraCarIndex = readValue<number>('CamCarIdx') ?? playerCarIndex
  const positions = readArray<number>('CarIdxPosition')
  const lapsCompleted = readArray<number>('CarIdxLapCompleted')
  const lapDistances = readArray<number>('CarIdxLapDistPct')
  const carFlags = readArray<number>('CarIdxSessionFlags')
  const gears = readArray<number>('CarIdxGear')
  const rpms = readArray<number>('CarIdxRPM')
  const onPit = readArray<boolean>('CarIdxOnPitRoad')
  const f2 = readArray<number>('CarIdxF2Time')
  const lastLaps = readArray<number>('CarIdxLastLapTime')
  const bestLaps = readArray<number>('CarIdxBestLapTime')
  const sessionState = readValue<number>('SessionState') ?? 0
  const totalValue = readValue<number>('SessionLapsTotal') ?? 0
  const session = sdk.getSessionData() as unknown as SessionData
  const drivers = session.DriverInfo?.Drivers ?? []
  const detectedTrackName = session.WeekendInfo?.TrackDisplayName || session.WeekendInfo?.TrackName || 'Unknown Track'
  const trackName = overlaySettings.trackOverride !== 'auto' ? overlaySettings.trackOverride : detectedTrackName
  const selectedDriver = drivers.find((d) => normalizeCarNumber(d.CarNumber) === normalizeCarNumber(overlaySettings.selectedCarNumber))
  const selectedCarIndex = selectedDriver?.CarIdx ?? cameraCarIndex
  const selectedCarNumber = selectedDriver ? String(selectedDriver.CarNumber) : overlaySettings.selectedCarNumber
  const selectedDriverName = selectedDriver ? driverName(selectedDriver) : ''
  const selectedDriverCustomerId = Number(selectedDriver?.UserID ?? selectedDriver?.UserId ?? selectedDriver?.CustomerID ?? selectedDriver?.CustomerId ?? 0) || 0
  const order = leaderboard(drivers, positions)
  const mapCars = trackCars(drivers, lapDistances)
  const leaderIndex = order[0]?.carIndex
  const currentLap = leaderIndex !== undefined ? Math.max(1, (lapsCompleted[leaderIndex] ?? 0) + 1) : 0
  const totalLaps = totalValue > 0 && totalValue < 32000 ? totalValue : 0
  const selectedLap = selectedCarIndex >= 0 ? Math.max(1, (lapsCompleted[selectedCarIndex] ?? 0) + 1) : 0
  const position = positions[selectedCarIndex] ?? 0
  const aheadDriver = position > 1 ? order.find((d) => d.position === position - 1) : undefined
  const behindDriver = position > 0 ? order.find((d) => d.position === position + 1) : undefined
  const selectedF2 = f2[selectedCarIndex]
  const aheadF2 = aheadDriver ? f2[aheadDriver.carIndex] : undefined
  const behindF2 = behindDriver ? f2[behindDriver.carIndex] : undefined
  const gapAhead = aheadDriver && Number.isFinite(selectedF2) && Number.isFinite(aheadF2) ? Math.max(0, selectedF2 - (aheadF2 as number)) : -1
  const gapBehind = behindDriver && Number.isFinite(selectedF2) && Number.isFinite(behindF2) ? Math.max(0, (behindF2 as number) - selectedF2) : -1
  const rawGap = f2[selectedCarIndex]
  const gapToLeader = sessionState === 4 && position > 1 && Number.isFinite(rawGap) && rawGap >= 0 ? rawGap : position === 1 ? 0 : -1
  const onPitRoad = Boolean(onPit[selectedCarIndex])
  const playerOnPitRoad = Boolean(onPit[playerCarIndex])
  if (playerOnPitRoad && !wasPlayerOnPitRoad) lastPitLap = lapsCompleted[playerCarIndex] ?? currentLap
  wasPlayerOnPitRoad = playerOnPitRoad
  const lapsSincePit = lastPitLap > 0 ? Math.max(0, (lapsCompleted[playerCarIndex] ?? currentLap) - lastPitLap) : 0
  const localTelemetryAvailable = selectedCarIndex === playerCarIndex
  const combinedFlags = carFlags.reduce((a, b) => (a | (b ?? 0)) >>> 0, readValue<number>('SessionFlags') ?? 0)
  const flag = flagState(combinedFlags, sessionState, currentLap, totalLaps)

  broadcast({
    type: 'telemetry', connected: true, cameraCarIndex, selectedCarIndex, selectedCarNumber,
    selectedDriverName, selectedDriverCustomerId, detectedTrackName, trackName, position, selectedLap,
    gapToLeader, onPitRoad, lastLapTime: validTime(lastLaps[selectedCarIndex]), bestLapTime: validTime(bestLaps[selectedCarIndex]),
    gear: gears[selectedCarIndex] ?? readValue<number>('Gear') ?? 0,
    speedMph: Math.round((readValue<number>('Speed') ?? 0) * 2.236936),
    rpm: Math.round(rpms[selectedCarIndex] ?? readValue<number>('RPM') ?? 0),
    localTelemetryAvailable, gapAhead, gapBehind, aheadDriver: aheadDriver ?? null, behindDriver: behindDriver ?? null,
    airTempC: readValue<number>('AirTemp') ?? 0,
    trackTempC: readValue<number>('TrackTempCrew') ?? readValue<number>('TrackTemp') ?? 0,
    relativeHumidity: readValue<number>('RelativeHumidity') ?? 0,
    windVelMps: readValue<number>('WindVel') ?? 0,
    windDirRad: readValue<number>('WindDir') ?? 0,
    skies: readValue<number>('Skies') ?? 0,
    tireInfo: { lf: tire('LF'), rf: tire('RF'), lr: tire('LR'), rr: tire('RR') },
    fuelLevel: readValue<number>('FuelLevel') ?? 0,
    fuelLevelPct: readValue<number>('FuelLevelPct') ?? 0,
    throttle: readValue<number>('Throttle') ?? 0,
    brake: readValue<number>('Brake') ?? 0,
    steeringWheelAngle: readValue<number>('SteeringWheelAngle') ?? 0,
    brakeBias: readValue<number>('dcBrakeBias') ?? 0,
    currentLapTime: readValue<number>('LapCurrentLapTime') ?? 0,
    sessionTimeRemain: readValue<number>('SessionTimeRemain') ?? 0,
    incidentCount: readValue<number>('PlayerCarMyIncidentCount') ?? 0,
    lapsSincePit, flag, sessionState, currentLap, totalLaps, leaderboard: order, trackCars: mapCars,
    settings: overlaySettings, overlayStatus: overlayStatus(),
  })

  setTimeout(tick, overlaySettings.telemetryRate === 'normal' ? NORMAL_UPDATE_INTERVAL : HIGH_UPDATE_INTERVAL)
}

wss.on('connection', (client) => {
  clients.set(client, 'unknown')
  client.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as ControlMessage
      if (message.type === 'registerClient') {
        const type = message.clientType
        if (type === 'driver' || type === 'ticker' || type === 'control') {
          clients.set(client, type)
          sendProfile(client)
        }
        return
      }
      if (message.type === 'updateProfile' && message.profile) {
        activeProfile = message.profile
        updateSettings({ selectedCarNumber: activeProfile.carNumber })
        sendProfile()
        return
      }
      if (message.type === 'updateSettings' && message.settings) updateSettings(message.settings)
    } catch (error) {
      console.error('Could not read control message:', error)
    }
  })
  client.on('close', () => clients.delete(client))
})

wss.on('listening', () => console.log(`Telemetry service listening on ws://localhost:${PORT}`))
tick()
