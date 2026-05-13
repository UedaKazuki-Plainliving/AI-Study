# テスト仕様書 — 社内Webシステム ログイン・ユーザー管理機能

**作成日**: 2026-05-13  
**対象システム**: 社内Webシステム (login-app)  
**テストフレームワーク**: Playwright (API・E2E) / Jest (単体)

---

## 1. テスト対象システム概要

| 項目 | 内容 |
|------|------|
| システム名 | 社内Webシステム（ログイン・ユーザー管理） |
| バックエンド | Node.js / Express |
| データベース | PostgreSQL |
| フロントエンド | HTML / Vanilla JS |
| 認証方式 | セッションCookie（express-session） |
| パスワード | bcrypt ハッシュ（ソルトラウンド:10） |

---

## 2. テストレベルとスコープ

| レベル | ツール | テスト数 | 対象 |
|--------|--------|----------|------|
| 単体テスト | Jest | 44 | src/utils.js（純粋関数） |
| APIテスト | Playwright (api) | 34 | REST API エンドポイント |
| E2Eテスト（ブラウザ） | Playwright (browser) | 26 | index.html / admin.html |

---

## 3. テスト環境

| 項目 | 内容 |
|------|------|
| サーバー | AWS EC2 (t3.micro) `http://43.207.67.234:3000` |
| ブラウザ | Chrome (Headless Shell) |
| 実行コマンド | `npm test` (全プロジェクト) |
| 単体テスト | `npm run test:unit` |
| APIテスト | `npm run test:api` |
| E2Eテスト | `npm run test:e2e` |

---

## 4. ペルソナ定義

### ペルソナA: 田中 花子（一般社員）
- **役割**: 社内Webシステムの一般利用者
- **スキル**: PC基本操作、業務システム利用経験あり
- **利用シーン**: 毎朝ログインして業務開始、長期休暇後のパスワード期限切れ
- **リスク**: パスワードを忘れがち、複数回ログイン失敗でロックアウト

### ペルソナB: 山田 太郎（IT部門管理者）
- **役割**: ユーザーアカウント管理者
- **スキル**: システム管理、セキュリティ知識
- **利用シーン**: 新入社員追加、退職者無効化、ロック解除対応
- **リスク**: 誤ったユーザー削除、ロック解除ミス

---

## 5. ユーザーストーリー

| ID | ペルソナ | ストーリー | 優先度 |
|----|----------|------------|--------|
| US-01 | 田中 | 正しい認証情報でログインしてホーム画面を表示したい | 高 |
| US-02 | 田中 | 誤ったパスワードを入力したとき残り試行回数を知りたい | 高 |
| US-03 | 田中 | パスワードが期限切れのとき変更画面へ案内されたい | 高 |
| US-04 | 田中 | ログアウトして入力欄をクリアした状態に戻したい | 中 |
| US-05 | 田中 | 入力ミスがあればフィールドレベルでエラーを知りたい | 中 |
| US-06 | 山田 | 新入社員のアカウントを安全に作成したい | 高 |
| US-07 | 山田 | ロックされた社員のアカウントをすぐに解除したい | 高 |
| US-08 | 山田 | 退職者のアカウントを無効化・削除したい | 高 |
| US-09 | 山田 | 管理画面からパスワードを強制リセットしたい | 中 |

---

## 6. E2Eテスト仕様（ブラウザ操作）

### 6.1 ログイン画面 (`index.html`)

