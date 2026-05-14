'use strict';
/**
 * E2E テスト — アイコン設定画面 (icon.html)
 * TC-I01〜TC-I03
 *
 * 設計技法:
 *   状態遷移: ログイン済み → アイコン設定 → localStorage 保存
 *             未ログイン → icon.html → リダイレクト
 *   扱いづらい要素の直接操作（about.html 明示）:
 *     <input type="range"> (#zoom)  - スライダー操作
 *     <input type="color"> (#color) - カラーピッカー操作
 *
 * icon.html の仕様（icon.js より）:
 *   確定後の保存形式: user.icon = { image: dataURL, width: zoomVal, height: zoomVal, color: colorVal }
 *   保存先: localStorage[user.email]（user オブジェクトにマージ）
 *   ページ遷移: なし（localStorage 保存のみ）
 *   zoom リセット値: 100 / color リセット値: #ffffff
 *
 * TC-I01: ログイン済みで icon.html へアクセス → アイコン設定フォームが表示される
 * TC-I02: 未ログインで icon.html へアクセス → index.html へリダイレクト
 * TC-I03: 画像・zoom・color を操作して確定 → localStorage に全フィールドが正しく保存される
 */
const { test, expect } = require('@playwright/test');
const { setupLoggedIn, TEST_USER } = require('./helpers');

// 1×1px の最小限 PNG（10KB 未満の有効な画像ファイル）
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// ============================================================
// TC-I01: ログイン済みで icon.html へアクセス → フォームが表示される
// ============================================================
test('TC-I01: ログイン済みで icon.html へアクセス → アイコン設定フォームが表示される', async ({ page }) => {
  await setupLoggedIn(page);
  await page.goto('icon.html');

  await expect(page.locator('#icon-form')).toBeVisible();
  await expect(page.locator('#icon')).toBeAttached();
  await expect(page.locator('#zoom')).toBeAttached();
  await expect(page.locator('#color')).toBeAttached();
  await expect(page.getByRole('button', { name: '確定' })).toBeVisible();
});

// ============================================================
// TC-I02: 未ログインで icon.html へアクセス → index.html へリダイレクト
// ============================================================
test('TC-I02: 未ログインで icon.html へアクセス → トップページへリダイレクト', async ({ page }) => {
  await page.goto('icon.html');

  await expect(page).toHaveURL(/index\.html/, { timeout: 5000 });
});

// ============================================================
// TC-I03: 画像・zoom・color を操作して確定 → localStorage に全フィールドが正しく保存される
// ============================================================
test('TC-I03: 画像・zoom・color を設定して確定 → localStorage にアイコンデータ全フィールドが保存される', async ({ page }) => {
  await setupLoggedIn(page);
  await page.goto('icon.html');
  await page.waitForLoadState('networkidle');

  // ── ファイル入力 ──
  // 注意（仕様）: #icon の change イベントで zoom=100/color=#ffffff に自動リセットされ
  //               かつ zoom/color が disabled → enabled に切り替わる。
  //               zoom・color の設定はファイル選択の「後」に行う必要がある。
  const pngBuffer = Buffer.from(TINY_PNG_BASE64, 'base64');
  await page.locator('#icon').setInputFiles({
    name: 'test-icon.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
  });

  // ファイル選択後、zoom/color が enabled になるまで待機
  await expect(page.locator('#zoom')).toBeEnabled({ timeout: 3000 });
  await expect(page.locator('#color')).toBeEnabled({ timeout: 3000 });

  // ── zoom (range) ── ファイル選択後のリセット(100)と異なる値を設定
  // about.html が「扱いづらい要素」と明示: evaluate で確実に値をセット
  // 注意: #zoom は min=0 max=100 の range 入力。128 等の範囲外値はブラウザが 100 にクランプするため、
  //       範囲内の値（例: 80）を使う必要がある。
  const zoomValue = 80;
  await page.locator('#zoom').evaluate((el, val) => {
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, String(zoomValue));

  // ── color ── ファイル選択後のリセット(#ffffff)と異なる値を設定
  // about.html が「扱いづらい要素」と明示
  const colorValue = '#ff0000';
  await page.locator('#color').evaluate((el, val) => {
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, colorValue);

  // ── 確定 ──
  await page.getByRole('button', { name: '確定' }).click();

  // FileReader は非同期 → localStorage 保存完了を待機（最大 5 秒）
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

  // ── 保存内容を検証 ──
  const iconData = await page.evaluate((email) => {
    const data = JSON.parse(localStorage.getItem(email) || '{}');
    return data.icon ?? null;
  }, TEST_USER.email);

  // 全フィールドが保存されている
  expect(iconData).not.toBeNull();
  expect(iconData.image).toMatch(/^data:image\//);   // Base64 データ URL
  expect(iconData.width).toBe(zoomValue);            // zoom 値が width に反映
  expect(iconData.height).toBe(zoomValue);           // zoom 値が height に反映
  expect(iconData.color).toBe(colorValue);           // color 値が反映
});
