'use strict';
/**
 * E2E テスト — 予約フォーム (reserve.html)
 * TC-R01〜TC-R10
 *
 * 設計技法:
 *   同値分割: 正常送信 / 必須未入力 / 形式不正
 *   境界値分析: 宿泊日（今日=NG、明日=OK、90日後=OK）
 *   デシジョンテーブル: 確認連絡方法 × メール/電話入力有無
 *   状態遷移: 連絡方法切り替え → フィールド表示変化
 *   データ検証: 合計金額の計算式（プラン料金 × 人数 × 泊数 + 追加プラン）
 *
 * 合計金額計算式（billing.js）:
 *   base = roomBill × headCount × term
 *   週末割増: 土日1泊ごとに + roomBill × 0.25 × headCount
 *   朝食: + 1,000 × headCount × term（泊数分）
 *   昼チェックイン: + 1,000 × headCount（1回）
 *   観光プラン: + 1,000 × headCount（1回）
 *
 * TC-R01: 必須項目入力 → confirm.html へ遷移
 * TC-R02: 平日1人1泊（プラン0=7,000円）→ 合計 7,000円
 * TC-R03: 朝食バイキング追加 → 合計 8,000円（+1,000）
 * TC-R04: 複数追加プラン（朝食+観光）× 2人 → 合計 18,000円
 * TC-R05: 宿泊日=今日（最小値-1）→ バリデーションエラー
 * TC-R06: 氏名未入力 → エラー表示
 * TC-R07: 確認のご連絡が未選択 → confirm.html へ遷移しない
 * TC-R08: 確認連絡=メール、メールアドレス未入力 → エラー
 * TC-R09: 確認連絡=電話、電話番号未入力 → エラー
 * TC-R10: 連絡方法の切り替え → 対応フィールドの表示切り替え
 */
const { test, expect } = require('@playwright/test');
const {
  getNextWeekday,
  setDateOnPicker,
  setTodayDirectly,
  fillTermAndHeadCount,
  getBillAmount,
} = require('./helpers');

const PLAN_URL = 'reserve.html?plan-id=0';

// datepicker に明日をセット（既存ヘルパー互換）
async function setDate(page) {
  await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    window.$('#date').datepicker('setDate', d);
    window.$('#date').trigger('change');
  });
}

// 予約フォームに基本情報を入力するヘルパー
async function fillBasicReserve(page) {
  await page.waitForLoadState('networkidle');
  await setDate(page);
  await page.locator('#term').fill('2');
  await page.locator('#head-count').fill('2');
  await page.locator('#username').fill('予約太郎');
  await page.locator('#contact').selectOption('no');
}

// ============================================================
// TC-R01: 必須項目入力 → confirm.html へ遷移
// ============================================================
test('TC-R01: 必須項目入力 → 予約確認ページへ遷移する', async ({ page }) => {
  await page.goto(PLAN_URL);
  await fillBasicReserve(page);
  await page.locator('#submit-button').click();

  await expect(page).toHaveURL(/confirm\.html/, { timeout: 10000 });
});

// ============================================================
// TC-R02: 平日1人1泊 → 合計 7,000円
// ============================================================
test('TC-R02: 平日1人1泊（プラン0）→ 合計7,000円', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');

  // 次の平日をセット（週末割増を回避）
  await setDateOnPicker(page, getNextWeekday());
  await fillTermAndHeadCount(page, 1, 1);

  const amount = await getBillAmount(page);
  expect(amount).toBe(7000);
});

// ============================================================
// TC-R03: 朝食バイキング追加（1人1泊）→ 合計 8,000円
// ============================================================
test('TC-R03: 朝食バイキング追加 → 合計8,000円（7,000 + 1,000×1人×1泊）', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');

  await setDateOnPicker(page, getNextWeekday());
  await fillTermAndHeadCount(page, 1, 1);
  await page.locator('#breakfast').check();

  const amount = await getBillAmount(page);
  expect(amount).toBe(8000);
});

// ============================================================
// TC-R04: 複数追加プラン（朝食+観光）× 2人1泊 → 合計 18,000円
// ============================================================
test('TC-R04: 複数追加プラン（朝食+観光）× 2人 → 合計18,000円', async ({ page }) => {
  // 計算: 7,000×2×1(base) + 1,000×2×1(朝食/人/泊) + 1,000×2(観光/人) = 14,000+2,000+2,000 = 18,000
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');

  await setDateOnPicker(page, getNextWeekday());
  await fillTermAndHeadCount(page, 1, 2);
  await page.locator('#breakfast').check();
  await page.locator('#sightseeing').check();

  const amount = await getBillAmount(page);
  expect(amount).toBe(18000);
});

// ============================================================
// TC-R05: 宿泊日=今日（境界値 min-1）→ バリデーションエラー
// ============================================================
test('TC-R05: 宿泊日=今日（最小値-1）→ バリデーションエラー', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');

  // datepicker の minDate=1 を迂回して今日の日付を直接セット
  await setTodayDirectly(page);
  await page.locator('#term').fill('1');
  await page.locator('#head-count').fill('1');
  await page.locator('#username').fill('テスト太郎');
  await page.locator('#contact').selectOption('no');
  await page.locator('#submit-button').click();

  // 日付バリデーションエラーで confirm.html へ遷移しない
  await expect(page).not.toHaveURL(/confirm\.html/);
  // 日付フィールド付近にエラーが表示される
  await expect(page.locator('#date ~ .invalid-feedback')).toBeVisible();
});

