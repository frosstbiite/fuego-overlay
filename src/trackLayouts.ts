export type TrackLayout = {
  key: string
  name: string
  aliases: string[]
  path: string
  startFinish: {
    x1: number
    y1: number
    x2: number
    y2: number
  }
}

const fallbackTrack: TrackLayout = {
  key: 'fallback',
  name: 'Track',
  aliases: [],
  path: `
    M 110 102
    L 60 102
    C 32 102, 18 84, 18 60
    C 18 36, 32 18, 60 18
    L 160 18
    C 188 18, 202 36, 202 60
    C 202 84, 188 102, 160 102
    Z
  `,
  startFinish: {
    x1: 110,
    y1: 94,
    x2: 110,
    y2: 110,
  },
}

export const trackLayouts: TrackLayout[] = [
  {
    key: 'talladega',
    name: 'Talladega Superspeedway',
    aliases: [
      'talladega',
    ],
    path: `
      M 110 102
      L 62 102
      C 35 102, 19 88, 15 65
      C 11 42, 23 23, 52 18
      L 158 18
      C 184 18, 199 32, 203 52
      C 207 74, 196 91, 174 97
      C 154 102, 132 102, 110 102
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 94,
      x2: 110,
      y2: 110,
    },
  },

  {
    key: 'texas',
    name: 'Texas Motor Speedway',
    aliases: [
      'texas motor',
      'texas speedway',
    ],
    path: `
      M 110 103
      L 58 103
      C 31 103, 17 89, 17 64
      C 17 39, 31 19, 58 17
      L 158 17
      C 180 17, 198 28, 203 46
      L 203 70
      C 198 90, 182 103, 158 103
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 95,
      x2: 110,
      y2: 111,
    },
  },

  {
    key: 'dover',
    name: 'Dover Motor Speedway',
    aliases: [
      'dover',
    ],
    path: `
      M 110 103
      L 67 103
      C 36 103, 20 87, 20 60
      C 20 33, 36 17, 67 17
      L 153 17
      C 184 17, 200 33, 200 60
      C 200 87, 184 103, 153 103
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 95,
      x2: 110,
      y2: 111,
    },
  },

{
  key: 'charlotte',
  name: 'Charlotte Motor Speedway',
  aliases: [
    'charlotte',
  ],
  path: `
    M 110 106

    L 95 106

    C 78 105,
      63 99,
      45 96

    C 26 93,
      15 80,
      15 61

    C 15 35,
      35 17,
      68 17

    L 152 17

    C 185 17,
      205 35,
      205 61

    C 205 80,
      194 93,
      175 96

    C 157 99,
      142 105,
      125 106

    L 110 106

    Z
  `,
  startFinish: {
    x1: 110,
    y1: 98,
    x2: 110,
    y2: 114,
  },
},

  {
    key: 'nashville',
    name: 'Nashville Superspeedway',
    aliases: [
      'nashville superspeedway',
      'nashville',
    ],
    path: `
      M 110 102
      L 59 102
      C 32 102, 17 86, 17 61
      C 17 37, 31 20, 56 18
      L 158 18
      C 181 18, 198 31, 202 50
      C 207 72, 194 91, 169 98
      C 150 102, 129 102, 110 102
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 94,
      x2: 110,
      y2: 110,
    },
  },

  {
    key: 'michigan',
    name: 'Michigan International Speedway',
    aliases: [
      'michigan',
    ],
    path: `
      M 110 101
      L 62 101
      C 36 101, 20 87, 16 65
      C 12 42, 27 22, 54 18
      L 154 18
      C 178 18, 195 29, 202 48
      C 210 70, 198 89, 173 97
      C 153 102, 130 101, 110 101
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 93,
      x2: 110,
      y2: 109,
    },
  },

  {
    key: 'pocono',
    name: 'Pocono Raceway',
    aliases: [
      'pocono',
    ],
    path: `
      M 110 103
      L 39 96
      C 23 94, 16 84, 21 69
      L 58 22
      C 66 12, 78 13, 91 21
      L 197 75
      C 207 81, 204 94, 191 98
      C 161 105, 135 105, 110 103
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 95,
      x2: 110,
      y2: 111,
    },
  },

  {
    key: 'daytona',
    name: 'Daytona International Speedway',
    aliases: [
      'daytona',
    ],
    path: `
      M 110 102
      L 61 102
      C 34 102, 18 88, 14 65
      C 10 42, 23 23, 52 18
      L 159 18
      C 185 18, 200 32, 204 53
      C 208 74, 196 91, 173 98
      C 153 102, 132 102, 110 102
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 94,
      x2: 110,
      y2: 110,
    },
  },

  {
    key: 'chicagoland',
    name: 'Chicagoland Speedway',
    aliases: [
      'chicagoland',
    ],
    path: `
      M 110 102
      L 59 102
      C 32 102, 17 86, 17 61
      C 17 37, 31 20, 57 18
      L 156 18
      C 181 18, 198 31, 202 50
      C 207 72, 194 91, 169 98
      C 150 102, 130 102, 110 102
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 94,
      x2: 110,
      y2: 110,
    },
  },

  {
    key: 'atlanta',
    name: 'EchoPark Speedway',
    aliases: [
      'echopark',
      'atlanta motor',
      'atlanta speedway',
      'atlanta',
    ],
    path: `
      M 110 102
      L 57 102
      C 31 102, 17 87, 17 64
      C 17 40, 31 20, 57 18
      L 157 18
      C 180 18, 197 29, 202 47
      L 202 69
      C 198 89, 182 102, 157 102
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 94,
      x2: 110,
      y2: 110,
    },
  },

  {
    key: 'north-wilkesboro',
    name: 'North Wilkesboro Speedway',
    aliases: [
      'north wilkesboro',
      'wilkesboro',
    ],
    path: `
      M 110 101
      L 69 101
      C 38 101, 22 85, 22 60
      C 22 35, 38 19, 69 19
      L 151 19
      C 182 19, 198 35, 198 60
      C 198 85, 182 101, 151 101
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 93,
      x2: 110,
      y2: 109,
    },
  },

  {
    key: 'indianapolis',
    name: 'Indianapolis Motor Speedway',
    aliases: [
      'indianapolis',
      'indy oval',
    ],
    path: `
      M 110 103
      L 54 103
      Q 20 103, 20 79
      L 20 41
      Q 20 17, 54 17
      L 166 17
      Q 200 17, 200 41
      L 200 79
      Q 200 103, 166 103
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 95,
      x2: 110,
      y2: 111,
    },
  },

  {
    key: 'las-vegas',
    name: 'Las Vegas Motor Speedway',
    aliases: [
      'las vegas',
      'vegas',
    ],
    path: `
      M 110 102
      L 58 102
      C 32 102, 17 87, 17 62
      C 17 38, 31 20, 57 18
      L 157 18
      C 181 18, 198 30, 202 49
      C 207 71, 194 90, 169 98
      C 150 102, 130 102, 110 102
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 94,
      x2: 110,
      y2: 110,
    },
  },

  {
    key: 'iowa',
    name: 'Iowa Speedway',
    aliases: [
      'iowa',
    ],
    path: `
      M 110 101
      L 66 101
      C 38 101, 22 86, 21 62
      C 20 38, 36 20, 64 19
      L 151 19
      C 178 19, 195 32, 199 52
      C 204 73, 191 90, 165 98
      C 148 102, 128 101, 110 101
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 93,
      x2: 110,
      y2: 109,
    },
  },

  {
  key: 'richmond',
  name: 'Richmond Raceway',
  aliases: [
    'richmond',
  ],
  path: `
    M 110 106

    C 79 106,
      50 102,
      29 92

    C 11 84,
      6 68,
      13 49

    C 21 28,
      39 16,
      64 16

    L 160 16

    C 186 16,
      203 30,
      209 49

    C 215 69,
      207 86,
      188 95

    C 166 104,
      137 107,
      110 106

    Z
  `,
  startFinish: {
    x1: 106,
    y1: 96,
    x2: 113,
    y2: 113,
  },
},

  {
    key: 'new-hampshire',
    name: 'New Hampshire Motor Speedway',
    aliases: [
      'new hampshire',
      'loudon',
    ],
    path: `
      M 110 102
      L 62 102
      C 34 102, 18 84, 18 59
      C 18 34, 34 18, 62 18
      L 158 18
      C 186 18, 202 34, 202 59
      C 202 84, 186 102, 158 102
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 94,
      x2: 110,
      y2: 110,
    },
  },

  {
    key: 'darlington',
    name: 'Darlington Raceway',
    aliases: [
      'darlington',
    ],
    path: `
      M 110 102
      L 58 102
      C 31 102, 15 87, 17 62
      C 19 38, 35 22, 62 19
      L 157 15
      C 181 14, 199 27, 203 48
      C 208 72, 194 91, 168 98
      C 149 102, 129 102, 110 102
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 94,
      x2: 110,
      y2: 110,
    },
  },

  {
    key: 'bristol',
    name: 'Bristol Motor Speedway',
    aliases: [
      'bristol',
    ],
    path: `
      M 110 103
      L 76 103
      C 43 103, 26 87, 26 60
      C 26 33, 43 17, 76 17
      L 144 17
      C 177 17, 194 33, 194 60
      C 194 87, 177 103, 144 103
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 95,
      x2: 110,
      y2: 111,
    },
  },

  {
    key: 'kansas',
    name: 'Kansas Speedway',
    aliases: [
      'kansas',
    ],
    path: `
      M 110 102
      L 58 102
      C 32 102, 17 87, 17 62
      C 17 38, 31 20, 57 18
      L 157 18
      C 181 18, 198 30, 202 49
      C 207 71, 194 90, 169 98
      C 150 102, 130 102, 110 102
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 94,
      x2: 110,
      y2: 110,
    },
  },

  {
    key: 'phoenix',
    name: 'Phoenix Raceway',
    aliases: [
      'phoenix',
    ],
    path: `
      M 110 103
      L 55 103
      C 30 103, 17 88, 19 67
      C 21 48, 36 37, 57 35
      L 92 31
      L 118 18
      L 163 18
      C 188 18, 201 33, 201 54
      C 201 77, 185 94, 160 99
      C 143 103, 126 103, 110 103
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 95,
      x2: 110,
      y2: 111,
    },
  },

  {
    key: 'martinsville',
    name: 'Martinsville Speedway',
    aliases: [
      'martinsville',
    ],
    path: `
      M 110 103
      L 73 103
      C 39 103, 27 88, 27 60
      C 27 32, 39 17, 73 17
      L 147 17
      C 181 17, 193 32, 193 60
      C 193 88, 181 103, 147 103
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 95,
      x2: 110,
      y2: 111,
    },
  },

  {
    key: 'homestead',
    name: 'Homestead-Miami Speedway',
    aliases: [
      'homestead',
      'homestead-miami',
      'miami speedway',
    ],
    path: `
      M 110 102
      L 58 102
      C 32 102, 17 87, 17 62
      C 17 38, 31 20, 57 18
      L 157 18
      C 181 18, 198 30, 202 49
      C 207 71, 194 90, 169 98
      C 150 102, 130 102, 110 102
      Z
    `,
    startFinish: {
      x1: 110,
      y1: 94,
      x2: 110,
      y2: 110,
    },
  },
]

export function getTrackLayout(
  reportedTrackName: string,
): TrackLayout {
  const normalizedTrackName =
    reportedTrackName
      .toLowerCase()
      .trim()

  const matchedTrack =
    trackLayouts.find(
      (track) => {
        return track.aliases.some(
          (alias) => {
            return normalizedTrackName
              .includes(
                alias.toLowerCase(),
              )
          },
        )
      },
    )

  return matchedTrack ??
    fallbackTrack
}