| テストID | シナリオ | 前提条件 | 操作手順 | 期待結果 | 対応Gherkin |
|----------|----------|----------|----------|----------|-------------|
| SC-01 | 正常ログイン | e2enormal 有効 | ID/PW入力 → ログイン | ホーム画面表示、名前表示 | login.feature SC-01 |
| SC-02 | ユーザーID未入力 | — | 空のままログイン | `#err-userid` に「ユーザーIDを入力してください」 | SC-02 |
| SC-03 | パスワード未入力 | — | IDのみ入力してログイン | `#err-password` に「パスワードを入力してください」 | SC-03 |
| SC-04 | ID形式不正（記号） | — | `user_invalid` 入力→フォーカスアウト | `#err-userid` に「半角英数字」 | SC-04 |
| SC-05 | パスワード7文字 | — | 7文字PW入力→フォーカスアウト | `#err-password` に「8〜32文字」 | SC-05 |
| [BV] | パスワード8文字（最小値） | — | 8文字PW入力→フォーカスアウト | エラーなし | — |
| SC-06 | PW不一致（1回目） | e2enormal 有効 | 誤PW入力→ログイン | 「あと4回失敗するとロックされます」 | SC-06 |
| [BV] | 認証エラー後に入力開始 | 認証エラー表示中 | フィールドに文字入力 | エラー非表示 | — |
| SC-07 | 5回連続失敗→ロック | e2elock 有効 | 誤PW5回入力 | ロックメッセージ（`.auth-locked`） | SC-07 |
| SC-08 | ロック中のログイン | e2elock ロック中 | 正しいPW入力 | ロックエラー表示 | SC-08 |
| SC-09 | PW期限切れ→変更画面 | e2eexpired 期限切れ | 認証情報入力→ログイン | `#screen-pw-change` 表示 | SC-09 |
| SC-10 | PW変更成功 | PW変更画面表示中 | 新PW/確認PW入力→変更 | 「パスワードを変更しました」→ログイン画面遷移 | SC-10 |
| SC-11 | ログアウト | ログイン済み | ログアウトボタン押下 | ログイン画面、入力欄クリア | SC-11 |
| SC-12 | 確認PW不一致 | PW変更画面 | 異なるPW入力→変更 | `#err-confirm-password` に「パスワードが一致しません」 | SC-12 |
| [BV] | PW変更後ボタン無効 | PW変更成功直後 | — | `#btn-change` disabled 維持 | — |

### 6.2 管理画面 (`admin.html`)

| テストID | シナリオ | 前提条件 | 操作手順 | 期待結果 | 対応Gherkin |
|----------|----------|----------|----------|----------|-------------|
| SC-A01 | ユーザー追加成功 | e2enew001 未存在 | ID/PW入力→追加 | 成功メッセージ・一覧に表示 | admin.feature SC-A01 |
| SC-A02 | ID重複エラー | e2enew001 存在済み | 同ID/PW入力→追加 | エラーアラート表示 | SC-A02 |
| SC-A03 | ID未入力 | — | 空のまま追加 | `#err-add-userid` エラー | SC-A03 |
| SC-A04 | PW7文字 | — | validuser/Short1!（7文字）入力→追加 | `#err-add-password` エラー | SC-A04 |
| SC-A05 | 手動ロック | e2elocktest 有効 | ロックするボタン→確認 | `.badge-locked` 表示・成功メッセージ | SC-A05 |
| SC-A06 | ロック解除 | e2elocktest ロック中 | ロック解除ボタン | `.badge-active` 表示・成功メッセージ | SC-A06 |
| SC-A07 | PW変更要求 | e2elocktest 有効 | PW変更要求→確認 | 「にパスワード変更を要求しました」 | SC-A07 |
| SC-A08 | PWリセット（管理者） | e2elocktest 有効 | PW変更→モーダル→新PW入力→変更 | モーダルが閉じる | SC-A08 |
| SC-A09 | ユーザー無効化 | e2elocktest 有効 | 無効化→確認 | `.badge-inactive` 表示 | SC-A09 |
| SC-A10 | ユーザー有効化 | e2elocktest 無効 | 有効化→確認 | `.badge-active` 表示 | SC-A10 |
| SC-A11 | ユーザー削除 | e2edelete 存在 | 削除→確認 | 成功メッセージ・一覧から消える | SC-A11 |

---

## 7. APIテスト仕様

### 7.1 認証API (`/api/auth/*`)

