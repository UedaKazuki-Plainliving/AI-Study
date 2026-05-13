/**
 * 認証API テスト
 * 対象: POST /api/auth/login
 *       POST /api/auth/logout
 *       POST /api/auth/change-password
 *       GET  /api/auth/status
 */
const { test, expect } = require('@playwright/test');
const { TEST_USERS, WRONG_PASSWORD, resetUser, login } = require('./helpers');

// ============================================================
// POST /api/auth/login
// ============================================================
test.describe('POST /api/auth/login', () => {

  test.beforeAll(async ({ request }) => {
    await resetUser(request, TEST_USERS.NORMAL.userId);
    await resetUser(request, TEST_USERS.EXPIRED.userId);
    // 期限切れユーザーのパスワードを強制期限切れにする
    await request.put(`/api/users/${TEST_USERS.EXPIRED.userId}`, {
      data: { forcePasswordChange: true },
    });
  });

  test.afterAll(async ({ request }) => {
    await request.delete(`/api/users/${TEST_USERS.NORMAL.userId}`);
    await request.delete(`/api/users/${TEST_USERS.EXPIRED.userId}`);
  });

  test('TC-L01: 正常ログイン → 200', async ({ request }) => {
    const res = await login(request, TEST_USERS.NORMAL.userId);

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');
    expect(body.data.userId).toBe(TEST_USERS.NORMAL.userId);
    expect(body.data).toHaveProperty('expiresAt');
  });

  test('TC-L02: 存在しないユーザー → 401 AUTH_FAILED', async ({ request }) => {
    const res = await login(request, 'no_such_user_xyz');

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_FAILED');
    expect(body.error.remainingAttempts).toBeNull();
  });

  test('TC-L03: パスワード不一致（1回目）→ 401・残り4回', async ({ request }) => {
    // tst_normalはbeforeAllでリセット済み。失敗回数0からスタート
    const res = await login(request, TEST_USERS.NORMAL.userId, WRONG_PASSWORD);

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_FAILED');
    expect(body.error.remainingAttempts).toBe(4);
  });

  test('TC-L09: パスワード期限切れ → 422 PASSWORD_EXPIRED', async ({ request }) => {
    const res = await login(request, TEST_USERS.EXPIRED.userId);

    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('PASSWORD_EXPIRED');
  });

});

// ============================================================
// 連続ログイン失敗→ロック（順序依存のため serial で実行）
// ============================================================
test.describe.serial('POST /api/auth/login — 連続失敗→ロック', () => {

  test.beforeAll(async ({ request }) => {
    await resetUser(request, TEST_USERS.LOCK.userId);
  });

  test.afterAll(async ({ request }) => {
    await request.delete(`/api/users/${TEST_USERS.LOCK.userId}`);
  });

  test('TC-L04: 1回目失敗 → 残り4回', async ({ request }) => {
    const res = await login(request, TEST_USERS.LOCK.userId, WRONG_PASSWORD);
    expect(res.status()).toBe(401);
    expect((await res.json()).error.remainingAttempts).toBe(4);
  });

  test('TC-L05: 2回目失敗 → 残り3回', async ({ request }) => {
    const res = await login(request, TEST_USERS.LOCK.userId, WRONG_PASSWORD);
    expect(res.status()).toBe(401);
    expect((await res.json()).error.remainingAttempts).toBe(3);
  });

  test('TC-L06: 3回目失敗 → 残り2回', async ({ request }) => {
    const res = await login(request, TEST_USERS.LOCK.userId, WRONG_PASSWORD);
    expect(res.status()).toBe(401);
    expect((await res.json()).error.remainingAttempts).toBe(2);
  });

  test('TC-L07: 4回目失敗 → 残り1回', async ({ request }) => {
    const res = await login(request, TEST_USERS.LOCK.userId, WRONG_PASSWORD);
    expect(res.status()).toBe(401);
    expect((await res.json()).error.remainingAttempts).toBe(1);
  });

  test('TC-L08: 5回目失敗 → 403 ACCOUNT_LOCKED（ロック）', async ({ request }) => {
    const res = await login(request, TEST_USERS.LOCK.userId, WRONG_PASSWORD);
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('ACCOUNT_LOCKED');
    expect(body.error).toHaveProperty('lockedUntil');
  });

  test('TC-L09: ロック中に再試行 → 403 ACCOUNT_LOCKED', async ({ request }) => {
    // 正しいパスワードでも弾かれる
    const res = await login(request, TEST_USERS.LOCK.userId);
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe('ACCOUNT_LOCKED');
  });

});

