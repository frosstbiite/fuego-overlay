import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import { getTrackLayout } from './trackLayouts'
import { useTelemetrySocket } from './useTelemetrySocket'
import {
  frostProfile,
  type DriverProfile,
} from './profileTypes'
import './App.css'

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

type TrackCar = {
  carIndex: number
  carNumber: string
  name: string
  lapDistancePct: number
}

type TelemetryData = {
  type?: 'telemetry'
  connected: boolean
  cameraCarIndex: number
  selectedCarIndex: number
  selectedCarNumber: string
  selectedDriverName: string
  trackName: string
  position: number
  gear: number
  speedMph: number
  rpm: number
  flag: FlagState
  trackCars: TrackCar[]
  settings: OverlaySettings
}

type ProfileMessage = {
  type: 'profile'
  profile: DriverProfile
}

type TrackCarPoint = TrackCar & {
  x: number
  y: number
}

const defaultSettings: OverlaySettings = {
  selectedCarNumber: '21',
  showDriverBar: true,
  showTicker: true,
  showTrackMap: true,
  showSponsorLogo: true,
  trackOverride: 'auto',
}

const flagOrder: FlagState[] = [
  'pacing',
  'green',
  'yellow',
  'white',
  'checkered',
]

const demonstrationCars: TrackCar[] = [
  {
    carIndex: 21,
    carNumber: '21',
    name: 'GRIJALVA',
    lapDistancePct: 0.18,
  },
  {
    carIndex: 8,
    carNumber: '8',
    name: 'SMITH',
    lapDistancePct: 0.32,
  },
  {
    carIndex: 30,
    carNumber: '30',
    name: 'POWERS',
    lapDistancePct: 0.57,
  },
  {
    carIndex: 53,
    carNumber: '53',
    name: 'GONZALEZ',
    lapDistancePct: 0.82,
  },
]

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

