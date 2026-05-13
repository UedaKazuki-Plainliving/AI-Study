# DB仕様書 — 社内Webシステム ログイン機能

> バージョン: 1.0
> 作成日: 2026-05-13
> DBMS: PostgreSQL 16

---

## 概要

ログイン認証機能で使用するデータベース設計。
ユーザー情報・セッション・ログイン履歴を管理する。

---

## テーブル一覧

| テーブル名 | 説明 |
|-----------|------|
| users | ユーザーアカウント情報 |
| sessions | ログインセッション |
| login_histories | ログイン試行履歴 |

---

## テーブル定義

---

### users（ユーザー）

ユーザーアカウントの基本情報・認証情報を管理する。

```sql
CREATE TABLE users (
    user_id             VARCHAR(20)     NOT NULL,
    password_hash       VARCHAR(255)    NOT NULL,
    password_changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    failed_login_count  SMALLINT        NOT NULL DEFAULT 0,
    locked_until        TIMESTAMP WITH TIME ZONE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_users PRIMARY KEY (user_id),
    CONSTRAINT chk_failed_count CHECK (failed_login_count >= 0)
);

COMMENT ON TABLE  users                    IS 'ユーザーアカウント';
COMMENT ON COLUMN users.user_id            IS 'ユーザーID（半角英数字 1〜20文字）';
COMMENT ON COLUMN users.password_hash      IS 'パスワードハッシュ（bcrypt）';
COMMENT ON COLUMN users.password_changed_at IS 'パスワード最終変更日時';
COMMENT ON COLUMN users.failed_login_count IS '連続ログイン失敗回数';
COMMENT ON COLUMN users.locked_until       IS 'ロック解除日時（NULLの場合はロックなし）';
COMMENT ON COLUMN users.is_active          IS 'アカウント有効フラグ';
```

#### カラム詳細

| カラム名 | 型 | NOT NULL | デフォルト | 説明 |
|---------|-----|---------|----------|------|
| user_id | VARCHAR(20) | ○ | — | PK。半角英数字 1〜20文字 |
| password_hash | VARCHAR(255) | ○ | — | bcryptハッシュ（コスト係数12推奨） |
| password_changed_at | TIMESTAMPTZ | ○ | NOW() | パスワード最終変更日時 |
| failed_login_count | SMALLINT | ○ | 0 | 連続失敗回数（0〜5） |
| locked_until | TIMESTAMPTZ | — | NULL | ロック解除日時。NULL=未ロック |
| is_active | BOOLEAN | ○ | TRUE | FALSE=退職等による無効化 |
| created_at | TIMESTAMPTZ | ○ | NOW() | レコード作成日時 |
| updated_at | TIMESTAMPTZ | ○ | NOW() | レコード更新日時 |

#### インデックス

```sql
-- PKのみ（user_idは検索キーとして使用）
```

#### 初期データ（テスト用）

```sql
INSERT INTO users (user_id, password_hash, password_changed_at)
VALUES (
    'user001',
    '$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',  -- P@ssword のハッシュ
    NOW()
);
```

#### ビジネスルール

| ルール | 内容 |
|--------|------|
| ロック判定 | `locked_until IS NOT NULL AND locked_until > NOW()` |
| 自動ロック解除 | `locked_until <= NOW()` のとき、ロック解除とみなし `failed_login_count=0` にリセット |
| パスワード期限切れ | `NOW() - password_changed_at > interval '90 days'` |
| 連続失敗ロック | `failed_login_count >= 5` で `locked_until = NOW() + interval '30 minutes'` |

---

### sessions（セッション）

ログイン中のセッション情報を管理する。

```sql
CREATE TABLE sessions (
    session_id  VARCHAR(128)    NOT NULL,
    user_id     VARCHAR(20)     NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked  BOOLEAN         NOT NULL DEFAULT FALSE,

    CONSTRAINT pk_sessions PRIMARY KEY (session_id),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id  ON sessions(user_id);
CREATE INDEX idx_sessions_expires  ON sessions(expires_at);

COMMENT ON TABLE  sessions            IS 'ログインセッション';
COMMENT ON COLUMN sessions.session_id IS 'セッショントークン（JWT or UUID）';
COMMENT ON COLUMN sessions.user_id    IS 'ユーザーID';
COMMENT ON COLUMN sessions.expires_at IS 'セッション有効期限';
COMMENT ON COLUMN sessions.is_revoked IS 'ログアウト済みフラグ';
```

#### カラム詳細

