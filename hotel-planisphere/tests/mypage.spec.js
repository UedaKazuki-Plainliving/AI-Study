'use strict';
/**
 * E2E テスト — マイページ (mypage.html)
 * TC-M01〜TC-M04
 */
const { test, expect } = require('@playwright/test');
const { TEST_USER, setupLoggedIn, signupUser } = require('./helpers');

// TC-M01: ログイン後にマイページで登録情報が表示される
test('TC-M01: ログイン後 → 登録情報がマイページに表示される', async ({ page }) => {
  await setupLoggedIn(page);
  await page.goto('mypage.html');

  await expect(page.getByText(TEST_USER.email)).toBeVisible();
  await expect(page.getByText(TEST_USER.name)).toBeVisible();
});

// TC-M02: ログアウト → ログイン画面へ遷移
test('TC-M02: ログアウト → ログイン画面へ遷移', async ({ page }) => {
  await setupLoggedIn(page);
  await page.goto('mypage.html');

  await page.getByRole('button', { name: 'ログアウト' }).click();

  await expect(page).toHaveURL(/index\.html/);
});

// TC-M03: 未ログイン状態でマイページへアクセス → トップページへリダイレクト
test('TC-M03: 未ログインでマイページアクセス → トップページへリダイレクト', async ({ page }) => {
  await page.goto('mypage.html');

  await expect(page).toHaveURL(/index\.html/, { timeout: 5000 });
});

// TC-M04: 退会する → ログイン画面へ遷移しユーザーデータが消える
test('TC-M04: 退会する → ログイン画面へ遷移', async ({ page }) => {
  // signup UIでユーザー作成（退会するとデータが消えるため専用ユーザーを使用）
  await signupUser(page, {
    email: `withdraw_${Date.now()}@example.com`,
    password: 'Test1234',
    name: '退会テスト',
    rank: 'normal',
  });
  await page.goto('mypage.html');

  // 退会ボタンをクリック（確認ダイアログがある場合は承認）
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '退会する' }).click();

  await expect(page).toHaveURL(/index\.html|login\.html/, { timeout: 10000 });
});
