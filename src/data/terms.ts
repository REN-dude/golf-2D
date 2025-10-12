export type Term = { id: string; label: string; oneLiner: string }

export const terms: Term[] = [
  { id: 'tee', label: 'ティーショット', oneLiner: '最初の一打' },
  { id: 'fairway', label: 'フェアウェイ', oneLiner: '短く刈られた打ちやすいエリア' },
  { id: 'rough', label: 'ラフ', oneLiner: '長い芝でボールが沈みやすい' },
  { id: 'sand', label: 'バンカー', oneLiner: '砂でショットが減速する' },
  { id: 'water', label: 'ウォーター', oneLiner: '池。入ると救済とペナルティ' },
  { id: 'ob', label: 'OB', oneLiner: 'コース外。1打罰でドロップ' },
  { id: 'hazard', label: 'ハザード', oneLiner: '難所（砂・水など）' },
  { id: 'green', label: 'グリーン', oneLiner: 'カップがあるパッティングエリア' },
  { id: 'putter', label: 'パター', oneLiner: '転がして狙うクラブ' },
  { id: 'par', label: 'パー', oneLiner: '想定打数' },
]

