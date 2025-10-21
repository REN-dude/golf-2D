export type ClubKey = '1w' | '5i' | '7i' | '9i' | '56w'

export type ClubSpec = {
  key: ClubKey
  label: string
  // carry/run coefficients (multipliers applied to a base distance metric)
  carryCoeff: number
  runCoeff: number
  // additional club params for future physics/feel tuning
  maxPower: number // relative strength used to scale input power
  spin: number // 0..1, higher reduces roll more
  launchAngleDeg: number // for later; unused in 2D flat sim
}

export const CLUB_ORDER: ClubKey[] = ['1w', '5i', '7i', '9i', '56w']

//クラブのパラメータ
export const CLUBS: Record<ClubKey, ClubSpec> = {
  '1w': {
    key: '1w',
    label: '1W',
    carryCoeff: 1.10,
    runCoeff: 1.40,
    maxPower: 1.25,
    spin: 0.2,
    launchAngleDeg: 12,
  },
  '5i': {
    key: '5i',
    label: '5I',
    carryCoeff: 0.95,
    runCoeff: 1.05,
    maxPower: 1.05,
    spin: 0.35,
    launchAngleDeg: 18,
  },
  '7i': {
    key: '7i',
    label: '7I',
    carryCoeff: 0.88,
    runCoeff: 0.90,
    maxPower: 1.0,
    spin: 0.45,
    launchAngleDeg: 22,
  },
  '9i': {
    key: '9i',
    label: '9I',
    carryCoeff: 0.78,
    runCoeff: 0.65,
    maxPower: 0.9,
    spin: 0.6,
    launchAngleDeg: 26,
  },
  '56w': {
    key: '56w',
    label: '56°',
    carryCoeff: 0.62,
    runCoeff: 0.25,
    maxPower: 0.7,
    spin: 0.85,
    launchAngleDeg: 52,
  },
}

// Lie-based modifiers to carry and run (simple 2D approximations)
export const LIE_MOD = {
  // Treat tee like fairway for modifiers
  fairway: { carry: 1.0, run: 1.0 },
  rough: { carry: 0.92, run: 0.7 },
  sand: { carry: 0.85, run: 0.4 }, // bunker
  green: { carry: 0.95, run: 0.5 },
  water: { carry: 0.8, run: 0.2 },
} as const

