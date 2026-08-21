import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'

import {
  createCustomProfile,
  frostProfile,
  type DriverProfile,
} from './profileTypes'

const DEFAULT_ZOOM = 0.72

type Props = {
  profiles: DriverProfile[]
  activeProfileId: string
  onActivate: (profileId: string) => void
  onSave: (profile: DriverProfile) => void
  onDelete: (profileId: string) => void
}

async function cropPortrait(
  source: string,
  zoom: number,
  offsetX: number,
  offsetY: number,
) {
  const image = new Image()
  image.src = source
  await image.decode()

  const canvas = document.createElement('canvas')
  /*
   * Match the driver portrait grid cell in App.css exactly:
   * 155px wide by 148px high inside the ticker border.
   */
  canvas.width = 620
  canvas.height = 592

  const context = canvas.getContext('2d')
  if (!context) return source

  const coverScale = Math.max(
    canvas.width / image.width,
    canvas.height / image.height,
  )
  const scale = coverScale * zoom
  const width = image.width * scale
  const height = image.height * scale
  const travelX = Math.max(0, width - canvas.width) / 2
  const travelY = Math.max(0, height - canvas.height) / 2
  const x = (canvas.width - width) / 2 + (offsetX / 100) * travelX
  const y = (canvas.height - height) / 2 + (offsetY / 100) * travelY

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, x, y, width, height)
  return canvas.toDataURL('image/webp', 0.9)
}

