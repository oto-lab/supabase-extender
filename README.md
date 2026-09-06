# Supabase Extender

[![技術者倫理|遵守済み](https://gijutsusharin.li/badge.svg)](https://gijutsusharin.li)

Supabaseの無料プランは、一定期間APIアクセスがないとプロジェクトが一時停止され、
さらに放置するとデータが削除されてしまう。

このツールは Google Apps Script (GAS) を使い、指定したSupabaseプロジェクトの
REST APIに**毎週1回**軽量なリクエストを送ることでプロジェクトをアクティブな状態に
保ち続ける。

## 構成

- `src/Code.js` — 本体スクリプト（Supabaseへのping、週次トリガー、失敗時メール通知）
- `src/appsscript.json` — Apps Scriptのマニフェスト
- [clasp](https://github.com/google/clasp) を使ってこのリポジトリのコードをGASプロジェクトにpushする

## セットアップ手順

### 1. clasp のインストール & ログイン

```bash
npm install
npm run login
```

ブラウザが開くのでGoogleアカウントでログインする。

初回のみ、[Apps Script の設定](https://script.google.com/home/usersettings) で
「Google Apps Script API」をONにしておくこと。

### 2. GASプロジェクトの作成

```bash
npm run create
```

これでこのリポジトリと紐づいた新しいスタンドアロンのGASプロジェクトが作成され、
`.clasp.json` が生成される（このファイルは各自の環境固有のためgit管理対象外）。

既存のGASプロジェクトに紐づけたい場合は代わりに以下を実行する。

```bash
npx clasp clone-script <スクリプトID> --rootDir ./src
```

> clasp v3では一部コマンドが `create` → `create-script`、`clone` → `clone-script`、
> `open` → `open-script` にリネームされている（`push` / `logs` / `login` は変更なし）。

### 3. コードをpush

```bash
npm run push
```

### 4. Supabaseの接続情報を設定

```bash
npm run open
```

でスクリプトエディタが開くので、左メニューの「プロジェクトの設定」(歯車アイコン) →
「スクリプト プロパティ」から以下を追加する（**コードに直接書き込まず、必ずここで設定する**）。

| プロパティ名 | 必須 | 説明 |
| --- | --- | --- |
| `SUPABASE_URL` | ✅ | 例: `https://xxxxxxxxxxxx.supabase.co` |
| `SUPABASE_KEY` | ✅ | Supabaseの `anon` キー（Settings > API から取得） |
| `SUPABASE_TABLE` | 任意 | 存在確認するテーブル名。空欄の場合はREST APIのルートに軽量アクセスするだけになる |
| `NOTIFY_EMAIL` | 任意 | 実行失敗時の通知先メールアドレス。空欄なら実行アカウント自身のメールアドレスに送信される |

### 5. 動作確認

スクリプトエディタの関数選択で `pingSupabase` を選び、実行する。
初回実行時は外部アクセス・メール送信の権限承認ダイアログが出るので許可する。
実行ログ（表示 > 実行数）でステータスコードが200番台になっていることを確認する。

### 6. 週次トリガーの作成

同様に関数選択で `createWeeklyTrigger` を選び、一度だけ実行する。
これで毎週月曜6時台に `keepAlive` が自動実行されるようになる。

トリガーは「トリガー」タブ（時計アイコン）からも確認・削除できる。

## 動作の仕組み

- `SUPABASE_TABLE` を設定した場合: `GET {SUPABASE_URL}/rest/v1/{table}?select=*&limit=1`
- 未設定の場合: `GET {SUPABASE_URL}/rest/v1/`（OpenAPI定義を返すだけの軽量なエンドポイント）

いずれもSupabaseのAPI Gateway（PostgREST）へのリクエストとしてカウントされ、
プロジェクトの活動として認識される。実際のテーブルへのアクセスを確実にしたい場合は
`SUPABASE_TABLE` の設定を推奨する。

失敗時（ネットワークエラー、APIキー無効、ステータスコードが200番台以外など）は
`NOTIFY_EMAIL` 宛にエラー内容をメール通知する。

## 注意事項

- `SUPABASE_KEY` は `anon` キーで十分（読み取りのみのため）。`service_role` キーは
  漏洩時のリスクが大きいので使わないこと。
- RLS (Row Level Security) が有効なテーブルを指定する場合、`anon` キーで
  `select` が許可されているか確認すること。許可されていないとステータス401/403で
  失敗し、その都度メール通知が届く。
- このツールはあくまで無料プランの自動停止/削除を回避するための延命策であり、
  Supabase側の仕様変更によって効果がなくなる可能性がある。
