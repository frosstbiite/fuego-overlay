import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import {
  defaultDriverLayout,
  defaultTickerBranding,
  driverWidgetLabels,
  normalizeDriverLayout,
  widgetConditionLabels,
  widgetMinimums,
  widgetVariantSizes,
  type DriverLayoutConfig,
  type DriverLayoutProfile,
  type DriverWidgetId,
  type WidgetCondition,
  type TickerBrandingAlignment,
  type TickerBrandingMode,
  type WidgetVariant,
} from './layoutTypes'
import './DriverLayoutEditor.css'

type Props = {
  value: DriverLayoutConfig
  onChange: (layout: DriverLayoutConfig) => void
  showConditionalWidgets?: boolean
  showSafeAreaGuides?: boolean
}

type ResizeMode = 'move' | 'east' | 'south' | 'corner'

type Interaction = {
  widget: DriverWidgetId
  mode: ResizeMode
  startX: number
  startY: number
  start: DriverLayoutConfig[DriverWidgetId]
}

const widgetIds = Object.keys(driverWidgetLabels) as DriverWidgetId[]
const coreWidgetIds: DriverWidgetId[] = [
  'runningOrder',
  'raceStatus',
  'driverIdentity',
  'telemetry',
  'trackMap',
  'lapTiming',
]
const conditionIds = Object.keys(widgetConditionLabels) as WidgetCondition[]
const LAYOUT_PROFILES_KEY = 'fuego-driver-layout-profiles'

