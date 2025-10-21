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
//carryCoeff:キャリー比率（空中区間の割合）を決める係数。大きいほどキャリーが増える。
//runCoeff:ラン比率（着地後の転がり）を決める係数。大きいほどランが増える。
//maxPower:ショット初速の基準倍率。ドラッグ量は無視し、方向のみ反映、速度は「固定値 × maxPower」。
//spin:ラン抑制（高いほど転がりが減る）と、空気抵抗計算にも影響。
//launchAngleDeg:空気抵抗の算出に寄与（高いほど空気抵抗がやや増える）。2Dでの打ち上げ角の簡易パラメータ。
export const CLUBS: Record<ClubKey, ClubSpec> = {
  '1w': {
    key: '1w',
    label: '1W',
    carryCoeff: 0.5,
    runCoeff: 0.95,
    maxPower: 1.6,
    spin: 0.25,
    launchAngleDeg: 12,
  },
  '5i': {
    key: '5i',
    label: '5I',
    carryCoeff: 0.4,
    runCoeff: 0.85,
    maxPower: 1.35,
    spin: 0.35,
    launchAngleDeg: 18,
  },
  '7i': {
    key: '7i',
    label: '7I',
    carryCoeff: 0.3,
    runCoeff: 0.75,
    maxPower: 1.15,
    spin: 0.45,
    launchAngleDeg: 22,
  },
  '9i': {
    key: '9i',
    label: '9I',
    carryCoeff: 0.2,
    runCoeff: 0.60,
    maxPower: 1,
    spin: 0.6,
    launchAngleDeg: 26,
  },
  '56w': {
    key: '56w',
    label: '56°',
    carryCoeff: 0.1,
    runCoeff: 0.20,
    maxPower: 0.75,
    spin: 0.90,
    launchAngleDeg: 52,
  },
}

// Lie-based modifiers to carry and run (simple 2D approximations)
export const LIE_MOD = {
  // Treat tee like fairway for modifiers
  fairway: { carry: 0.95, run: 1.0 },
  rough: { carry: 0.92, run: 0.7 },
  sand: { carry: 0.85, run: 0.4 }, // bunker
  green: { carry: 0.95, run: 0.5 },
  water: { carry: 0.8, run: 0.2 },
} as const


