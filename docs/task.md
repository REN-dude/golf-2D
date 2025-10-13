0) 端末セットアップ（Codex用ではない）
npm create vite@latest golf-par3 -- --template react-ts
cd golf-par3
npm i phaser
npm i -D @types/phaser
npm i
npm run dev

1) Codex命令：MVP仕様（最初に貼る）

以下の仕様で Par3のみ・チュートリアル無し の 2D ゴルフMVPを作ってください。
ライブラリは React + Vite + TypeScript + Phaser3。画像アセットは使わず図形描画のみ。
要件

単一ホール（Par3）。画面は 800×450。

操作：ボールを長押し→引っ張って→離す でショット（ベクトル＝押下開始点−離し点）。

地形：フェアウェイ/グリーン/バンカー/池 を配置。

バンカー：摩擦が強い（＝減速大）。強くドラッグしないと出にくい。

池：侵入時に +1ペナルティ。「カップの後方線上」かつ「池の後方」にドロップして再開。

簡易化のため：カップ→直前の安全位置 へ引いた直線上で、水面の外側に少し離した位置（例：水面境界から 20px 後方）へドロップ。

グリーン上は見た目を変える（色/縁取り）＋自動でパット向けに最大パワーを低下。

物理：Arcade Physics。重力0、ワールド境界で反射。

カップイン：カップ円と重なり、速度が小さいとき“吸着”してホールアウト。

UI：左上に 「Hole 1 (Par 3)」 と 打数（Strokes） を表示。右上に リセット ボタン。

コードは 最小構成のファイル に分割して出力してください。

最終回答は、各ファイルのフル内容を「ファイル名→コード」形式で まとめてください。

まずはディレクトリ構成案を出してください。

2) Codex命令：ディレクトリと空ファイル

次のファイルを作成し、空のエクスポートを置いてください（既存のVite雛形に追記）。

src/
  game/
    GolfScene.ts
    types.ts
  ui/
    HUD.tsx
  styles/
    app.css
App.tsx
main.tsx
index.css


まだ描画やロジックは書かず、型とコンポーネントの雛形だけ置いてください。

3) Codex命令：型と定数

src/game/types.ts に以下を定義してください。

export type Lie = 'fairway' | 'green' | 'sand' | 'water';
export interface Rect { x:number; y:number; w:number; h:number; }
export interface Circle { x:number; y:number; r:number; }
export interface Course {
  par: number;
  tee: { x:number; y:number; };
  cup: Circle;
  green: Circle;
  bunker: Rect; // 1つだけ
  water: Rect;  // 1つだけ
  bounds: { w:number; h:number; };
}


par は 3、bounds は 800×450 を前提にします。

4) Codex命令：Phaserシーン（単一ホール実装）

src/game/GolfScene.ts を以下で実装してください。
シーン初期化

Phaser 3、Arcade Physics、重力0、画面 800×450。

Course 定義を内部に持ち、座標例：

tee: (120, 360)

cup: 円 { x: 650, y: 120, r: 10 }

green: 円 { x: 650, y: 120, r: 70 }（見た目変更＆パワー制限）

bunker: 矩形 { x: 360, y: 260, w: 120, h: 70 }

water: 矩形 { x: 460, y: 150, w: 120, h: 80 }（カップとティーの中間に置く）

描画

背景：フェアウェイ色。

グリーン：緑系の別色の円を描画し、縁取り。

バンカー：砂色の矩形。

池：青の矩形。

カップ：小円＋旗の簡易描画（ラインでも良い）。

ボール：小円（半径12px程度）。

操作

ボール長押しでドラッグガイド（点線+矢印）。

離したら velocity = (start - end) * powerScale を適用。

グリーン上はパワー上限を低下（例：最大速度を通常の 35% にクランプ）。

物理/ライ

毎フレーム、現在のライを判定：

water 矩形内 → water

bunker 矩形内 → sand

green 円内 → green

