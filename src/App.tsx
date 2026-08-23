import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'
import ControlPanel from './ControlPanel'
import RaceTicker from './RaceTicker'
import {
  renderExtraDriverWidget,
  type ExtraWidgetTelemetry,
} from './ExtraDriverWidgets'
import {
  defaultDriverLayout,
  normalizeDriverLayout,
  type DriverLayoutConfig,
  type DriverWidgetId,
  type WidgetCondition,
} from './layoutTypes'
import driver21Portrait from './assets/driver21.png'
import erniesLogo from './assets/ernies-logo.png'

const WS_URL = 'ws://127.0.0.1:3200'

type FlagState = 'green' | 'yellow' | 'white' | 'checkered' | 'pacing'

type Telemetry = {
  connected: boolean
  speed: number
  rpm: number
  gear: string | number
  position: number
  driverName: string
  carNumber: string
  lap: number
  totalLaps: number
  flag: FlagState
  throttle: number
  brake: number
  steering: number
  brakeBias: number | null
  lapCurrentLapTime: number
  lapLastLapTime: number
  lapBestLapTime: number
  fuelLevel: number
  fuelLevelPct: number
  sessionTimeRemain: number
  sessionLapsRemain: number
  incidents: number
  onPitRoad: boolean
  lapsSincePit: number
  trackTemp: number
  airTemp: number
  windVel: number
  gapToLeader: number
  gapAhead: number
  gapBehind: number
  iracingCustomerId: number
  trackName: string
  carIdxPct: Record<string, number>
  driverRoster: Array<{
    carIdx: number
    userName: string
    carNumber: string
    carClassShortName: string
    iracingCustomerId: number
    isSpectator: boolean
    carPath: string
  }>
  raceOrder: Array<{
    carIdx: number
    position: number
    carNumber: string
    userName: string
    gapToLeader: number
    gapAhead: number
    gapBehind: number
    lastLapTime: number
    bestLapTime: number
    lapCompleted: number
    isPlayer: boolean
  }>
  settings: OverlaySettings
}

type DriverProfile = {
  id: string
  label: string
  firstName: string
  nickname?: string
  lastName: string
  carNumber: string
  manufacturer: string
  portrait: string
  sponsorLogo?: string
  factory?: boolean
}

type TrackCar = {
  carIdx: number
  carNumber: string
  pct: number
  isPlayer: boolean
}

type OverlaySettings = {
  overlayLayout: 'classic' | 'driver' | 'cockpit'
  driverLayout: DriverLayoutConfig
  enableDriverLayoutEditor: boolean
  showSafeAreaGuides: boolean
  showConditionalWidgetsInEditor: boolean
  driverProfileId: string
  driverProfileCustom?: DriverProfile | null
  classicScale: number
  overlayOpacity: number
  overlayAnimations: boolean
  showTrackMap: boolean
  showSponsorLogo: boolean
  tickerEnabled: boolean
  tickerPosition: 'top' | 'bottom'
  tickerSpeed: number
  tickerMaxDrivers: number
  accentColor: string
  heartRateSourceUrl: string
  heartRateAutoReconnect: boolean
  showHeartRateClassic: boolean
}

const defaultDriverProfiles: DriverProfile[] = [
  {
    id: 'frost-21',
    label: 'Joseph "Frost" Grijalva',
    firstName: 'JOSEPH',
    nickname: 'FROST',
    lastName: 'GRIJALVA',
    carNumber: '21',
    manufacturer: 'FORD',
    portrait: driver21Portrait,
    sponsorLogo: erniesLogo,
  },
  {
    id: 'driver-22',
    label: 'Driver 22',
    firstName: 'DRIVER',
    nickname: 'FUEGO',
    lastName: 'TWENTY TWO',
    carNumber: '22',
    manufacturer: 'FORD',
    portrait: driver21Portrait,
    sponsorLogo: erniesLogo,
  },
]

const defaultSettings: OverlaySettings = {
  overlayLayout: 'classic',
  driverLayout: defaultDriverLayout,
  enableDriverLayoutEditor: false,
  showSafeAreaGuides: true,
  showConditionalWidgetsInEditor: true,
  driverProfileId: 'frost-21',
  driverProfileCustom: null,
  classicScale: 1.1,
  overlayOpacity: 1,
  overlayAnimations: true,
  showTrackMap: true,
  showSponsorLogo: true,
  tickerEnabled: false,
  tickerPosition: 'top',
  tickerSpeed: 30,
  tickerMaxDrivers: 12,
  accentColor: '#00a8ff',
  heartRateSourceUrl: '',
  heartRateAutoReconnect: true,
  showHeartRateClassic: false,
}

