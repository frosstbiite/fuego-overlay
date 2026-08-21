import frostPortrait from './assets/driver21.png'

const DEFAULT_PROFILE_ZOOM = 0.72

export type DriverProfile = {
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

export const frostProfile: DriverProfile = {
  id: 'frost-default',
  factory: true,
  profileName: 'Frost — Default',
  firstName: 'JOSEPH',
  nickname: 'FROST',
  lastName: 'GRIJALVA',
  teamName: 'FUEGO AUTOSPORT',
  manufacturer: 'FORD',
  carNumber: '21',
  primaryColor: '#161dff',
  secondaryColor: '#0b0f85',
  trimColor: '#2f8cff',
  numberColor: '#fff200',
  textColor: '#ffffff',
  portrait: frostPortrait,
  portraitSource: frostPortrait,
  portraitZoom: 1,
  portraitOffsetX: 0,
  portraitOffsetY: 0,
  sponsorLogo: '',
}

export function createCustomProfile(
  source: DriverProfile = frostProfile,
): DriverProfile {
  return {
    ...source,
    id: `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    factory: false,
    profileName:
      source.id === frostProfile.id
        ? 'My Driver'
        : `${source.profileName} Copy`,
  }
}

export function normalizeProfile(
  profile: Partial<DriverProfile>,
): DriverProfile {
  const normalized = {
    ...frostProfile,
    ...profile,
    id: profile.id || createCustomProfile().id,
    factory: profile.id === frostProfile.id,
  }

  return {
    ...normalized,
    portraitSource:
      profile.portraitSource ||
      profile.portrait ||
      frostProfile.portraitSource,
    portraitZoom:
      Number.isFinite(profile.portraitZoom)
        ? Number(profile.portraitZoom)
        : DEFAULT_PROFILE_ZOOM,
    portraitOffsetX:
      Number.isFinite(profile.portraitOffsetX)
        ? Number(profile.portraitOffsetX)
        : 0,
    portraitOffsetY:
      Number.isFinite(profile.portraitOffsetY)
        ? Number(profile.portraitOffsetY)
        : 0,
  }
}
