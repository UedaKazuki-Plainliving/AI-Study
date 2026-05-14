/**
 * E2E ブラウザテスト — ログイン画面 (index.html)
 * Gherkin: features/login.feature
 *
 * ペルソナ: 田中 花子（一般社員）
 */
const { test, expect } = require('@playwright/test');

const NORMAL  = { userId: 'e2enormal',  password: 'TestP@ss1' };
const LOCK    = { userId: 'e2elock',    password: 'TestP@ss1' };
const EXPIRED = { userId: 'e2eexpired', password: 'TestP@ss1' };
const ADMIN   = { userId: 'admin',      password: 'root1234' };
const WRONG_PASSWORD = 'WrongP@ss9';

// ---- セットアップ ----
test.beforeAll(async ({ request }) => {
  for (const u of [NORMAL, LOCK, EXPIRED]) {
    await request.delete(`/api/users/${u.userId}`);
    await request.post('/api/users', { data: u });
  }
  // EXPIRED ユーザーのパスワードを期限切れにする
  await request.put(`/api/users/${EXPIRED.userId}`, {
    data: { forcePasswordChange: true },
  });
});

test.afterAll(async ({ request }) => {
  for (const u of [NORMAL, LOCK, EXPIRED]) {
    await request.delete(`/api/users/${u.userId}`);
  }
});

// ---- 共通操作 ----
async function gotoLogin(page) {
  await page.goto('/index.html');
  await expect(page.locator('#screen-login')).toBeVisible();
}

async function fillAndLogin(page, userId, password) {
  await page.locator('#user-id').fill(userId);
  await page.locator('#password').fill(password);
  await page.locator('#btn-login').click();
  await expect(page.locator('#btn-login')).toBeEnabled({ timeout: 10000 });
}

// ============================================================
// 正常系
// ============================================================

// TC-E02 / SC-ADM-01: 管理者ログイン → 管理画面遷移
test('TC-E02 / SC-ADM-01: 管理者ログイン → 管理画面に遷移', async ({ page, request }) => {
  // admin ユーザーが未登録の場合はスキップ（EC2上で node init-db.js を実行してください）
  const usersRes = await request.get('/api/users');
  const usersJson = await usersRes.json();
  const adminExists = usersJson.data?.some(u => u.user_id === 'admin');
  test.skip(!adminExists, 'admin ユーザーが未登録。EC2上で node init-db.js を実行してください。');

  await gotoLogin(page);
  await page.locator('#user-id').fill(ADMIN.userId);
  await page.locator('#password').fill(ADMIN.password);
  await page.locator('#btn-login').click();

  await page.waitForURL('**/admin.html', { timeout: 10000 });
  await expect(page).toHaveURL(/admin\.html/);
  await expect(page.locator('h2', { hasText: 'ユーザー一覧' })).toBeVisible();
});

// SC-01: 正常ログイン
test('SC-01: 正常ログイン → ホーム画面遷移', async ({ page }) => {
  await gotoLogin(page);
  await fillAndLogin(page, NORMAL.userId, NORMAL.password);

  await expect(page.locator('#screen-home')).toBeVisible();
  await expect(page.locator('#home-username')).toContainText(`${NORMAL.userId} さん`);
});

// SC-11: ログアウト
test('SC-11: ログアウト → ログイン画面に戻り入力クリア', async ({ page }) => {
  await gotoLogin(page);
  await fillAndLogin(page, NORMAL.userId, NORMAL.password);
  await expect(page.locator('#screen-home')).toBeVisible();

  await page.locator('.btn-logout').click();

  await expect(page.locator('#screen-login')).toBeVisible();
  await expect(page.locator('#user-id')).toHaveValue('');
  await expect(page.locator('#password')).toHaveValue('');
});

// ============================================================
// フロントエンドバリデーション
// ============================================================

// SC-02: ユーザーID未入力
test('SC-02: ユーザーID未入力 → フィールドエラー表示', async ({ page }) => {
  await gotoLogin(page);
  await page.locator('#btn-login').click();

  await expect(page.locator('#err-userid')).toBeVisible();
  await expect(page.locator('#err-userid')).toContainText('ユーザーIDを入力してください');
});

// SC-03: パスワード未入力
test('SC-03: パスワード未入力 → フィールドエラー表示', async ({ page }) => {
  await gotoLogin(page);
  await page.locator('#user-id').fill(NORMAL.userId);
  await page.locator('#btn-login').click();

  await expect(page.locator('#err-password')).toBeVisible();
  await expect(page.locator('#err-password')).toContainText('パスワードを入力してください');
});

