# Dr.D — AI学習診断アプリ 設計書

中高生向けAI学習診断アプリ。"学習のお医者さん"をコンセプトに、診断→処方→経過観察の医療メタファーで学習体験を提供する。

---

## Tech Stack

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Next.js (App Router) |
| バックエンド / DB / Auth | Supabase (PostgreSQL + Auth + Edge Functions) |
| スタイリング | Tailwind CSS v4 |
| デプロイ | Render |
| AI | OpenAI API (GPT-4o) — 問題生成・難易度判定・処方箋作成 |

---

## デザイントークン

### カラーパレット

| 用途 | HEX |
|------|-----|
| 背景 (Background) | `#0d1117` |
| CTA / アクセント | `#f4a261` |
| 正解 (Correct) | `#2ec4b2` |
| 不正解 (Incorrect) | `#e76f51` |
| テキスト (Primary) | `#e6edf3` |
| テキスト (Secondary) | `#8b949e` |
| カード背景 | `#161b22` |
| ボーダー | `#30363d` |

### フォント

| 用途 | フォント | ウェイト |
|------|---------|---------|
| 見出し・UI | Quicksand | 500, 700 |
| 本文・日本語 | Zen Maru Gothic | 400, 500, 700 |

Google Fonts から読み込み。`font-display: swap` を指定。

---

## アプリフロー（全9ステップ）

```
受付 → 科目選択 → 範囲しぼり → 理解度チェック(5問)
→ 難易度提案 → 診断クイズ(10問) → 処方箋
→ 経過観察(3問) → カルテ
```

### 1. 受付（Reception）
- ニックネーム入力（ゲストモード or Supabase Auth ログイン）
- 「診察を始める」ボタンで開始
- ルート: `/`

### 2. 科目選択（Subject Select）
- 科目カードをタップで選択（数学・英語・理科・社会・国語）
- 各科目にアイコンと色を割り当て
- ルート: `/select-subject`

### 3. 範囲しぼり（Scope Narrowing）
- 選択した科目に応じた単元リストを表示
- 学年フィルター（中1〜高3）
- 複数選択可
- ルート: `/select-scope`

### 4. 理解度チェック（Pre-Check） — 5問
- 選択範囲から基礎〜標準の問題を5問出題
- AI が範囲・学年に基づき生成
- 回答形式: 3択 + 「わからない」（計4ボタン）
- ルート: `/pre-check`

### 5. 難易度提案（Difficulty Proposal）
- 理解度チェックの正答率から推定レベルを表示
- 「この難易度で診断する」or「自分で変更する」を選択
- レベル: 初級 / 中級 / 上級
- ルート: `/difficulty`

### 6. 診断クイズ（Diagnosis Quiz） — 10問
- 提案された難易度で10問出題
- AI がアダプティブに難易度微調整（連続正解で↑、連続不正解で↓）
- 回答形式: 3択 + 「わからない」（計4ボタン）
- ヒントボタン・解説ボタンあり（後述）
- ルート: `/quiz`

### 7. 処方箋（Prescription）
- AI が診断結果を分析し、弱点・改善ポイントをカード形式で表示
- 推奨学習プラン（優先度付き）
- ルート: `/prescription`

### 8. 経過観察（Follow-up） — 3問
- 処方箋で指摘された弱点から3問出題
- 改善度を測定
- ルート: `/follow-up`

### 9. カルテ（Medical Chart）
- 総合診断結果サマリー
- スコア・XP・レベル表示
- 科目別レーダーチャート
- 過去カルテ一覧（ログインユーザーのみ）
- SNS シェアボタン
- ルート: `/chart`

---

## クイズUI仕様

### 回答ボタン

4つのボタンを縦に並べる:
1. 選択肢A
2. 選択肢B
3. 選択肢C
4. 「わからない」（スタイルを他と差別化: ボーダーのみ、薄いテキスト）

### フィードバックアニメーション

| 結果 | 演出 | 時間 | 次の問題へ |
|------|------|------|-----------|
| 正解 | 緑グロー (`#2ec4b2`) + チェックアイコン | 1.0秒 | 自動送り |
| 不正解 | 赤フラッシュ (`#e76f51`) + 正解ハイライト | 1.8秒 | 自動送り |
| わからない | 不正解と同じ扱い | 1.8秒 | 自動送り |

- 正解グロー: `box-shadow: 0 0 20px #2ec4b2` + `scale(1.02)` トランジション
- 不正解フラッシュ: 背景が `#e76f51` で 0.3秒フェードイン → 正解選択肢を `#2ec4b2` ボーダーで表示

