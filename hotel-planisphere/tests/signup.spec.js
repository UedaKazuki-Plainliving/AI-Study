'use strict';
/**
 * E2E テスト — 会員登録画面 (signup.html)
 * TC-S01〜TC-S10
 *
 * 設計技法:
 *   境界値分析: パスワード長 (7文字=NG, 8文字=OK)
 *               電話番号桁数 (10桁=NG, 11桁=OK)
 *   同値分割: 正常系 / 必須未入力 / 形式不正 / 重複
 *
 * TC-S01: 必須項目のみで正常登録
 * TC-S02: 全項目入力で正常登録
 * TC-S03: メールアドレス未入力 → エラー
 * TC-S04: パスワード 7 文字（最小値-1）→ エラー
 * TC-S05: パスワード 8 文字（最小値=OK）→ 成功
 * TC-S06: パスワード確認不一致 → エラー
 * TC-S07: 氏名未入力 → エラー
 * TC-S08: 電話番号 10 桁（11桁-1）→ エラー
 * TC-S09: 電話番号 11 桁（最小値=OK）→ 成功
 * TC-S10: 重複メールアドレス → エラー
 */
const { test, expect } = require('@playwright/test');
const { injectUser } = require('./helpers');

function uniqueEmail(prefix = 'user') {
  return `${prefix}_${Date.now()}@example.com`;
}

// TC-S01: 必須項目のみで正常登録 → マイページへ遷移
test('TC-S01: 必須項目のみで正常登録 → マイページへ遷移', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#email').fill(uniqueEmail('s01'));
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Test1234');
  await page.locator('#username').fill('登録太郎');
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page).toHaveURL(/mypage\.html/);
});

// TC-S02: 全項目入力で正常登録 → マイページへ遷移
test('TC-S02: 全項目入力で正常登録 → マイページへ遷移', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#email').fill(uniqueEmail('s02'));
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Test1234');
  await page.locator('#username').fill('全項目花子');
  await page.locator('#rank-premium').check();
  await page.locator('#address').fill('東京都千代田区1-1-1');
  await page.locator('#tel').fill('01234567890');
  await page.locator('#gender').selectOption('2');  // 女性
  await page.locator('#birthday').fill('1990-01-01');
  await page.locator('#notification').check();
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page).toHaveURL(/mypage\.html/);
});

// TC-S03: メールアドレス未入力 → エラー表示
test('TC-S03: メールアドレス未入力 → エラー表示', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Test1234');
  await page.locator('#username').fill('テスト太郎');
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page.locator('#email ~ .invalid-feedback')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});

// TC-S04: パスワード 7 文字（境界値-1）→ エラー表示
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

// TC-S05: パスワード 8 文字（境界値=OK）→ エラーなし・マイページへ遷移
test('TC-S05: パスワード8文字（最小値）→ エラーなし', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#email').fill(uniqueEmail('s05'));
  await page.locator('#password').fill('Test1234');      // 8文字
  await page.locator('#password-confirmation').fill('Test1234');
  await page.locator('#username').fill('テスト太郎');
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page).toHaveURL(/mypage\.html/);
});

// TC-S06: パスワード確認不一致 → エラー表示
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

// TC-S07: 氏名未入力 → エラー表示
test('TC-S07: 氏名未入力 → エラー表示', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#email').fill(uniqueEmail('s07'));
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Test1234');
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page.locator('#username ~ .invalid-feedback')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});

// TC-S08: 電話番号 10 桁（境界値-1）→ エラー表示
test('TC-S08: 電話番号10桁（11桁-1）→ エラー表示', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#email').fill(uniqueEmail('s08'));
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Test1234');
  await page.locator('#username').fill('テスト太郎');
  await page.locator('#tel').fill('0123456789');         // 10桁
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page.locator('#tel ~ .invalid-feedback')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});

// TC-S09: 電話番号 11 桁（境界値=OK）→ エラーなし・マイページへ遷移
test('TC-S09: 電話番号11桁（最小値）→ エラーなし', async ({ page }) => {
  await page.goto('signup.html');
  await page.locator('#email').fill(uniqueEmail('s09'));
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Test1234');
  await page.locator('#username').fill('テスト太郎');
  await page.locator('#tel').fill('01234567890');        // 11桁
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page).toHaveURL(/mypage\.html/);
});

// TC-S10: 重複メールアドレス → エラー表示
test('TC-S10: 重複メールアドレス → エラー表示', async ({ page }) => {
  const dupEmail = uniqueEmail('s10');

  // 1回目: localStorage にユーザーを注入して既存ユーザーとして登録
  await page.goto('');
  await injectUser(page, {
    email: dupEmail,
    password: 'Test1234',
    name: '既存ユーザー',
    rank: 'normal',
  });

  // 2回目: 同じメールアドレスで登録試行
  await page.goto('signup.html');
  await page.locator('#email').fill(dupEmail);
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Test1234');
  await page.locator('#username').fill('重複ユーザー');
  await page.getByRole('button', { name: '登録' }).click();

  await expect(page.locator('#email ~ .invalid-feedback')).toBeVisible();
  await expect(page).not.toHaveURL(/mypage\.html/);
});