function loadLayoutProfiles(): DriverLayoutProfile[] {
  try {
    const raw = localStorage.getItem(LAYOUT_PROFILES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as DriverLayoutProfile[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((profile) => profile && profile.id && profile.name && profile.layout)
      .map((profile) => ({
        ...profile,
        layout: normalizeDriverLayout(profile.layout),
      }))
  } catch {
    return []
  }
}

function DriverLayoutEditor({
  value,
  onChange,
  showConditionalWidgets = true,
  showSafeAreaGuides = false,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const undoRef = useRef<DriverLayoutConfig[]>([])
  const redoRef = useRef<DriverLayoutConfig[]>([])
  const [interaction, setInteraction] = useState<Interaction | null>(null)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [layoutProfiles, setLayoutProfiles] = useState<DriverLayoutProfile[]>(loadLayoutProfiles)
  const [profileName, setProfileName] = useState('')
  const [selectedWidget, setSelectedWidget] =
    useState<DriverWidgetId>('telemetry')

  useEffect(() => {
    function handleResetProfiles() {
      setLayoutProfiles([])
      setProfileName('')
    }

    window.addEventListener(
      'fuego-layout-profiles-reset',
      handleResetProfiles,
    )

    return () => {
      window.removeEventListener(
        'fuego-layout-profiles-reset',
        handleResetProfiles,
      )
    }
  }, [])

  function refreshHistory() {
    setHistoryVersion((version) => version + 1)
  }

  function remember(layout: DriverLayoutConfig) {
    undoRef.current = [...undoRef.current.slice(-49), structuredClone(layout)]
    redoRef.current = []
    refreshHistory()
  }

  function applyDiscrete(next: DriverLayoutConfig) {
    remember(value)
    onChange(next)
  }

  function updateWidget(
    widget: DriverWidgetId,
    patch: Partial<DriverLayoutConfig[DriverWidgetId]>,
    rememberChange = true,
  ) {
    const next = {
      ...value,
      [widget]: {
        ...value[widget],
        ...patch,
      },
    }

    if (rememberChange) {
      applyDiscrete(next)
    } else {
      onChange(next)
    }
  }

  function updateTickerBranding(
    patch: Partial<NonNullable<DriverLayoutConfig['runningOrder']['tickerBranding']>>,
  ) {
    const current =
      value.runningOrder.tickerBranding ??
      defaultTickerBranding

    updateWidget('runningOrder', {
      tickerBranding: {
        ...current,
        ...patch,
      },
    })
  }

  function chooseTickerLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      window.alert('Choose a PNG, JPG, WebP, or SVG logo.')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateTickerBranding({
          logo: reader.result,
          mode: 'logo',
        })
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  function beginInteraction(
    event: ReactPointerEvent,
    widget: DriverWidgetId,
    mode: ResizeMode,
  ) {
    if (value[widget].locked) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)

    remember(value)

    setInteraction({
      widget,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      start: { ...value[widget] },
    })
  }

  function moveInteraction(event: ReactPointerEvent) {
    if (!interaction || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const dx = ((event.clientX - interaction.startX) / rect.width) * 100
    const dy = ((event.clientY - interaction.startY) / rect.height) * 100
    const start = interaction.start
    const minimum = widgetMinimums[interaction.widget]

    if (interaction.mode === 'move') {
      updateWidget(
        interaction.widget,
        {
          x: clamp(start.x + dx, 0, 100 - start.width),
          y: clamp(start.y + dy, 0, 100 - start.height),
        },
        false,
      )
      return
    }

    let width = start.width
    let height = start.height

    if (interaction.mode === 'east' || interaction.mode === 'corner') {
      width = clamp(start.width + dx, minimum.width, 100 - start.x)
    }

    if (interaction.mode === 'south' || interaction.mode === 'corner') {
      height = clamp(start.height + dy, minimum.height, 100 - start.y)
    }

    if (start.aspectLocked) {
      const ratio = start.width / start.height

      if (interaction.mode === 'south') {
        width = clamp(height * ratio, minimum.width, 100 - start.x)
      } else {
        height = clamp(width / ratio, minimum.height, 100 - start.y)
      }
    }

    updateWidget(interaction.widget, { width, height }, false)
  }

  function endInteraction(event: ReactPointerEvent) {
    if (!interaction) return

    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture can already be released by the browser.
    }

    setInteraction(null)
  }

  function undo() {
    const previous = undoRef.current[undoRef.current.length - 1]
    if (!previous) return

    undoRef.current = undoRef.current.slice(0, -1)
    redoRef.current = [...redoRef.current.slice(-49), structuredClone(value)]
    onChange(structuredClone(previous))
    refreshHistory()
  }

  function redo() {
    const next = redoRef.current[redoRef.current.length - 1]
    if (!next) return

    redoRef.current = redoRef.current.slice(0, -1)
    undoRef.current = [...undoRef.current.slice(-49), structuredClone(value)]
    onChange(structuredClone(next))
    refreshHistory()
  }

  function resetWidget(widget: DriverWidgetId) {
    applyDiscrete({
      ...value,
      [widget]: structuredClone(defaultDriverLayout[widget]),
    })
  }

  function resetLayout() {
    applyDiscrete(structuredClone(defaultDriverLayout))
  }

  function persistProfiles(next: DriverLayoutProfile[]) {
    setLayoutProfiles(next)
    localStorage.setItem(LAYOUT_PROFILES_KEY, JSON.stringify(next))
  }

  function saveLayoutProfile() {
    const name = profileName.trim()
    if (!name) return

    const now = Date.now()
    const existing = layoutProfiles.find(
      (profile) => profile.name.toLowerCase() === name.toLowerCase(),
    )

    if (existing) {
      persistProfiles(
        layoutProfiles.map((profile) =>
          profile.id === existing.id
            ? {
                ...profile,
                name,
                layout: structuredClone(value),
                updatedAt: now,
              }
            : profile,
        ),
      )
      return
    }

    persistProfiles([
      ...layoutProfiles,
      {
        id: crypto.randomUUID(),
        name,
        layout: structuredClone(value),
        createdAt: now,
        updatedAt: now,
      },
    ])
  }

  function loadLayoutProfile(profile: DriverLayoutProfile) {
    remember(value)
    onChange(normalizeDriverLayout(profile.layout))
    setProfileName(profile.name)
  }

  function deleteLayoutProfile(profileId: string) {
    persistProfiles(layoutProfiles.filter((profile) => profile.id !== profileId))
  }

  return (
    <section className="control-card layout-editor-card">
      <div className="layout-editor-heading">
        <div>
          <h2>FUEGO DRIVER LAYOUT</h2>
          <p>
            Build the onboard overlay once and save multiple layout profiles.
            Widgets can be moved, resized, locked, given compact/expanded variants,
            and shown only when a live race condition is true.
          </p>
        </div>

        <div className="layout-history-actions" data-history-version={historyVersion}>
          <button type="button" onClick={undo} disabled={undoRef.current.length === 0}>
            UNDO
          </button>
          <button type="button" onClick={redo} disabled={redoRef.current.length === 0}>
            REDO
          </button>
          <button type="button" className="layout-reset-button" onClick={resetLayout}>
            RESET DRIVER PRESET
          </button>
        </div>
      </div>

      <div className="layout-profile-bar">
        <div className="layout-profile-save">
          <input
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            placeholder="Layout profile name"
            maxLength={40}
          />
          <button type="button" onClick={saveLayoutProfile} disabled={!profileName.trim()}>
            SAVE LAYOUT
          </button>
        </div>

        <div className="layout-profile-list">
          {layoutProfiles.length === 0 && (
            <span className="layout-profile-empty">
              No saved layouts yet
            </span>
          )}

          {layoutProfiles.map((profile) => (
            <div className="layout-profile-chip" key={profile.id}>
              <button type="button" onClick={() => loadLayoutProfile(profile)}>
                {profile.name}
              </button>
              <button
                type="button"
                className="layout-profile-delete"
                title={`Delete ${profile.name}`}
                onClick={() => deleteLayoutProfile(profile.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="layout-editor-grid">
        <div
          ref={canvasRef}
          className="layout-editor-canvas"
          onPointerMove={moveInteraction}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
        >
          {showSafeAreaGuides && (
            <div className="layout-editor-safe-area" />
          )}

          {widgetIds.map((widget) => {
            const placement = value[widget]
            if (!placement.visible) return null

            if (
              !showConditionalWidgets &&
              placement.condition !== 'always'
            ) {
              return null
            }

            return (
              <div
                key={widget}
                className={[
                  'layout-editor-widget',
                  interaction?.widget === widget ? 'layout-editor-widget-active' : '',
                  placement.locked ? 'layout-editor-widget-locked' : '',
                  `layout-editor-${placement.variant}`,
                  placement.condition !== 'always' ? 'layout-editor-conditional' : '',
                ].filter(Boolean).join(' ')}
                style={{
                  left: `${placement.x}%`,
                  top: `${placement.y}%`,
                  width: `${placement.width}%`,
                  height: `${placement.height}%`,
                }}
                onPointerDown={(event) => {
                  setSelectedWidget(widget)
                  beginInteraction(event, widget, 'move')
                }}
              >
                <span>{driverWidgetLabels[widget]}</span>
                <small>
                  {Math.round(placement.x)}%, {Math.round(placement.y)}%
                  {' · '}
                  {placement.width.toFixed(1)}% × {placement.height.toFixed(1)}%
                </small>

                {placement.condition !== 'always' && (
                  <em>{widgetConditionLabels[placement.condition]}</em>
                )}

                {!placement.locked && (
                  <>
                    <button
                      type="button"
                      className="layout-resize-edge layout-resize-east"
                      aria-label={`Resize ${driverWidgetLabels[widget]} width`}
                      onPointerDown={(event) => beginInteraction(event, widget, 'east')}
                    />
                    <button
                      type="button"
                      className="layout-resize-edge layout-resize-south"
                      aria-label={`Resize ${driverWidgetLabels[widget]} height`}
                      onPointerDown={(event) => beginInteraction(event, widget, 'south')}
                    />
                    <button
                      type="button"
                      className="layout-resize-handle"
                      aria-label={`Resize ${driverWidgetLabels[widget]}`}
                      onPointerDown={(event) => beginInteraction(event, widget, 'corner')}
                    />
                  </>
                )}
              </div>
            )
          })}

          <div className="layout-editor-resolution">
            16:9 RESPONSIVE CANVAS
          </div>
        </div>

        <div className="layout-widget-list layout-widget-editor-panel">
          <div className="widget-overview">
            <div className="widget-panel-heading">
              <h3>WIDGETS</h3>
              <small>DEFAULT SET</small>
            </div>

            <div className="widget-overview-list">
              {coreWidgetIds.map((widget) => (
                <button
                  key={widget}
                  type="button"
                  className={
                    selectedWidget === widget
                      ? 'widget-overview-item active'
                      : 'widget-overview-item'
                  }
                  onClick={() => setSelectedWidget(widget)}
                >
                  <span
                    className={
                      value[widget].visible
                        ? 'widget-status-dot enabled'
                        : 'widget-status-dot'
                    }
                  />
                  <strong>{driverWidgetLabels[widget]}</strong>
                  <small>
                    {value[widget].visible ? 'ON' : 'OFF'}
                  </small>
                </button>
              ))}
            </div>
          </div>

          <div className="widget-single-editor">
            <div className="widget-panel-heading">
              <h3>EDIT WIDGET</h3>
              <small>ALL WIDGETS</small>
            </div>

            <label className="widget-editor-field">
              <span>WIDGET</span>
              <select
                value={selectedWidget}
                onChange={(event) =>
                  setSelectedWidget(
                    event.target.value as DriverWidgetId,
                  )
                }
              >
                {widgetIds.map((widget) => (
                  <option key={widget} value={widget}>
                    {driverWidgetLabels[widget]}
                  </option>
                ))}
              </select>
            </label>

            {(() => {
              const widget = selectedWidget
              const placement = value[widget]

              return (
                <div className="widget-editor-controls">
                  <label className="widget-enabled-row">
                    <span>
                      <strong>ENABLED</strong>
                      <small>
                        Show this widget in the Driver layout.
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      checked={placement.visible}
                      onChange={(event) =>
                        updateWidget(widget, {
                          visible: event.target.checked,
                        })
                      }
                    />
                  </label>

                  <div className="layout-widget-selects widget-editor-selects">
                    <label>
                      STYLE
                      <select
                        value={placement.variant}
                        onChange={(event) => {
                          const variant =
                            event.target.value as WidgetVariant
                          const size =
                            widgetVariantSizes[widget][variant]

                          updateWidget(widget, {
                            variant,
                            x: Math.min(
                              placement.x,
                              100 - size.width,
                            ),
                            y: Math.min(
                              placement.y,
                              100 - size.height,
                            ),
                            width: size.width,
                            height: size.height,
                          })
                        }}
                      >
                        <option value="compact">Compact</option>
                        <option value="standard">Standard</option>
                        <option value="expanded">Expanded</option>
                      </select>
                    </label>

                    <label>
                      SHOW
                      <select
                        value={placement.condition}
                        onChange={(event) =>
                          updateWidget(widget, {
                            condition:
                              event.target.value as WidgetCondition,
                          })
                        }
                      >
                        {conditionIds.map((condition) => (
                          <option key={condition} value={condition}>
                            {widgetConditionLabels[condition]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="widget-lock-grid">
                    <label>
                      <input
                        type="checkbox"
                        checked={placement.locked}
                        onChange={(event) =>
                          updateWidget(widget, {
                            locked: event.target.checked,
                          })
                        }
                      />
                      Lock position
                    </label>

                    <label>
                      <input
                        type="checkbox"
                        checked={placement.aspectLocked}
                        onChange={(event) =>
                          updateWidget(widget, {
                            aspectLocked: event.target.checked,
                          })
                        }
                      />
                      Lock ratio
                    </label>
                  </div>

                  <div className="widget-size-readout">
                    <span>SIZE</span>
                    <strong>
                      {placement.width.toFixed(1)}% ×{' '}
                      {placement.height.toFixed(1)}%
                    </strong>
                    <span>POSITION</span>
                    <strong>
                      {placement.x.toFixed(1)}%,{' '}
                      {placement.y.toFixed(1)}%
                    </strong>
                  </div>

                  {widget === 'runningOrder' && (() => {
                    const branding =
                      placement.tickerBranding ??
                      defaultTickerBranding

                    return (
                      <div className="ticker-branding-controls widget-extra-controls">
                        <strong>TICKER BRANDING</strong>

                        <label>
                          TYPE
                          <select
                            value={branding.mode}
                            onChange={(event) =>
                              updateTickerBranding({
                                mode:
                                  event.target.value as TickerBrandingMode,
                              })
                            }
                          >
                            <option value="text">Custom Text</option>
                            <option value="logo">Custom Logo</option>
                            <option value="sponsor">Profile Sponsor</option>
                            <option value="none">None</option>
                          </select>
                        </label>

                        {branding.mode === 'text' && (
                          <>
                            <label>
                              TEXT
                              <input
                                type="text"
                                value={branding.text}
                                maxLength={32}
                                onChange={(event) =>
                                  updateTickerBranding({
                                    text: event.target.value,
                                  })
                                }
                              />
                            </label>

                            <div className="ticker-branding-row">
                              <label>
                                ALIGN
                                <select
                                  value={branding.textAlign}
                                  onChange={(event) =>
                                    updateTickerBranding({
                                      textAlign:
                                        event.target.value as TickerBrandingAlignment,
                                    })
                                  }
                                >
                                  <option value="left">Left</option>
                                  <option value="center">Center</option>
                                  <option value="right">Right</option>
                                </select>
                              </label>

                              <label>
                                COLOR
                                <input
                                  type="color"
                                  value={branding.textColor}
                                  onChange={(event) =>
                                    updateTickerBranding({
                                      textColor: event.target.value,
                                    })
                                  }
                                />
                              </label>
                            </div>

                            <label>
                              TEXT SIZE · {Math.round(branding.textSize * 100)}%
                              <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.05"
                                value={branding.textSize}
                                onChange={(event) =>
                                  updateTickerBranding({
                                    textSize: Number(event.target.value),
                                  })
                                }
                              />
                            </label>

                            <label className="ticker-branding-check">
                              <input
                                type="checkbox"
                                checked={branding.italic}
                                onChange={(event) =>
                                  updateTickerBranding({
                                    italic: event.target.checked,
                                  })
                                }
                              />
                              Italic
                            </label>
                          </>
                        )}

                        {branding.mode === 'logo' && (
                          <>
                            <label className="ticker-logo-file">
                              CHOOSE LOGO
                              <input
                                type="file"
                                accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                                onChange={chooseTickerLogo}
                              />
                            </label>

                            {branding.logo && (
                              <div className="ticker-logo-preview">
                                <img
                                  src={branding.logo}
                                  alt="Ticker branding preview"
                                />
                              </div>
                            )}

                            <label>
                              LOGO ZOOM · {Math.round(branding.logoZoom * 100)}%
                              <input
                                type="range"
                                min="0.5"
                                max="3"
                                step="0.05"
                                value={branding.logoZoom}
                                onChange={(event) =>
                                  updateTickerBranding({
                                    logoZoom: Number(event.target.value),
                                  })
                                }
                              />
                            </label>

                            <label>
                              LEFT / RIGHT
                              <input
                                type="range"
                                min="-100"
                                max="100"
                                step="1"
                                value={branding.logoOffsetX}
                                onChange={(event) =>
                                  updateTickerBranding({
                                    logoOffsetX: Number(event.target.value),
                                  })
                                }
                              />
                            </label>

                            <label>
                              UP / DOWN
                              <input
                                type="range"
                                min="-100"
                                max="100"
                                step="1"
                                value={branding.logoOffsetY}
                                onChange={(event) =>
                                  updateTickerBranding({
                                    logoOffsetY: Number(event.target.value),
                                  })
                                }
                              />
                            </label>
                          </>
                        )}

                        {branding.mode === 'sponsor' && (
                          <small>
                            Uses the primary sponsor logo from the
                            active Driver Profile.
                          </small>
                        )}

                        {branding.mode === 'none' && (
                          <small>
                            Removes the branding cell and gives the
                            running order the extra space.
                          </small>
                        )}
                      </div>
                    )
                  })()}

                  <button
                    type="button"
                    className="widget-reset-selected"
                    onClick={() => resetWidget(widget)}
                  >
                    RESET {driverWidgetLabels[widget].toUpperCase()}
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </section>
  )
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export default DriverLayoutEditor