// SC-04: ユーザーID形式不正（フォーカスアウト時）
test('SC-04: ユーザーID不正（記号含む）→ blurでエラー', async ({ page }) => {
  await gotoLogin(page);
  await page.locator('#user-id').fill('user_invalid');
  await page.locator('#user-id').blur();

  await expect(page.locator('#err-userid')).toBeVisible();
  await expect(page.locator('#err-userid')).toContainText('半角英数字');
});

// SC-05: パスワード7文字（最小値-1）
test('SC-05: パスワード7文字（最小値-1）→ blurでエラー', async ({ page }) => {
  await gotoLogin(page);
  await page.locator('#password').fill('P@ss00');  // 7文字
  await page.locator('#password').blur();

  await expect(page.locator('#err-password')).toBeVisible();
  await expect(page.locator('#err-password')).toContainText('8〜32文字');
});

// 境界値: パスワード8文字（最小値）は正常
test('[BV] パスワード8文字（最小値）→ blurでエラーなし', async ({ page }) => {
  await gotoLogin(page);
  await page.locator('#password').fill('P@ssw001');  // 8文字
  await page.locator('#password').blur();

  await expect(page.locator('#err-password')).not.toBeVisible();
});

// ============================================================
// 認証失敗・残り回数
// ============================================================

// SC-06: パスワード不一致 → 残り回数表示
test('SC-06: パスワード不一致（1回目）→ 残り4回メッセージ', async ({ page }) => {
  await gotoLogin(page);
  await fillAndLogin(page, NORMAL.userId, WRONG_PASSWORD);

  await expect(page.locator('#auth-error')).toBeVisible();
  await expect(page.locator('#auth-error')).toContainText('あと4回失敗するとロックされます');
});

// 入力開始で認証エラーが消える
test('[BV] 認証エラー表示後に入力開始 → エラー非表示', async ({ page }) => {
  await gotoLogin(page);
  await fillAndLogin(page, NORMAL.userId, WRONG_PASSWORD);
  await expect(page.locator('#auth-error')).toBeVisible();

  // 入力開始 → エラーが消える
  await page.locator('#user-id').fill('x');
  await expect(page.locator('#auth-error')).not.toBeVisible();
});

// ============================================================
// 連続失敗 → アカウントロック（serial: 順序依存）
// ============================================================
test.describe.serial('SC-07/08: 連続失敗→ロック', () => {

  test.beforeAll(async ({ request }) => {
    await request.delete(`/api/users/${LOCK.userId}`);
    await request.post('/api/users', { data: LOCK });
  });

  test('SC-07: 連続5回失敗 → ロックメッセージ', async ({ page }) => {
    await gotoLogin(page);
    for (let i = 0; i < 5; i++) {
      await page.locator('#user-id').fill(LOCK.userId);
      await page.locator('#password').fill(WRONG_PASSWORD);
      await page.locator('#btn-login').click();
      await expect(page.locator('#btn-login')).toBeEnabled({ timeout: 10000 });
    }
    await expect(page.locator('#auth-error')).toHaveClass(/auth-locked/);
    await expect(page.locator('#auth-error')).toContainText('ロック');
  });

  test('SC-08: ロック中に正しいパスワードで試行 → ロックエラー', async ({ page }) => {
    await gotoLogin(page);
    await fillAndLogin(page, LOCK.userId, LOCK.password);

    await expect(page.locator('#auth-error')).toHaveClass(/auth-locked/);
    await expect(page.locator('#auth-error')).toContainText('ロック');
  });

});

// ============================================================
// パスワード期限切れ・変更
// ============================================================

// SC-09: パスワード期限切れ → 変更画面遷移
test('SC-09: パスワード期限切れ → パスワード変更画面へ遷移', async ({ page, request }) => {
  // EXPIREDユーザーの状態を確実にリセット
  await request.delete(`/api/users/${EXPIRED.userId}`);
  await request.post('/api/users', { data: EXPIRED });
  await request.put(`/api/users/${EXPIRED.userId}`, { data: { forcePasswordChange: true } });

  await gotoLogin(page);
  await fillAndLogin(page, EXPIRED.userId, EXPIRED.password);

  await expect(page.locator('#screen-pw-change')).toBeVisible();
  await expect(page.locator('.pw-expired-notice')).toBeVisible();
});

