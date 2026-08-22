import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import ProfileManager from './ProfileManager'
import DriverLayoutEditor from './DriverLayoutEditor'
import {
  defaultDriverLayout,
  normalizeDriverLayout,
  type DriverLayoutConfig,
  type OverlayLayout,
} from './layoutTypes'
import {
  frostProfile,
  normalizeProfile,
  type DriverProfile,
} from './profileTypes'
import './ControlPanel.css'

type OverlaySettings = {
  selectedCarNumber: string
  showDriverBar: boolean
  showTicker: boolean
  showTrackMap: boolean
  showSponsorLogo: boolean
  trackOverride: string
  overlayLayout: OverlayLayout
  driverLayout: DriverLayoutConfig
  rememberLastLayout: boolean
  defaultOverlayLayout: OverlayLayout
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

type OverlayStatus = {
  driverConnections: number
  tickerConnections: number
}

type RaceInformation = {
  iracingCustomerId: number
  position: number
  selectedLap: number
  currentLap: number
  totalLaps: number
  gapToLeader: number
  onPitRoad: boolean
  lastLapTime: number
  bestLapTime: number
}

type TelemetryMessage = {
  type?: 'telemetry'
  connected?: boolean
  selectedDriverCustomerId?: number
  trackName?: string
  detectedTrackName?: string
  selectedCarNumber?: string
  selectedDriverName?: string
  position?: number
  selectedLap?: number
  currentLap?: number
  totalLaps?: number
  gapToLeader?: number
  onPitRoad?: boolean
  lastLapTime?: number
  bestLapTime?: number
  settings?: OverlaySettings
  overlayStatus?: OverlayStatus
}

type ProfileMessage = {
  type: 'profile'
  profile: DriverProfile | null
}

type ControlTab = 'driver' | 'overlay' | 'broadcaster' | 'race' | 'settings'

const SETTINGS_KEY = 'fuego-overlay-settings'
const LEGACY_SETTINGS_KEY = 'frost-overlay-settings'
const PROFILES_KEY = 'fuego-overlay-profiles'
const ACTIVE_PROFILE_KEY = 'fuego-overlay-active-profile'
const LAYOUT_PROFILES_KEY = 'fuego-driver-layout-profiles'

const defaultSettings: OverlaySettings = {
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

const defaultOverlayStatus: OverlayStatus = {
  driverConnections: 0,
  tickerConnections: 0,
}

const defaultRaceInformation: RaceInformation = {
  iracingCustomerId: 0,
  position: 0,
  selectedLap: 0,
  currentLap: 0,
  totalLaps: 0,
  gapToLeader: -1,
  onPitRoad: false,
  lastLapTime: 0,
  bestLapTime: 0,
}

const trackOptions = [
  'Talladega Superspeedway',
  'Texas Motor Speedway',
  'Dover Motor Speedway',
  'Charlotte Motor Speedway',
  'Nashville Superspeedway',
  'Michigan International Speedway',
  'Pocono Raceway',
  'Daytona International Speedway',
  'Chicagoland Speedway',
  'EchoPark Speedway',
  'North Wilkesboro Speedway',
  'Indianapolis Motor Speedway',
  'Las Vegas Motor Speedway',
  'Iowa Speedway',
  'Richmond Raceway',
  'New Hampshire Motor Speedway',
  'Darlington Raceway',
  'Bristol Motor Speedway',
  'Kansas Speedway',
  'Phoenix Raceway',
  'Martinsville Speedway',
  'Homestead-Miami Speedway',
]

function loadSavedSettings() {
  try {
    const savedSettings =
      localStorage.getItem(SETTINGS_KEY) ||
      localStorage.getItem(LEGACY_SETTINGS_KEY)

    if (!savedSettings) {
      return defaultSettings
    }

    const parsed = JSON.parse(savedSettings) as Partial<OverlaySettings>

    const merged = {
      ...defaultSettings,
      ...parsed,
      driverLayout: normalizeDriverLayout(parsed.driverLayout),
    } as OverlaySettings

    if (!merged.rememberLastLayout) {
      merged.overlayLayout = merged.defaultOverlayLayout
    }

    return merged
  } catch {
    return defaultSettings
  }
}

function loadSavedProfiles(): DriverProfile[] {
  try {
    const stored = localStorage.getItem(PROFILES_KEY)
    if (!stored) return [frostProfile]

    const parsed = JSON.parse(stored) as Partial<DriverProfile>[]
    const customProfiles = parsed
      .filter((profile) => profile.id !== frostProfile.id)
      .map((profile) => normalizeProfile(profile))
      .map((profile) => ({ ...profile, factory: false }))

    return [frostProfile, ...customProfiles]
  } catch {
    return [frostProfile]
  }
}

function loadActiveProfileId() {
  return localStorage.getItem(ACTIVE_PROFILE_KEY) || frostProfile.id
}

function formatLapTime(
  seconds: number,
) {
  if (
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return '--'
  }

  const minutes =
    Math.floor(seconds / 60)

  const remainingSeconds =
    seconds - minutes * 60

  return (
    `${minutes}:` +
    remainingSeconds
      .toFixed(3)
      .padStart(6, '0')
  )
}

function formatGap(
  position: number,
  gapToLeader: number,
) {
  if (position === 1) {
    return 'LEADER'
  }

  if (
    !Number.isFinite(gapToLeader) ||
    gapToLeader < 0
  ) {
    return '--'
  }

  return `+${gapToLeader.toFixed(3)}`
}

function ControlPanel() {
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const [activeTab, setActiveTab] = useState<ControlTab>('driver')
  const [profiles, setProfiles] = useState<DriverProfile[]>(loadSavedProfiles)
  const [activeProfileId, setActiveProfileId] = useState(loadActiveProfileId)
  const [selectedProfileId, setSelectedProfileId] = useState(loadActiveProfileId)
  const [editingProfileId, setEditingProfileId] = useState(loadActiveProfileId)
  const [activeProfile, setActiveProfile] = useState<DriverProfile>(() =>
    profiles.find((profile) => profile.id === activeProfileId) || frostProfile,
  )

  const activeProfileRef = useRef(activeProfile)

  useEffect(() => {
    activeProfileRef.current = activeProfile
  }, [activeProfile])

  const [serverConnected, setServerConnected] = useState(false)
  const [iracingConnected, setIracingConnected] = useState(false)
  const [trackName, setTrackName] = useState('Unknown Track')
  const [detectedTrackName, setDetectedTrackName] = useState('Unknown Track')
  const [driverName, setDriverName] = useState('')
  const [settings, setSettings] = useState<OverlaySettings>(loadSavedSettings)
  const [appVersion, setAppVersion] = useState('1.1.1')
  const [updateButtonText, setUpdateButtonText] = useState('CHECK FOR UPDATES')

  useEffect(() => {
    window.fuegoUpdater?.getVersion()
      .then((version) => {
        if (version) setAppVersion(version)
      })
      .catch(() => {
        // Development browser preview has no Electron preload.
      })
  }, [])

  const [overlayStatus, setOverlayStatus] = useState<OverlayStatus>(defaultOverlayStatus)
  const [raceInformation, setRaceInformation] = useState<RaceInformation>(defaultRaceInformation)
  const [copiedSource, setCopiedSource] = useState<'driver' | 'ticker' | null>(null)
  const driverOverlayUrl = `${window.location.origin}/`

  useEffect(() => {
    let stopped = false

    function connect() {
      if (stopped) return

      const socket = new WebSocket('ws://localhost:3200')
      socketRef.current = socket

      socket.onopen = () => {
        setServerConnected(true)

        socket.send(JSON.stringify({
          type: 'registerClient',
          clientType: 'control',
        }))

        const savedSettings = loadSavedSettings()

        socket.send(JSON.stringify({
          type: 'updateSettings',
          settings: savedSettings,
        }))

        socket.send(JSON.stringify({
          type: 'updateProfile',
          profile: activeProfileRef.current,
        }))
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as TelemetryMessage | ProfileMessage
          if (message.type === 'profile') return

          setIracingConnected(Boolean(message.connected))
          setTrackName(message.trackName || 'Unknown Track')
          setDetectedTrackName(message.detectedTrackName || 'Unknown Track')
          setDriverName(message.selectedDriverName || '')

          setRaceInformation({
            iracingCustomerId: message.selectedDriverCustomerId ?? 0,
            position: message.position ?? 0,
            selectedLap: message.selectedLap ?? 0,
            currentLap: message.currentLap ?? 0,
            totalLaps: message.totalLaps ?? 0,
            gapToLeader: message.gapToLeader ?? -1,
            onPitRoad: Boolean(message.onPitRoad),
            lastLapTime: message.lastLapTime ?? 0,
            bestLapTime: message.bestLapTime ?? 0,
          })

          if (message.overlayStatus) {
            setOverlayStatus(message.overlayStatus)
          }

          if (message.settings) {
            const receivedSettings = {
              ...defaultSettings,
              ...message.settings,
              driverLayout: normalizeDriverLayout(message.settings.driverLayout),
            }

            setSettings(receivedSettings)
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(receivedSettings))
          }
        } catch (error) {
          console.error('Could not read control-panel data:', error)
        }
      }

      socket.onerror = () => {
        setServerConnected(false)
      }

      socket.onclose = () => {
        setServerConnected(false)
        setIracingConnected(false)
        setOverlayStatus(defaultOverlayStatus)
        setRaceInformation(defaultRaceInformation)

        if (!stopped) {
          reconnectTimerRef.current = window.setTimeout(connect, 1500)
        }
      }
    }

    connect()

    return () => {
      stopped = true
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
      }
      socketRef.current?.close()
    }
  }, [])

  function sendSettings(nextSettings: OverlaySettings) {
    setSettings(nextSettings)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings))

    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'updateSettings',
        settings: nextSettings,
      }))
    }
  }

  function sendProfile(profile: DriverProfile) {
    activeProfileRef.current = profile
    setActiveProfile(profile)
    setActiveProfileId(profile.id)
    setSelectedProfileId(profile.id)
    localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id)

    const nextSettings = {
      ...settings,
      selectedCarNumber: profile.carNumber,
    }
    sendSettings(nextSettings)

    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'updateProfile',
        profile,
      }))
    }
  }

  function saveProfiles(nextProfiles: DriverProfile[]) {
    setProfiles(nextProfiles)
    localStorage.setItem(PROFILES_KEY, JSON.stringify(nextProfiles))
  }

  function activateProfile(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId)
    if (profile) setEditingProfileId(profile.id)
  }

  function saveProfile(profile: DriverProfile) {
    const normalized = normalizeProfile(profile)
    const exists = profiles.some((item) => item.id === normalized.id)
    const nextProfiles = exists
      ? profiles.map((item) => item.id === normalized.id ? normalized : item)
      : [...profiles, normalized]

    saveProfiles(nextProfiles)
    setEditingProfileId(normalized.id)
  }

  function deleteProfile(profileId: string) {
    if (profileId === frostProfile.id) return
    const nextProfiles = profiles.filter((profile) => profile.id !== profileId)
    saveProfiles(nextProfiles)

    if (editingProfileId === profileId) setEditingProfileId(frostProfile.id)
    if (selectedProfileId === profileId) {
      setSelectedProfileId(activeProfileId === profileId ? frostProfile.id : activeProfileId)
    }
    if (activeProfileId === profileId) sendProfile(frostProfile)
  }

  function applySelectedProfile() {
    const profile = profiles.find((item) => item.id === selectedProfileId)
    if (profile) sendProfile(profile)
  }

  function selectTrack(trackOverride: string) {
    sendSettings({ ...settings, trackOverride })
  }

  function selectOverlayLayout(overlayLayout: OverlayLayout) {
    sendSettings({ ...settings, overlayLayout })
  }

  function updateDriverLayout(driverLayout: DriverLayoutConfig) {
    sendSettings({ ...settings, driverLayout })
  }

  function updatePreference<K extends keyof OverlaySettings>(
    key: K,
    value: OverlaySettings[K],
  ) {
    sendSettings({ ...settings, [key]: value })
  }

  function resetOverlaySettings() {
    const nextSettings: OverlaySettings = {
      ...defaultSettings,
      selectedCarNumber: settings.selectedCarNumber,
      driverLayout: settings.driverLayout,
      overlayLayout: settings.overlayLayout,
    }
    sendSettings(nextSettings)
  }

  function resetControlPanelSettings() {
    updatePreference('uiScale', 1)
  }

  function resetSavedLayouts() {
    localStorage.removeItem(LAYOUT_PROFILES_KEY)
    window.dispatchEvent(new CustomEvent('fuego-layout-profiles-reset'))
  }

  function factoryResetFuego() {
    if (!window.confirm(
      'Reset Fuego to factory defaults? Driver profiles, saved layouts, and preferences will be removed.',
    )) return

    localStorage.removeItem(SETTINGS_KEY)
    localStorage.removeItem(LEGACY_SETTINGS_KEY)
    localStorage.removeItem(PROFILES_KEY)
    localStorage.removeItem(ACTIVE_PROFILE_KEY)
    localStorage.removeItem(LAYOUT_PROFILES_KEY)

    const nextSettings = structuredClone(defaultSettings)
    setSettings(nextSettings)
    window.location.reload()
  }

  async function checkForAppUpdates() {
    if (!window.fuegoUpdater) {
      window.open('https://github.com/frosstbiite/fuego-overlay/releases/latest', '_blank')
      return
    }

    try {
      setUpdateButtonText('CHECKING...')
      const result = await window.fuegoUpdater.checkForUpdates()
      if (result?.currentVersion) setAppVersion(result.currentVersion)
    } catch (error) {
      console.error('Could not check for Fuego updates:', error)
    } finally {
      setUpdateButtonText('CHECK FOR UPDATES')
    }
  }

  function openDriverOverlay() {
    window.open(driverOverlayUrl, '_blank')
  }

  async function copySourceUrl(source: 'driver') {
    const sourceUrl = driverOverlayUrl
    try {
      await navigator.clipboard.writeText(sourceUrl)
      setCopiedSource(source)
      window.setTimeout(() => setCopiedSource(null), 1500)
    } catch (error) {
      console.error('Could not copy browser-source URL:', error)
    }
  }

  const driverSourceConnected = overlayStatus.driverConnections > 0
  const lapDisplay =
    raceInformation.totalLaps > 0
      ? `${raceInformation.selectedLap} / ${raceInformation.totalLaps}`
      : raceInformation.selectedLap > 0
        ? String(raceInformation.selectedLap)
        : '--'

  const controlProfileStyle = {
    '--control-blue': activeProfile.primaryColor,
    '--control-deep-blue': activeProfile.secondaryColor,
    '--control-yellow': activeProfile.numberColor,
    '--control-white': activeProfile.textColor,
    '--control-trim': activeProfile.trimColor,
    '--control-ui-scale': settings.uiScale,
  } as CSSProperties

  return (
    <main className="control-stage" style={controlProfileStyle}>
      <section className="control-panel">
        <div className="control-stripes" />

        <header className="control-header">
          <div className="control-number">{activeProfile.carNumber}</div>
          <div>
            <span className="control-kicker">
              {activeProfile.firstName}{' '}
              {activeProfile.nickname && `“${activeProfile.nickname}” `}
              {activeProfile.lastName}
            </span>
            <h1>OVERLAY CONTROL</h1>
          </div>
          <div className={[
            'control-status',
            iracingConnected
              ? 'status-live'
              : serverConnected
                ? 'status-waiting'
                : 'status-offline',
          ].join(' ')}>
            <span />
            {iracingConnected
              ? 'iRACING LIVE'
              : serverConnected
                ? 'WAITING FOR iRACING'
                : 'SERVER OFFLINE'}
          </div>
        </header>

        <nav className="control-tabs" aria-label="Control sections">
          {[
            ['driver', 'DRIVER PROFILE'],
            ['overlay', 'OVERLAY CONTROL'],
            ['broadcaster', 'BROADCASTER'],
            ['race', 'RACE CONTROL'],
            ['settings', 'SETTINGS'],
          ].map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab as ControlTab)}
            >
              {label}
            </button>
          ))}
        </nav>

        {activeTab === 'driver' && (
          <div className="tab-page">
            <section className="control-card driver-card driver-profile-summary">
              <h2>ACTIVE DRIVER PROFILE</h2>
              <label className="control-label" htmlFor="selected-profile">
                DRIVER PROFILE
              </label>
              <div className="profile-select-row">
                <select
                  id="selected-profile"
                  value={selectedProfileId}
                  onChange={(event) => setSelectedProfileId(event.target.value)}
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {`#${profile.carNumber} — ${profile.profileName}`}
                    </option>
                  ))}
                </select>
                <button type="button" className="apply-button" onClick={applySelectedProfile}>
                  APPLY PROFILE
                </button>
              </div>
              <div className="selected-driver">
                <strong>#{activeProfile.carNumber}</strong>
                <span>
                  {activeProfile.firstName}{' '}
                  {activeProfile.nickname && `“${activeProfile.nickname}” `}
                  {activeProfile.lastName}
                </span>
              </div>
              <div className="detected-driver">
                iRACING: {driverName || 'DRIVER NOT DETECTED'}
              </div>
            </section>
            <ProfileManager
              profiles={profiles}
              activeProfileId={editingProfileId}
              onActivate={activateProfile}
              onSave={saveProfile}
              onDelete={deleteProfile}
            />
          </div>
        )}

        {activeTab === 'overlay' && (
          <div className="control-grid">
            <section className="control-card layout-selector-card">
              <h2>ONBOARD OVERLAY LAYOUT</h2>
              <div className="layout-selector-buttons">
                <button
                  type="button"
                  className={settings.overlayLayout === 'classic' ? 'layout-choice active' : 'layout-choice'}
                  onClick={() => selectOverlayLayout('classic')}
                >
                  <strong>FUEGO CLASSIC</strong>
                  <span>Current overlay</span>
                </button>
                <button
                  type="button"
                  className={settings.overlayLayout === 'driver' ? 'layout-choice active' : 'layout-choice'}
                  onClick={() => selectOverlayLayout('driver')}
                >
                  <strong>FUEGO DRIVER</strong>
                  <span>Modular driver-feed layout</span>
                </button>
                <button type="button" className="layout-choice disabled" disabled>
                  <strong>FUEGO COCKPIT</strong>
                  <span>Coming next</span>
                </button>
              </div>
            </section>

            {settings.overlayLayout === 'driver' && (
              <DriverLayoutEditor
                value={settings.driverLayout}
                onChange={updateDriverLayout}
                showConditionalWidgets={settings.showConditionalWidgetsInEditor}
                showSafeAreaGuides={settings.showSafeAreaGuides}
              />
            )}

            <section className="control-card race-card">
              <h2>RACE INFORMATION</h2>
              <dl className="race-info-list">
                <div><dt>POSITION</dt><dd>{raceInformation.position > 0 ? `P${raceInformation.position}` : '--'}</dd></div>
                <div><dt>LAP</dt><dd>{lapDisplay}</dd></div>
                <div><dt>GAP</dt><dd>{formatGap(raceInformation.position, raceInformation.gapToLeader)}</dd></div>
                <div>
                  <dt>iRACING ID</dt>
                  <dd className="race-iracing-id">
                    {raceInformation.iracingCustomerId > 0
                      ? raceInformation.iracingCustomerId
                      : '--'}
                  </dd>
                </div>
                <div>
                  <dt>STATUS</dt>
                  <dd className={raceInformation.onPitRoad ? 'race-status-pit' : 'race-status-track'}>
                    {iracingConnected
                      ? raceInformation.onPitRoad ? 'PIT ROAD' : 'ON TRACK'
                      : '--'}
                  </dd>
                </div>
                <div><dt>LAST LAP</dt><dd>{formatLapTime(raceInformation.lastLapTime)}</dd></div>
                <div><dt>BEST LAP</dt><dd>{formatLapTime(raceInformation.bestLapTime)}</dd></div>
              </dl>
            </section>

            <section className="control-card session-card">
              <h2>SESSION STATUS</h2>
              <dl className="status-list">
                <div><dt>TELEMETRY</dt><dd>{iracingConnected ? 'CONNECTED' : 'DISCONNECTED'}</dd></div>
                <div><dt>DETECTED TRACK</dt><dd>{detectedTrackName}</dd></div>
                <div><dt>MAP IN USE</dt><dd>{trackName}</dd></div>
              </dl>

              <label className="control-label track-select-label" htmlFor="track-override">
                TRACK MAP OVERRIDE
              </label>
              <select
                id="track-override"
                className="track-select"
                value={settings.trackOverride}
                onChange={(event) => selectTrack(event.target.value)}
              >
                <option value="auto">AUTOMATIC — USE iRACING</option>
                {trackOptions.map((track) => (
                  <option key={track} value={track}>{track.toUpperCase()}</option>
                ))}
              </select>
            </section>

            <section className="control-card obs-card">
              <h2>OBS BROWSER SOURCE</h2>
              <p className="control-help">Add this source to OBS once. Fuego Classic, Fuego Driver, and future onboard layouts all render through this single source.</p>
              <div className="obs-source">
                <div className="obs-source-heading">
                  <span className={driverSourceConnected ? 'obs-indicator obs-connected' : 'obs-indicator'} />
                  <strong>FUEGO OVERLAY</strong>
                  <em>{driverSourceConnected ? `CONNECTED (${overlayStatus.driverConnections})` : 'NOT CONNECTED'}</em>
                </div>
                <div className="obs-url-row">
                  <input value={driverOverlayUrl} readOnly />
                  <button type="button" onClick={() => copySourceUrl('driver')}>
                    {copiedSource === 'driver' ? 'COPIED' : 'COPY'}
                  </button>
                </div>
              </div>
              <div className="source-buttons compact-source-buttons">
                <button type="button" onClick={openDriverOverlay}>OPEN FUEGO OVERLAY</button>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'broadcaster' && (
          <section className="coming-soon-page">
            <span className="coming-soon-kicker">FUEGO BROADCAST SUITE</span>
            <h2>BROADCASTER</h2>
            <p>Camera switching, driver focus, live TV graphics, replay controls, and broadcast hotkeys are planned for a future release.</p>
            <strong>COMING SOON</strong>
          </section>
        )}

        {activeTab === 'race' && (
          <section className="coming-soon-page">
            <span className="coming-soon-kicker">FUEGO RACE ADMINISTRATION</span>
            <h2>RACE CONTROL</h2>
            <p>Caution controls, pace-lap management, driver black flags, DQ protection, command lockouts, and race-control history are planned for a future release.</p>
            <strong>COMING SOON</strong>
          </section>
        )}

        {activeTab === 'settings' && (
          <div className="settings-page">
            <section className="control-card settings-card">
              <h2>APPLICATION</h2>
              <dl className="settings-list">
                <div><dt>VERSION</dt><dd>v{appVersion}</dd></div>
                <div><dt>UPDATE CHANNEL</dt><dd>STABLE</dd></div>
                <div><dt>AUTOMATIC UPDATE CHECK</dt><dd className="setting-enabled">ENABLED</dd></div>
                <div><dt>STARTUP SPLASH</dt><dd className="setting-enabled">ENABLED</dd></div>
              </dl>
              <button
                type="button"
                className="settings-action settings-update-button"
                onClick={checkForAppUpdates}
              >
                {updateButtonText}
              </button>
            </section>

            <section className="control-card settings-card">
              <h2>DRIVER LAYOUT</h2>
              <div className="settings-form-grid">
                <label className="settings-toggle-row">
                  <span>
                    <strong>REMEMBER LAST LAYOUT</strong>
                    <small>Open the layout that was active when Fuego closed.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.rememberLastLayout}
                    onChange={(event) => updatePreference('rememberLastLayout', event.target.checked)}
                  />
                </label>

                <label>
                  <span>DEFAULT STARTUP LAYOUT</span>
                  <select
                    value={settings.defaultOverlayLayout}
                    onChange={(event) => updatePreference('defaultOverlayLayout', event.target.value as OverlayLayout)}
                    disabled={settings.rememberLastLayout}
                  >
                    <option value="classic">Fuego Classic</option>
                    <option value="driver">Fuego Driver</option>
                  </select>
                </label>

                <label className="settings-toggle-row">
                  <span>
                    <strong>SHOW CONDITIONAL WIDGETS IN EDITOR</strong>
                    <small>Keep conditional widgets visible while designing a layout.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.showConditionalWidgetsInEditor}
                    onChange={(event) => updatePreference('showConditionalWidgetsInEditor', event.target.checked)}
                  />
                </label>
              </div>
            </section>

            <section className="control-card settings-card">
              <h2>OBS / DISPLAY</h2>
              <div className="settings-form-grid">
                <label>
                  <span>BASE CANVAS</span>
                  <select
                    value={settings.canvasPreset}
                    onChange={(event) => updatePreference('canvasPreset', event.target.value as OverlaySettings['canvasPreset'])}
                  >
                    <option value="720p">1280 × 720</option>
                    <option value="1080p">1920 × 1080</option>
                    <option value="1440p">2560 × 1440</option>
                    <option value="4k">3840 × 2160</option>
                  </select>
                </label>

                <label className="settings-toggle-row">
                  <span>
                    <strong>AUTO-SCALE OVERLAY</strong>
                    <small>Scale percentage-based Driver layouts with the OBS browser canvas.</small>
                  </span>
                  <input type="checkbox" checked={settings.autoScaleOverlay} onChange={(event) => updatePreference('autoScaleOverlay', event.target.checked)} />
                </label>

                <label className="settings-toggle-row">
                  <span>
                    <strong>SAFE-AREA GUIDES</strong>
                    <small>Show broadcast-safe guides inside the Driver layout editor.</small>
                  </span>
                  <input type="checkbox" checked={settings.showSafeAreaGuides} onChange={(event) => updatePreference('showSafeAreaGuides', event.target.checked)} />
                </label>
              </div>
            </section>

            <section className="control-card settings-card">
              <h2>TELEMETRY</h2>
              <div className="settings-form-grid settings-three-column">
                <label>
                  <span>SPEED</span>
                  <select value={settings.speedUnit} onChange={(event) => updatePreference('speedUnit', event.target.value as OverlaySettings['speedUnit'])}>
                    <option value="mph">MPH</option>
                    <option value="kph">KPH</option>
                  </select>
                </label>
                <label>
                  <span>FUEL</span>
                  <select value={settings.fuelUnit} onChange={(event) => updatePreference('fuelUnit', event.target.value as OverlaySettings['fuelUnit'])}>
                    <option value="liters">Liters</option>
                    <option value="gallons">Gallons</option>
                    <option value="percent">Percent</option>
                  </select>
                </label>
                <label>
                  <span>TEMPERATURE</span>
                  <select value={settings.temperatureUnit} onChange={(event) => updatePreference('temperatureUnit', event.target.value as OverlaySettings['temperatureUnit'])}>
                    <option value="fahrenheit">°F</option>
                    <option value="celsius">°C</option>
                  </select>
                </label>
                <label>
                  <span>UPDATE RATE</span>
                  <select value={settings.telemetryRate} onChange={(event) => updatePreference('telemetryRate', event.target.value as OverlaySettings['telemetryRate'])}>
                    <option value="normal">Normal · 30 Hz</option>
                    <option value="high">High · 60 Hz</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="control-card settings-card">
              <h2>APPEARANCE</h2>
              <div className="settings-form-grid">
                <label>
                  <span>CONTROL PANEL SCALE · {Math.round(settings.uiScale * 100)}%</span>
                  <input type="range" min="0.85" max="1.2" step="0.05" value={settings.uiScale} onChange={(event) => updatePreference('uiScale', Number(event.target.value))} />
                </label>
                <label className="settings-toggle-row">
                  <span>
                    <strong>OVERLAY ANIMATIONS</strong>
                    <small>Enable flag sweeps and other overlay transitions.</small>
                  </span>
                  <input type="checkbox" checked={settings.overlayAnimations} onChange={(event) => updatePreference('overlayAnimations', event.target.checked)} />
                </label>
                <label>
                  <span>ANIMATION SPEED</span>
                  <select value={settings.animationSpeed} disabled={!settings.overlayAnimations} onChange={(event) => updatePreference('animationSpeed', event.target.value as OverlaySettings['animationSpeed'])}>
                    <option value="slow">Slow</option>
                    <option value="normal">Normal</option>
                    <option value="fast">Fast</option>
                  </select>
                </label>
                <label>
                  <span>OVERLAY OPACITY · {Math.round(settings.overlayOpacity * 100)}%</span>
                  <input type="range" min="0.4" max="1" step="0.05" value={settings.overlayOpacity} onChange={(event) => updatePreference('overlayOpacity', Number(event.target.value))} />
                </label>
              </div>
            </section>

            <section className="control-card settings-card">
              <h2>LOCAL SERVICES</h2>
              <dl className="settings-list">
                <div><dt>OVERLAY SERVER</dt><dd>127.0.0.1:5173</dd></div>
                <div><dt>TELEMETRY SERVICE</dt><dd>127.0.0.1:3200</dd></div>
                <div><dt>TELEMETRY STATUS</dt><dd>{serverConnected ? 'ONLINE' : 'OFFLINE'}</dd></div>
                <div><dt>iRACING STATUS</dt><dd>{iracingConnected ? 'CONNECTED' : 'WAITING'}</dd></div>
              </dl>
            </section>

            <section className="control-card settings-card settings-recovery">
              <h2>DEFAULTS / RECOVERY</h2>
              <p>
                Reset only the part of Fuego you need. Factory Reset removes
                local driver profiles, saved layouts, and application preferences.
              </p>
              <div className="settings-recovery-actions">
                <button type="button" onClick={resetOverlaySettings}>RESET OVERLAY SETTINGS</button>
                <button type="button" onClick={resetControlPanelSettings}>RESET CONTROL PANEL</button>
                <button type="button" onClick={resetSavedLayouts}>RESET SAVED LAYOUTS</button>
                <button type="button" className="settings-danger" onClick={factoryResetFuego}>FACTORY RESET FUEGO</button>
              </div>
            </section>
          </div>
        )}

        <footer className="control-footer">
          FUEGO OVERLAY v{appVersion}
          {' • '}
          © 2026 FUEGO AUTOSPORT
          {' • '}
          ALL RIGHTS RESERVED
        </footer>
      </section>
    </main>
  )
}

export default ControlPanel