| カラム名 | 型 | NOT NULL | デフォルト | 説明 |
|---------|-----|---------|----------|------|
| session_id | VARCHAR(128) | ○ | — | PK。JWTまたはUUID |
| user_id | VARCHAR(20) | ○ | — | FK → users.user_id |
| created_at | TIMESTAMPTZ | ○ | NOW() | セッション作成日時 |
| expires_at | TIMESTAMPTZ | ○ | — | セッション有効期限（通常8時間） |
| is_revoked | BOOLEAN | ○ | FALSE | TRUE=ログアウト済み |

---

### login_histories（ログイン試行履歴）

ログイン試行の成否を記録する。セキュリティ監査用。

```sql
CREATE TABLE login_histories (
    id          BIGSERIAL       NOT NULL,
    user_id     VARCHAR(20),
    result      VARCHAR(20)     NOT NULL,
    ip_address  INET,
    user_agent  TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_login_histories PRIMARY KEY (id),
    CONSTRAINT chk_result CHECK (result IN ('SUCCESS', 'FAILED', 'LOCKED', 'EXPIRED'))
);

CREATE INDEX idx_login_hist_user_id ON login_histories(user_id);
CREATE INDEX idx_login_hist_attempted ON login_histories(attempted_at DESC);

COMMENT ON TABLE  login_histories             IS 'ログイン試行履歴';
COMMENT ON COLUMN login_histories.user_id     IS 'ユーザーID（存在しないIDの試行はNULL）';
COMMENT ON COLUMN login_histories.result      IS '結果: SUCCESS/FAILED/LOCKED/EXPIRED';
COMMENT ON COLUMN login_histories.ip_address  IS 'クライアントIPアドレス';
COMMENT ON COLUMN login_histories.attempted_at IS '試行日時';
```

#### result 値の定義

| 値 | 意味 |
|----|------|
| `SUCCESS` | 認証成功 |
| `FAILED` | 認証失敗（ID/PW不一致） |
| `LOCKED` | ロック中のため拒否 |
| `EXPIRED` | パスワード期限切れ（認証自体は成功） |

---

## ER図

```
┌──────────────┐        ┌──────────────────┐
│    users     │1      *│     sessions     │
│──────────────│────────│──────────────────│
│ user_id (PK) │        │ session_id (PK)  │
│ password_hash│        │ user_id (FK)     │
│ pw_changed_at│        │ created_at       │
│ fail_count   │        │ expires_at       │
│ locked_until │        │ is_revoked       │
│ is_active    │        └──────────────────┘
│ created_at   │
│ updated_at   │        ┌──────────────────┐
│              │1      *│  login_histories │
│              │────────│──────────────────│
└──────────────┘        │ id (PK)          │
                        │ user_id          │
                        │ result           │
                        │ ip_address       │
                        │ attempted_at     │
                        └──────────────────┘
```

---

## 主要クエリ

### ログイン認証

```sql
-- 1. ユーザー取得（認証前チェック）
SELECT
    user_id,
    password_hash,
    password_changed_at,
    failed_login_count,
    locked_until,
    is_active,
    (NOW() - password_changed_at > interval '90 days') AS password_expired,
    (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked
FROM users
WHERE user_id = $1;
```

### 失敗回数更新・ロック設定

```sql
-- 認証失敗時：失敗回数インクリメント
UPDATE users
SET
    failed_login_count = failed_login_count + 1,
    locked_until = CASE
        WHEN failed_login_count + 1 >= 5
        THEN NOW() + interval '30 minutes'
        ELSE locked_until
    END,
    updated_at = NOW()
WHERE user_id = $1;
```

### ログイン成功時リセット

```sql
-- 認証成功時：失敗回数リセット
UPDATE users
SET
    failed_login_count = 0,
    locked_until = NULL,
    updated_at = NOW()
WHERE user_id = $1;
```

### パスワード変更

```sql
UPDATE users
SET
    password_hash       = $2,
    password_changed_at = NOW(),
    failed_login_count  = 0,
    locked_until        = NULL,
    updated_at          = NOW()
WHERE user_id = $1;
```

### 期限切れセッションの削除（定期バッチ）

```sql
DELETE FROM sessions
WHERE expires_at < NOW() OR is_revoked = TRUE;
```

---

## 注意事項

- パスワードは必ずbcrypt（コスト係数12以上）でハッシュ化して保存すること
- 平文パスワードはいかなる場合もDBに保存しないこと
- `login_histories` は監査ログとして保持期間を定め、定期的にアーカイブすること
