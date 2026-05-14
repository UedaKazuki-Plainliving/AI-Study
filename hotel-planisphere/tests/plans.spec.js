'use strict';
/**
 * E2E テスト — 宿泊プラン一覧画面 (plans.html)
 * TC-P01〜TC-P04
 */
const { test, expect } = require('@playwright/test');
const { setupLoggedIn, PREMIUM_USER } = require('./helpers');

// TC-P01: 未ログイン状態でプラン一覧表示
test('TC-P01: 未ログイン → プラン一覧が表示される', async ({ page }) => {
  await page.goto('plans.html');
  // プランカードが少なくとも1件表示される
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 });
  // ログイン・会員登録リンクが表示される
  await expect(page.locator('#login-holder')).toBeVisible();
  await expect(page.locator('#signup-holder')).toBeVisible();
});

// TC-P02: ログイン後にプラン一覧表示（会員向けプラン含む）
test('TC-P02: ログイン後 → 会員向けプランが追加表示される', async ({ page }) => {
  await setupLoggedIn(page);
  await page.goto('plans.html');

  await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 });
  // ログアウトボタンが表示される（ログイン済み確認）
  await expect(page.locator('#logout-holder')).toBeVisible();
  // ログイン後はマイページリンクが表示される
  await expect(page.locator('#mypage-holder')).toBeVisible();
});

// TC-P03: プレミアム会員でログイン → プレミアム限定プランが表示される
test('TC-P03: プレミアム会員ログイン → プレミアムプランが表示される', async ({ page }) => {
  await setupLoggedIn(page, PREMIUM_USER);
  await page.goto('plans.html');

  await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#logout-holder')).toBeVisible();
});

// TC-P04: 「このプランで予約」ボタンクリック → 予約画面へ遷移
test('TC-P04: 「このプランで予約」→ 予約フォームへ遷移', async ({ page }) => {
  await page.goto('plans.html');
  // 最初のプランカードの予約ボタンをクリック（新規タブが開く場合あり）
  const [newPage] = await Promise.all([
    page.context().waitForEvent('page'),
    page.locator('a.btn', { hasText: 'このプランで予約' }).first().click(),
  ]);
  await expect(newPage).toHaveURL(/reserve\.html/);
  await newPage.close();
});