| テストID | エンドポイント | シナリオ | 入力 | 期待レスポンス |
|----------|--------------|----------|------|---------------|
| TC-L01 | POST /api/auth/login | 正常ログイン | 有効ID/PW | 200 `{ userId, forcePasswordChange }` |
| TC-L02 | POST /api/auth/login | 存在しないユーザー | 未登録ID | 401 `AUTH_FAILED` |
| TC-L03 | POST /api/auth/login | PW不一致（1回目） | 正ID/誤PW | 401 `{ remainingAttempts: 4 }` |
| TC-L04〜L08 | POST /api/auth/login | 連続失敗（1〜5回） | 正ID/誤PW×5 | 残り4/3/2/1回 → 403 `ACCOUNT_LOCKED` |
| TC-L09 | POST /api/auth/login | PW期限切れ | 期限切れユーザー | 422 `PASSWORD_EXPIRED` |
| TC-LO01 | POST /api/auth/logout | ログアウト | ログイン済みセッション | 200 |
| TC-LO02 | POST /api/auth/logout | ログアウト後セッション無効 | ログアウト後リクエスト | 401 |
| TC-CP01 | POST /api/auth/change-password | 正常変更 | 期限切れセッション＋新PW | 200 |
| TC-CP02 | POST /api/auth/change-password | 未認証 | セッションなし | 401 |
| TC-CP03 | POST /api/auth/change-password | 変更不要セッション | 通常ログイン後 | 401 |
| TC-CP04 | POST /api/auth/change-password | 新PW未入力 | 期限切れセッション＋空PW | 400 |
| TC-ST01 | GET /api/auth/status | ログイン済み | ログイン済みセッション | 200 `{ userId }` |
| TC-ST02 | GET /api/auth/status | 未認証 | なし | 401 |

### 7.2 ユーザー管理API (`/api/users/*`)

| テストID | エンドポイント | シナリオ | 期待レスポンス |
|----------|--------------|----------|---------------|
| TC-U01 | GET /api/users | 一覧取得 | 200 配列 |
| TC-U02 | GET /api/users | 必須フィールド確認 | `user_id, is_active, failed_login_count` など |
| TC-U03 | POST /api/users | 作成成功 | 201 |
| TC-U04 | POST /api/users | ID重複 | 400 `DUPLICATE_USER` |
| TC-U05 | POST /api/users | ID不正（記号） | 400 `VALIDATION_ERROR` |
| TC-U06 | POST /api/users | PW短すぎ（7文字） | 400 `VALIDATION_ERROR` |
| TC-U07 | PUT /api/users/:id | PW更新 | 200 |
| TC-U08 | PUT /api/users/:id | 手動ロック | 200 `locked_until` 設定 |
| TC-U09 | PUT /api/users/:id | ロック解除 | 200 `locked_until` null |
| TC-U10 | PUT /api/users/:id | PW変更要求 | 200 |
| TC-U11 | PUT /api/users/:id | 無効化 | 200 `is_active: false` |
| TC-U12 | PUT /api/users/:id | 有効化 | 200 `is_active: true` |
| TC-U13 | PUT /api/users/:id | 更新項目なし | 400 `NO_UPDATE` |
| TC-U14 | PUT /api/users/:id | 存在しないユーザー | 404 `NOT_FOUND` |
| TC-U15 | DELETE /api/users/:id | 削除成功 | 200 |
| TC-U16 | DELETE /api/users/:id | 存在しないユーザー | 404 `NOT_FOUND` |

---

## 8. 単体テスト仕様（境界値分析）

### 8.1 `isPasswordExpired(passwordChangedAt)` — PW期限切れ判定

パスワード有効期限: **90日**

| テストID | 入力（N日前） | 期待値 | 分類 |
|----------|-------------|--------|------|
| BV-01 | 0日前（今日） | false | 有効内 |
| BV-02 | 1日前 | false | 有効内 |
| BV-03 | 89日前（期限-1日） | false | 境界値直前 |
| BV-04 | 90日前（期限ちょうど） | **true** | 境界値（有効→無効） |
| BV-05 | 91日前（期限+1日） | true | 境界値超過 |
| BV-06 | 180日前 | true | 大幅超過 |
| BV-07 | Date オブジェクト渡し | 正常動作 | 型テスト |

### 8.2 `isLocked(lockedUntil)` — ロック状態判定

| テストID | 入力 | 期待値 | 分類 |
|----------|------|--------|------|
| BV-10 | null | false | 未ロック |
| BV-11 | undefined | false | 未ロック |
| BV-12 | '' | false | 未ロック |
| BV-13 | 1分前（過去） | false | ロック期限切れ |
| BV-14 | 30分前 | false | 自動解除済み |
| BV-15 | 1分後（未来） | **true** | ロック中 |
| BV-16 | 30分後（LOCK_MINUTES） | true | ロック中（境界） |
| BV-17 | 9999年 | true | 永続ロック |

