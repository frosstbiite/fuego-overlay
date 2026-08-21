import { IRacingSDK } from 'irsdk-node'
import {
  WebSocket,
  WebSocketServer,
} from 'ws'

const PORT = 3200
const UPDATE_INTERVAL = 16

type FlagState =
  | 'pacing'
  | 'green'
  | 'yellow'
  | 'white'
  | 'checkered'

type OverlaySettings = {
  selectedCarNumber: string
  showDriverBar: boolean
  showTicker: boolean
  showTrackMap: boolean
  showSponsorLogo: boolean
  trackOverride: string
}

type OverlayClientType =
  | 'driver'
  | 'ticker'
  | 'control'
  | 'unknown'

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
  clientType?: OverlayClientType
  settings?: Partial<OverlaySettings>
  profile?: DriverProfile
}

type SessionDriver = {
  CarIdx: number
  UserName?: string
  AbbrevName?: string
  Initials?: string
  TeamName?: string
  CarNumber: string
  IsSpectator?: number
  CarIsPaceCar?: number
}

type SessionData = {
  WeekendInfo?: {
    TrackName?: string
    TrackDisplayName?: string
  }

  DriverInfo?: {
    Drivers?: SessionDriver[]
  }
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

const sdk = new IRacingSDK({
  autoEnableTelemetry: true,
})

const webSocketServer =
  new WebSocketServer({
    port: PORT,
  })

let wasConnected = false

const connectedClients =
  new Map<
    WebSocket,
    OverlayClientType
  >()

let overlaySettings: OverlaySettings = {
  selectedCarNumber: '21',
  showDriverBar: true,
  showTicker: true,
  showTrackMap: true,
  showSponsorLogo: true,
  trackOverride: 'auto',
}

let activeProfile: DriverProfile | null = null

function readValue<T>(
  name: string,
): T | undefined {
  const telemetry =
    sdk.getTelemetryVariable<T>(
      name as never,
    )

  return telemetry?.value?.[0]
}

function readArray<T>(
  name: string,
): T[] {
  const telemetry =
    sdk.getTelemetryVariable<T>(
      name as never,
    )

  return telemetry?.value ?? []
}

function normalizeCarNumber(
  carNumber: string,
) {
  const cleanedNumber =
    String(carNumber ?? '')
      .trim()
      .toUpperCase()

  if (/^\d+$/.test(cleanedNumber)) {
    return (
      cleanedNumber.replace(
        /^0+(?=\d)/,
        '',
      ) || '0'
    )
  }

  return cleanedNumber
}

function getLastName(
  fullName: string,
) {
  const cleanedName =
    fullName.trim()

  let lastName = cleanedName

  if (cleanedName.includes(',')) {
    lastName =
      cleanedName
        .split(',')[0]
        .trim()
  } else {
    const nameParts =
      cleanedName.split(/\s+/)

    lastName =
      nameParts[
        nameParts.length - 1
      ] ?? cleanedName
  }

  return lastName
    .replace(/\d+$/, '')
    .trim()
    .toUpperCase()
}

function getDriverName(
  driver: SessionDriver,
) {
  const availableName =
    driver.UserName ||
    driver.AbbrevName ||
    driver.TeamName ||
    `CAR ${driver.CarNumber}`

  return getLastName(
    availableName,
  )
}

function getValidTime(
  value: number | undefined,
) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 0
  }

  return value
}

function getFlagState(
  sessionFlags: number,
  sessionState: number,
  currentLap: number,
  totalLaps: number,
): FlagState {
  const CHECKERED_FLAG = 0x00000001
  const WHITE_FLAG = 0x00000002
  const GREEN_FLAG = 0x00000004
  const YELLOW_FLAG = 0x00000008
  const YELLOW_WAVING = 0x00000100
  const ONE_LAP_TO_GREEN = 0x00000200
  const GREEN_HELD = 0x00000400
  const CAUTION = 0x00004000
  const CAUTION_WAVING = 0x00008000
  const START_GO = 0x80000000

  const flags =
    sessionFlags >>> 0

  if (
    (flags & CHECKERED_FLAG) !== 0 ||
    sessionState === 5 ||
    sessionState === 6
  ) {
    return 'checkered'
  }

  if (sessionState < 4) {
    return 'pacing'
  }

  const yellowFlags =
    YELLOW_FLAG |
    YELLOW_WAVING |
    ONE_LAP_TO_GREEN |
    CAUTION |
    CAUTION_WAVING

  if (
    (flags & yellowFlags) !== 0
  ) {
    return 'yellow'
  }

  const isScheduledFinalLap =
    totalLaps > 0 &&
    currentLap > 0 &&
    currentLap >= totalLaps

  if (
    (flags & WHITE_FLAG) !== 0 ||
    isScheduledFinalLap
  ) {
    return 'white'
  }

  if (
    (flags & GREEN_FLAG) !== 0 ||
    (flags & GREEN_HELD) !== 0 ||
    (flags & START_GO) !== 0
  ) {
    return 'green'
  }

  return 'green'
}

