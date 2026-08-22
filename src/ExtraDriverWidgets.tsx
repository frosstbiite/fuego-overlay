import { useState, type CSSProperties } from 'react'
import { normalizeDriverLayout, type DriverLayoutConfig, type WidgetPlacement } from './layoutTypes'
import { useTelemetrySocket } from './useTelemetrySocket'

type TireCorner = {
  pressure: number
  tempL: number
  tempM: number
  tempR: number
  wearL: number
  wearM: number
  wearR: number
}

type TireInfo = { lf: TireCorner; rf: TireCorner; lr: TireCorner; rr: TireCorner }

type GapDriver = {
  position: number
  carIndex: number
  carNumber: string
  name: string
}

type Settings = {
  showDriverBar: boolean
  overlayLayout: 'classic' | 'driver' | 'cockpit'
  temperatureUnit: 'fahrenheit' | 'celsius'
  driverLayout: DriverLayoutConfig
}

type Data = {
  type?: string
  connected: boolean
  position?: number
  localTelemetryAvailable?: boolean
  tireInfo?: TireInfo | null
  airTempC?: number
  trackTempC?: number
  relativeHumidity?: number
  windVelMps?: number
  skies?: number
  gapAhead?: number
  gapBehind?: number
  aheadDriver?: GapDriver | null
  behindDriver?: GapDriver | null
  settings?: Settings
}

const defaultSettings: Settings = {
  showDriverBar: true,
  overlayLayout: 'classic',
  temperatureUnit: 'fahrenheit',
  driverLayout: normalizeDriverLayout(),
}

function styleOf(p: WidgetPlacement): CSSProperties {
  return { left: `${p.x}%`, top: `${p.y}%`, width: `${p.width}%`, height: `${p.height}%` }
}

function temp(celsius: number | undefined, unit: Settings['temperatureUnit']) {
  if (typeof celsius !== 'number' || !Number.isFinite(celsius)) return '--'
  return unit === 'fahrenheit'
    ? `${Math.round(celsius * 9 / 5 + 32)}°F`
    : `${Math.round(celsius)}°C`
}

function averageTemp(t?: TireCorner) {
  return t ? (t.tempL + t.tempM + t.tempR) / 3 : 0
}

function averageWear(t?: TireCorner) {
  return t ? (t.wearL + t.wearM + t.wearR) / 3 : 0
}

function gap(seconds?: number) {
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0
    ? `${seconds.toFixed(2)}s`
    : '--'
}

function skies(value?: number) {
  if (value === 0) return 'CLEAR'
  if (value === 1) return 'PARTLY CLOUDY'
  if (value === 2) return 'MOSTLY CLOUDY'
  if (value === 3) return 'OVERCAST'
  return '--'
}

export default function ExtraDriverWidgets() {
  const [data, setData] = useState<Data>({ connected: false })

  useTelemetrySocket<Data>(
    (incoming) => {
      if (incoming.type === 'profile') return
      setData(incoming)
    },
    (connected) => {
      if (!connected) {
        setData((current) => ({ ...current, connected: false }))
      }
    },
    'driver',
  )

  const settings = data.settings ?? defaultSettings
  const layout = normalizeDriverLayout(settings.driverLayout)

  if (!settings.showDriverBar || settings.overlayLayout !== 'driver') return null

  const local = Boolean(data.localTelemetryAvailable)
  const tire = layout.tireInfo
  const weather = layout.weather
  const battle = layout.gapBattle
  const unit = settings.temperatureUnit

  return (
    <main className="driver-layout-stage driver-extra-widgets-stage">
      {tire.visible && local && (
        <section className={`driver-widget driver-tire-widget driver-widget-${tire.variant}`} style={styleOf(tire)}>
          {tire.variant === 'compact' ? (
            <div className="driver-tire-compact">
              <span>TIRES</span>
              <strong>{data.tireInfo ? `${Math.round((averageWear(data.tireInfo.lf)+averageWear(data.tireInfo.rf)+averageWear(data.tireInfo.lr)+averageWear(data.tireInfo.rr))/4*100)}%` : '--'}</strong>
              <small>AVG WEAR</small>
            </div>
          ) : (
            <>
              <div className="driver-tire-heading"><strong>TIRE INFO</strong><span>LOCAL CAR</span></div>
              <div className="driver-tire-grid">
                {([['LF',data.tireInfo?.lf],['RF',data.tireInfo?.rf],['LR',data.tireInfo?.lr],['RR',data.tireInfo?.rr]] as const).map(([label,t]) => (
                  <div key={label} className="driver-tire-corner">
                    <b>{label}</b>
                    <strong>{t ? temp(averageTemp(t), unit) : '--'}</strong>
                    {tire.variant === 'expanded' && <><small>{t && t.pressure > 0 ? `${(t.pressure * 0.145038).toFixed(1)} PSI` : '-- PSI'}</small><em>{t ? `${Math.round(averageWear(t)*100)}% WEAR` : '--'}</em></>}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {weather.visible && (
        <section className={`driver-widget driver-weather-widget driver-widget-${weather.variant}`} style={styleOf(weather)}>
          {weather.variant === 'compact' ? (
            <div className="driver-weather-primary"><span>AIR</span><strong>{temp(data.airTempC, unit)}</strong></div>
          ) : (
            <>
              <div className="driver-weather-heading">WEATHER</div>
              <div className="driver-weather-grid">
                <div><span>AIR</span><strong>{temp(data.airTempC, unit)}</strong></div>
                <div><span>TRACK</span><strong>{temp(data.trackTempC, unit)}</strong></div>
                <div><span>HUMIDITY</span><strong>{typeof data.relativeHumidity === 'number' ? `${Math.round(data.relativeHumidity*100)}%` : '--'}</strong></div>
              </div>
              {weather.variant === 'expanded' && <div className="driver-weather-extra"><div><span>SKIES</span><strong>{skies(data.skies)}</strong></div><div><span>WIND</span><strong>{typeof data.windVelMps === 'number' ? `${Math.round(data.windVelMps*2.236936)} MPH` : '--'}</strong></div></div>}
            </>
          )}
        </section>
      )}

      {battle.visible && (
        <section className={`driver-widget driver-gap-widget driver-widget-${battle.variant}`} style={styleOf(battle)}>
          {battle.variant !== 'compact' && <div className="driver-gap-heading">GAP AHEAD / BEHIND</div>}
          <div className="driver-gap-grid">
            <div className="driver-gap-ahead"><span>AHEAD</span>{battle.variant !== 'compact' && <b>{data.aheadDriver ? `#${data.aheadDriver.carNumber} ${data.aheadDriver.name}` : 'LEADER'}</b>}<strong>{gap(data.gapAhead)}</strong></div>
            <div className="driver-gap-selected"><span>YOU</span><strong>{(data.position ?? 0) > 0 ? `P${data.position}` : '--'}</strong></div>
            <div className="driver-gap-behind"><span>BEHIND</span>{battle.variant !== 'compact' && <b>{data.behindDriver ? `#${data.behindDriver.carNumber} ${data.behindDriver.name}` : 'NONE'}</b>}<strong>{gap(data.gapBehind)}</strong></div>
          </div>
          {battle.variant === 'expanded' && <div className="driver-gap-note">LIVE INTERVALS · SELECTED DRIVER</div>}
        </section>
      )}
    </main>
  )
}