それ以外 → fairway

減速（疑似摩擦）：

fairway: 0.99

green: 0.995（転がりやすさ演出）

sand: 0.96（強く減速）

壁反射：ワールド境界で反射、反射時は速度 0.9 倍。

バンカー仕様

砂上は強く減速するだけでOK（「強くドラッグしないと出ない」を表現）。

池のペナルティ＆ドロップ

water に侵入した瞬間：

strokes += 1

直前の安全位置 lastSafePos を保持しておく。

「カップの後方線上」かつ「池の後方」 へドロップ：

ベクトル v = lastSafePos - cupCenter を正規化。

dropPoint = pointBeyondWater(cupCenter, v) を計算（cup→lastSafe 方向に向かって、水の外側に 20px 余白を設けた座標）。

矩形 water を横切る直線上の交点を求め、そこから 20px カップ側と反対方向へオフセットして配置。

速度を0にし、ボール座標を dropPoint へ。

カップイン

ボール中心が cup.r 以内、かつ速度が閾値（例：40）未満 → 速度を0にしてホールアウト。

ホールアウト時にコールバックでUIへ通知。

イベント

ショットごとに strokes を+1。

onUpdateLie(lie: Lie) と onHoleOut() をコールバックで外へ通知できるように init(config) で受け取る。

受け入れ基準

砂に入ると転がりが明確に重い。

池に入ると +1 され、カップ後方線上で水の外側にドロップされる。

グリーン内は見た目が変わり、最大パワーが弱くなる。

Par3 でスコア表示が更新される。

5) Codex命令：UI（HUD）

src/ui/HUD.tsx を実装：

左上に Hole 1 (Par 3) と Strokes: N を表示。

右上に Reset ボタン（ボールと打数を初期化）。

props：strokes:number, onReset:()=>void。

src/styles/app.css にHUDの固定配置用の最低限スタイルを記述。

6) Codex命令：App とエントリ

App.tsx：

画面全体に Phaser の <div ref> を置く。

GolfScene を生成し、init({ onUpdateLie, onHoleOut }) を渡す。

strokes の状態を保持してHUDへ渡す。ショット時/池ペナルティ時に加算できるよう、GolfScene からも通知を受ける。

Reset でボール位置/打数を初期化する API を scene に用意（例：reset()）。

main.tsx：標準の React エントリ。
index.css：ベーススタイル＋ app.css を読み込み。

7) Codex命令：池ドロップの補助関数

GolfScene.ts 内に、矩形 water:Rect と カップ中心 C から安全方向ベクトル v に沿って、水面外に20px出た点を返す関数を実装してください。
例：

function pointBeyondWater(cup:{x:number;y:number}, dir:{x:number;y:number}, water:Rect, margin=20){
  // 直線 P(t)=C + t*dir と water 矩形の交差を計算。
  // 交点 t_water を見つけたら drop = C + (t_water - marginOnDir)*dir。
  // dir は正規化しておくこと。marginOnDir = margin。t はスカラー距離。
  // 交差しない場合は、lastSafePos へ少し戻した位置を返すフォールバック。
}


（実装は簡易計算でOK。水矩形の AABB と直線の交点を t で求める）

8) Codex命令：受け入れテスト

手動確認手順：

1打目でバンカーに落としてみる → 転がりが重く、強くドラッグしないと出ない。

池に落とす → Strokes が +1、ボールは カップ後方線上 で 水の外 に落ちる。

グリーンに入ると見た目が変わり、ドラッグ最大パワーが下がる。

低速でカップに触れると吸着インしてホールアウト。

Reset で初期状態（ティー位置・打数0）に戻る。

9) Codex命令：最終出力形式

すべてのファイルを フル内容 で、次の順序で出力してください。差分ではなく上書きできるように。

src/game/types.ts

src/game/GolfScene.ts

src/ui/HUD.tsx

src/styles/app.css

src/App.tsx

src/main.tsx

src/index.css