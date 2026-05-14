'use strict';
/**
 * E2E テスト — ログイン画面 (login.html)
 * TC-L01〜TC-L05
 */
const { test, expect } = require('@playwright/test');
const { TEST_USER, injectUser } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await page.goto('');
  await injectUser(page);
});

// TC-L01: 正常ログイン
test('TC-L01: 正常ログイン → マイページへ遷移', async ({ page }) => {
  await page.goto('login.html');
  await page.locator('#email').fill(TEST_USER.email);
  await page.locator('#password').fill(TEST_USER.password);
  await page.locator('#login-button').click();

  await expect(page).toHaveURL(/mypage\.html/);
});

// TC-L02: メールアドレス未入力
test('TC-L02: メールアドレス未入力 → エラー表示', async ({ page }) => {
  await page.goto('login.html');
  await page.locator('#password').fill(TEST_USER.password);
  await page.locator('#login-button').click();

  await expect(page.locator('#email-message')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});

// TC-L03: パスワード未入力
test('TC-L03: パスワード未入力 → エラー表示', async ({ page }) => {
  await page.goto('login.html');
  await page.locator('#email').fill(TEST_USER.email);
  await page.locator('#login-button').click();

  await expect(page.locator('#password-message')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});

// TC-L04: 誤ったパスワード
test('TC-L04: 誤ったパスワード → 認証エラー表示', async ({ page }) => {
  await page.goto('login.html');
  await page.locator('#email').fill(TEST_USER.email);
  await page.locator('#password').fill('WrongPassword9');
  await page.locator('#login-button').click();

  await expect(page.locator('#email-message')).toBeVisible();
  await expect(page.locator('#password-message')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});

// TC-L05: 未登録メールアドレス
test('TC-L05: 未登録メールアドレス → 認証エラー表示', async ({ page }) => {
  await page.goto('login.html');
  await page.locator('#email').fill('notregistered@example.com');
  await page.locator('#password').fill(TEST_USER.password);
  await page.locator('#login-button').click();

  await expect(page.locator('#email-message')).toBeVisible();
  await expect(page.locator('#password-message')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});
