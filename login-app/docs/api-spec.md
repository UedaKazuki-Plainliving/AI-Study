# API仕様書 — 社内Webシステム ログイン機能

> バージョン: 1.0
> 作成日: 2026-05-13
> 対象: ログイン・認証関連API

---

## 共通仕様

### ベースURL
```
https://api.example.com/v1
```

### リクエストヘッダー

| ヘッダー | 値 | 必須 |
|---------|-----|------|
| Content-Type | application/json | ○ |
| Accept | application/json | ○ |
| X-Request-ID | UUID（リクエスト識別子） | 推奨 |

### レスポンス形式

```json
{
  "status": "success" | "error",
  "data": { ... },
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "fields": { "フィールド名": "エラー内容" }
  }
}
```

### HTTPステータスコード

| コード | 意味 |
|--------|------|
| 200 | 成功 |
| 400 | バリデーションエラー・リクエスト不正 |
| 401 | 認証失敗 |
| 403 | アカウントロック |
| 422 | パスワード期限切れ |
| 500 | サーバーエラー |

---

## エンドポイント一覧

---

### POST /auth/login

ログイン認証を行う。

#### リクエスト

```json
{
  "userId": "ユーザーID",
  "password": "パスワード"
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|--------------|
| userId | string | ○ | 半角英数字、1〜20文字 |
| password | string | ○ | 半角英数記号、8〜32文字 |

#### レスポンス（成功 200）

```json
{
  "status": "success",
  "data": {
    "userId": "{ユーザーID}",
    "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2026-05-13T18:00:00+09:00"
  }
}
```

#### レスポンス（バリデーションエラー 400）

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力値に誤りがあります",
    "fields": {
      "userId": "ユーザーIDは半角英数字で入力してください",
      "password": "パスワードは8〜32文字で入力してください"
    }
  }
}
```

#### レスポンス（認証失敗 401）

```json
{
  "status": "error",
  "error": {
    "code": "AUTH_FAILED",
    "message": "ユーザーIDまたはパスワードが正しくありません",
    "remainingAttempts": 3
  }
}
```

#### レスポンス（アカウントロック 403）

```json
{
  "status": "error",
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "アカウントがロックされています",
    "lockedUntil": "2026-05-13T10:30:00+09:00"
  }
}
```

#### レスポンス（パスワード期限切れ 422）

```json
{
  "status": "error",
  "error": {
    "code": "PASSWORD_EXPIRED",
    "message": "パスワードの有効期限が切れています",
    "passwordChangeToken": "abc123xyz..."
  }
}
```

> `passwordChangeToken` はパスワード変更APIで使用する一時トークン（有効期限15分）。

---

### POST /auth/logout

ログアウトしてセッションを無効化する。

#### リクエストヘッダー

| ヘッダー | 値 |
|---------|-----|
| Authorization | Bearer {sessionToken} |

#### リクエストボディ

なし

#### レスポンス（成功 200）

```json
{
  "status": "success",
  "data": {
    "message": "ログアウトしました"
  }
}
```

---

### POST /auth/change-password

パスワードを変更する。期限切れ時の強制変更にも使用する。

#### リクエスト

```json
{
  "passwordChangeToken": "abc123xyz...",
  "newPassword": "NewP@ssword1",
  "confirmPassword": "NewP@ssword1"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| passwordChangeToken | string | ○ | `/auth/login` の422レスポンスで取得したトークン |
| newPassword | string | ○ | 半角英数記号、8〜32文字 |
| confirmPassword | string | ○ | newPassword と同一であること |

#### レスポンス（成功 200）

```json
{
  "status": "success",
  "data": {
    "message": "パスワードを変更しました",
    "passwordChangedAt": "2026-05-13T10:05:00+09:00"
  }
}
```

#### レスポンス（バリデーションエラー 400）

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力値に誤りがあります",
    "fields": {
      "newPassword": "パスワードは8〜32文字で入力してください",
      "confirmPassword": "パスワードが一致しません"
    }
  }
}
```

---

### GET /auth/status

現在のセッション状態を確認する。

#### リクエストヘッダー

| ヘッダー | 値 |
|---------|-----|
| Authorization | Bearer {sessionToken} |

#### レスポンス（有効 200）

```json
{
  "status": "success",
  "data": {
    "userId": "{ユーザーID}",
    "sessionValid": true,
    "expiresAt": "2026-05-13T18:00:00+09:00",
    "passwordExpiresAt": "2026-08-11T00:00:00+09:00"
  }
}
```

#### レスポンス（無効 401）

```json
{
  "status": "error",
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "セッションが無効です。再ログインしてください"
  }
}
```

---

## エラーコード一覧

| コード | HTTPステータス | 説明 |
|--------|--------------|------|
| `VALIDATION_ERROR` | 400 | 入力バリデーションエラー |
| `AUTH_FAILED` | 401 | 認証失敗（ID/PW不一致） |
| `SESSION_EXPIRED` | 401 | セッション期限切れ |
| `ACCOUNT_LOCKED` | 403 | 連続失敗によるロック |
| `PASSWORD_EXPIRED` | 422 | パスワード有効期限切れ |
| `INVALID_TOKEN` | 400 | パスワード変更トークン不正・期限切れ |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー |

---

## 認証フロー図

```
クライアント                    サーバー
    |                               |
    |-- POST /auth/login ---------->|
    |                               |-- バリデーションチェック
    |                               |-- ロックチェック
    |                               |-- 認証チェック
    |                               |-- パスワード期限チェック
    |                               |
    |<-- 200 sessionToken ----------| ← 成功
    |<-- 400 VALIDATION_ERROR ------| ← 入力不正
    |<-- 401 AUTH_FAILED -----------| ← ID/PW不一致
    |<-- 403 ACCOUNT_LOCKED --------| ← ロック中
    |<-- 422 PASSWORD_EXPIRED ------| ← 期限切れ
    |                               |
    | （期限切れの場合）             |
    |-- POST /auth/change-password ->|
    |<-- 200 OK --------------------|
    |                               |
    |-- POST /auth/login ---------->| ← 再ログイン
    |<-- 200 sessionToken ----------|
```

---

## 注意事項

- セッショントークンはHTTPOnly Cookieまたはメモリ上で管理し、localStorageへの保存は避けること
- パスワードは通信時にTLS（HTTPS）で暗号化すること
- ブルートフォース攻撃対策として、認証失敗回数のカウントはサーバー側（DB）で管理すること
