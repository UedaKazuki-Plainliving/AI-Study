'use strict';
/**
 * E2E テスト — マイページ (mypage.html)
 * TC-M01〜TC-M07
 *
 * 設計技法:
 *   状態遷移: ログイン → ログアウト → index.html
 *             ログイン → 退会 → confirm+alert → index.html → ログイン不可
 *   条件分岐: user.preset フラグによるボタン有効/無効
 *   データ検証: アイコン設定後にマイページへ画像が反映される
 *
 * 退会ダイアログ仕様（data/ja/message.json より）:
 *   1件目 confirm: "退会すると全ての情報が削除されます。\nよろしいですか？"
 *   2件目 alert:   "退会処理を完了しました。ご利用ありがとうございました。"
 *
 * ボタン有効化条件（mypage.js より）:
 *   !user.preset === true → 退会・アイコン設定が有効
 *   プリセットユーザー (ichiro 等) は user.preset = true → 無効のまま
 *
 * TC-M01: ログイン後 → 登録情報がマイページに表示される
 * TC-M02: ログアウト → index.html へ遷移
 * TC-M03: 未ログインアクセス → index.html へリダイレクト
 * TC-M04: 退会 → confirm+alert 両ダイアログが正しいメッセージで表示され index.html へ遷移
 * TC-M05: 退会後 → 同メールアドレスでログインできない
 * TC-M06: プリセットユーザー → 退会ボタン・アイコン設定リンクが無効化されている
 * TC-M07: アイコン設定後 → マイページで画像が表示される
 */
const { test, expect } = require('@playwright/test');
const {
  TEST_USER,
  PRESET_ICHIRO,
  setupLoggedIn,
  setupPresetLoggedIn,
  signupUser,
} = require('./helpers');

// 1×1px の最小限 PNG
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// ============================================================
// TC-M01: ログイン後 → 登録情報が表示される
// ============================================================
test('TC-M01: ログイン後 → 登録情報がマイページに表示される', async ({ page }) => {
  await setupPresetLoggedIn(page, PRESET_ICHIRO);
  await page.goto('mypage.html');

  await expect(page.getByText(PRESET_ICHIRO.email)).toBeVisible();
  await expect(page.getByText(PRESET_ICHIRO.name)).toBeVisible();
});

// ============================================================
// TC-M02: ログアウト → index.html へ遷移
// ============================================================
test('TC-M02: ログアウト → ログイン画面へ遷移', async ({ page }) => {
  await setupLoggedIn(page);
  await page.goto('mypage.html');

  await page.getByRole('button', { name: 'ログアウト' }).click();

  await expect(page).toHaveURL(/index\.html/);
});

// ============================================================
// TC-M03: 未ログインアクセス → index.html へリダイレクト
// ============================================================
test('TC-M03: 未ログインでマイページアクセス → トップページへリダイレクト', async ({ page }) => {
  await page.goto('mypage.html');

  await expect(page).toHaveURL(/index\.html/, { timeout: 5000 });
});

// ============================================================
// TC-M04: 退会 → confirm+alert 両ダイアログ検証 → index.html へ遷移
// ============================================================
test('TC-M04: 退会 → confirm・alert 両ダイアログが正しいメッセージで表示される', async ({ page }) => {
  await signupUser(page, {
    email: `withdraw_${Date.now()}@example.com`,
    password: 'Test1234',
    name: '退会テスト',
    rank: 'normal',
  });
  await page.goto('mypage.html');

  // すべてのダイアログを記録しながら accept する
  const dialogs = [];
  page.on('dialog', (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    dialog.accept();
  });

  await page.getByRole('button', { name: '退会する' }).click();
  await expect(page).toHaveURL(/index\.html|login\.html/, { timeout: 10000 });

  // confirm → alert の順に 2件表示される
  expect(dialogs).toHaveLength(2);

  // 1件目: confirm ダイアログ
  expect(dialogs[0].type).toBe('confirm');
  expect(dialogs[0].message).toContain('退会すると全ての情報が削除されます');

  // 2件目: alert ダイアログ（退会完了）
  expect(dialogs[1].type).toBe('alert');
  expect(dialogs[1].message).toBe('退会処理を完了しました。ご利用ありがとうございました。');
});

// ============================================================
// TC-M05: 退会後 → 同メールアドレスでログインできない
// ============================================================
test('TC-M05: 退会後 → 同メールアドレスでのログインが失敗する', async ({ page }) => {
  const withdrawEmail = `withdraw_check_${Date.now()}@example.com`;
  const withdrawPassword = 'Test1234';

  await signupUser(page, {
    email: withdrawEmail,
    password: withdrawPassword,
    name: '退会確認テスト',
    rank: 'normal',
  });
  await page.goto('mypage.html');

  // 両ダイアログを accept して退会完了
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '退会する' }).click();
  await expect(page).toHaveURL(/index\.html|login\.html/, { timeout: 10000 });

  // 退会後に同じ認証情報でログイン試行 → 失敗
  await page.goto('login.html');
  await page.locator('#email').fill(withdrawEmail);
  await page.locator('#password').fill(withdrawPassword);
  await page.locator('#login-button').click();

  await expect(page).not.toHaveURL(/mypage\.html/);
  await expect(page.locator('#email-message')).toBeVisible();
});

// ============================================================
// TC-M06: プリセットユーザー → 退会・アイコン設定が無効化されている
// ============================================================
test('TC-M06: プリセットユーザー → 退会ボタン・アイコン設定リンクが無効化されている', async ({ page }) => {
  // ichiro は user.preset = true → !user.preset = false → ボタンは有効化されない
  await setupPresetLoggedIn(page, PRESET_ICHIRO);
  await page.goto('mypage.html');

  // 退会ボタンが disabled
  await expect(page.getByRole('button', { name: '退会する' })).toBeDisabled();

  // アイコン設定リンクが disabled クラスを持ち操作不可
  await expect(page.locator('#icon-link')).toHaveClass(/disabled/);
});

// ============================================================
// TC-M07: アイコン設定後 → マイページで画像が表示される
// ============================================================
test('TC-M07: アイコン設定後 → マイページの #icon-holder に画像が表示される', async ({ page }) => {
  await setupLoggedIn(page);

  // icon.html で画像をアップロードして確定
  await page.goto('icon.html');
  await page.waitForLoadState('networkidle');

  const pngBuffer = Buffer.from(TINY_PNG_BASE64, 'base64');
  await page.locator('#icon').setInputFiles({
    name: 'test-icon.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
  });
  await page.getByRole('button', { name: '確定' }).click();

  // FileReader 非同期処理完了を待機
  await page.waitForFunction(
    (email) => {
      try {
        const data = JSON.parse(localStorage.getItem(email) || '{}');
        return !!(data.icon && data.icon.image);
      } catch {
        return false;
      }
    },
    TEST_USER.email,
    { timeout: 5000 },
  );

  // マイページへ遷移してアイコン画像が表示される
  await page.goto('mypage.html');
  await expect(page.locator('#icon-holder img')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#icon-holder img')).toHaveClass(/img-thumbnail/);
});
