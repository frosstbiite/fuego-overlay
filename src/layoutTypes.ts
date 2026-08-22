export type OverlayLayout = 'classic' | 'driver' | 'cockpit'

export type DriverWidgetId =
  | 'runningOrder'
  | 'raceStatus'
  | 'driverIdentity'
  | 'telemetry'
  | 'trackMap'
  | 'lapTiming'
  | 'fuel'
  | 'pedals'
  | 'steering'
  | 'brakeBias'
  | 'currentLap'
  | 'sessionRemaining'
  | 'incidents'
  | 'pitInfo'

export type WidgetVariant = 'compact' | 'standard' | 'expanded'

export type TickerBrandingMode =
  | 'text'
  | 'logo'
  | 'sponsor'
  | 'none'

export type TickerBrandingAlignment =
  | 'left'
  | 'center'
  | 'right'

export type TickerBrandingConfig = {
  mode: TickerBrandingMode
  text: string
  logo: string
  logoZoom: number
  logoOffsetX: number
  logoOffsetY: number
  textSize: number
  textAlign: TickerBrandingAlignment
  italic: boolean
  textColor: string
}

export type WidgetCondition =
  | 'always'
  | 'pit-road'
  | 'low-fuel'
  | 'caution'
  | 'white-flag'
  | 'local-telemetry'

export type WidgetPlacement = {
  x: number
  y: number
  width: number
  height: number
  visible: boolean
  locked: boolean
  aspectLocked: boolean
  variant: WidgetVariant
  condition: WidgetCondition
  tickerBranding?: TickerBrandingConfig
}

export type DriverLayoutConfig = Record<DriverWidgetId, WidgetPlacement>

export type DriverLayoutProfile = {
  id: string
  name: string
  layout: DriverLayoutConfig
  createdAt: number
  updatedAt: number
}

export const defaultTickerBranding: TickerBrandingConfig = {
  mode: 'text',
  text: 'FUEGO',
  logo: '',
  logoZoom: 1,
  logoOffsetX: 0,
  logoOffsetY: 0,
  textSize: 1,
  textAlign: 'center',
  italic: true,
  textColor: '#fff200',
}

export const driverWidgetLabels: Record<DriverWidgetId, string> = {
  runningOrder: 'Running Order',
  raceStatus: 'Race Status / Lap',
  driverIdentity: 'Driver Identity',
  telemetry: 'Telemetry',
  trackMap: 'Track Map',
  lapTiming: 'Last / Best / Delta',
  fuel: 'Fuel',
  pedals: 'Throttle / Brake',
  steering: 'Steering Input',
  brakeBias: 'Brake Bias',
  currentLap: 'Current Lap Time',
  sessionRemaining: 'Session Remaining',
  incidents: 'Incident Count',
  pitInfo: 'Pit Status / Laps Since Pit',
}

export const widgetConditionLabels: Record<WidgetCondition, string> = {
  always: 'Always',
  'pit-road': 'Only on Pit Road',
  'low-fuel': 'Only when Fuel ≤ 20%',
  caution: 'Only under Caution',
  'white-flag': 'Only on White Flag',
  'local-telemetry': 'Only when Local Data Exists',
}


export const widgetVariantSizes: Record<
  DriverWidgetId,
  Record<WidgetVariant, { width: number; height: number }>
> = {
  runningOrder: {
    compact: { width: 50, height: 6 },
    standard: { width: 76, height: 8 },
    expanded: { width: 96, height: 12 },
  },
  raceStatus: {
    compact: { width: 12, height: 8 },
    standard: { width: 17, height: 12 },
    expanded: { width: 24, height: 15 },
  },
  driverIdentity: {
    compact: { width: 18, height: 12 },
    standard: { width: 28, height: 18 },
    expanded: { width: 38, height: 24 },
  },
  telemetry: {
    compact: { width: 20, height: 10 },
    standard: { width: 31, height: 15 },
    expanded: { width: 42, height: 19 },
  },
  trackMap: {
    compact: { width: 16, height: 11 },
    standard: { width: 24, height: 15 },
    expanded: { width: 34, height: 22 },
  },
  lapTiming: {
    compact: { width: 15, height: 9 },
    standard: { width: 35, height: 15 },
    expanded: { width: 45, height: 19 },
  },
  fuel: {
    compact: { width: 10, height: 8 },
    standard: { width: 14, height: 10 },
    expanded: { width: 20, height: 13 },
  },
  pedals: {
    compact: { width: 14, height: 9 },
    standard: { width: 18, height: 10 },
    expanded: { width: 26, height: 14 },
  },
  steering: {
    compact: { width: 10, height: 8 },
    standard: { width: 14, height: 10 },
    expanded: { width: 20, height: 13 },
  },
  brakeBias: {
    compact: { width: 10, height: 8 },
    standard: { width: 13, height: 10 },
    expanded: { width: 19, height: 13 },
  },
  currentLap: {
    compact: { width: 12, height: 8 },
    standard: { width: 16, height: 10 },
    expanded: { width: 24, height: 13 },
  },
  sessionRemaining: {
    compact: { width: 12, height: 8 },
    standard: { width: 16, height: 10 },
    expanded: { width: 24, height: 13 },
  },
  incidents: {
    compact: { width: 9, height: 8 },
    standard: { width: 12, height: 10 },
    expanded: { width: 18, height: 13 },
  },
  pitInfo: {
    compact: { width: 12, height: 8 },
    standard: { width: 18, height: 10 },
    expanded: { width: 27, height: 14 },
  },
}

