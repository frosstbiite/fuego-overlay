import {
  useState,
  type CSSProperties,
} from 'react'

import { useTelemetrySocket } from './useTelemetrySocket'
import {
  frostProfile,
  type DriverProfile,
} from './profileTypes'
import './RaceTicker.css'

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

type LeaderboardDriver = {
  position: number
  carIndex: number
  carNumber: string
  name: string
}

type RaceTelemetry = {
  type?: 'telemetry'
  connected: boolean
  flag: FlagState
  currentLap: number
  totalLaps: number
  selectedCarNumber: string
  leaderboard: LeaderboardDriver[]
  settings: OverlaySettings
}

type ProfileMessage = {
  type: 'profile'
  profile: DriverProfile
}

const defaultSettings: OverlaySettings = {
  selectedCarNumber: '21',
  showDriverBar: true,
  showTicker: true,
  showTrackMap: true,
  showSponsorLogo: true,
  trackOverride: 'auto',
}

const demoLeaderboard: LeaderboardDriver[] = [
  {
    position: 1,
    carIndex: 0,
    carNumber: '21',
    name: 'GRIJALVA',
  },
  {
    position: 2,
    carIndex: 1,
    carNumber: '8',
    name: 'SMITH',
  },
  {
    position: 3,
    carIndex: 2,
    carNumber: '45',
    name: 'JONES',
  },
  {
    position: 4,
    carIndex: 3,
    carNumber: '12',
    name: 'MARTIN',
  },
  {
    position: 5,
    carIndex: 4,
    carNumber: '6',
    name: 'WILLIAMS',
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

function RaceTicker() {
  const [profile, setProfile] =
    useState<DriverProfile>(frostProfile)
  const [telemetry, setTelemetry] =
    useState<RaceTelemetry>({
      connected: false,
      flag: 'pacing',
      currentLap: 36,
      totalLaps: 100,
      selectedCarNumber: '21',
      leaderboard: [],
      settings: defaultSettings,
    })

  /*
   * Automatically reconnects whenever
   * the telemetry service restarts.
   */
  useTelemetrySocket<RaceTelemetry | ProfileMessage>(
    (data) => {
      if (data.type === 'profile') {
        setProfile(data.profile)
        return
      }

      setTelemetry({
        ...data,

        selectedCarNumber:
          data.selectedCarNumber ||
          data.settings
            ?.selectedCarNumber ||
          '21',

        leaderboard:
          data.leaderboard ?? [],

        settings:
          data.settings ??
          defaultSettings,
      })
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
    'ticker',
  )

  const flag: FlagState =
    telemetry.connected
      ? telemetry.flag
      : 'pacing'

  const selectedCarNumber =
    telemetry.selectedCarNumber ||
    telemetry.settings
      .selectedCarNumber ||
    '21'

  const leaderboard =
    telemetry.connected &&
    telemetry.leaderboard.length > 0
      ? telemetry.leaderboard
      : demoLeaderboard.map(
          (driver, index) => {
            if (index !== 0) {
              return driver
            }

            return {
              ...driver,
              carNumber:
                selectedCarNumber,
            }
          },
        )

  const currentLap =
    telemetry.connected
      ? telemetry.currentLap
      : 36

  const totalLaps =
    telemetry.connected
      ? telemetry.totalLaps
      : 100

  function getFlagLabel(
    currentFlag: FlagState,
  ) {
    switch (currentFlag) {
      case 'pacing':
        return 'PACE LAPS'

      case 'yellow':
        return 'CAUTION'

      case 'white':
        return 'WHITE FLAG'

      case 'checkered':
        return 'CHECKERED'

      case 'green':
      default:
        return 'GREEN FLAG'
    }
  }

  const flagLabel =
    getFlagLabel(flag)

  const lapText =
    totalLaps > 0
      ? `LAP ${currentLap} OF ${totalLaps}`
      : `LAP ${currentLap}`

  const tickerStyle = {
    '--ticker-duration':
      `${Math.max(
        18,
        leaderboard.length * 3.5,
      )}s`,
  } as CSSProperties

  const profileStyle = {
    '--profile-primary': profile.primaryColor,
    '--profile-secondary': profile.secondaryColor,
    '--profile-trim': profile.trimColor,
    '--profile-number': profile.numberColor,
    '--profile-text': profile.textColor,
  } as CSSProperties

  function renderLeaderboard() {
    return leaderboard.map(
      (driver) => {
        const isSelected =
          normalizeCarNumber(
            driver.carNumber,
          ) ===
          normalizeCarNumber(
            selectedCarNumber,
          )

        return (
          <div
            className={
              isSelected
                ? 'leaderboard-entry leaderboard-entry-selected'
                : 'leaderboard-entry'
            }
            key={
              `${driver.carIndex}-${driver.position}`
            }
          >
            <span className="leaderboard-position">
              {driver.position}
            </span>

            <span className="leaderboard-number">
              #{driver.carNumber}
            </span>

            <span className="leaderboard-name">
              {driver.name}
            </span>
          </div>
        )
      },
    )
  }

  /*
   * Keep telemetry connected while
   * hiding the ticker display.
   */
  if (
    !telemetry.settings
      .showTicker
  ) {
    return null
  }

  return (
    <main className="race-ticker-stage">
      <section
        key={flag}
        className={
          `race-ticker race-ticker-${flag}`
        }
        style={profileStyle}
      >
        <div className="race-status">
          <span className="status-light" />

          <strong>
            {flagLabel}
          </strong>
        </div>

        <div className="leaderboard-window">
          <div
            className="leaderboard-scroll"
            style={tickerStyle}
          >
            <div className="leaderboard-group">
              {renderLeaderboard()}
            </div>

            <div
              className="leaderboard-group"
              aria-hidden="true"
            >
              {renderLeaderboard()}
            </div>
          </div>
        </div>

        <div className="lap-counter">
          {lapText}
        </div>
      </section>
    </main>
  )
}

export default RaceTicker