// ============================================================
// POST /api/auth/logout
// ============================================================
test.describe('POST /api/auth/logout', () => {

  test.beforeAll(async ({ request }) => {
    await resetUser(request, TEST_USERS.NORMAL.userId);
  });

  test.afterAll(async ({ request }) => {
    await request.delete(`/api/users/${TEST_USERS.NORMAL.userId}`);
  });

  test('TC-LO01: ログアウト成功 → 200', async ({ request }) => {
    await login(request, TEST_USERS.NORMAL.userId);

    const res = await request.post('/api/auth/logout');

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');
    expect(body.data.message).toBe('ログアウトしました');
  });

  test('TC-LO02: ログアウト後はセッション無効 → 401', async ({ request }) => {
    await login(request, TEST_USERS.NORMAL.userId);
    await request.post('/api/auth/logout');

    const res = await request.get('/api/auth/status');
    expect(res.status()).toBe(401);
  });

});

// ============================================================
// POST /api/auth/change-password
// ============================================================
test.describe('POST /api/auth/change-password', () => {

  test.beforeAll(async ({ request }) => {
    await resetUser(request, TEST_USERS.EXPIRED.userId);
    await request.put(`/api/users/${TEST_USERS.EXPIRED.userId}`, {
      data: { forcePasswordChange: true },
    });
    await resetUser(request, TEST_USERS.NORMAL.userId);
  });

  test.afterAll(async ({ request }) => {
    await request.delete(`/api/users/${TEST_USERS.EXPIRED.userId}`);
    await request.delete(`/api/users/${TEST_USERS.NORMAL.userId}`);
  });

  test('TC-CP01: 正常変更 → 200', async ({ request }) => {
    // 期限切れログイン → 422 でセッション開始
    await login(request, TEST_USERS.EXPIRED.userId);

    const res = await request.post('/api/auth/change-password', {
      data: { newPassword: 'NewP@ss001' },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');
    expect(body.data.message).toBe('パスワードを変更しました');
    expect(body.data).toHaveProperty('passwordChangedAt');
  });

  test('TC-CP02: 未認証（セッションなし）→ 401', async ({ request }) => {
    // 新しいrequestコンテキスト相当（セッションなし）
    const res = await request.post('/api/auth/change-password', {
      data: { newPassword: 'NewP@ss001' },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  test('TC-CP03: 通常ログイン後（変更不要セッション）→ 401', async ({ request }) => {
    await login(request, TEST_USERS.NORMAL.userId);

    const res = await request.post('/api/auth/change-password', {
      data: { newPassword: 'NewP@ss001' },
    });
    expect(res.status()).toBe(401);
  });

  test('TC-CP04: 新パスワード未入力 → 400', async ({ request }) => {
    // TC-CP01 がパスワードを変更済みのため、改めて期限切れ状態に戻す
    await resetUser(request, TEST_USERS.EXPIRED.userId);
    await request.put(`/api/users/${TEST_USERS.EXPIRED.userId}`, {
      data: { forcePasswordChange: true },
    });
    await login(request, TEST_USERS.EXPIRED.userId);

    const res = await request.post('/api/auth/change-password', {
      data: {},
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

});

// ============================================================
// GET /api/auth/status
// ============================================================
test.describe('GET /api/auth/status', () => {

  test.beforeAll(async ({ request }) => {
    await resetUser(request, TEST_USERS.NORMAL.userId);
  });

  test.afterAll(async ({ request }) => {
    await request.delete(`/api/users/${TEST_USERS.NORMAL.userId}`);
  });

  test('TC-ST01: ログイン済み → 200・セッション情報を返す', async ({ request }) => {
    await login(request, TEST_USERS.NORMAL.userId);

    const res = await request.get('/api/auth/status');

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');
    expect(body.data.userId).toBe(TEST_USERS.NORMAL.userId);
    expect(body.data.sessionValid).toBe(true);
    expect(body.data).toHaveProperty('expiresAt');
    expect(body.data).toHaveProperty('passwordExpiresAt');
  });

  test('TC-ST02: 未認証 → 401', async ({ request }) => {
    const res = await request.get('/api/auth/status');
    expect(res.status()).toBe(401);
  });

});
