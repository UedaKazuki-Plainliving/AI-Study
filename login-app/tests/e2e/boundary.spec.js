'use strict';
/**
 * E2E 境界値テスト — パスワード有効期限 / アカウントロック期限
 * TC-B01〜B04
 */
const { test, expect } = require('@playwright/test');

const EXPIRY_OK  = { userId: 'e2eexpiry89', password: 'TestP@ss1' }; // 期限内ユーザー
const EXPIRY_NG  = { userId: 'e2eexpiry90', password: 'TestP@ss1' }; // 期限切れユーザー
const LOCK_BV    = { userId: 'e2elockbv',   password: 'TestP@ss1' }; // ロックBVユーザー
const WRONG_PASSWORD = 'WrongP@ss9';

test.beforeAll(async ({ request }) => {
  // 期限内ユーザー（新規作成 = パスワード変更日時が現在）
  await request.delete(`/api/users/${EXPIRY_OK.userId}`);
  await request.post('/api/users', { data: EXPIRY_OK });

  // 期限切れユーザー（forcePasswordChange で期限切れ状態にする）
  await request.delete(`/api/users/${EXPIRY_NG.userId}`);
  await request.post('/api/users', { data: EXPIRY_NG });
  await request.put(`/api/users/${EXPIRY_NG.userId}`, { data: { forcePasswordChange: true } });

  // ロックBVユーザー
  await request.delete(`/api/users/${LOCK_BV.userId}`);
  await request.post('/api/users', { data: LOCK_BV });
});

test.afterAll(async ({ request }) => {
  for (const u of [EXPIRY_OK, EXPIRY_NG, LOCK_BV]) {
    await request.delete(`/api/users/${u.userId}`);
  }
});

async function gotoLogin(page) {
  await page.goto('/index.html');
  await expect(page.locator('#screen-login')).toBeVisible();
}

// ============================================================
// パスワード有効期限 境界値
// ============================================================

// TC-B01: パスワード変更後89日以内 → ホーム画面（期限切れにならない）
// 新規作成ユーザー = 変更直後 = 期限内として検証
test('TC-B01 / SC-BV-PW-89: 期限内ユーザーでログイン → ホーム画面', async ({ page }) => {
  await gotoLogin(page);
  await page.locator('#user-id').fill(EXPIRY_OK.userId);
  await page.locator('#password').fill(EXPIRY_OK.password);
  await page.locator('#btn-login').click();
  await expect(page.locator('#btn-login')).toBeEnabled({ timeout: 10000 });

  await expect(page.locator('#screen-home')).toBeVisible();
  await expect(page.locator('#screen-pw-change')).not.toBeVisible();
});

// TC-B02: パスワード変更から90日経過 → パスワード変更画面（期限切れ）
// forcePasswordChange API で期限切れ状態を再現
test('TC-B02 / SC-BV-PW-90: 期限切れユーザーでログイン → パスワード変更画面', async ({ page }) => {
  await gotoLogin(page);
  await page.locator('#user-id').fill(EXPIRY_NG.userId);
  await page.locator('#password').fill(EXPIRY_NG.password);
  await page.locator('#btn-login').click();
  await expect(page.locator('#btn-login')).toBeEnabled({ timeout: 10000 });

  await expect(page.locator('#screen-pw-change')).toBeVisible();
  await expect(page.locator('#screen-home')).not.toBeVisible();
});

// ============================================================
// アカウントロック期限 境界値
// ============================================================

// TC-B03: ロック中ユーザー → ログイン拒否（ロックエラー表示）
// 連続失敗でロックした直後（ロック期限が未来）を検証
test.describe.serial('TC-B03: ロック中はログイン拒否', () => {
  test.beforeAll(async ({ request }) => {
    // ロック状態を作る: 5回連続失敗させる
    for (let i = 0; i < 5; i++) {
      await request.post('/api/auth/login', {
        data: { userId: LOCK_BV.userId, password: WRONG_PASSWORD },
      });
    }
  });

  test('TC-B03 / SC-BV-LOCK-1MIN: ロック直後に正しいパスワードで試行 → ロックエラー', async ({ page }) => {
    await gotoLogin(page);
    await page.locator('#user-id').fill(LOCK_BV.userId);
    await page.locator('#password').fill(LOCK_BV.password);
    await page.locator('#btn-login').click();
    await expect(page.locator('#btn-login')).toBeEnabled({ timeout: 10000 });

    await expect(page.locator('#auth-error')).toHaveClass(/auth-locked/);
    await expect(page.locator('#auth-error')).toContainText('ロック');
    await expect(page.locator('#screen-home')).not.toBeVisible();
  });
});

// TC-B04: ロック期限切れ後のログイン成功
// ロック期間は30分のため自動待機テストは非現実的。
// 管理者ロック解除APIを使って「ロック解除済み」状態を再現する。
test('TC-B04 / SC-BV-LOCK-EXPIRED: ロック解除後のログイン成功', async ({ page, request }) => {
  // ロック解除（resetLock: true）
  await request.put(`/api/users/${LOCK_BV.userId}`, { data: { resetLock: true } });

  await gotoLogin(page);
  await page.locator('#user-id').fill(LOCK_BV.userId);
  await page.locator('#password').fill(LOCK_BV.password);
  await page.locator('#btn-login').click();
  await expect(page.locator('#btn-login')).toBeEnabled({ timeout: 10000 });

  await expect(page.locator('#screen-home')).toBeVisible();
  await expect(page.locator('#auth-error')).not.toBeVisible();
});
