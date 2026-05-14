'use strict';
/**
 * E2E ブラウザテスト — ユーザー管理画面 (admin.html)
 * Gherkin: features/admin.feature
 *
 * ペルソナ: 山田 太郎（IT部門管理者）
 */
const { test, expect } = require('@playwright/test');

const LOCK_USER  = { userId: 'e2elocktest', password: 'TestP@ss1' };
const DEL_USER   = { userId: 'e2edelete',   password: 'TestP@ss1' };
const NEW_USER   = { userId: 'e2enew001',   password: 'TestP@ss1' };
const ADMIN      = { userId: 'admin',       password: 'root1234'  };
const ADMIN_NEW_PW = 'NewAdminPw1!';

test.beforeAll(async ({ request }) => {
  await request.delete(`/api/users/${LOCK_USER.userId}`);
  await request.post('/api/users', { data: LOCK_USER });
  await request.delete(`/api/users/${DEL_USER.userId}`);
  await request.post('/api/users', { data: DEL_USER });
  await request.delete(`/api/users/${NEW_USER.userId}`);
});

test.afterAll(async ({ request }) => {
  for (const u of [LOCK_USER, DEL_USER, NEW_USER]) {
    await request.delete(`/api/users/${u.userId}`);
  }
});

// ---- 共通操作 ----
async function gotoAdmin(page) {
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/users') && r.status() === 200),
    page.goto('/admin.html'),
  ]);
}

function userRow(page, userId) {
  return page.locator('#user-tbody tr').filter({ hasText: userId });
}

// ============================================================
// ユーザー追加
// ============================================================

