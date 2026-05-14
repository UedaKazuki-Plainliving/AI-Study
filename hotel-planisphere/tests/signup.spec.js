'use strict';
/**
 * E2E テスト — 会員登録画面 (signup.html)
 * TC-S01〜TC-S09
 */
const { test, expect } = require('@playwright/test');
const { injectUser } = require('./helpers');

function uniqueEmail(prefix = 'user') {
  return `${prefix}_${Date.now()}@example.com`;
}

// TC-S01: 必須項目のみで正常登録
test('TC-S01: 必須項目のみで正常登録 → マイページへ遷移', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#email').fill(uniqueEmail('s01'));
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Test1234');
  await page.locator('#username').fill('登録太郎');
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page).toHaveURL(/mypage\.html/);
});

// TC-S02: 全項目入力で正常登録
test('TC-S02: 全項目入力で正常登録 → マイページへ遷移', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#email').fill(uniqueEmail('s02'));
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Test1234');
  await page.locator('#username').fill('全項目花子');
  await page.locator('#rank-premium').check();
  await page.locator('#address').fill('東京都千代田区1-1-1');
  await page.locator('#tel').fill('01234567890');
  await page.locator('#gender').selectOption('2');  // 2 = 女性
  await page.locator('#birthday').fill('1990-01-01');
  await page.locator('#notification').check();
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page).toHaveURL(/mypage\.html/);
});

// TC-S03: メールアドレス未入力
test('TC-S03: メールアドレス未入力 → エラー表示', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Test1234');
  await page.locator('#username').fill('テスト太郎');
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page.locator('#email ~ .invalid-feedback')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});

// TC-S04: パスワード7文字（最小値-1）→ エラー
test('TC-S04: パスワード7文字（最小値-1）→ エラー表示', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#email').fill(uniqueEmail('s04'));
  await page.locator('#password').fill('Test123');       // 7文字
  await page.locator('#password-confirmation').fill('Test123');
  await page.locator('#username').fill('テスト太郎');
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page.locator('#password ~ .invalid-feedback')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});

// TC-S05: パスワード8文字（最小値）→ エラーなし
test('TC-S05: パスワード8文字（最小値）→ エラーなし', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#email').fill(uniqueEmail('s05'));
  await page.locator('#password').fill('Test1234');      // 8文字
  await page.locator('#password-confirmation').fill('Test1234');
  await page.locator('#username').fill('テスト太郎');
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page).toHaveURL(/mypage\.html/);
});

// TC-S06: パスワード確認不一致
test('TC-S06: パスワード確認不一致 → エラー表示', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#email').fill(uniqueEmail('s06'));
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Different9');
  await page.locator('#username').fill('テスト太郎');
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page.locator('#password-confirmation ~ .invalid-feedback')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});

// TC-S07: 氏名未入力
test('TC-S07: 氏名未入力 → エラー表示', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#email').fill(uniqueEmail('s07'));
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Test1234');
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page.locator('#username ~ .invalid-feedback')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});

// TC-S08: 電話番号10桁（最小値-1）→ エラー
test('TC-S08: 電話番号10桁（11桁-1）→ エラー表示', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#email').fill(uniqueEmail('s08'));
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Test1234');
  await page.locator('#username').fill('テスト太郎');
  await page.locator('#tel').fill('0123456789');        // 10桁
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page.locator('#tel ~ .invalid-feedback')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});

// TC-S09: 重複メールアドレス → エラー
test('TC-S09: 重複メールアドレス → エラー表示', async ({ page }) => {
  const dupEmail = uniqueEmail('s09');
  // 1回目の登録
  await page.goto('');
  await injectUser(page, {
    email: dupEmail,
    password: 'Test1234',
    name: '既存ユーザー',
    rank: 'normal',
  });

  // 同じメールアドレスで再登録試行
  await page.goto('signup.html');
  await page.locator('#email').fill(dupEmail);
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Test1234');
  await page.locator('#username').fill('重複ユーザー');
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page.locator('#email ~ .invalid-feedback')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});