function getLeaderboard(
  drivers: SessionDriver[],
  carPositions: number[],
): LeaderboardDriver[] {
  return drivers
    .filter((driver) => {
      const position =
        carPositions[
          driver.CarIdx
        ]

      return (
        driver &&
        driver.IsSpectator !== 1 &&
        driver.CarIsPaceCar !== 1 &&
        typeof position ===
          'number' &&
        position > 0
      )
    })
    .map((driver) => ({
      position:
        carPositions[
          driver.CarIdx
        ],

      carIndex:
        driver.CarIdx,

      carNumber:
        String(
          driver.CarNumber ?? '',
        ),

      name:
        getDriverName(driver),
    }))
    .sort(
      (
        firstDriver,
        secondDriver,
      ) => (
        firstDriver.position -
        secondDriver.position
      ),
    )
}

function getTrackCars(
  drivers: SessionDriver[],
  carLapDistances: number[],
): TrackCar[] {
  return drivers
    .filter((driver) => {
      const lapDistance =
        carLapDistances[
          driver.CarIdx
        ]

      return (
        driver &&
        driver.IsSpectator !== 1 &&
        driver.CarIsPaceCar !== 1 &&
        typeof lapDistance ===
          'number' &&
        Number.isFinite(
          lapDistance,
        ) &&
        lapDistance >= 0
      )
    })
    .map((driver) => {
      const rawLapDistance =
        carLapDistances[
          driver.CarIdx
        ] ?? 0

      const lapDistancePct =
        ((rawLapDistance % 1) +
          1) %
        1

      return {
        carIndex:
          driver.CarIdx,

        carNumber:
          String(
            driver.CarNumber ?? '',
          ),

        name:
          getDriverName(driver),

        lapDistancePct,
      }
    })
}

function getOverlayStatus() {
  let driverConnections = 0
  let tickerConnections = 0
  let controlConnections = 0

  for (
    const clientType of
    connectedClients.values()
  ) {
    if (clientType === 'driver') {
      driverConnections += 1
    }

    if (clientType === 'ticker') {
      tickerConnections += 1
    }

    if (clientType === 'control') {
      controlConnections += 1
    }
  }

  return {
    driverConnections,
    tickerConnections,
    controlConnections,
  }
}

function broadcast(
  data: object,
) {
  const message =
    JSON.stringify(data)

  for (
    const client of
    webSocketServer.clients
  ) {
    if (
      client.readyState ===
      WebSocket.OPEN
    ) {
      client.send(message)
    }
  }
}

function sendActiveProfile(
  client?: WebSocket,
) {
  if (!activeProfile) return

  const message = JSON.stringify({
    type: 'profile',
    profile: activeProfile,
  })

  if (client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
    return
  }

  for (const connectedClient of webSocketServer.clients) {
    if (connectedClient.readyState === WebSocket.OPEN) {
      connectedClient.send(message)
    }
  }
}

function updateOverlaySettings(
  incomingSettings:
    Partial<OverlaySettings>,
) {
  const nextCarNumber =
    incomingSettings
      .selectedCarNumber !==
    undefined
      ? normalizeCarNumber(
          String(
            incomingSettings
              .selectedCarNumber,
          ),
        ).slice(0, 4)
      : overlaySettings
          .selectedCarNumber

  const incomingTrackOverride =
    incomingSettings
      .trackOverride

  const nextTrackOverride =
    typeof incomingTrackOverride ===
      'string' &&
    incomingTrackOverride.trim()
      ? incomingTrackOverride.trim()
      : overlaySettings
          .trackOverride

  overlaySettings = {
    selectedCarNumber:
      nextCarNumber ||
      overlaySettings
        .selectedCarNumber,

    showDriverBar:
      typeof incomingSettings
        .showDriverBar ===
      'boolean'
        ? incomingSettings
            .showDriverBar
        : overlaySettings
            .showDriverBar,

    showTicker:
      typeof incomingSettings
        .showTicker ===
      'boolean'
        ? incomingSettings
            .showTicker
        : overlaySettings
            .showTicker,

    showTrackMap:
      typeof incomingSettings
        .showTrackMap ===
      'boolean'
        ? incomingSettings
            .showTrackMap
        : overlaySettings
            .showTrackMap,

    showSponsorLogo:
      typeof incomingSettings
        .showSponsorLogo ===
      'boolean'
        ? incomingSettings
            .showSponsorLogo
        : overlaySettings
            .showSponsorLogo,

    trackOverride:
      nextTrackOverride,
  }

  console.log(
    'Overlay settings updated:',
    overlaySettings,
  )
}