export default function ProfileManager({
  profiles,
  activeProfileId,
  onActivate,
  onSave,
  onDelete,
}: Props) {
  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ||
    frostProfile

  const [draft, setDraft] = useState<DriverProfile>(activeProfile)
  const [portraitSource, setPortraitSource] = useState(
    activeProfile.portraitSource || activeProfile.portrait,
  )
  const [zoom, setZoom] = useState(
    activeProfile.portraitZoom ?? DEFAULT_ZOOM,
  )
  const [offsetX, setOffsetX] = useState(
    activeProfile.portraitOffsetX ?? 0,
  )
  const [offsetY, setOffsetY] = useState(
    activeProfile.portraitOffsetY ?? 0,
  )
  const [cropPreview, setCropPreview] = useState(
    activeProfile.portrait,
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sponsorInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(activeProfile)
    setPortraitSource(
      activeProfile.portraitSource || activeProfile.portrait,
    )
    setZoom(activeProfile.portraitZoom ?? DEFAULT_ZOOM)
    setOffsetX(activeProfile.portraitOffsetX ?? 0)
    setOffsetY(activeProfile.portraitOffsetY ?? 0)
  }, [activeProfile])

  useEffect(() => {
    let cancelled = false

    if (draft.factory) {
      setCropPreview(activeProfile.portrait)
      return () => {
        cancelled = true
      }
    }

    cropPortrait(
      portraitSource,
      zoom,
      offsetX,
      offsetY,
    )
      .then((preview) => {
        if (!cancelled) {
          setCropPreview(preview)
        }
      })
      .catch((error) => {
        console.error('Could not preview portrait crop:', error)
      })

    return () => {
      cancelled = true
    }
  }, [activeProfile.portrait, draft.factory, offsetX, offsetY, portraitSource, zoom])

  function updateField<K extends keyof DriverProfile>(
    field: K,
    value: DriverProfile[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function choosePortrait(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      window.alert('Choose a PNG, JPG, or WebP image.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPortraitSource(reader.result)
        setZoom(DEFAULT_ZOOM)
        setOffsetX(0)
        setOffsetY(0)
      }
    }
    reader.readAsDataURL(file)
  }

  function chooseSponsorLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      window.alert('Choose a PNG, JPG, or WebP logo.')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateField('sponsorLogo', reader.result)
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  async function saveProfile() {
    if (draft.factory) return
    const portrait = await cropPortrait(
      portraitSource,
      zoom,
      offsetX,
      offsetY,
    )
    onSave({
      ...draft,
      firstName: draft.firstName.trim().toUpperCase(),
      nickname: draft.nickname.trim().toUpperCase(),
      lastName: draft.lastName.trim().toUpperCase(),
      manufacturer: draft.manufacturer.trim().toUpperCase(),
      carNumber: draft.carNumber.trim().toUpperCase().slice(0, 4) || '0',
      portrait,
      portraitSource,
      portraitZoom: zoom,
      portraitOffsetX: offsetX,
      portraitOffsetY: offsetY,
    })
  }

  return (
    <div className="profile-workspace">
      <aside className="profile-sidebar control-card">
        <h2>DRIVER PROFILES</h2>
        <div className="profile-list">
          {profiles.map((profile) => (
            <button
              type="button"
              key={profile.id}
              className={profile.id === activeProfileId ? 'profile-choice active' : 'profile-choice'}
              onClick={() => onActivate(profile.id)}
            >
              <strong>#{profile.carNumber}</strong>
              <span>{profile.profileName}</span>
              {profile.factory && <em>FACTORY</em>}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="profile-action primary"
          onClick={() => onSave(createCustomProfile(activeProfile))}
        >
          DUPLICATE AS NEW
        </button>
        {!activeProfile.factory && (
          <button
            type="button"
            className="profile-action danger"
            onClick={() => onDelete(activeProfile.id)}
          >
            DELETE PROFILE
          </button>
        )}
      </aside>

      <section className="profile-form control-card">
        <div className="profile-heading-row">
          <h2>PROFILE DETAILS</h2>
          {draft.factory && <span>READ-ONLY DEFAULT</span>}
        </div>
        <div className="profile-fields">
          <label>PROFILE NAME<input value={draft.profileName} disabled={draft.factory} onChange={(e) => updateField('profileName', e.target.value)} /></label>
          <label>CAR NUMBER<input value={draft.carNumber} disabled={draft.factory} maxLength={4} onChange={(e) => updateField('carNumber', e.target.value)} /></label>
          <label>FIRST NAME<input value={draft.firstName} disabled={draft.factory} onChange={(e) => updateField('firstName', e.target.value)} /></label>
          <label>NICKNAME<input value={draft.nickname} disabled={draft.factory} onChange={(e) => updateField('nickname', e.target.value)} /></label>
          <label>LAST NAME<input value={draft.lastName} disabled={draft.factory} onChange={(e) => updateField('lastName', e.target.value)} /></label>
          <label>MANUFACTURER<input value={draft.manufacturer} disabled={draft.factory} onChange={(e) => updateField('manufacturer', e.target.value)} /></label>
          <label className="wide">TEAM NAME<input value={draft.teamName} disabled={draft.factory} onChange={(e) => updateField('teamName', e.target.value)} /></label>
        </div>
        <h3>OVERLAY COLORS</h3>
        <div className="color-fields">
          {([
            ['primaryColor', 'PRIMARY'],
            ['secondaryColor', 'SECONDARY'],
            ['trimColor', 'TRIM / STANDBY'],
            ['numberColor', 'NUMBER'],
            ['textColor', 'TEXT'],
          ] as const).map(([field, label]) => (
            <label key={field}>
              <span>{label}</span>
              <input type="color" value={draft[field]} disabled={draft.factory} onChange={(e) => updateField(field, e.target.value)} />
              <code>{draft[field].toUpperCase()}</code>
            </label>
          ))}
        </div>
        {!draft.factory && (
          <button type="button" className="profile-action primary save-profile" onClick={saveProfile}>
            SAVE PROFILE
          </button>
        )}
      </section>

      <section className="portrait-editor control-card">
        <h2>DRIVER PORTRAIT</h2>
        <div
          className="portrait-crop-window"
          style={{
            width: '240px',
            height: `${(240 * 148) / 155}px`,
            aspectRatio: '155 / 148',
          }}
        >
          <img
            className={
              draft.factory
                ? 'factory-portrait-preview'
                : 'custom-portrait-preview'
            }
            src={draft.factory ? portraitSource : cropPreview}
            alt="Driver crop preview"
            style={
              draft.factory
                ? {
                    objectFit: 'contain',
                    transform: 'translateY(5px) scale(1.1)',
                  }
                : undefined
            }
          />
          {!draft.factory && (
            <div
              className="crop-boundary"
              aria-hidden="true"
            />
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={choosePortrait} />
        <button type="button" className="profile-action primary" disabled={draft.factory} onClick={() => fileInputRef.current?.click()}>
          CHOOSE IMAGE
        </button>
        <label className="crop-slider">ZOOM<input type="range" min="0.55" max="3" step="0.01" value={zoom} disabled={draft.factory} onChange={(e) => setZoom(Number(e.target.value))} /></label>
        <label className="crop-slider">LEFT / RIGHT<input type="range" min="-100" max="100" value={offsetX} disabled={draft.factory} onChange={(e) => setOffsetX(Number(e.target.value))} /></label>
        <label className="crop-slider">UP / DOWN<input type="range" min="-100" max="100" value={offsetY} disabled={draft.factory} onChange={(e) => setOffsetY(Number(e.target.value))} /></label>
        <p>PNG files with transparent backgrounds produce the cleanest broadcast portrait.</p>

        <div className="sponsor-editor">
          <h3>PRIMARY SPONSOR LOGO</h3>

          <div className="sponsor-preview">
            {draft.sponsorLogo ? (
              <img
                src={draft.sponsorLogo}
                alt="Primary sponsor preview"
              />
            ) : (
              <span>NO LOGO SELECTED</span>
            )}
          </div>

          <input
            ref={sponsorInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={chooseSponsorLogo}
          />

          <button
            type="button"
            className="profile-action primary"
            disabled={draft.factory}
            onClick={() => sponsorInputRef.current?.click()}
          >
            CHOOSE SPONSOR LOGO
          </button>

          {!draft.factory && draft.sponsorLogo && (
            <button
              type="button"
              className="profile-action danger"
              onClick={() => updateField('sponsorLogo', '')}
            >
              REMOVE LOGO
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
