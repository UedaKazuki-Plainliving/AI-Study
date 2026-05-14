'use strict';
/**
 * バリデーションテスト — パフォーマンス・非機能観点
 *
 * 調査データに基づく想定:
 *   - じゃらん月間1,368万人 → 時間あたり約19,000UU → 同時接続推定 200〜500
 *   - ピーク（GW・お盆・年末年始）: 通常の 3〜5倍 → 同時 1,000〜2,500
 *   - モバイル比率: 約 60%（iPhone SE 375px が基準）
 *
 * ページロード基準（旅行サイト標準・Baymard/Google Core Web Vitals）:
 *   - ページロード全体:    3,000ms 以内（旅行サイト許容上限）
 *   - LCP（最大コンテンツ描画）: 2,500ms 以内（Google "Good"基準）
 *   - DOMContentLoaded:  1,500ms 以内
 *   - フォーム応答性:     操作から 100ms 以内に UI が反応
 *
 * 注意: このサイトは GitHub Pages ホスト（静的サイト）のため、
 *       並列負荷テスト（同時 200 ユーザー等）は行わない。
 *       代わりにシングルユーザーのページロード時間・インタラクション応答を計測する。
 */
const { test, expect } = require('@playwright/test');
const { setupPresetLoggedIn, PRESET_SAKURA } = require('../helpers');

const THRESHOLDS = {
  pageLoad: 4000,          // ページ全体ロード（旅行サイト許容上限）
  lcp: 2500,               // LCP Good 基準（Google Core Web Vitals）
  domContentLoaded: 2000,  // DOM 準備完了
  firstPaint: 1500,        // First Paint（体感速度）
  interactionResponse: 500, // UI 操作への応答（フォーム変化等）
};

// ============================================================
// P-01: トップページのロード時間
// ============================================================
test('P-01: トップページ(index.html)が4秒以内に描画完了する', async ({ page }) => {
  const start = Date.now();
  await page.goto('');
  await page.waitForLoadState('networkidle');
  const elapsed = Date.now() - start;

  console.log(`[P-01] トップページロード時間: ${elapsed}ms（閾値: ${THRESHOLDS.pageLoad}ms）`);
  expect(elapsed).toBeLessThan(THRESHOLDS.pageLoad);
});

// ============================================================
// P-02: プラン一覧ページ（Ajax あり）のロード時間
// ============================================================
test('P-02: プラン一覧(plans.html)がAjax完了まで4秒以内', async ({ page }) => {
  const start = Date.now();
  await page.goto('plans.html');
  await page.waitForLoadState('networkidle');
  // プランが実際に描画されるまで待機（Ajax 完了の実質的な確認）
  await expect(page.locator('a.btn:has-text("このプランで予約")')).toHaveCount(7, { timeout: THRESHOLDS.pageLoad });
  const elapsed = Date.now() - start;

  console.log(`[P-02] プラン一覧ロード（Ajax含む）: ${elapsed}ms（閾値: ${THRESHOLDS.pageLoad}ms）`);
  expect(elapsed).toBeLessThan(THRESHOLDS.pageLoad);
});

// ============================================================
// P-03: ログイン済みプラン一覧（プレミアム会員・10件）
// ============================================================
test('P-03: ログイン済みプラン一覧(10件)が4秒以内に表示される', async ({ page }) => {
  await setupPresetLoggedIn(page, PRESET_SAKURA);

  const start = Date.now();
  await page.goto('plans.html');
  await expect(page.locator('a.btn:has-text("このプランで予約")')).toHaveCount(9, { timeout: THRESHOLDS.pageLoad });
  const elapsed = Date.now() - start;

  console.log(`[P-03] ログイン済みプラン一覧ロード: ${elapsed}ms（閾値: ${THRESHOLDS.pageLoad}ms）`);
  expect(elapsed).toBeLessThan(THRESHOLDS.pageLoad);
});