function tick() {
  const connected =
    sdk.waitForData(
      UPDATE_INTERVAL,
    )

  if (connected) {
    if (!wasConnected) {
      wasConnected = true

      sdk.resetTelemetryVariableCache()

      console.log(
        'Connected to iRacing telemetry',
      )
    }

    const cameraCarIndex =
      readValue<number>(
        'CamCarIdx',
      ) ??
      readValue<number>(
        'PlayerCarIdx',
      ) ??
      0

    const carPositions =
      readArray<number>(
        'CarIdxPosition',
      )

    const carLapsCompleted =
      readArray<number>(
        'CarIdxLapCompleted',
      )

    const carLapDistances =
      readArray<number>(
        'CarIdxLapDistPct',
      )

    const carSessionFlags =
      readArray<number>(
        'CarIdxSessionFlags',
      )

    const carGears =
      readArray<number>(
        'CarIdxGear',
      )

    const carRpms =
      readArray<number>(
        'CarIdxRPM',
      )

    const carOnPitRoad =
      readArray<boolean>(
        'CarIdxOnPitRoad',
      )

    const carF2Times =
      readArray<number>(
        'CarIdxF2Time',
      )

    const carLastLapTimes =
      readArray<number>(
        'CarIdxLastLapTime',
      )

    const carBestLapTimes =
      readArray<number>(
        'CarIdxBestLapTime',
      )

    const speedMetersPerSecond =
      readValue<number>(
        'Speed',
      ) ?? 0

    const sessionFlags =
      readValue<number>(
        'SessionFlags',
      ) ?? 0

    const combinedCarFlags =
      carSessionFlags.reduce(
        (
          combinedFlags,
          currentCarFlags,
        ) => (
          combinedFlags |
          (currentCarFlags ?? 0)
        ) >>> 0,
        0,
      )

    const effectiveSessionFlags =
      (
        sessionFlags |
        combinedCarFlags
      ) >>> 0

    const sessionState =
      readValue<number>(
        'SessionState',
      ) ?? 0

    const totalLapsValue =
      readValue<number>(
        'SessionLapsTotal',
      ) ?? 0

    const sessionData =
      sdk.getSessionData() as
        unknown as SessionData

    const drivers =
      sessionData.DriverInfo
        ?.Drivers ?? []

    const detectedTrackName =
      sessionData.WeekendInfo
        ?.TrackDisplayName ||
      sessionData.WeekendInfo
        ?.TrackName ||
      'Unknown Track'

    const trackName =
      overlaySettings
        .trackOverride !==
        'auto'
        ? overlaySettings
            .trackOverride
        : detectedTrackName

    const selectedDriver =
      drivers.find(
        (driver) => (
          normalizeCarNumber(
            driver.CarNumber,
          ) ===
          normalizeCarNumber(
            overlaySettings
              .selectedCarNumber,
          )
        ),
      )

    const selectedCarIndex =
      selectedDriver?.CarIdx ??
      cameraCarIndex

    const selectedCarNumber =
      selectedDriver
        ? String(
            selectedDriver
              .CarNumber,
          )
        : overlaySettings
            .selectedCarNumber

    const selectedDriverName =
      selectedDriver
        ? getDriverName(
            selectedDriver,
          )
        : ''

    const leaderboard =
      getLeaderboard(
        drivers,
        carPositions,
      )

    const trackCars =
      getTrackCars(
        drivers,
        carLapDistances,
      )

    const leaderCarIndex =
      leaderboard[0]?.carIndex

    const currentLap =
      leaderCarIndex !==
      undefined
        ? Math.max(
            1,
            (
              carLapsCompleted[
                leaderCarIndex
              ] ?? 0
            ) + 1,
          )
        : 0

    const totalLaps =
      totalLapsValue > 0 &&
      totalLapsValue < 32000
        ? totalLapsValue
        : 0

    const selectedLap =
      selectedCarIndex >= 0
        ? Math.max(
            1,
            (
              carLapsCompleted[
                selectedCarIndex
              ] ?? 0
            ) + 1,
          )
        : 0

    const selectedPosition =
      carPositions[
        selectedCarIndex
      ] ?? 0

    /*
     * CarIdxF2Time is race time behind
     * the leader during a race session.
     */
    const rawGapToLeader =
      carF2Times[
        selectedCarIndex
      ]

    const gapToLeader =
      sessionState === 4 &&
      selectedPosition > 1 &&
      typeof rawGapToLeader ===
        'number' &&
      Number.isFinite(
        rawGapToLeader,
      ) &&
      rawGapToLeader >= 0
        ? rawGapToLeader
        : selectedPosition === 1
          ? 0
          : -1

    const onPitRoad =
      Boolean(
        carOnPitRoad[
          selectedCarIndex
        ],
      )

    const lastLapTime =
      getValidTime(
        carLastLapTimes[
          selectedCarIndex
        ],
      )

    const bestLapTime =
      getValidTime(
        carBestLapTimes[
          selectedCarIndex
        ],
      )

    const flag =
      getFlagState(
        effectiveSessionFlags,
        sessionState,
        currentLap,
        totalLaps,
      )

    broadcast({
      type: 'telemetry',
      connected: true,
      cameraCarIndex,
      selectedCarIndex,
      selectedCarNumber,
      selectedDriverName,
      detectedTrackName,
      trackName,

      position:
        selectedPosition,

      selectedLap,
      gapToLeader,
      onPitRoad,
      lastLapTime,
      bestLapTime,

      gear:
        carGears[
          selectedCarIndex
        ] ??
        readValue<number>(
          'Gear',
        ) ??
        0,

      speedMph:
        Math.round(
          speedMetersPerSecond *
            2.236936,
        ),

      rpm:
        Math.round(
          carRpms[
            selectedCarIndex
          ] ??
          readValue<number>(
            'RPM',
          ) ??
          0,
        ),

      flag,
      sessionState,
      currentLap,
      totalLaps,
      leaderboard,
      trackCars,
      settings: overlaySettings,
      overlayStatus:
        getOverlayStatus(),
    })
  } else {
    if (wasConnected) {
      wasConnected = false

      console.log(
        'Disconnected from iRacing telemetry',
      )
    }

    const trackName =
      overlaySettings
        .trackOverride !==
        'auto'
        ? overlaySettings
            .trackOverride
        : 'Unknown Track'

    broadcast({
      type: 'telemetry',
      connected: false,
      cameraCarIndex: 0,
      selectedCarIndex: 0,

      selectedCarNumber:
        overlaySettings
          .selectedCarNumber,

      selectedDriverName: '',
      detectedTrackName:
        'Unknown Track',
      trackName,
      position: 0,
      selectedLap: 0,
      gapToLeader: -1,
      onPitRoad: false,
      lastLapTime: 0,
      bestLapTime: 0,
      gear: 0,
      speedMph: 0,
      rpm: 0,
      flag: 'pacing',
      sessionState: 0,
      currentLap: 0,
      totalLaps: 0,
      leaderboard: [],
      trackCars: [],
      settings: overlaySettings,
      overlayStatus:
        getOverlayStatus(),
    })
  }

  setTimeout(
    tick,
    UPDATE_INTERVAL,
  )
}