### 8.3 `RE_USERID` — ユーザーID正規表現 `/^[a-zA-Z0-9]{1,20}$/`

| テストID | 入力 | 期待値 | 分類 |
|----------|------|--------|------|
| BV-20 | 1文字（最小値） | valid | 最小境界 |
| BV-21 | 20文字（最大値） | valid | 最大境界 |
| BV-22 | 英大文字 | valid | 文字種 |
| BV-23 | 英小文字 | valid | 文字種 |
| BV-24 | 数字のみ | valid | 文字種 |
| BV-25 | 空文字 | invalid | 空 |
| BV-26 | 21文字（最大値+1） | **invalid** | 最大境界超過 |
| BV-27 | アンダースコア含む | invalid | 禁止文字 |
| BV-28 | ハイフン含む | invalid | 禁止文字 |
| BV-29 | @ 含む | invalid | 禁止文字 |
| BV-30 | 全角英字含む | invalid | 禁止文字 |
| BV-31 | スペース含む | invalid | 禁止文字 |
| BV-32 | 日本語含む | invalid | 禁止文字 |

### 8.4 `RE_PASSWORD` — パスワード正規表現（8〜32文字）

| テストID | 入力 | 期待値 | 分類 |
|----------|------|--------|------|
| BV-40 | 8文字・英数字（最小値） | valid | 最小境界 |
| BV-41 | 8文字・記号含む | valid | 文字種 |
| BV-42 | 32文字（最大値） | valid | 最大境界 |
| BV-43 | 使用可能記号すべて含む | valid | 文字種 |
| BV-44 | 数字のみ8文字 | valid | 文字種 |
| BV-45 | 空文字 | invalid | 空 |
| BV-46 | 7文字（最小値-1） | **invalid** | 最小境界未達 |
| BV-47 | 33文字（最大値+1） | **invalid** | 最大境界超過 |
| BV-48 | スペース含む | invalid | 禁止文字 |
| BV-49 | 日本語含む | invalid | 禁止文字 |
| BV-50 | 全角記号含む | invalid | 禁止文字 |
| BV-51 | タブ文字含む | invalid | 禁止文字 |

### 8.5 ビジネスルール定数

| 定数 | 値 | 意味 |
|------|-----|------|
| `MAX_FAIL` | 5 | ロックまでの最大失敗回数 |
| `LOCK_MINUTES` | 30 | ロック継続時間（分） |
| `PW_EXPIRY_DAYS` | 90 | パスワード有効日数 |

---

## 9. テスト実行方法

```bash
# 単体テスト
npm run test:unit

# APIテスト（Playwright）
npm run test:api

# E2Eテスト（ブラウザ）
npm run test:e2e

# 全テスト
npm test

# HTMLレポート表示
npm run test:report
```

---

## 10. テストカバレッジサマリー

| テストレベル | テスト数 | ステータス |
|------------|----------|-----------|
| 単体テスト（Jest） | 44 | ✅ 全件PASS |
| APIテスト（Playwright） | 34 | ✅ 全件PASS |
| E2Eテスト ログイン画面 | 15 | ✅ 全件PASS |
| E2Eテスト 管理画面 | 11 | ✅ 全件PASS |
| **合計** | **104** | **✅ 104/104 PASS** |

### 主要カバー領域

- ✅ 正常ログイン / ログアウト
- ✅ フロントエンドバリデーション（3ステップ: 必須 / 文字種 / 長さ）
- ✅ 認証失敗 + 残り試行回数
- ✅ 連続5回失敗によるアカウントロック
- ✅ パスワード期限切れ → 変更画面遷移
- ✅ パスワード変更成功 / 確認不一致
- ✅ ユーザー追加 / 重複エラー
- ✅ 手動ロック / ロック解除
- ✅ 有効化 / 無効化 / 削除
- ✅ 境界値: PW 7/8/32/33文字、ID 1/20/21文字、90日/91日、30分前後
