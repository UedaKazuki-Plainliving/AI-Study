# Claude Code 勉強会 — PostgreSQL 編

HTMLだけのアプリにデータベースを追加するステップです。
HTML単体編の内容に追加して準備してください。

---

## 構成の変化

### HTML単体のとき
```
ブラウザ → index.html
```

### DB追加後
```
ブラウザ → index.html
              ↓ fetch (HTTP)
           server.js (Node.js + Express)
              ↓ SQL
           PostgreSQL
```

サーバー（Node.js）が間に入る構成になります。

---

## 追加で必要なもの

### 1. PostgreSQL

**インストール**
- https://www.postgresql.org/download/
- Windows版インストーラーをダウンロードして実行
- インストール中に設定するもの：
  - パスワード（例: `password`）← 忘れずメモ
  - ポート: `5432`（デフォルトのまま）

**起動確認**
```bash
psql -U postgres
# パスワードを入力してプロンプトが出ればOK
```

### 2. Node.js パッケージ（自動でインストールされます）

Claude Code に頼むと自動でセットアップしてくれますが、
内部的には以下を使います：

| パッケージ | 役割 |
|-----------|------|
| `express` | Webサーバー |
| `pg` | PostgreSQL接続 |
| `cors` | ブラウザからのアクセスを許可 |

---

## 当日の進め方（DB編）

### ステップ1　PostgreSQL を起動しておく

Windowsの場合、インストール後は自動起動になっていることが多い。
確認方法：タスクマネージャー → サービス → `postgresql` が「実行中」

### ステップ2　Claude Code に作ってもらう

作業フォルダで `claude` を起動して話しかける：

```
PostgreSQL を使ったタスク管理アプリを作って。
・index.html でタスクの一覧表示・追加・削除ができる
・server.js (Express) がAPIを提供する
・DBはPostgreSQLで、テーブル作成SQLも書いて
・DBの接続情報: host=localhost, user=postgres, password=password, db=studyapp
```

### ステップ3　DBとテーブルを作る

Claude Codeが作ってくれたSQLを実行：

```bash
psql -U postgres
```

```sql
CREATE DATABASE studyapp;
\c studyapp
-- Claude が作ったSQLをここに貼り付けて実行
```

### ステップ4　サーバーを起動する

```bash
node server.js
```

### ステップ5　ブラウザで確認

`index.html` をブラウザで開く（またはhttp://localhost:3000 など）

---

## 題材アイデア（DB版）

| アイデア | 難易度 | 内容 |
|---------|--------|------|
| タスク管理 | ★★☆ | タスクの追加・完了・削除。データが残る |
| 出席管理 | ★★☆ | 名前リストから出席を記録 |
| アンケート | ★★★ | 選択肢への投票と集計グラフ |
| メモ帳 | ★★☆ | タイトル+本文を保存・一覧表示 |
| 日記アプリ | ★★★ | 日付ごとに記録、過去の日記を参照 |

---

## HTML単体版との比較

| 項目 | HTML単体 | DB追加 |
|------|---------|--------|
| データの保存 | ブラウザを閉じると消える | サーバー再起動後も残る |
| 複数端末での共有 | できない | できる（同じLAN内） |
| 準備の手間 | 少ない | やや多い |
| 難易度 | 低い | 中程度 |
| 向いている用途 | ゲーム・ツール | 管理アプリ・記録系 |

---

## 当日の持ち物チェックリスト（追加分）

- [ ] PostgreSQL インストール済み・起動している
- [ ] `psql -U postgres` でログインできる
- [ ] 接続パスワードをメモしてある

---

## トラブルシューティング

**psql が見つからない**
→ PostgreSQL の `bin` フォルダにパスを通す
（例: `C:\Program Files\PostgreSQL\16\bin`）
→ Windowsの「環境変数」→ `Path` に追加

**ポート5432が使われている**
→ すでにPostgreSQLが起動している可能性大。再起動は不要。

**ブラウザからサーバーに繋がらない**
→ `node server.js` が起動しているか確認
→ `cors` の設定をClaude Codeに確認してもらう

---

*ポイント: 難しい部分はすべてClaude Codeに頼めばOKです。*
*「エラーが出た」とそのままコピペして伝えるだけで直してくれます。*