function getPositionSuffix(
  position: number,
) {
  const lastTwoDigits =
    position % 100

  if (
    lastTwoDigits >= 11 &&
    lastTwoDigits <= 13
  ) {
    return 'TH'
  }

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

function getGearDisplay(
  gear: number,
) {
  if (gear === -1) {
    return 'R'
  }

  if (gear === 0) {
    return 'N'
  }

  return String(gear)
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
  const trackPathRef =
    useRef<SVGPathElement>(null)

  const [carPoints, setCarPoints] =
    useState<TrackCarPoint[]>([])

  const trackLayout =
    getTrackLayout(trackName)

  const normalizedSelectedNumber =
    normalizeCarNumber(
      selectedCarNumber,
    )

  useEffect(() => {
    const path =
      trackPathRef.current

    if (!path) {
      return
    }

    const pathLength =
      path.getTotalLength()

    const nextCarPoints =
      cars.map((car) => {
        const normalizedDistance =
          Math.min(
            1,
            Math.max(
              0,
              car.lapDistancePct,
            ),
          )

        /*
         * Reverse the SVG direction so cars
         * travel counterclockwise.
         */
        const reversedDistance =
          1 - normalizedDistance

        const point =
          path.getPointAtLength(
            reversedDistance *
              pathLength,
          )

        return {
          ...car,
          x: point.x,
          y: point.y,
        }
      })

    setCarPoints(nextCarPoints)
  }, [
    cars,
    trackLayout.path,
  ])

  /*
   * Draw the selected car last so its
   * yellow dot stays above the field.
   */
  const orderedCarPoints =
    [...carPoints].sort(
      (
        firstCar,
        secondCar,
      ) => {
        const firstIsSelected =
          normalizeCarNumber(
            firstCar.carNumber,
          ) ===
          normalizedSelectedNumber

        const secondIsSelected =
          normalizeCarNumber(
            secondCar.carNumber,
          ) ===
          normalizedSelectedNumber

        return (
          Number(firstIsSelected) -
          Number(secondIsSelected)
        )
      },
    )

  return (
    <div
      className="track-map"
      aria-label={
        `${trackLayout.name} track map`
      }
      title={trackLayout.name}
    >
      <svg
        viewBox="0 0 220 120"
        role="img"
        aria-label={
          trackLayout.name
        }
      >
        <path
          ref={trackPathRef}
          className="track-outline"
          d={trackLayout.path}
        />

        <path
          className="track-centerline"
          d={trackLayout.path}
        />

        <line
          className="start-finish-line"
          x1={
            trackLayout
              .startFinish.x1
          }
          y1={
            trackLayout
              .startFinish.y1
          }
          x2={
            trackLayout
              .startFinish.x2
          }
          y2={
            trackLayout
              .startFinish.y2
          }
        />

        {orderedCarPoints.map(
          (car) => {
            const isSelected =
              normalizeCarNumber(
                car.carNumber,
              ) ===
              normalizedSelectedNumber

            return (
              <g
                key={car.carIndex}
                className={
                  isSelected
                    ? 'track-car track-car-frost'
                    : 'track-car'
                }
                transform={
                  `translate(${car.x} ${car.y})`
                }
              >
                <circle
                  r={
                    isSelected
                      ? 11
                      : 5
                  }
                />

                {isSelected && (
                  <text
                    x="0"
                    y="1.5"
                    textAnchor="middle"
                  >
                    {
                      selectedCarNumber
                    }
                  </text>
                )}

                <title>
                  {`#${car.carNumber} ${car.name}`}
                </title>
              </g>
            )
          },
        )}
      </svg>
    </div>
  )
}

function App() {
  const [flag, setFlag] =
    useState<FlagState>('pacing')

  const [telemetry, setTelemetry] =
    useState<TelemetryData>({
      connected: false,
      cameraCarIndex: 0,
      selectedCarIndex: 0,
      selectedCarNumber: '21',
      selectedDriverName: '',
      trackName:
        'New Hampshire Motor Speedway',
      position: 0,
      gear: 0,
      speedMph: 0,
      rpm: 0,
      flag: 'pacing',
      trackCars: [],
      settings: defaultSettings,
    })

  const [profile, setProfile] =
    useState<DriverProfile>(frostProfile)

  /*
   * Connect to the telemetry service.
   * The shared hook automatically reconnects
   * whenever the service becomes unavailable.
   */
  useTelemetrySocket<TelemetryData | ProfileMessage>(
    (data) => {
      if (data.type === 'profile') {
        setProfile(data.profile)
        return
      }

      setTelemetry({
        ...data,

        trackName:
          data.trackName ||
          'Unknown Track',

        selectedCarNumber:
          data.selectedCarNumber ||
          data.settings
            ?.selectedCarNumber ||
          '21',

        trackCars:
          data.trackCars ?? [],

        settings:
          data.settings ??
          defaultSettings,
      })

      if (
        data.connected &&
        data.flag
      ) {
        setFlag(data.flag)
      }
    },

    (socketConnected) => {
      if (!socketConnected) {
        setTelemetry(
          (currentTelemetry) => ({
            ...currentTelemetry,
            connected: false,
          }),
        )
      }
    },
    'driver',
  )

  function cycleFlag() {
    if (telemetry.connected) {
      return
    }

    const currentIndex =
      flagOrder.indexOf(flag)

    const nextIndex =
      (currentIndex + 1) %
      flagOrder.length

    setFlag(
      flagOrder[nextIndex],
    )
  }

  const selectedCarNumber =
    telemetry.selectedCarNumber ||
    telemetry.settings
      .selectedCarNumber ||
    '21'

  const position =
    telemetry.connected
      ? telemetry.position
      : 25

  const gear =
    telemetry.connected
      ? telemetry.gear
      : 4

  const speed =
    telemetry.connected
      ? telemetry.speedMph
      : 95

  const rpm =
    telemetry.connected
      ? telemetry.rpm
      : 6155

  const trackCars =
    telemetry.connected
      ? telemetry.trackCars
      : demonstrationCars.map(
          (car, index) => {
            if (index !== 0) {
              return car
            }

            return {
              ...car,
              carNumber:
                selectedCarNumber,
            }
          },
        )

  const trackName =
  telemetry.trackName &&
  telemetry.trackName !==
    'Unknown Track'
    ? telemetry.trackName
    : 'New Hampshire Motor Speedway'

  const gearDisplay =
    getGearDisplay(gear)

  const maximumRpm = 9000

  const activeRpmBarCount =
    Math.min(
      8,
      Math.max(
        0,
        Math.ceil(
          (rpm / maximumRpm) *
            8,
        ),
      ),
    )

  const rpmBarOrder = [
    0,
    7,
    1,
    6,
    2,
    5,
    3,
    4,
  ]

  const activeRpmBars =
    rpmBarOrder.slice(
      0,
      activeRpmBarCount,
    )

  const maximumSpeed = 200

  const speedGaugeAngle =
    Math.min(
      180,
      Math.max(
        0,
        (speed /
          maximumSpeed) *
          180,
      ),
    )

  const speedGaugeStyle = {
    '--speed-angle':
      `${speedGaugeAngle}deg`,
  } as CSSProperties

  const profileStyle = {
    '--profile-primary': profile.primaryColor,
    '--profile-secondary': profile.secondaryColor,
    '--profile-trim': profile.trimColor,
    '--profile-number': profile.numberColor,
    '--profile-text': profile.textColor,
  } as CSSProperties

  /*
   * Keep telemetry connected while
   * hiding the driver overlay.
   */
  if (
    !telemetry.settings
      .showDriverBar
  ) {
    return null
  }

  return (
    <main className="overlay-stage">
      <section
        key={flag}
        className={
          `driver-ticker flag-${flag}`
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

        <div className="telemetry speed">
          <div
            className="gauge"
            style={
              speedGaugeStyle
            }
          >
            <span className="gauge-fill" />

            <strong>
              {gearDisplay}
            </strong>
          </div>

          <span className="telemetry-value">
            {speed}
          </span>

          <span className="telemetry-label">
            MPH
          </span>
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

        <div
          className={
            telemetry.settings.showSponsorLogo &&
            profile.sponsorLogo
              ? 'right-panel has-sponsor'
              : 'right-panel'
          }
        >
          {telemetry.settings
            .showTrackMap ? (
            <TrackMap
              cars={trackCars}
              trackName={trackName}
              selectedCarNumber={
                selectedCarNumber
              }
            />
          ) : (
            <div
              className="track-map track-map-hidden"
              aria-hidden="true"
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
      </section>
    </main>
  )
}

export default App