const fallbackTelemetry: Telemetry = {
  connected: false,
  speed: 95,
  rpm: 6155,
  gear: 4,
  position: 25,
  driverName: 'Joseph Grijalva',
  carNumber: '21',
  lap: 18,
  totalLaps: 120,
  flag: 'green',
  throttle: 0.72,
  brake: 0.08,
  steering: -0.12,
  brakeBias: 47.1,
  lapCurrentLapTime: 22.847,
  lapLastLapTime: 22.931,
  lapBestLapTime: 22.601,
  fuelLevel: 10.4,
  fuelLevelPct: 0.36,
  sessionTimeRemain: 1860,
  sessionLapsRemain: 72,
  incidents: 0,
  onPitRoad: false,
  lapsSincePit: 38,
  trackTemp: 78,
  airTemp: 71,
  windVel: 2,
  gapToLeader: 0,
  gapAhead: -0.18,
  gapBehind: 0.42,
  iracingCustomerId: 0,
  trackName: 'Richmond Raceway',
  carIdxPct: { '0': 0.91, '1': 0.12, '2': 0.38, '3': 0.64 },
  driverRoster: [
    {
      carIdx: 0,
      userName: 'Joseph Grijalva',
      carNumber: '21',
      carClassShortName: 'Cup',
      iracingCustomerId: 0,
      isSpectator: false,
      carPath: '',
    },
  ],
  raceOrder: [],
  settings: defaultSettings,
}

