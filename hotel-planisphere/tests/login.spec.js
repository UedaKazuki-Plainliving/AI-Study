'use strict';
/**
 * E2E テスト — ログイン画面 (login.html)
 * TC-L01〜TC-L05
 *
 * 設計技法:
 *   デシジョンテーブル: メールアドレス × パスワード の入力状態と期待結果
 *   同値分割: 正常 / メールなし / パスワードなし / パスワード誤り / 未登録メール
 *
 * TC-L01: プリセットユーザー (ichiro/password) で正常ログイン
 * TC-L02: メールアドレス未入力 → エラー
 * TC-L03: パスワード未入力 → エラー
 * TC-L04: 正しいメール + 誤パスワード → 認証エラー
 * TC-L05: 未登録メールアドレス → 認証エラー
 */
const { test, expect } = require('@playwright/test');
const { PRESET_ICHIRO } = require('./helpers');

test.beforeEach(async ({ page }) => {
  // サイト初期化 → プリセットユーザーが localStorage に自動登録される
  await page.goto('');
});

// TC-L01: プリセットユーザー (ichiro / password) で正常ログイン
test('TC-L01: プリセットユーザーで正常ログイン → マイページへ遷移', async ({ page }) => {
  await page.goto('login.html');
  await page.locator('#email').fill(PRESET_ICHIRO.email);
  await page.locator('#password').fill(PRESET_ICHIRO.password);
  await page.locator('#login-button').click();

  await expect(page).toHaveURL(/mypage\.html/);
});

// TC-L02: メールアドレス未入力 → #email-message が表示される
test('TC-L02: メールアドレス未入力 → エラー表示', async ({ page }) => {
  await page.goto('login.html');
  await page.locator('#password').fill(PRESET_ICHIRO.password);
  await page.locator('#login-button').click();

  await expect(page.locator('#email-message')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});

// TC-L03: パスワード未入力 → #password-message が表示される
test('TC-L03: パスワード未入力 → エラー表示', async ({ page }) => {
  await page.goto('login.html');
  await page.locator('#email').fill(PRESET_ICHIRO.email);
  await page.locator('#login-button').click();

  await expect(page.locator('#password-message')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});

// TC-L04: 正しいメール + 誤パスワード → 認証エラー（両フィールドにエラー）
test('TC-L04: 誤ったパスワード → 認証エラー表示', async ({ page }) => {
  await page.goto('login.html');
  await page.locator('#email').fill(PRESET_ICHIRO.email);
  await page.locator('#password').fill('WrongPassword9');
  await page.locator('#login-button').click();

  await expect(page.locator('#email-message')).toBeVisible();
  await expect(page.locator('#password-message')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});

// TC-L05: 未登録メールアドレス → 認証エラー（両フィールドにエラー）
test('TC-L05: 未登録メールアドレス → 認証エラー表示', async ({ page }) => {
  await page.goto('login.html');
  await page.locator('#email').fill('notregistered@example.com');
  await page.locator('#password').fill('Test1234');
  await page.locator('#login-button').click();

  await expect(page.locator('#email-message')).toBeVisible();
  await expect(page.locator('#password-message')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});