// ============================================================
// TC-R06: 氏名未入力 → エラー表示
// ============================================================
test('TC-R06: 氏名未入力 → エラー表示', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');
  await setDate(page);
  await page.locator('#term').fill('1');
  await page.locator('#head-count').fill('1');
  await page.locator('#contact').selectOption('no');
  await page.locator('#submit-button').click();

  await expect(page.locator('#username ~ .invalid-feedback')).toBeVisible();
});

// ============================================================
// TC-R07: 確認のご連絡が未選択 → confirm.html へ遷移しない
// ============================================================
test('TC-R07: 確認のご連絡が未選択 → 確認ページへ遷移しない', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');
  await setDate(page);
  await page.locator('#term').fill('1');
  await page.locator('#head-count').fill('1');
  await page.locator('#username').fill('予約太郎');
  // #contact は「選択してください」（value=""）のまま
  await page.locator('#submit-button').click();

  await expect(page).not.toHaveURL(/confirm\.html/);
});

// ============================================================
// TC-R08: 確認連絡=メール + メールアドレス未入力 → エラー
// ============================================================
test('TC-R08: 確認連絡でメール選択 → メールアドレス未入力でエラー', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');
  await setDate(page);
  await page.locator('#term').fill('1');
  await page.locator('#head-count').fill('1');
  await page.locator('#username').fill('予約太郎');
  await page.locator('#contact').selectOption('email');
  await page.locator('#submit-button').click();

  await expect(page.locator('#email ~ .invalid-feedback')).toBeVisible();
});

// ============================================================
// TC-R09: 確認連絡=電話 + 電話番号未入力 → エラー
// ============================================================
test('TC-R09: 確認連絡で電話選択 → 電話番号未入力でエラー', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');
  await setDate(page);
  await page.locator('#term').fill('1');
  await page.locator('#head-count').fill('1');
  await page.locator('#username').fill('予約太郎');
  await page.locator('#contact').selectOption('tel');
  await page.locator('#submit-button').click();

  await expect(page.locator('#tel ~ .invalid-feedback')).toBeVisible();
});

// ============================================================
// TC-R11: roomPage ありのプラン → #room-info に iframe が表示される
// ============================================================
test('TC-R11: 部屋情報ありのプラン(plan-id=0) → #room-info に iframe が表示されスタンダードツインの情報が見える', async ({ page }) => {
  // plan-id=0: roomPage = "standard-twin.html" → iframe 生成
  await page.goto('reserve.html?plan-id=0');
  await page.waitForLoadState('networkidle');

  // #room-info 内に iframe が存在する
  await expect(page.locator('#room-info iframe')).toBeVisible({ timeout: 10000 });

  // iframe の title 属性が設定されている（アクセシビリティ確認）
  await expect(page.locator('#room-info iframe')).toHaveAttribute('title', /.+/);

  // iframe 内に部屋情報テキストが表示される
  const frame = page.frameLocator('#room-info iframe');
  await expect(frame.getByText('スタンダードツイン')).toBeVisible({ timeout: 10000 });
});

// ============================================================
// TC-R12: roomPage なしのプラン → #room-info に iframe が表示されない
// ============================================================
test('TC-R12: 部屋情報なしのプラン(plan-id=6) → #room-info に iframe が表示されない', async ({ page }) => {
  // plan-id=6: エステ・マッサージプラン、roomPage = null → iframe 未生成
  await page.goto('reserve.html?plan-id=6');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('#room-info iframe')).toHaveCount(0);
});

// ============================================================
// TC-R13: ご要望（#comment）入力 → confirm.html に内容が表示される
// ============================================================
test('TC-R13: ご要望（textarea）を入力 → confirm.html に内容が引き継がれる', async ({ page }) => {
  const noteText = '禁煙ルームをご希望します。早めのチェックインをお願いします。';

  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');
  await setDate(page);
  await page.locator('#term').fill('1');
  await page.locator('#head-count').fill('1');
  await page.locator('#username').fill('テスト太郎');
  await page.locator('#contact').selectOption('no');
  await page.locator('#comment').fill(noteText);
  await page.locator('#submit-button').click();

  await expect(page).toHaveURL(/confirm\.html/, { timeout: 10000 });
  await expect(page.getByText(noteText)).toBeVisible();
});

// ============================================================
// TC-R10: 連絡方法の切り替え → フィールド表示が切り替わる
// ============================================================
test('TC-R10: 連絡方法切り替え → メール/電話フィールドの表示が切り替わる', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');

  // 初期状態: メール・電話フィールドは非表示
  await expect(page.locator('#email')).not.toBeVisible();
  await expect(page.locator('#tel')).not.toBeVisible();

  // 「メールでのご連絡」を選択 → メールフィールドが表示
  await page.locator('#contact').selectOption('email');
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#tel')).not.toBeVisible();

  // 「電話でのご連絡」に切り替え → 電話フィールドが表示、メールは非表示
  await page.locator('#contact').selectOption('tel');
  await expect(page.locator('#email')).not.toBeVisible();
  await expect(page.locator('#tel')).toBeVisible();

  // 「連絡不要」に切り替え → 両方非表示
  await page.locator('#contact').selectOption('no');
  await expect(page.locator('#email')).not.toBeVisible();
  await expect(page.locator('#tel')).not.toBeVisible();
});
