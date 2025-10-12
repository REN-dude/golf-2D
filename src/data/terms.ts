export type Term = { id: string; label: string; oneLiner: string }

export const terms: Term[] = [
  { id: 'tee', label: 'ティーショット', oneLiner: 'ホールの最初の一打。ティーから打つ。' },
  { id: 'fairway', label: 'フェアウェイ', oneLiner: '芝が短く整備された打ちやすいエリア。' },
  { id: 'rough', label: 'ラフ', oneLiner: '芝が長く抵抗が増えるエリア。' },
  { id: 'sand', label: 'バンカー', oneLiner: '砂地のエリア。ショットが難しくなる。' },
  { id: 'ob', label: 'OB', oneLiner: 'コース外。1罰打のうえ再開。' },
  { id: 'water', label: 'ハザード', oneLiner: '池・川など。1罰打でドロップ。' },
  { id: 'green', label: 'グリーン', oneLiner: 'カップのある最終エリア。' },
  { id: 'putter', label: 'パター', oneLiner: 'グリーン上で使うクラブ。' },
]