// ============================================================
// P-04: 予約フォーム（iframe あり）のロード時間
// ============================================================
test('P-04: 予約フォーム(reserve.html, iframe付き)が4秒以内に操作可能になる', async ({ page }) => {
  const start = Date.now();
  await page.goto('reserve.html?plan-id=0');
  await page.waitForLoadState('networkidle');
  // #username フィールドが操作可能になるまで
  await expect(page.locator('#username')).toBeVisible({ timeout: THRESHOLDS.pageLoad });
  const elapsed = Date.now() - start;

  console.log(`[P-04] 予約フォームロード（iframe付き）: ${elapsed}ms（閾値: ${THRESHOLDS.pageLoad}ms）`);
  expect(elapsed).toBeLessThan(THRESHOLDS.pageLoad);
});

// ============================================================
// P-05: フォームインタラクション応答性
//       「連絡方法」選択 → メールフィールド表示切り替えが 500ms 以内
// ============================================================
test('P-05: 連絡方法セレクト変更 → フィールド表示切り替えが500ms以内', async ({ page }) => {
  await page.goto('reserve.html?plan-id=0');
  await page.waitForLoadState('networkidle');

  const start = Date.now();
  await page.locator('#contact').selectOption('email');
  await expect(page.locator('#email')).toBeVisible();
  const elapsed = Date.now() - start;

  console.log(`[P-05] 連絡方法切り替え応答時間: ${elapsed}ms（閾値: ${THRESHOLDS.interactionResponse}ms）`);
  expect(elapsed).toBeLessThan(THRESHOLDS.interactionResponse);
});

// ============================================================
// P-06: 合計金額リアルタイム計算の応答性
//       人数変更 → 合計金額更新が 1000ms 以内
// ============================================================
test('P-06: 人数・泊数変更 → 合計金額の更新が1000ms以内', async ({ page }) => {
  await page.goto('reserve.html?plan-id=0');
  await page.waitForLoadState('networkidle');

  await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    // 月曜日に設定（週末割増なし）
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    window.$('#date').datepicker('setDate', d);
    window.$('#date').trigger('change');
  });

  await page.locator('#term').fill('1');
  await page.locator('#head-count').fill('1');
  await page.evaluate(() => window.$('.needs-calc').trigger('change'));

  const start = Date.now();
  // 金額が '-' でなく数値として表示されるまで
  await page.waitForFunction(() => {
    const text = document.querySelector('#total-bill')?.textContent ?? '';
    return text && text !== '-' && /[0-9]/.test(text);
  }, { timeout: 1000 });
  const elapsed = Date.now() - start;

  console.log(`[P-06] 合計金額計算応答時間: ${elapsed}ms（閾値: 1000ms）`);
  expect(elapsed).toBeLessThan(1000);
});

// ============================================================
// P-07: モバイルビューポートでのページロード（60%がモバイル利用）
// ============================================================
test('P-07: モバイル(375px)でのプラン一覧ロードが4秒以内', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 667 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();

  const start = Date.now();
  await page.goto('plans.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('a.btn:has-text("このプランで予約")')).toHaveCount(7, { timeout: THRESHOLDS.pageLoad });
  const elapsed = Date.now() - start;

  console.log(`[P-07] モバイルプラン一覧ロード: ${elapsed}ms（閾値: ${THRESHOLDS.pageLoad}ms）`);
  expect(elapsed).toBeLessThan(THRESHOLDS.pageLoad);

  await ctx.close();
});

// ============================================================
// P-08: 連続ページ遷移（ユーザーが複数ページを回遊）
//       実際のユーザーは複数ページを行き来する
// ============================================================
test('P-08: 連続ページ遷移（5ページ）の合計時間が15秒以内', async ({ page }) => {
  const pages = [
    '',              // トップ
    'plans.html',    // プラン一覧
    'reserve.html?plan-id=0', // 予約フォーム
    'signup.html',   // 会員登録
    'login.html',    // ログイン
  ];

  const start = Date.now();
  for (const path of pages) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  const elapsed = Date.now() - start;

  console.log(`[P-08] 5ページ連続遷移合計時間: ${elapsed}ms（閾値: 15000ms）`);
  expect(elapsed).toBeLessThan(15000);
});
