# Golf Tutorial 2D

React + Phaser 3 で実装した、シンプルな 2D ゴルフ学習用プロジェクトです。ドラッグしてショット、グリーン上では自動でパットモードに切り替わります。React 側で HUD を描画し、Phaser 側で物理・描画・入力を処理しています。

## 動作環境
- Node.js 18 以上を推奨（Vite 5 系）
- npm 9 以上を推奨

## セットアップ
```bash
cd golf-tutorial-2d
npm install
```

## 開発
```bash
npm run dev
```
- `http://localhost:5173` などで起動します（ポートは環境により異なります）。

## ビルド / プレビュー
```bash
npm run build   # dist/ に出力
npm run preview # ビルド成果物をローカルで確認
```

## 操作方法（ゲーム）
- 画面内のボール近くをドラッグ＆リリースでショット（ドラッグ方向と距離がそのまま速度になります）。
- カップ周辺（グリーン）では自動で「パットモード」に切り替わります。
- ウォーターに入ると 1 打罰で最後のセーフ地点へドロップします。
- 画面外に出ると OB（1 打罰）として最後のセーフ地点へ戻ります。
- 右上 HUD から「Reset Hole」「Next Hole」を操作できます。

## 主なスクリプト
- `npm run dev` 開発サーバ起動（Vite）
- `npm run build` TypeScript のビルド + 本番ビルド
- `npm run preview` 本番ビルドの簡易サーバ

## ディレクトリ構成
- `golf-tutorial-2d/index.html` エントリ HTML（日本語ロケール）
- `golf-tutorial-2d/src/main.tsx` React アプリのエントリ
- `golf-tutorial-2d/src/App.tsx` Phaser ゲームの起動と HUD 連携
- `golf-tutorial-2d/src/game/GolfScene.ts` ゲーム本体（Phaser Scene、ショット・判定等）
- `golf-tutorial-2d/src/game/types.ts` 型定義（Course/Hole/Event など）
- `golf-tutorial-2d/src/data/course.ts` コース定義（全 3 ホール）
- `golf-tutorial-2d/src/data/terms.ts` 用語とワンライナー
- `golf-tutorial-2d/src/ui/*.tsx` HUD コンポーネント（Checklist/表示類）
- `golf-tutorial-2d/src/styles/app.css` HUD のスタイル
- `golf-tutorial-2d/src/index.css` ルートのスタイル
- `golf-tutorial-2d/vite.config.ts` Vite 設定
- `golf-tutorial-2d/tsconfig*.json` TypeScript 設定

## 使用技術
- React 18
- Phaser 3.70
- Vite 5
- TypeScript 5

## ライセンス
- 本リポジトリに明示的なライセンスは未設定です。
