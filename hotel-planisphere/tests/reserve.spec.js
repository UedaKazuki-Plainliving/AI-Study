'use strict';
/**
 * E2E テスト — 予約フォーム (reserve.html) & 確認画面 (confirm.html)
 * TC-R01〜TC-R08
 * フロー: reserve.html (入力) → submit → confirm.html (確認) → 「この内容で予約する」→ success-modal
 * 日付ピッカー: jQuery UI datepicker (minDate: 1, maxDate: 90)
 */
const { test, expect } = require('@playwright/test');

const PLAN_URL = 'reserve.html?plan-id=0';

// jQuery UI datepicker の公式 API で明日の日付をセット
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
// 正常系
// ============================================================

// TC-R01: 必須項目入力 → 確認画面（confirm.html）へ遷移
test('TC-R01: 必須項目入力 → 予約確認ページへ遷移する', async ({ page }) => {
  await page.goto(PLAN_URL);
  await fillBasicReserve(page);
  await page.locator('#submit-button').click();

  await expect(page).toHaveURL(/confirm\.html/, { timeout: 10000 });
});

// TC-R02: 追加プラン選択 → 合計金額が増加する
test('TC-R02: 追加プラン（朝食）選択 → 合計金額が増加する', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');
  await setDate(page);
  await page.locator('#term').fill('1');
  await page.evaluate(() => window.$('#term').trigger('change'));
  await page.locator('#head-count').fill('1');
  await page.evaluate(() => window.$('#head-count').trigger('change'));

  // 追加プランなしの金額が計算されるのを待つ
  await expect(page.locator('#total-bill')).not.toHaveText('-', { timeout: 5000 });
  const totalBefore = await page.locator('#total-bill').textContent();

  // 朝食バイキングを追加して change を発火
  await page.locator('#breakfast').check();
  await page.evaluate(() => window.$('.needs-calc').trigger('change'));

  // 金額が増加することを確認
  const totalAfter = await page.locator('#total-bill').textContent();
  expect(
    Number((totalAfter ?? '0').replace(/[^0-9]/g, ''))
  ).toBeGreaterThan(
    Number((totalBefore ?? '0').replace(/[^0-9]/g, ''))
  );
});

// TC-R03: 予約確定 → 完了モーダル表示
test('TC-R03: 確認ページで「この内容で予約する」→ 完了モーダル表示', async ({ page }) => {
  await page.goto(PLAN_URL);
  await fillBasicReserve(page);
  await page.locator('#submit-button').click();

  await expect(page).toHaveURL(/confirm\.html/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'この内容で予約する' }).click();

  await expect(page.locator('#success-modal')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#success-modal')).toContainText('予約を完了しました');
});

// TC-R04: 完了モーダルの「閉じる」ボタン
test('TC-R04: 完了モーダルで「閉じる」→ モーダルが閉じる', async ({ page }) => {
  await page.goto(PLAN_URL);
  await fillBasicReserve(page);
  await page.locator('#submit-button').click();

  await expect(page).toHaveURL(/confirm\.html/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'この内容で予約する' }).click();
  await expect(page.locator('#success-modal')).toBeVisible({ timeout: 10000 });

  await page.locator('#success-modal').getByRole('button', { name: '閉じる' }).click();
  await expect(page.locator('#success-modal')).not.toBeVisible({ timeout: 5000 });
});

// ============================================================
// 異常系
// ============================================================

// TC-R05: 確認のご連絡が未選択 → confirm.html へ遷移しない
test('TC-R05: 確認のご連絡が未選択 → 確認ページへ遷移しない', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');
  await setDate(page);
  await page.locator('#term').fill('1');
  await page.locator('#head-count').fill('1');
  await page.locator('#username').fill('予約太郎');
  // contact は「選択してください」(value="") のまま送信
  await page.locator('#submit-button').click();

  // バリデーションエラーのため遷移しない
  await expect(page).not.toHaveURL(/confirm\.html/);
});

// TC-R06: 氏名未入力 → エラー表示
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

// TC-R07: 確認連絡「メールでのご連絡」でメールアドレス未入力 → エラー
test('TC-R07: 確認連絡でメール選択 → メールアドレス未入力でエラー', async ({ page }) => {
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

// TC-R08: 確認連絡「電話でのご連絡」で電話番号未入力 → エラー
test('TC-R08: 確認連絡で電話選択 → 電話番号未入力でエラー', async ({ page }) => {
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
