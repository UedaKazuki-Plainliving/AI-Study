/**
 * ユーザー管理API テスト
 * 対象: GET    /api/users
 *       POST   /api/users
 *       PUT    /api/users/:userId
 *       DELETE /api/users/:userId
 */
const { test, expect } = require('@playwright/test');
const { TEST_USERS, resetUser } = require('./helpers');

// ============================================================
// GET /api/users
// ============================================================
test.describe('GET /api/users', () => {

  test('TC-U01: ユーザー一覧取得 → 200・配列を返す', async ({ request }) => {
    const res = await request.get('/api/users');

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('TC-U02: レスポンスの各ユーザーが必須フィールドを持つ', async ({ request }) => {
    const res = await request.get('/api/users');
    const body = await res.json();

    for (const user of body.data) {
      expect(user).toHaveProperty('user_id');
      expect(user).toHaveProperty('is_active');
      expect(user).toHaveProperty('failed_login_count');
      expect(user).toHaveProperty('password_changed_at');
      expect(user).toHaveProperty('created_at');
    }
  });

});

// ============================================================
// POST /api/users
// ============================================================
test.describe('POST /api/users', () => {

  const NEW_USER = { userId: 'tstcreate', password: 'TestP@ss1' };

  test.beforeAll(async ({ request }) => {
    // 前回のテスト残骸を削除
    await request.delete(`/api/users/${NEW_USER.userId}`);
  });

  test.afterAll(async ({ request }) => {
    await request.delete(`/api/users/${NEW_USER.userId}`);
  });

  test('TC-U03: ユーザー作成成功 → 201', async ({ request }) => {
    const res = await request.post('/api/users', { data: NEW_USER });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('success');
    expect(body.data.user_id).toBe(NEW_USER.userId);
    expect(body.data.is_active).toBe(true);
    expect(body.data.failed_login_count).toBe(0);
  });

  test('TC-U04: ユーザーID重複 → 400 DUPLICATE_USER', async ({ request }) => {
    const res = await request.post('/api/users', { data: NEW_USER });

    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('DUPLICATE_USER');
  });

  test('TC-U05: ユーザーID不正（記号含む）→ 400 VALIDATION_ERROR', async ({ request }) => {
    const res = await request.post('/api/users', {
      data: { userId: 'user@invalid!', password: 'TestP@ss1' },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.fields).toHaveProperty('userId');
  });

  test('TC-U06: パスワード短すぎ（7文字）→ 400 VALIDATION_ERROR', async ({ request }) => {
    const res = await request.post('/api/users', {
      data: { userId: 'validuser', password: 'Short1!' },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.fields).toHaveProperty('password');
  });

});

// ============================================================
// PUT /api/users/:userId
// ============================================================
test.describe('PUT /api/users/:userId', () => {

  test.beforeAll(async ({ request }) => {
    await resetUser(request, TEST_USERS.NORMAL.userId);
  });

  test.afterAll(async ({ request }) => {
    await request.delete(`/api/users/${TEST_USERS.NORMAL.userId}`);
  });

  test('TC-U07: パスワード更新 → 200', async ({ request }) => {
    const res = await request.put(`/api/users/${TEST_USERS.NORMAL.userId}`, {
      data: { password: 'NewP@ss999' },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');
    expect(body.data.user_id).toBe(TEST_USERS.NORMAL.userId);
  });

  test('TC-U08: 手動ロック → 200・locked_untilが設定される', async ({ request }) => {
    const res = await request.put(`/api/users/${TEST_USERS.NORMAL.userId}`, {
      data: { lock: true },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.locked_until).not.toBeNull();
  });

  test('TC-U09: ロック解除 → 200・locked_untilがnullになる', async ({ request }) => {
    const res = await request.put(`/api/users/${TEST_USERS.NORMAL.userId}`, {
      data: { resetLock: true },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.locked_until).toBeNull();
    expect(body.data.failed_login_count).toBe(0);
  });

  test('TC-U10: PW変更要求 → 200', async ({ request }) => {
    const res = await request.put(`/api/users/${TEST_USERS.NORMAL.userId}`, {
      data: { forcePasswordChange: true },
    });

    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe('success');
  });

  test('TC-U11: 無効化 → 200・is_activeがfalseになる', async ({ request }) => {
    const res = await request.put(`/api/users/${TEST_USERS.NORMAL.userId}`, {
      data: { isActive: false },
    });

    expect(res.status()).toBe(200);
    expect((await res.json()).data.is_active).toBe(false);
  });

  test('TC-U12: 有効化 → 200・is_activeがtrueになる', async ({ request }) => {
    const res = await request.put(`/api/users/${TEST_USERS.NORMAL.userId}`, {
      data: { isActive: true },
    });

    expect(res.status()).toBe(200);
    expect((await res.json()).data.is_active).toBe(true);
  });

  test('TC-U13: 更新項目なし → 400 NO_UPDATE', async ({ request }) => {
    const res = await request.put(`/api/users/${TEST_USERS.NORMAL.userId}`, {
      data: {},
    });

    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('NO_UPDATE');
  });

  test('TC-U14: 存在しないユーザー → 404 NOT_FOUND', async ({ request }) => {
    const res = await request.put('/api/users/no_such_user_xyz', {
      data: { isActive: true },
    });

    expect(res.status()).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_FOUND');
  });

});

// ============================================================
// DELETE /api/users/:userId
// ============================================================
test.describe('DELETE /api/users/:userId', () => {

  test.beforeAll(async ({ request }) => {
    await resetUser(request, TEST_USERS.DELETE.userId);
  });

  test('TC-U15: ユーザー削除 → 200', async ({ request }) => {
    const res = await request.delete(`/api/users/${TEST_USERS.DELETE.userId}`);

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');
    expect(body.data.message).toContain(TEST_USERS.DELETE.userId);
  });

  test('TC-U16: 存在しないユーザー → 404 NOT_FOUND', async ({ request }) => {
    const res = await request.delete('/api/users/no_such_user_xyz');

    expect(res.status()).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_FOUND');
  });

});
