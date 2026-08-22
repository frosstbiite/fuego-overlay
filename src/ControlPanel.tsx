import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import ProfileManager from './ProfileManager'
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
}

type OverlayStatus = {
  driverConnections: number
  tickerConnections: number
}

type RaceInformation = {
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

const defaultSettings: OverlaySettings = {
  selectedCarNumber: '21',
  showDriverBar: true,
  showTicker: true,
  showTrackMap: true,
  showSponsorLogo: true,
  trackOverride: 'auto',
}

const defaultOverlayStatus: OverlayStatus = {
  driverConnections: 0,
  tickerConnections: 0,
}

const defaultRaceInformation: RaceInformation = {
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

    return {
      ...defaultSettings,
      ...JSON.parse(savedSettings),
    } as OverlaySettings
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
    !Number.isFinite(
      gapToLeader,
    ) ||
    gapToLeader < 0
  ) {
    return '--'
  }

  return (
    `+${gapToLeader.toFixed(3)}`
  )
}

function ControlPanel() {
  const socketRef =
    useRef<WebSocket | null>(null)

  const reconnectTimerRef =
    useRef<number | null>(null)

  const [activeTab, setActiveTab] =
    useState<ControlTab>('driver')

  const [profiles, setProfiles] =
    useState<DriverProfile[]>(loadSavedProfiles)

  const [activeProfileId, setActiveProfileId] =
    useState(loadActiveProfileId)

  const [selectedProfileId, setSelectedProfileId] =
    useState(loadActiveProfileId)

  const [editingProfileId, setEditingProfileId] =
    useState(loadActiveProfileId)

  /*
   * This is a snapshot of the profile that has actually been applied.
   * Editing or saving a profile must not alter the live GUI/overlays until
   * APPLY PROFILE is pressed in Driver Profile.
   */
  const [activeProfile, setActiveProfile] =
    useState<DriverProfile>(() =>
      profiles.find((profile) => profile.id === activeProfileId) ||
      frostProfile,
    )

  const activeProfileRef = useRef(activeProfile)

  useEffect(() => {
    activeProfileRef.current = activeProfile
  }, [activeProfile])

  const [serverConnected, setServerConnected] =
    useState(false)

  const [iracingConnected, setIracingConnected] =
    useState(false)

  const [trackName, setTrackName] =
    useState('Unknown Track')

  const [
    detectedTrackName,
    setDetectedTrackName,
  ] = useState('Unknown Track')

  const [driverName, setDriverName] =
    useState('')

  const [settings, setSettings] =
    useState<OverlaySettings>(
      loadSavedSettings,
    )

  const [
    overlayStatus,
    setOverlayStatus,
  ] = useState<OverlayStatus>(
    defaultOverlayStatus,
  )

  const [
    raceInformation,
    setRaceInformation,
  ] = useState<RaceInformation>(
    defaultRaceInformation,
  )

  const [
    copiedSource,
    setCopiedSource,
  ] = useState<
    'driver' | 'ticker' | null
  >(null)

  const driverOverlayUrl =
    `${window.location.origin}/`

  const tickerOverlayUrl =
    `${window.location.origin}/?view=ticker`

  useEffect(() => {
    let stopped = false

    function connect() {
      if (stopped) {
        return
      }

      const socket =
        new WebSocket(
          'ws://localhost:3200',
        )

      socketRef.current = socket

      socket.onopen = () => {
        setServerConnected(true)

        socket.send(
          JSON.stringify({
            type: 'registerClient',
            clientType: 'control',
          }),
        )

        const savedSettings =
          loadSavedSettings()

        socket.send(
          JSON.stringify({
            type: 'updateSettings',
            settings: savedSettings,
          }),
        )

        socket.send(
          JSON.stringify({
            type: 'updateProfile',
            profile: activeProfileRef.current,
          }),
        )
      }

      socket.onmessage = (
        event,
      ) => {
        try {
          const message =
            JSON.parse(
              event.data,
            ) as TelemetryMessage | ProfileMessage

          if (message.type === 'profile') {
            return
          }

          setIracingConnected(
            Boolean(
              message.connected,
            ),
          )

          setTrackName(
            message.trackName ||
              'Unknown Track',
          )

          setDetectedTrackName(
            message.detectedTrackName ||
              'Unknown Track',
          )

          setDriverName(
            message.selectedDriverName ||
              '',
          )

          setRaceInformation({
            position:
              message.position ?? 0,

            selectedLap:
              message.selectedLap ?? 0,

            currentLap:
              message.currentLap ?? 0,

            totalLaps:
              message.totalLaps ?? 0,

            gapToLeader:
              message.gapToLeader ?? -1,

            onPitRoad:
              Boolean(
                message.onPitRoad,
              ),

            lastLapTime:
              message.lastLapTime ?? 0,

            bestLapTime:
              message.bestLapTime ?? 0,
          })

          if (
            message.overlayStatus
          ) {
            setOverlayStatus(
              message.overlayStatus,
            )
          }

          if (message.settings) {
            const receivedSettings = {
              ...defaultSettings,
              ...message.settings,
            }

            setSettings(
              receivedSettings,
            )

            localStorage.setItem(
              SETTINGS_KEY,
              JSON.stringify(
                receivedSettings,
              ),
            )

          }
        } catch (error) {
          console.error(
            'Could not read control-panel data:',
            error,
          )
        }
      }

      socket.onerror = () => {
        setServerConnected(false)
      }

      socket.onclose = () => {
        setServerConnected(false)
        setIracingConnected(false)

        setOverlayStatus(
          defaultOverlayStatus,
        )

        setRaceInformation(
          defaultRaceInformation,
        )

        if (!stopped) {
          reconnectTimerRef.current =
            window.setTimeout(
              connect,
              1500,
            )
        }
      }
    }

    connect()

    return () => {
      stopped = true

      if (
        reconnectTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          reconnectTimerRef.current,
        )
      }

      socketRef.current?.close()
    }
  }, [])

  function sendSettings(
    nextSettings:
      OverlaySettings,
  ) {
    setSettings(nextSettings)

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(
        nextSettings,
      ),
    )

    const socket =
      socketRef.current

    if (
      socket &&
      socket.readyState ===
        WebSocket.OPEN
    ) {
      socket.send(
        JSON.stringify({
          type: 'updateSettings',
          settings: nextSettings,
        }),
      )
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
      socket.send(
        JSON.stringify({
          type: 'updateProfile',
          profile,
        }),
      )
    }
  }

  function saveProfiles(nextProfiles: DriverProfile[]) {
    setProfiles(nextProfiles)
    localStorage.setItem(PROFILES_KEY, JSON.stringify(nextProfiles))
  }

  function activateProfile(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId)
    if (profile) {
      setEditingProfileId(profile.id)
    }
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

    if (editingProfileId === profileId) {
      setEditingProfileId(frostProfile.id)
    }

    if (selectedProfileId === profileId) {
      setSelectedProfileId(
        activeProfileId === profileId
          ? frostProfile.id
          : activeProfileId,
      )
    }

    if (activeProfileId === profileId) {
      sendProfile(frostProfile)
    }
  }

  function applySelectedProfile() {
    const profile = profiles.find(
      (item) => item.id === selectedProfileId,
    )

    if (profile) {
      sendProfile(profile)
    }
  }

  function selectTrack(
    trackOverride: string,
  ) {
    sendSettings({
      ...settings,
      trackOverride,
    })
  }

  function toggleSetting(
    settingName:
      | 'showDriverBar'
      | 'showTicker'
      | 'showTrackMap'
      | 'showSponsorLogo',
  ) {
    sendSettings({
      ...settings,
      [settingName]:
        !settings[settingName],
    })
  }

  function openDriverOverlay() {
    window.open(
      driverOverlayUrl,
      '_blank',
      'noopener,noreferrer',
    )
  }

  function openTickerOverlay() {
    window.open(
      tickerOverlayUrl,
      '_blank',
      'noopener,noreferrer',
    )
  }

  async function copySourceUrl(
    source:
      'driver' | 'ticker',
  ) {
    const sourceUrl =
      source === 'driver'
        ? driverOverlayUrl
        : tickerOverlayUrl

    try {
      await navigator.clipboard.writeText(
        sourceUrl,
      )

      setCopiedSource(source)

      window.setTimeout(
        () => {
          setCopiedSource(
            (currentSource) =>
              currentSource ===
              source
                ? null
                : currentSource,
          )
        },
        1500,
      )
    } catch (error) {
      console.error(
        'Could not copy OBS source:',
        error,
      )
    }
  }

  const driverSourceConnected =
    overlayStatus
      .driverConnections > 0

  const tickerSourceConnected =
    overlayStatus
      .tickerConnections > 0

  const lapDisplay =
    raceInformation.totalLaps > 0
      ? `${raceInformation.selectedLap} / ${raceInformation.totalLaps}`
      : raceInformation.selectedLap > 0
        ? String(
            raceInformation.selectedLap,
          )
        : '--'

  const controlProfileStyle = {
    '--control-blue': activeProfile.primaryColor,
    '--control-deep-blue': activeProfile.secondaryColor,
    '--control-yellow': activeProfile.numberColor,
    '--control-white': activeProfile.textColor,
    '--control-trim': activeProfile.trimColor,
  } as CSSProperties

  return (
    <main className="control-stage" style={controlProfileStyle}>
      <section className="control-panel">
        <div className="control-stripes" />

        <header className="control-header">
          <div className="control-number">
            {activeProfile.carNumber}
          </div>

          <div>
            <span className="control-kicker">
              {activeProfile.firstName}{' '}
              {activeProfile.nickname && `“${activeProfile.nickname}” `}
              {activeProfile.lastName}
            </span>

            <h1>
              OVERLAY CONTROL
            </h1>
          </div>

          <div
            className={[
              'control-status',

              iracingConnected
                ? 'status-live'
                : serverConnected
                  ? 'status-waiting'
                  : 'status-offline',
            ].join(' ')}
          >
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
          <section className="control-card driver-card">
            <h2>
              SELECTED DRIVER
            </h2>

            <label
              className="control-label"
              htmlFor="selected-profile"
            >
              DRIVER PROFILE
            </label>

            <div className="profile-select-row">
              <select
                id="selected-profile"
                value={selectedProfileId}
                onChange={(event) => {
                  setSelectedProfileId(
                    event.target.value,
                  )
                }}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {`#${profile.carNumber} — ${profile.profileName}`}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="apply-button"
                onClick={applySelectedProfile}
              >
                APPLY PROFILE
              </button>
            </div>

            <div className="selected-driver">
              <strong>
                #
                {
                  activeProfile.carNumber
                }
              </strong>

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

          <section className="control-card race-card">
            <h2>
              RACE INFORMATION
            </h2>

            <dl className="race-info-list">
              <div>
                <dt>POSITION</dt>

                <dd>
                  {raceInformation.position >
                  0
                    ? `P${raceInformation.position}`
                    : '--'}
                </dd>
              </div>

              <div>
                <dt>LAP</dt>
                <dd>{lapDisplay}</dd>
              </div>

              <div>
                <dt>GAP</dt>

                <dd>
                  {formatGap(
                    raceInformation.position,
                    raceInformation.gapToLeader,
                  )}
                </dd>
              </div>

              <div>
                <dt>STATUS</dt>

                <dd
                  className={
                    raceInformation.onPitRoad
                      ? 'race-status-pit'
                      : 'race-status-track'
                  }
                >
                  {iracingConnected
                    ? raceInformation.onPitRoad
                      ? 'PIT ROAD'
                      : 'ON TRACK'
                    : '--'}
                </dd>
              </div>

              <div>
                <dt>LAST LAP</dt>

                <dd>
                  {formatLapTime(
                    raceInformation.lastLapTime,
                  )}
                </dd>
              </div>

              <div>
                <dt>BEST LAP</dt>

                <dd>
                  {formatLapTime(
                    raceInformation.bestLapTime,
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="control-card session-card">
            <h2>
              SESSION STATUS
            </h2>

            <dl className="status-list">
              <div>
                <dt>TELEMETRY</dt>

                <dd>
                  {iracingConnected
                    ? 'CONNECTED'
                    : 'DISCONNECTED'}
                </dd>
              </div>

              <div>
                <dt>
                  DETECTED TRACK
                </dt>

                <dd>
                  {detectedTrackName}
                </dd>
              </div>

              <div>
                <dt>MAP IN USE</dt>

                <dd>
                  {trackName}
                </dd>
              </div>
            </dl>

            <label
              className="control-label track-select-label"
              htmlFor="track-override"
            >
              TRACK MAP OVERRIDE
            </label>

            <select
              id="track-override"
              className="track-select"
              value={
                settings.trackOverride
              }
              onChange={(event) => {
                selectTrack(
                  event.target.value,
                )
              }}
            >
              <option value="auto">
                AUTOMATIC — USE iRACING
              </option>

              {trackOptions.map(
                (track) => (
                  <option
                    key={track}
                    value={track}
                  >
                    {track.toUpperCase()}
                  </option>
                ),
              )}
            </select>
          </section>

          <section className="control-card elements-card">
            <h2>
              OVERLAY ELEMENTS
            </h2>

            <button
              type="button"
              className="toggle-row"
              onClick={() =>
                toggleSetting(
                  'showDriverBar',
                )
              }
            >
              <span>
                DRIVER INFORMATION
              </span>

              <span
                className={
                  settings.showDriverBar
                    ? 'toggle-switch toggle-on'
                    : 'toggle-switch'
                }
              >
                <i />
              </span>
            </button>

            <button
              type="button"
              className="toggle-row"
              onClick={() =>
                toggleSetting(
                  'showTicker',
                )
              }
            >
              <span>
                RACE TICKER
              </span>

              <span
                className={
                  settings.showTicker
                    ? 'toggle-switch toggle-on'
                    : 'toggle-switch'
                }
              >
                <i />
              </span>
            </button>

            <button
              type="button"
              className="toggle-row"
              onClick={() =>
                toggleSetting(
                  'showTrackMap',
                )
              }
            >
              <span>
                TRACK MAP
              </span>

              <span
                className={
                  settings.showTrackMap
                    ? 'toggle-switch toggle-on'
                    : 'toggle-switch'
                }
              >
                <i />
              </span>
            </button>

            <button
              type="button"
              className="toggle-row"
              onClick={() =>
                toggleSetting(
                  'showSponsorLogo',
                )
              }
            >
              <span>
                PRIMARY SPONSOR LOGO
              </span>

              <span
                className={
                  settings.showSponsorLogo
                    ? 'toggle-switch toggle-on'
                    : 'toggle-switch'
                }
              >
                <i />
              </span>
            </button>
          </section>

          <section className="control-card obs-card">
            <h2>
              OBS STATUS
            </h2>

            <div className="obs-source">
              <div className="obs-source-heading">
                <span
                  className={
                    driverSourceConnected
                      ? 'obs-indicator obs-connected'
                      : 'obs-indicator'
                  }
                />

                <strong>
                  DRIVER OVERLAY
                </strong>

                <em>
                  {driverSourceConnected
                    ? `CONNECTED (${overlayStatus.driverConnections})`
                    : 'NOT CONNECTED'}
                </em>
              </div>

              <div className="obs-url-row">
                <input
                  value={
                    driverOverlayUrl
                  }
                  readOnly
                />

                <button
                  type="button"
                  onClick={() =>
                    copySourceUrl(
                      'driver',
                    )
                  }
                >
                  {copiedSource ===
                  'driver'
                    ? 'COPIED'
                    : 'COPY'}
                </button>
              </div>
            </div>

            <div className="obs-source">
              <div className="obs-source-heading">
                <span
                  className={
                    tickerSourceConnected
                      ? 'obs-indicator obs-connected'
                      : 'obs-indicator'
                  }
                />

                <strong>
                  RACE TICKER
                </strong>

                <em>
                  {tickerSourceConnected
                    ? `CONNECTED (${overlayStatus.tickerConnections})`
                    : 'NOT CONNECTED'}
                </em>
              </div>

              <div className="obs-url-row">
                <input
                  value={
                    tickerOverlayUrl
                  }
                  readOnly
                />

                <button
                  type="button"
                  onClick={() =>
                    copySourceUrl(
                      'ticker',
                    )
                  }
                >
                  {copiedSource ===
                  'ticker'
                    ? 'COPIED'
                    : 'COPY'}
                </button>
              </div>
            </div>

            <div className="source-buttons compact-source-buttons">
              <button
                type="button"
                onClick={
                  openDriverOverlay
                }
              >
                OPEN DRIVER
              </button>

              <button
                type="button"
                onClick={
                  openTickerOverlay
                }
              >
                OPEN TICKER
              </button>
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
                <div><dt>VERSION</dt><dd>v1.1.0</dd></div>
                <div><dt>UPDATE CHANNEL</dt><dd>STABLE</dd></div>
                <div><dt>AUTOMATIC UPDATE CHECK</dt><dd className="setting-enabled">ENABLED</dd></div>
                <div><dt>STARTUP SPLASH</dt><dd className="setting-enabled">ENABLED</dd></div>
                <div><dt>BRANDING HOLD</dt><dd>5 SECONDS</dd></div>
              </dl>
              <a
                className="settings-action"
                href="https://github.com/frosstbiite/fuego-overlay/releases/latest"
                target="_blank"
                rel="noreferrer"
              >
                CHECK FOR UPDATES
              </a>
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

            <section className="control-card settings-card settings-future">
              <h2>GENERAL SETTINGS</h2>
              <p>Additional startup, update, port, and application preferences will live here as Fuego Overlay expands.</p>
              <strong>MORE SETTINGS COMING SOON</strong>
            </section>
          </div>
        )}

          <footer className="control-footer">
          FUEGO OVERLAY v1.1.0
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