### ヒントボタン

- 問題画面の右下に「ヒント💡」ボタン
- タップで AI 生成のヒントをトースト表示
- ヒント使用時は XP 付与なし（その問題のみ）
- 1問につき1回まで

### 解説ボタン

- 不正解 / わからない選択後のフィードバック画面に「解説を見る」ボタン
- タップで AI 生成の詳細解説をモーダル表示
- 自動送りタイマーは解説モーダル表示中は一時停止

---

## XP（経験値）システム

| アクション | XP |
|-----------|-----|
| クイズ正答（ヒント未使用） | +15 |
| セッション完了ボーナス | +30 |
| 経過観察（最終確認）正答 | +20 |

- ヒント使用した問題の正答: +0
- 「わからない」選択: +0
- 不正解: +0

### レベル計算

```
レベル = floor(XP / 100) + 1
```

レベルアップ時にアニメーション演出。

---

## データベース設計 (Supabase PostgreSQL)

### users
| カラム | 型 | 説明 |
|-------|-----|------|
| id | uuid (PK) | Supabase Auth UID |
| nickname | text | ニックネーム |
| total_xp | integer | 累計XP |
| created_at | timestamptz | |

### sessions
| カラム | 型 | 説明 |
|-------|-----|------|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| subject | text | 科目 |
| scope | jsonb | 選択範囲 |
| difficulty | text | 初級/中級/上級 |
| pre_check_score | integer | 理解度チェック正答数 /5 |
| quiz_score | integer | 診断クイズ正答数 /10 |
| follow_up_score | integer | 経過観察正答数 /3 |
| xp_earned | integer | 獲得XP |
| prescription | jsonb | AI処方箋データ |
| created_at | timestamptz | |

### answers
| カラム | 型 | 説明 |
|-------|-----|------|
| id | uuid (PK) | |
| session_id | uuid (FK) | |
| phase | text | pre_check / quiz / follow_up |
| question_number | integer | |
| question_text | text | |
| choices | jsonb | 選択肢配列 |
| correct_answer | text | |
| user_answer | text | |
| is_correct | boolean | |
| hint_used | boolean | |
| time_taken_ms | integer | 回答時間 |
| created_at | timestamptz | |

---

## ディレクトリ構成

```
dr-d/
├── app/
│   ├── layout.tsx            # ルートレイアウト（フォント・テーマ）
│   ├── page.tsx              # 受付
│   ├── select-subject/
│   │   └── page.tsx
│   ├── select-scope/
│   │   └── page.tsx
│   ├── pre-check/
│   │   └── page.tsx
│   ├── difficulty/
│   │   └── page.tsx
│   ├── quiz/
│   │   └── page.tsx
│   ├── prescription/
│   │   └── page.tsx
│   ├── follow-up/
│   │   └── page.tsx
│   └── chart/
│       └── page.tsx
├── components/
│   ├── ui/                   # 汎用UIコンポーネント
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── ProgressBar.tsx
│   │   └── Toast.tsx
│   ├── quiz/
│   │   ├── QuizCard.tsx      # 問題カード
│   │   ├── ChoiceButton.tsx  # 選択肢ボタン（4択）
│   │   ├── FeedbackOverlay.tsx  # 正解/不正解演出
│   │   ├── HintButton.tsx
│   │   └── ExplanationModal.tsx
│   └── chart/
│       ├── RadarChart.tsx
│       └── ScoreSummary.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # ブラウザ用クライアント
│   │   ├── server.ts         # サーバー用クライアント
│   │   └── types.ts          # DB型定義
│   ├── ai/
│   │   ├── generate-questions.ts
│   │   ├── generate-hint.ts
│   │   ├── generate-explanation.ts
│   │   ├── generate-prescription.ts
│   │   └── assess-difficulty.ts
│   └── xp.ts                 # XP計算ロジック
├── hooks/
│   ├── useQuiz.ts            # クイズ状態管理
│   └── useSession.ts         # セッション管理
├── public/
│   └── icons/                # 科目アイコン等
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

---

## Render デプロイ設定

- **タイプ**: Web Service
- **ビルドコマンド**: `npm run build`
- **スタートコマンド**: `npm start`
- **環境変数**:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`

---

## 開発コマンド

```bash
npm run dev       # 開発サーバー起動
npm run build     # プロダクションビルド
npm run lint      # ESLint
```