function normalizeSettings(value: Partial<OverlaySettings> | undefined): OverlaySettings {
  return {
    ...defaultSettings,
    ...value,
    driverLayout: normalizeDriverLayout(value?.driverLayout),
    driverProfileCustom: value?.driverProfileCustom ?? null,
    heartRateSourceUrl: value?.heartRateSourceUrl ?? '',
    heartRateAutoReconnect: value?.heartRateAutoReconnect ?? true,
    showHeartRateClassic: value?.showHeartRateClassic ?? false,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function formatLapTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '--.--'
  return value.toFixed(3)
}

function formatGap(value: number) {
  if (!Number.isFinite(value)) return '--'
  if (Math.abs(value) < 0.01) return 'LEADER'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '--:--'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getPositionSuffix(position: number) {
  if (position % 100 >= 11 && position % 100 <= 13) return 'TH'
  switch (position % 10) {
    case 1:
      return 'ST'
    case 2:
      return 'ND'
    case 3:
      return 'RD'
    default:
      return 'TH'
  }
}

function conditionMet(condition: WidgetCondition, telemetry: Telemetry) {
  switch (condition) {
    case 'pit-road':
      return telemetry.onPitRoad
    case 'low-fuel':
      return telemetry.fuelLevelPct > 0 && telemetry.fuelLevelPct <= 0.2
    case 'caution':
      return telemetry.flag === 'yellow'
    case 'white-flag':
      return telemetry.flag === 'white'
    case 'local-telemetry':
      return telemetry.connected
    case 'always':
    default:
      return true
  }
}

function TrackMap({
  cars,
  trackName,
  selectedCarNumber,
}: {
  cars: TrackCar[]
  trackName: string
  selectedCarNumber: string
}) {
  const displayCars = cars.length
    ? cars
    : [
        { carIdx: 0, carNumber: selectedCarNumber, pct: 0.91, isPlayer: true },
        { carIdx: 1, carNumber: '22', pct: 0.12, isPlayer: false },
        { carIdx: 2, carNumber: '12', pct: 0.38, isPlayer: false },
        { carIdx: 3, carNumber: '4', pct: 0.64, isPlayer: false },
      ]

  const pathD = 'M 24 65 C 28 30, 67 18, 126 18 L 196 18 C 245 18, 282 38, 284 72 C 286 103, 251 119, 205 118 L 84 116 C 43 114, 20 94, 24 65 Z'

  const points = displayCars.map((car) => {
    const pct = ((car.pct % 1) + 1) % 1
    const angle = pct * Math.PI * 2 - Math.PI / 7
    const centerX = 154
    const centerY = 68
    const rx = 128
    const ry = 49
    return {
      ...car,
      x: centerX + Math.cos(angle) * rx,
      y: centerY + Math.sin(angle) * ry,
    }
  })

  return (
    <div className="track-map" title={trackName || 'Track map'}>
      <svg viewBox="0 0 310 136" role="img" aria-label="Track map">
        <path className="track-outline" d={pathD} />
        <path className="track-centerline" d={pathD} />
        <line className="start-finish-line" x1="154" y1="111" x2="154" y2="126" />
        {points.map((car) => (
          <g
            key={car.carIdx}
            className={car.isPlayer ? 'track-car track-car-frost' : 'track-car'}
            transform={`translate(${car.x} ${car.y})`}
          >
            <circle r={car.isPlayer ? 10 : 6} />
            {car.isPlayer && (
              <text x="0" y="3" textAnchor="middle">
                {car.carNumber}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

function App() {
  const [telemetry, setTelemetry] = useState<Telemetry>(fallbackTelemetry)
  const [testFlag, setTestFlag] = useState<FlagState | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number | null>(null)

  useEffect(() => {
    let closedByCleanup = false

    const connect = () => {
      const socket = new WebSocket(WS_URL)
      socketRef.current = socket

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          if (payload.type === 'telemetry') {
            setTelemetry({
              ...fallbackTelemetry,
              ...payload.data,
              settings: normalizeSettings(payload.data?.settings),
            })
          }
        } catch (error) {
          console.error('Failed to parse telemetry', error)
        }
      }

      socket.onclose = () => {
        socketRef.current = null
        setTelemetry((current) => ({ ...current, connected: false }))
        if (!closedByCleanup) {
          reconnectRef.current = window.setTimeout(connect, 1000)
        }
      }
    }

    connect()

    return () => {
      closedByCleanup = true
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current)
      socketRef.current?.close()
    }
  }, [])

  const settings = telemetry.settings
  const flag = testFlag ?? telemetry.flag
  const profile = useMemo(() => {
    if (settings.driverProfileId === 'custom' && settings.driverProfileCustom) {
      return settings.driverProfileCustom
    }
    return defaultDriverProfiles.find((item) => item.id === settings.driverProfileId) ?? defaultDriverProfiles[0]
  }, [settings.driverProfileCustom, settings.driverProfileId])

  const selectedCarNumber = profile.carNumber || telemetry.carNumber || '21'
  const position = telemetry.position > 0 ? telemetry.position : 25
  const speed = Math.max(0, Math.round(telemetry.speed || fallbackTelemetry.speed))
  const rpm = Math.max(0, Math.round(telemetry.rpm || fallbackTelemetry.rpm))
  const gearDisplay = telemetry.gear || fallbackTelemetry.gear
  const maxSpeed = 205
  const speedRatio = clamp(speed / maxSpeed, 0, 1)
  const speedAngle = speedRatio * 180
  const speedGaugeStyle = { '--speed-angle': `${speedAngle}deg` } as CSSProperties
  const rpmRatio = clamp(rpm / 9000, 0, 1)
  const activeRpmBars = Array.from({ length: Math.ceil(rpmRatio * 8) }, (_, index) => index)
  const speedLabel = 'MPH'
  const trackName = telemetry.trackName || 'Richmond Raceway'

  const driverLayout = normalizeDriverLayout(settings.driverLayout)
  const trackCars = useMemo<TrackCar[]>(() => {
    const roster = telemetry.driverRoster || []
    const pctMap = telemetry.carIdxPct || {}
    const cars = roster
      .filter((driver) => !driver.isSpectator)
      .map((driver) => ({
        carIdx: driver.carIdx,
        carNumber: driver.carNumber,
        pct: pctMap[String(driver.carIdx)] ?? pctMap[driver.carIdx] ?? 0,
        isPlayer: driver.carNumber === selectedCarNumber || driver.userName === telemetry.driverName,
      }))
      .filter((car) => Number.isFinite(car.pct))

    return cars.slice(0, 20)
  }, [selectedCarNumber, telemetry.carIdxPct, telemetry.driverName, telemetry.driverRoster])

  const raceInformation = useMemo<ExtraWidgetTelemetry>(
    () => ({
      speed,
      rpm,
      gear: gearDisplay,
      throttle: telemetry.throttle,
      brake: telemetry.brake,
      steering: telemetry.steering,
      brakeBias: telemetry.brakeBias,
      currentLapTime: telemetry.lapCurrentLapTime,
      lastLapTime: telemetry.lapLastLapTime,
      bestLapTime: telemetry.lapBestLapTime,
      fuelLevel: telemetry.fuelLevel,
      fuelLevelPct: telemetry.fuelLevelPct,
      sessionTimeRemain: telemetry.sessionTimeRemain,
      sessionLapsRemain: telemetry.sessionLapsRemain,
      incidents: telemetry.incidents,
      onPitRoad: telemetry.onPitRoad,
      lapsSincePit: telemetry.lapsSincePit,
      trackTemp: telemetry.trackTemp,
      airTemp: telemetry.airTemp,
      windVel: telemetry.windVel,
      gapToLeader: telemetry.gapToLeader,
      gapAhead: telemetry.gapAhead,
      gapBehind: telemetry.gapBehind,
      position,
      lap: telemetry.lap,
      totalLaps: telemetry.totalLaps,
      flag,
      trackName,
      iracingCustomerId: telemetry.iracingCustomerId,
      connected: telemetry.connected,
    }),
    [flag, gearDisplay, position, rpm, speed, telemetry, trackName],
  )

  const tickerDrivers = telemetry.raceOrder?.length
    ? telemetry.raceOrder.map((driver) => ({
        position: driver.position,
        carNumber: driver.carNumber,
        name: driver.userName,
        isPlayer: driver.isPlayer,
      }))
    : [
        { position: 1, carNumber: selectedCarNumber, name: profile.lastName, isPlayer: true },
        { position: 2, carNumber: '22', name: 'PERRY', isPlayer: false },
        { position: 3, carNumber: '12', name: 'SMITH', isPlayer: false },
        { position: 4, carNumber: '4', name: 'JOHNSON', isPlayer: false },
      ]

  const profileStyle = {
    '--profile-primary': settings.accentColor || '#00a8ff',
    '--profile-secondary': '#1523e8',
    '--profile-trim': settings.accentColor || '#00a8ff',
    '--profile-number': '#fff200',
    '--overlay-opacity': settings.overlayOpacity,
  } as CSSProperties

  const rootStyle = {
    '--classic-scale': settings.classicScale,
  } as CSSProperties

  const cycleFlag = useCallback(() => {
    if (telemetry.connected) return
    const order: FlagState[] = ['pacing', 'green', 'yellow', 'white', 'checkered']
    const current = testFlag ?? flag
    setTestFlag(order[(order.indexOf(current) + 1) % order.length])
  }, [flag, telemetry.connected, testFlag])

  const controlMessage = (updates: Partial<OverlaySettings>) => {
    socketRef.current?.send(JSON.stringify({ type: 'settings', data: updates }))
  }

  const updateDriverLayout = (layout: DriverLayoutConfig) => {
    controlMessage({ driverLayout: layout })
  }

  if (settings.overlayLayout === 'driver') {
    return (
      <div className="app-root" style={rootStyle}>
        <ControlPanel
          telemetry={telemetry}
          settings={settings}
          driverProfiles={defaultDriverProfiles}
          onUpdateSettings={controlMessage}
          onUpdateDriverLayout={updateDriverLayout}
          raceInformation={raceInformation}
        />
        <div
          className={[
            'driver-layout-stage',
            settings.showSafeAreaGuides ? 'driver-layout-stage-guides' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={profileStyle}
        >
          {Object.entries(driverLayout).map(([id, placement]) => {
            const widgetId = id as DriverWidgetId
            const visible =
              placement.visible &&
              (settings.showConditionalWidgetsInEditor || conditionMet(placement.condition, telemetry))
            if (!visible && !settings.enableDriverLayoutEditor) return null

            const content = widgetId === 'trackMap'
              ? <TrackMap cars={trackCars} trackName={trackName} selectedCarNumber={selectedCarNumber} />
              : renderExtraDriverWidget(widgetId, raceInformation, placement.variant, {
                  drivers: tickerDrivers,
                  tickerBranding: placement.tickerBranding,
                  profile,
                  selectedCarNumber,
                  trackMap: <TrackMap cars={trackCars} trackName={trackName} selectedCarNumber={selectedCarNumber} />,
                  heartRateSourceUrl: settings.heartRateSourceUrl,
                  heartRateAutoReconnect: settings.heartRateAutoReconnect,
                })

            return (
              <div
                key={widgetId}
                className={[
                  'driver-widget',
                  `driver-widget-${widgetId}`,
                  `driver-widget-${placement.variant}`,
                  !visible ? 'driver-widget-editor-hidden' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  left: `${placement.x}%`,
                  top: `${placement.y}%`,
                  width: `${placement.width}%`,
                  height: `${placement.height}%`,
                }}
              >
                {content}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="app-root" style={rootStyle}>
      <ControlPanel
        telemetry={telemetry}
        settings={settings}
        driverProfiles={defaultDriverProfiles}
        onUpdateSettings={controlMessage}
        onUpdateDriverLayout={updateDriverLayout}
        raceInformation={raceInformation}
      />

      {settings.tickerEnabled && (
        <RaceTicker
          drivers={tickerDrivers}
          lap={telemetry.lap}
          totalLaps={telemetry.totalLaps}
          flag={flag}
          maxDrivers={settings.tickerMaxDrivers}
          speed={settings.tickerSpeed}
          position={settings.tickerPosition}
          enabled={settings.tickerEnabled}
        />
      )}

      <main className="overlay-stage" style={profileStyle}>
      <div className="classic-driver-strip">
      <section
        key={flag}
        className={
          `${telemetry.settings.overlayAnimations ? '' : 'overlay-animations-off '}` +
          `driver-ticker flag-${flag}` +
          (telemetry.settings.showHeartRateClassic
            ? ' driver-ticker-with-heart-rate classic-has-heart-rate'
            : '') +
          (telemetry.settings.showTrackMap
            ? ' classic-has-track-map'
            : '') +
          (telemetry.settings.showSponsorLogo && profile.sponsorLogo
            ? ' classic-has-sponsor-logo'
            : '')
        }
        style={profileStyle}
        onClick={cycleFlag}
        title={
          telemetry.connected
            ? `Live flag: ${flag}`
            : 'Click to test flag colors'
        }
      >
        <div className="position">
          <strong>
            {position}
          </strong>

          <span>
            {getPositionSuffix(
              position,
            )}
          </span>
        </div>

        <div className="portrait">
          <img
            key={profile.portrait}
            className={
              profile.factory
                ? 'driver-portrait driver-portrait-factory'
                : 'driver-portrait driver-portrait-custom'
            }
            src={profile.portrait}
            alt={`${profile.firstName} ${profile.lastName}`}
          />
        </div>

        <div className="identity">
          <span className="first-name">
            {profile.firstName}{' '}

            <small className="nickname">
              {profile.nickname
                ? `"${profile.nickname}"`
                : ''}
            </small>
          </span>

          <strong className="last-name">
            {profile.lastName}
          </strong>

          <div className="car-line">
            <span className="car-number">
              {profile.carNumber || selectedCarNumber}
            </span>

            <span className="manufacturer">
              {profile.manufacturer}
            </span>
          </div>
        </div>

        <div className="telemetry speed classic-speed-cell">
          <div className="classic-speed-gauge-row">
            <div
              className="gauge"
              style={speedGaugeStyle}
            >
              <span className="gauge-fill" />

              <strong>
                {gearDisplay}
              </strong>
            </div>
          </div>

          <div className="classic-speed-readout">
            <strong>{speed}</strong>
            <span>{speedLabel}</span>
          </div>
        </div>

        <div className="telemetry rpm">
          <div className="rpm-bars">
            {Array.from({
              length: 8,
            }).map(
              (_, index) => {
                const isActive =
                  activeRpmBars
                    .includes(
                      index,
                    )

                const isRedlineBar =
                  index === 3 ||
                  index === 4

                return (
                  <span
                    key={index}
                    className={[
                      isActive
                        ? 'rpm-bar-active'
                        : '',

                      isRedlineBar
                        ? 'rpm-bar-redline'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                )
              },
            )}
          </div>

          <span className="telemetry-value">
            {rpm}
          </span>

          <span className="telemetry-label">
            RPM
          </span>
        </div>

        {telemetry.settings.showHeartRateClassic && (
          <section
            key={`classic-heart-rate-${flag}`}
            className={
              `${telemetry.settings.overlayAnimations ? '' : 'overlay-animations-off '}` +
              `classic-heart-rate-widget flag-${flag}`
            }
          >
            <div className="classic-heart-native">
              <strong>148</strong>
              <span>BPM</span>
            </div>
          </section>
        )}

        {(telemetry.settings.showTrackMap ||
          (telemetry.settings.showSponsorLogo && profile.sponsorLogo)) && (
          <div
            className={[
              'right-panel',
              telemetry.settings.showTrackMap
                ? 'has-track-map'
                : '',
              telemetry.settings.showSponsorLogo && profile.sponsorLogo
                ? 'has-sponsor'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {telemetry.settings.showTrackMap && (
              <TrackMap
                cars={trackCars}
                trackName={trackName}
                selectedCarNumber={
                  selectedCarNumber
                }
              />
            )}

            {telemetry.settings.showSponsorLogo &&
              profile.sponsorLogo && (
                <div className="sponsor-logo-box">
                  <img
                    src={profile.sponsorLogo}
                    alt="Primary sponsor"
                  />
                </div>
              )}
          </div>
        )}
      </section>

      </div>
      </main>
    </div>
  )
}

export default App