// SC-A01: ユーザー追加成功
test('SC-A01: ユーザー追加成功 → 一覧に表示', async ({ page, request }) => {
  await request.delete(`/api/users/${NEW_USER.userId}`);
  await gotoAdmin(page);

  await page.locator('#add-userid').fill(NEW_USER.userId);
  await page.locator('#add-password').fill(NEW_USER.password);
  await page.locator('.card').filter({ hasText: 'ユーザー追加' }).locator('button').click();

  await expect(page.locator('#add-alert-success')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#add-alert-success')).toContainText(`ユーザー「${NEW_USER.userId}」を追加しました`);
  await expect(userRow(page, NEW_USER.userId)).toBeVisible({ timeout: 10000 });
});

// SC-A02: ユーザーID重複エラー
test('SC-A02: ユーザーID重複 → エラーメッセージ', async ({ page, request }) => {
  await request.delete(`/api/users/${NEW_USER.userId}`);
  await request.post('/api/users', { data: NEW_USER });
  await gotoAdmin(page);

  await page.locator('#add-userid').fill(NEW_USER.userId);
  await page.locator('#add-password').fill(NEW_USER.password);
  await page.locator('.card').filter({ hasText: 'ユーザー追加' }).locator('button').click();

  await expect(page.locator('#add-alert-error')).toBeVisible({ timeout: 10000 });
});

// SC-A03: ユーザーID未入力バリデーション
test('SC-A03: ユーザーID未入力 → フィールドエラー', async ({ page }) => {
  await gotoAdmin(page);
  await page.locator('.card').filter({ hasText: 'ユーザー追加' }).locator('button').click();

  await expect(page.locator('#err-add-userid')).toBeVisible();
  await expect(page.locator('#err-add-userid')).toContainText('ユーザーIDを入力してください');
});

// SC-A04: パスワード短すぎバリデーション（7文字）
test('SC-A04: パスワード7文字 → フィールドエラー', async ({ page }) => {
  await gotoAdmin(page);
  await page.locator('#add-userid').fill('validuser');
  await page.locator('#add-password').fill('Short1!');  // 7文字
  await page.locator('.card').filter({ hasText: 'ユーザー追加' }).locator('button').click();

  await expect(page.locator('#err-add-password')).toBeVisible();
  await expect(page.locator('#err-add-password')).toContainText('8〜32文字');
});

// ============================================================
// ロック管理
// ============================================================

// SC-A05: 手動ロック
test('SC-A05: 手動ロック → ロック中バッジ表示', async ({ page, request }) => {
  await request.delete(`/api/users/${LOCK_USER.userId}`);
  await request.post('/api/users', { data: LOCK_USER });
  await gotoAdmin(page);

  await expect(userRow(page, LOCK_USER.userId)).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await userRow(page, LOCK_USER.userId).getByRole('button', { name: 'ロックする' }).click();

  await expect(page.locator('#list-alert-success')).toBeVisible({ timeout: 10000 });
  await expect(userRow(page, LOCK_USER.userId).locator('.badge-locked')).toBeVisible({ timeout: 10000 });
});

// SC-A06: ロック解除
test('SC-A06: ロック解除 → 有効バッジ表示', async ({ page, request }) => {
  await request.delete(`/api/users/${LOCK_USER.userId}`);
  await request.post('/api/users', { data: LOCK_USER });
  await request.put(`/api/users/${LOCK_USER.userId}`, { data: { lock: true } });
  await gotoAdmin(page);

  await expect(userRow(page, LOCK_USER.userId)).toBeVisible();
  await userRow(page, LOCK_USER.userId).getByRole('button', { name: 'ロック解除' }).click();

  await expect(page.locator('#list-alert-success')).toBeVisible({ timeout: 10000 });
  await expect(userRow(page, LOCK_USER.userId).locator('.badge-active')).toBeVisible({ timeout: 10000 });
});

// ============================================================
// パスワード管理
// ============================================================

// SC-A07: パスワード変更要求
test('SC-A07: PW変更要求 → 成功メッセージ', async ({ page, request }) => {
  await request.delete(`/api/users/${LOCK_USER.userId}`);
  await request.post('/api/users', { data: LOCK_USER });
  await gotoAdmin(page);

  await expect(userRow(page, LOCK_USER.userId)).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await userRow(page, LOCK_USER.userId).getByRole('button', { name: 'PW変更要求' }).click();

  await expect(page.locator('#list-alert-success')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#list-alert-success')).toContainText('にパスワード変更を要求しました');
});

// SC-A08: パスワードリセット（管理者操作）
test('SC-A08: パスワードリセット → モーダル操作 → 閉じる', async ({ page, request }) => {
  await request.delete(`/api/users/${LOCK_USER.userId}`);
  await request.post('/api/users', { data: LOCK_USER });
  await gotoAdmin(page);

  await expect(userRow(page, LOCK_USER.userId)).toBeVisible();
  await userRow(page, LOCK_USER.userId).getByRole('button', { name: 'PW変更', exact: true }).click();

  await expect(page.locator('#pw-modal')).toBeVisible();
  await expect(page.locator('#pw-modal-userid')).toContainText(LOCK_USER.userId);
  await page.locator('#pw-modal-input').fill('NewP@ss001');
  await page.locator('#pw-modal').getByRole('button', { name: '変更する' }).click();

  await expect(page.locator('#pw-modal')).not.toBeVisible({ timeout: 10000 });
});

// ============================================================
// アカウント有効/無効
// ============================================================

// SC-A09: ユーザー無効化
test('SC-A09: ユーザー無効化 → 無効バッジ表示', async ({ page, request }) => {
  await request.delete(`/api/users/${LOCK_USER.userId}`);
  await request.post('/api/users', { data: LOCK_USER });
  await gotoAdmin(page);

  await expect(userRow(page, LOCK_USER.userId)).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await userRow(page, LOCK_USER.userId).getByRole('button', { name: '無効化' }).click();

  await expect(userRow(page, LOCK_USER.userId).locator('.badge-inactive')).toBeVisible({ timeout: 10000 });
});

// SC-A10: ユーザー有効化
test('SC-A10: ユーザー有効化 → 有効バッジ表示', async ({ page, request }) => {
  await request.delete(`/api/users/${LOCK_USER.userId}`);
  await request.post('/api/users', { data: LOCK_USER });
  await request.put(`/api/users/${LOCK_USER.userId}`, { data: { isActive: false } });
  await gotoAdmin(page);

  await expect(userRow(page, LOCK_USER.userId)).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await userRow(page, LOCK_USER.userId).getByRole('button', { name: '有効化' }).click();

  await expect(userRow(page, LOCK_USER.userId).locator('.badge-active')).toBeVisible({ timeout: 10000 });
});

// ============================================================
// ユーザー削除
// ============================================================

// ============================================================
// 管理者アカウント保護
// ============================================================

// TC-A06 / SC-ADM-03: 管理者バッジ表示・操作ボタン非表示
test('TC-A06 / SC-ADM-03: admin行に管理者バッジ・削除/ロック/無効化ボタン非表示', async ({ page, request }) => {
  await gotoAdmin(page);

  const adminRow = page.locator('#user-tbody tr').filter({
    has: page.locator('td:first-child').filter({ hasText: /^admin$/ }),
  });
  const rowCount = await adminRow.count();
  // admin ユーザーが未登録の場合はスキップ
  test.skip(rowCount === 0, 'admin ユーザーが未登録。EC2上で node init-db.js を実行してください。');

  await expect(adminRow).toBeVisible();
  await expect(adminRow.locator('.badge-admin')).toBeVisible();
  await expect(adminRow.getByRole('button', { name: '削除' })).not.toBeVisible();
  await expect(adminRow.getByRole('button', { name: 'ロックする' })).not.toBeVisible();
  await expect(adminRow.getByRole('button', { name: '無効化' })).not.toBeVisible();
});

// TC-A05 / SC-ADM-02: 管理者パスワード変更 → 新パスワードでログイン成功
// パスワードを変更してから元に戻すため serial で実行
test.describe.serial('TC-A05: 管理者パスワード変更', () => {
  test('SC-ADM-02: 管理者PWを変更 → 成功メッセージ → 新PWでログイン成功', async ({ page, request }) => {
    // admin ユーザーが未登録の場合はスキップ
    const usersRes = await request.get('/api/users');
    const usersJson = await usersRes.json();
    const adminExists = usersJson.data?.some(u => u.user_id === 'admin');
    test.skip(!adminExists, 'admin ユーザーが未登録。EC2上で node init-db.js を実行してください。');

    // gotoAdmin は serial describe で不安定なため直接ナビゲート
    await page.goto('/admin.html');
    await page.waitForSelector('#admin-pw-input', { timeout: 10000 });

    await page.locator('#admin-pw-input').fill(ADMIN_NEW_PW);
    await page.locator('.card').filter({ hasText: '管理者パスワード変更' })
      .getByRole('button', { name: '変更する' }).click();

    await expect(page.locator('#admin-pw-alert-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#admin-pw-alert-success')).toContainText('変更しました');

    // 新パスワードでログインできることを確認
    await page.goto('/index.html');
    await expect(page.locator('#screen-login')).toBeVisible();
    await page.locator('#user-id').fill(ADMIN.userId);
    await page.locator('#password').fill(ADMIN_NEW_PW);
    await page.locator('#btn-login').click();

    await page.waitForURL('**/admin.html', { timeout: 10000 });
    await expect(page).toHaveURL(/admin\.html/);
  });

  test.afterAll(async ({ request }) => {
    // 元のパスワードに戻す
    await request.put('/api/admin/password', { data: { password: ADMIN.password } });
  });
});

// SC-A11: ユーザー削除
test('SC-A11: ユーザー削除 → 一覧から消える', async ({ page, request }) => {
  await request.delete(`/api/users/${DEL_USER.userId}`);
  await request.post('/api/users', { data: DEL_USER });
  await gotoAdmin(page);

  await expect(userRow(page, DEL_USER.userId)).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await userRow(page, DEL_USER.userId).getByRole('button', { name: '削除' }).click();

  await expect(page.locator('#list-alert-success')).toBeVisible({ timeout: 10000 });
  await expect(userRow(page, DEL_USER.userId)).not.toBeVisible({ timeout: 10000 });
});
