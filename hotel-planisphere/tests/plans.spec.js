'use strict';
/**
 * E2E テスト — 宿泊プラン一覧画面 (plans.html)
 * TC-P01〜TC-P05
 *
 * 設計技法:
 *   状態遷移: 未ログイン → 一般会員ログイン → プレミアム会員ログイン
 *   データ検証: 各ログイン状態ごとのプラン表示件数と特定プラン名の表示/非表示
 *
 * 仕様（data/ja/plan_data.json より）:
 *   未ログイン  → 7件 (制限なし: 0,4,5,6,7,8,9)
 *   一般会員    → 9件 (+ 一般会員限定: 2,3)
 *   プレミアム  → 10件 (+ プレミアム限定: 1)
 *
 * TC-P01: 未ログイン → 7件表示、プレミアム/一般会員専用プランは非表示
 * TC-P02: 一般会員ログイン → 9件表示、一般会員プランが追加
 * TC-P03: プレミアム会員ログイン → 10件表示、プレミアムプランが追加
 * TC-P04: ログイン後のナビゲーション表示確認
 * TC-P05: 「このプランで予約」クリック → 新タブで reserve.html が開く
 */
const { test, expect } = require('@playwright/test');
const { setupPresetLoggedIn, PRESET_ICHIRO, PRESET_SAKURA } = require('./helpers');

// plans.html のプラン予約リンクセレクタ
const BOOKING_LINK = 'a.btn:has-text("このプランで予約")';

// ============================================================
// TC-P01: 未ログイン → 7件表示
// ============================================================
test('TC-P01: 未ログイン → 7件のプランが表示される（プレミアム・一般会員専用なし）', async ({ page }) => {
  await page.goto('plans.html');
  await page.waitForLoadState('networkidle');

  // プラン件数: 7件（制限なしプランのみ）
  await expect(page.locator(BOOKING_LINK)).toHaveCount(7, { timeout: 10000 });

  // 制限なしプランは表示される
  await expect(page.getByText('お得な特典付きプラン')).toBeVisible();
  await expect(page.getByText('素泊まり')).toBeVisible();
  await expect(page.getByText('出張ビジネスプラン')).toBeVisible();

  // プレミアム会員限定プランは非表示
  await expect(page.getByText('プレミアムプラン')).not.toBeVisible();
  // 一般会員限定プランは非表示
  await expect(page.getByText('ディナー付きプラン')).not.toBeVisible();
  await expect(page.getByText('お得なプラン').first()).not.toBeVisible();

  // 未ログイン状態: ログイン・会員登録リンクが表示
  await expect(page.locator('#login-holder')).toBeVisible();
  await expect(page.locator('#signup-holder')).toBeVisible();
});

// ============================================================
// TC-P02: 一般会員ログイン → 9件表示
// ============================================================
test('TC-P02: 一般会員ログイン → 9件表示（一般会員プランが追加される）', async ({ page }) => {
  await setupPresetLoggedIn(page, PRESET_SAKURA);
  await page.goto('plans.html');
  await page.waitForLoadState('networkidle');

  // プラン件数: 9件（制限なし7件 + 一般会員限定2件）
  await expect(page.locator(BOOKING_LINK)).toHaveCount(9, { timeout: 10000 });

  // 一般会員限定プランが追加表示される
  await expect(page.getByText('ディナー付きプラン')).toBeVisible();
  await expect(page.getByText('お得なプラン').first()).toBeVisible();

  // プレミアム会員限定プランはまだ非表示
  await expect(page.getByText('プレミアムプラン')).not.toBeVisible();

  // ログイン済みナビゲーション
  await expect(page.locator('#logout-holder')).toBeVisible();
  await expect(page.locator('#mypage-holder')).toBeVisible();
});

// ============================================================
// TC-P03: プレミアム会員ログイン → 10件表示
// ============================================================
test('TC-P03: プレミアム会員ログイン → 10件表示（プレミアムプランが追加される）', async ({ page }) => {
  await setupPresetLoggedIn(page, PRESET_ICHIRO);
  await page.goto('plans.html');
  await page.waitForLoadState('networkidle');

  // プラン件数: 10件（全プラン）
  await expect(page.locator(BOOKING_LINK)).toHaveCount(10, { timeout: 10000 });

  // プレミアム会員限定プランが表示される
  await expect(page.getByText('プレミアムプラン')).toBeVisible();

  // 一般会員限定プランもプレミアム会員は閲覧可能
  await expect(page.getByText('ディナー付きプラン')).toBeVisible();
  await expect(page.getByText('お得なプラン').first()).toBeVisible();
});

// ============================================================
// TC-P04: ログイン後のナビゲーション表示確認
// ============================================================
test('TC-P04: ログイン後 → マイページ・ログアウトが表示される', async ({ page }) => {
  await setupPresetLoggedIn(page, PRESET_SAKURA);
  await page.goto('plans.html');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('#logout-holder')).toBeVisible();
  await expect(page.locator('#mypage-holder')).toBeVisible();
  // 未ログイン用リンクは非表示
  await expect(page.locator('#login-holder')).not.toBeVisible();
  await expect(page.locator('#signup-holder')).not.toBeVisible();
});

// ============================================================
// TC-P05: 「このプランで予約」→ 新タブで reserve.html が開く
// ============================================================
test('TC-P05: 「このプランで予約」→ 新タブで予約フォームへ遷移', async ({ page }) => {
  await page.goto('plans.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator(BOOKING_LINK).first()).toBeVisible({ timeout: 10000 });

  const [newPage] = await Promise.all([
    page.context().waitForEvent('page'),
    page.locator(BOOKING_LINK).first().click(),
  ]);

  await expect(newPage).toHaveURL(/reserve\.html/);
  await newPage.close();
});