// SC-10: パスワード変更成功
test('SC-10: パスワード変更成功 → 成功メッセージ → ログイン画面へ', async ({ page, request }) => {
  await request.delete(`/api/users/${EXPIRED.userId}`);
  await request.post('/api/users', { data: EXPIRED });
  await request.put(`/api/users/${EXPIRED.userId}`, { data: { forcePasswordChange: true } });

  await gotoLogin(page);
  await fillAndLogin(page, EXPIRED.userId, EXPIRED.password);
  await expect(page.locator('#screen-pw-change')).toBeVisible();

  await page.locator('#new-password').fill('NewP@ss999');
  await page.locator('#confirm-password').fill('NewP@ss999');
  await page.locator('#btn-change').click();

  await expect(page.locator('#pw-change-success')).toBeVisible();
  await expect(page.locator('#pw-change-success')).toContainText('パスワードを変更しました');
  // 2秒後にログイン画面へ遷移
  await expect(page.locator('#screen-login')).toBeVisible({ timeout: 5000 });
});

// SC-12: 確認パスワード不一致
test('SC-12: 確認パスワード不一致 → フィールドエラー', async ({ page, request }) => {
  await request.delete(`/api/users/${EXPIRED.userId}`);
  await request.post('/api/users', { data: EXPIRED });
  await request.put(`/api/users/${EXPIRED.userId}`, { data: { forcePasswordChange: true } });

  await gotoLogin(page);
  await fillAndLogin(page, EXPIRED.userId, EXPIRED.password);
  await expect(page.locator('#screen-pw-change')).toBeVisible();

  await page.locator('#new-password').fill('NewP@ss001');
  await page.locator('#confirm-password').fill('Different9');
  await page.locator('#btn-change').click();

  await expect(page.locator('#err-confirm-password')).toBeVisible();
  await expect(page.locator('#err-confirm-password')).toContainText('パスワードが一致しません');
});

// ============================================================
// セキュリティ
// ============================================================

// TC-S01 / SC-SEC-01: ログアウト後のセッション無効化
test('TC-S01 / SC-SEC-01: ログアウト後のセッション無効化確認', async ({ page, request }) => {
  await gotoLogin(page);
  await fillAndLogin(page, NORMAL.userId, NORMAL.password);
  await expect(page.locator('#screen-home')).toBeVisible();

  await page.locator('.btn-logout').click();
  await expect(page.locator('#screen-login')).toBeVisible();

  // セッションが無効化されていることをAPI経由で確認
  const res = await request.get('/api/auth/status');
  expect(res.status()).toBe(401);
});

// TC-S02 / SC-SEC-02: 不正なユーザーIDでのログイン試行（SQLインジェクション）
test('TC-S02 / SC-SEC-02: SQLインジェクション文字列 → ログイン拒否', async ({ page }) => {
  await gotoLogin(page);
  await page.locator('#user-id').fill("' OR '1'='1");
  await page.locator('#password').fill('anything');
  await page.locator('#btn-login').click();

  // ホーム画面へ遷移しない
  await expect(page.locator('#screen-home')).not.toBeVisible();
  // バリデーションエラーまたは認証エラーが表示される
  const hasValidationError = await page.locator('#err-userid').isVisible();
  const hasAuthError       = await page.locator('#auth-error').isVisible();
  expect(hasValidationError || hasAuthError).toBeTruthy();
});

// 変更成功後ボタンは無効化を維持（仕様 SC-10 のサブ確認）
test('[BV] PW変更成功後 → ボタン無効化のまま2秒待機', async ({ page, request }) => {
  await request.delete(`/api/users/${EXPIRED.userId}`);
  await request.post('/api/users', { data: EXPIRED });
  await request.put(`/api/users/${EXPIRED.userId}`, { data: { forcePasswordChange: true } });

  await gotoLogin(page);
  await fillAndLogin(page, EXPIRED.userId, EXPIRED.password);

  await page.locator('#new-password').fill('NewP@ss888');
  await page.locator('#confirm-password').fill('NewP@ss888');
  await page.locator('#btn-change').click();

  await expect(page.locator('#pw-change-success')).toBeVisible();
  // 成功直後のボタンは disabled のまま
  await expect(page.locator('#btn-change')).toBeDisabled();
});