webSocketServer.on(
  'connection',
  (client) => {
    console.log(
      'Overlay connected to telemetry service',
    )

    connectedClients.set(
      client,
      'unknown',
    )

    client.on(
      'message',
      (rawMessage) => {
        try {
          const message =
            JSON.parse(
              rawMessage.toString(),
            ) as ControlMessage

          if (
            message.type ===
              'registerClient'
          ) {
            const clientType =
              message.clientType

            if (
              clientType ===
                'driver' ||
              clientType ===
                'ticker' ||
              clientType ===
                'control'
            ) {
              connectedClients.set(
                client,
                clientType,
              )

              console.log(
                `${clientType} client registered`,
              )

              sendActiveProfile(client)
            }

            return
          }

          if (
            message.type === 'updateProfile' &&
            message.profile
          ) {
            activeProfile = message.profile
            updateOverlaySettings({
              selectedCarNumber: activeProfile.carNumber,
            })
            sendActiveProfile()
            return
          }

          if (
            message.type ===
              'updateSettings' &&
            message.settings
          ) {
            updateOverlaySettings(
              message.settings,
            )
          }
        } catch (error) {
          console.error(
            'Could not read control message:',
            error,
          )
        }
      },
    )

    client.on(
      'close',
      () => {
        const clientType =
          connectedClients.get(
            client,
          )

        connectedClients.delete(
          client,
        )

        console.log(
          `${clientType ?? 'unknown'} client disconnected`,
        )
      },
    )
  },
)

webSocketServer.on(
  'listening',
  () => {
    console.log(
      `Telemetry service listening on ws://localhost:${PORT}`,
    )
  },
)

tick()
