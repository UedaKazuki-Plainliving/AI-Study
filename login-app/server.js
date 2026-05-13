const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;
const MAX_FAIL = 5;
const LOCK_MINUTES = 30;
const PW_EXPIRY_DAYS = 90;

// ---- DB接続 ----
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME     || 'login_app_db',
  port:     parseInt(process.env.DB_PORT || '5432'),
});

// ---- ミドルウェア ----
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(session({
  secret: process.env.SESSION_SECRET || 'login-app-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 8 * 60 * 60 * 1000 },
}));

// ---- ヘルパー ----
function isPasswordExpired(passwordChangedAt) {
  const days = (Date.now() - new Date(passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24);
  return days >= PW_EXPIRY_DAYS;
}

function isLocked(lockedUntil) {
  return lockedUntil && new Date(lockedUntil) > new Date();
}

async function logHistory(userId, result, ip) {
  await pool.query(
    'INSERT INTO login_histories (user_id, result, ip_address) VALUES ($1, $2, $3)',
    [userId || null, result, ip]
  ).catch(() => {});
}

function requireAuth(req, res, next) {
  if (!req.session.userId || req.session.requiresPasswordChange) {
    return res.status(401).json({ status: 'error', error: { code: 'UNAUTHORIZED', message: '認証が必要です' } });
  }
  next();
}

// ========================================================
// 認証 API
// ========================================================

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { userId, password } = req.body || {};
  const ip = req.ip;

  try {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);

    // ユーザー不存在 or 無効 → 認証失敗として統一
    if (result.rows.length === 0 || !result.rows[0].is_active) {
      await logHistory(userId, 'FAILED', ip);
      return res.status(401).json({
        status: 'error',
        error: { code: 'AUTH_FAILED', message: 'ユーザーIDまたはパスワードが正しくありません', remainingAttempts: null },
      });
    }

    const user = result.rows[0];

    // ロックチェック
    if (isLocked(user.locked_until)) {
      await logHistory(userId, 'LOCKED', ip);
      return res.status(403).json({
        status: 'error',
        error: { code: 'ACCOUNT_LOCKED', message: 'アカウントがロックされています', lockedUntil: user.locked_until },
      });
    }

    // ロック自動解除
    if (user.locked_until && !isLocked(user.locked_until)) {
      await pool.query(
        'UPDATE users SET locked_until = NULL, failed_login_count = 0, updated_at = NOW() WHERE user_id = $1',
        [userId]
      );
      user.failed_login_count = 0;
      user.locked_until = null;
    }

    // パスワード照合
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const newCount = user.failed_login_count + 1;
      if (newCount >= MAX_FAIL) {
        const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        await pool.query(
          'UPDATE users SET failed_login_count = $1, locked_until = $2, updated_at = NOW() WHERE user_id = $3',
          [newCount, lockUntil, userId]
        );
        await logHistory(userId, 'LOCKED', ip);
        return res.status(403).json({
          status: 'error',
          error: { code: 'ACCOUNT_LOCKED', message: `ログインに連続${MAX_FAIL}回失敗したため、アカウントをロックしました。${LOCK_MINUTES}分後に自動解除されます。`, lockedUntil: lockUntil },
        });
      }
      await pool.query(
        'UPDATE users SET failed_login_count = $1, updated_at = NOW() WHERE user_id = $2',
        [newCount, userId]
      );
      await logHistory(userId, 'FAILED', ip);
      return res.status(401).json({
        status: 'error',
        error: { code: 'AUTH_FAILED', message: 'ユーザーIDまたはパスワードが正しくありません', remainingAttempts: MAX_FAIL - newCount },
      });
    }

    // 認証成功 → 失敗回数リセット
    await pool.query(
      'UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = NOW() WHERE user_id = $1',
      [userId]
    );

    // パスワード期限チェック
    if (isPasswordExpired(user.password_changed_at)) {
      req.session.userId = userId;
      req.session.requiresPasswordChange = true;
      await logHistory(userId, 'EXPIRED', ip);
      return res.status(422).json({
        status: 'error',
        error: { code: 'PASSWORD_EXPIRED', message: 'パスワードの有効期限が切れています' },
      });
    }

    // ログイン成功
    req.session.userId = userId;
    req.session.requiresPasswordChange = false;
    await logHistory(userId, 'SUCCESS', ip);
    return res.status(200).json({
      status: 'success',
      data: { userId, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) },
    });

  } catch (err) {
    console.error('[/api/auth/login]', err);
    return res.status(500).json({ status: 'error', error: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.status(200).json({ status: 'success', data: { message: 'ログアウトしました' } });
  });
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', async (req, res) => {
  if (!req.session.userId || !req.session.requiresPasswordChange) {
    return res.status(401).json({ status: 'error', error: { code: 'UNAUTHORIZED', message: 'パスワード変更の権限がありません' } });
  }
  const { newPassword } = req.body || {};
  if (!newPassword) {
    return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: '新しいパスワードを入力してください' } });
  }
  try {
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      'UPDATE users SET password_hash = $1, password_changed_at = NOW(), failed_login_count = 0, locked_until = NULL, updated_at = NOW() WHERE user_id = $2',
      [hash, req.session.userId]
    );
    req.session.requiresPasswordChange = false;
    const now = new Date();
    return res.status(200).json({ status: 'success', data: { message: 'パスワードを変更しました', passwordChangedAt: now } });
  } catch (err) {
    console.error('[/api/auth/change-password]', err);
    return res.status(500).json({ status: 'error', error: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// GET /api/auth/status
app.get('/api/auth/status', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT user_id, password_changed_at FROM users WHERE user_id = $1', [req.session.userId]);
    if (result.rows.length === 0) return res.status(401).json({ status: 'error', error: { code: 'SESSION_EXPIRED', message: 'セッションが無効です' } });
    const user = result.rows[0];
    const pwExpiresAt = new Date(new Date(user.password_changed_at).getTime() + PW_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    return res.status(200).json({
      status: 'success',
      data: { userId: user.user_id, sessionValid: true, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), passwordExpiresAt: pwExpiresAt },
    });
  } catch (err) {
    console.error('[/api/auth/status]', err);
    return res.status(500).json({ status: 'error', error: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ========================================================
// ユーザー管理 API
// ========================================================

// GET /api/users
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, password_changed_at, failed_login_count, locked_until, is_active, created_at, updated_at FROM users ORDER BY created_at ASC'
    );
    return res.status(200).json({ status: 'success', data: result.rows });
  } catch (err) {
    console.error('[GET /api/users]', err);
    return res.status(500).json({ status: 'error', error: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// POST /api/users
app.post('/api/users', async (req, res) => {
  const { userId, password } = req.body || {};
  const RE_USERID   = /^[a-zA-Z0-9]{1,20}$/;
  const RE_PASSWORD = /^[a-zA-Z0-9!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]{8,32}$/;

  const fields = {};
  if (!userId || !RE_USERID.test(userId))     fields.userId   = 'ユーザーIDは半角英数字1〜20文字で入力してください';
  if (!password || !RE_PASSWORD.test(password)) fields.password = 'パスワードは半角英数記号8〜32文字で入力してください';
  if (Object.keys(fields).length > 0) {
    return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: '入力値に誤りがあります', fields } });
  }

  try {
    const exists = await pool.query('SELECT 1 FROM users WHERE user_id = $1', [userId]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ status: 'error', error: { code: 'DUPLICATE_USER', message: 'そのユーザーIDはすでに使用されています' } });
    }
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO users (user_id, password_hash) VALUES ($1, $2) RETURNING user_id, password_changed_at, failed_login_count, locked_until, is_active, created_at',
      [userId, hash]
    );
    return res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    console.error('[POST /api/users]', err);
    return res.status(500).json({ status: 'error', error: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// PUT /api/users/:userId
app.put('/api/users/:userId', async (req, res) => {
  const { userId } = req.params;
  const { password, isActive, resetLock } = req.body || {};

  try {
    const exists = await pool.query('SELECT 1 FROM users WHERE user_id = $1', [userId]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'ユーザーが見つかりません' } });
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (password !== undefined) {
      const RE_PASSWORD = /^[a-zA-Z0-9!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]{8,32}$/;
      if (!RE_PASSWORD.test(password)) {
        return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: 'パスワードは半角英数記号8〜32文字で入力してください' } });
      }
      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push(`password_hash = $${idx++}`); values.push(hash);
      updates.push(`password_changed_at = NOW()`);
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${idx++}`); values.push(isActive);
    }

    if (resetLock) {
      updates.push(`failed_login_count = 0`);
      updates.push(`locked_until = NULL`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: 'error', error: { code: 'NO_UPDATE', message: '更新する項目がありません' } });
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${idx} RETURNING user_id, password_changed_at, failed_login_count, locked_until, is_active, updated_at`,
      values
    );
    return res.status(200).json({ status: 'success', data: result.rows[0] });

  } catch (err) {
    console.error('[PUT /api/users/:userId]', err);
    return res.status(500).json({ status: 'error', error: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// DELETE /api/users/:userId
app.delete('/api/users/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query('DELETE FROM users WHERE user_id = $1 RETURNING user_id', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', error: { code: 'NOT_FOUND', message: 'ユーザーが見つかりません' } });
    }
    return res.status(200).json({ status: 'success', data: { message: `ユーザー ${userId} を削除しました` } });
  } catch (err) {
    console.error('[DELETE /api/users/:userId]', err);
    return res.status(500).json({ status: 'error', error: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました' } });
  }
});

// ---- 起動 ----
app.listen(PORT, () => {
  console.log(`🚀 サーバー起動: http://localhost:${PORT}`);
  console.log(`   ログイン画面: http://localhost:${PORT}/index.html`);
  console.log(`   ユーザー管理: http://localhost:${PORT}/admin.html`);
});