export const widgetMinimums: Record<DriverWidgetId, { width: number; height: number }> = {
  runningOrder: { width: 28, height: 6 },
  raceStatus: { width: 12, height: 8 },
  driverIdentity: { width: 18, height: 14 },
  telemetry: { width: 22, height: 10 },
  trackMap: { width: 14, height: 12 },
  lapTiming: { width: 22, height: 10 },
  fuel: { width: 10, height: 8 },
  pedals: { width: 14, height: 10 },
  steering: { width: 12, height: 8 },
  brakeBias: { width: 10, height: 8 },
  currentLap: { width: 12, height: 8 },
  sessionRemaining: { width: 12, height: 8 },
  incidents: { width: 9, height: 8 },
  pitInfo: { width: 14, height: 8 },
}

function placement(
  x: number,
  y: number,
  width: number,
  height: number,
  visible = true,
  aspectLocked = false,
  variant: WidgetVariant = 'standard',
  condition: WidgetCondition = 'always',
): WidgetPlacement {
  return {
    x, y, width, height, visible,
    locked: false,
    aspectLocked,
    variant,
    condition,
  }
}

export const defaultDriverLayout: DriverLayoutConfig = {
  runningOrder: {
    ...placement(2, 2, 76, 8, true, false, 'standard'),
    tickerBranding: structuredClone(defaultTickerBranding),
  },
  raceStatus: placement(81, 2, 17, 12, true, false, 'standard'),
  driverIdentity: placement(2, 16, 26, 22, false, false, 'standard'),
  telemetry: placement(2, 82, 31, 15, true, false, 'standard'),
  trackMap: placement(36, 82, 24, 15, true, true, 'standard'),
  lapTiming: placement(63, 82, 35, 15, true, false, 'standard'),
  fuel: placement(2, 70, 12, 10, false, false, 'compact'),
  pedals: placement(16, 70, 18, 10, false, false, 'standard', 'local-telemetry'),
  steering: placement(36, 70, 14, 10, false, false, 'compact', 'local-telemetry'),
  brakeBias: placement(52, 70, 12, 10, false, false, 'compact', 'local-telemetry'),
  currentLap: placement(66, 70, 15, 10, false, false, 'compact', 'local-telemetry'),
  sessionRemaining: placement(83, 70, 15, 10, false, false, 'compact'),
  incidents: placement(2, 58, 10, 9, false, false, 'compact', 'local-telemetry'),
  pitInfo: placement(14, 58, 18, 9, false, false, 'standard', 'pit-road'),
}

export function normalizeDriverLayout(
  layout?: Partial<Record<DriverWidgetId, Partial<WidgetPlacement>>>,
): DriverLayoutConfig {
  const next = structuredClone(defaultDriverLayout)
  if (!layout) return next

  for (const key of Object.keys(next) as DriverWidgetId[]) {
    const incoming = layout[key]
    if (!incoming) continue

    next[key] = {
      x: clamp(incoming.x ?? next[key].x, 0, 95),
      y: clamp(incoming.y ?? next[key].y, 0, 95),
      width: clamp(incoming.width ?? next[key].width, widgetMinimums[key].width, 100),
      height: clamp(incoming.height ?? next[key].height, widgetMinimums[key].height, 100),
      visible: incoming.visible ?? next[key].visible,
      locked: incoming.locked ?? false,
      aspectLocked: incoming.aspectLocked ?? next[key].aspectLocked,
      variant: normalizeVariant(incoming.variant, next[key].variant),
      condition: normalizeCondition(incoming.condition, next[key].condition),
      tickerBranding:
        key === 'runningOrder'
          ? normalizeTickerBranding(
              incoming.tickerBranding,
              next[key].tickerBranding,
            )
          : undefined,
    }
  }

  return next
}

function normalizeTickerBranding(
  incoming: Partial<TickerBrandingConfig> | undefined,
  fallback: TickerBrandingConfig | undefined,
): TickerBrandingConfig {
  const base = fallback ?? defaultTickerBranding
  const mode =
    incoming?.mode === 'logo' ||
    incoming?.mode === 'sponsor' ||
    incoming?.mode === 'none' ||
    incoming?.mode === 'text'
      ? incoming.mode
      : base.mode

  const textAlign =
    incoming?.textAlign === 'left' ||
    incoming?.textAlign === 'right' ||
    incoming?.textAlign === 'center'
      ? incoming.textAlign
      : base.textAlign

  return {
    mode,
    text: String(incoming?.text ?? base.text).slice(0, 32),
    logo: String(incoming?.logo ?? base.logo),
    logoZoom: clamp(incoming?.logoZoom ?? base.logoZoom, 0.5, 3),
    logoOffsetX: clampSigned(incoming?.logoOffsetX ?? base.logoOffsetX, -100, 100),
    logoOffsetY: clampSigned(incoming?.logoOffsetY ?? base.logoOffsetY, -100, 100),
    textSize: clamp(incoming?.textSize ?? base.textSize, 0.5, 2),
    textAlign,
    italic: incoming?.italic ?? base.italic,
    textColor: String(incoming?.textColor ?? base.textColor),
  }
}

function clampSigned(value: number, minimum: number, maximum: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.min(maximum, Math.max(minimum, numeric))
}

function normalizeVariant(
  value: WidgetVariant | undefined,
  fallback: WidgetVariant,
): WidgetVariant {
  return value === 'compact' || value === 'expanded' || value === 'standard'
    ? value
    : fallback
}

function normalizeCondition(
  value: WidgetCondition | undefined,
  fallback: WidgetCondition,
): WidgetCondition {
  return value === 'always' ||
    value === 'pit-road' ||
    value === 'low-fuel' ||
    value === 'caution' ||
    value === 'white-flag' ||
    value === 'local-telemetry'
    ? value
    : fallback
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0))
}
