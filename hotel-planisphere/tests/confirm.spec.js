'use strict';
/**
 * E2E テスト — 宿泊予約確認画面 (confirm.html)
 * TC-C01〜TC-C03
 *
 * 設計技法:
 *   データ整合性: reserve.html での入力値が confirm.html に正しく引き継がれること
 *   状態遷移: 確認画面 → 予約完了モーダル → モーダル閉じる
 *
 * フロー: reserve.html (入力) → submit → confirm.html → 「この内容で予約する」→ #success-modal
 *
 * TC-C01: confirm.html に reserve.html の入力内容（プラン名・氏名・人数）が表示される
 * TC-C02: 「この内容で予約する」→ 予約完了モーダルが表示される
 * TC-C03: 完了モーダルの「閉じる」→ モーダルが非表示になる
 */
const { test, expect } = require('@playwright/test');

const PLAN_URL = 'reserve.html?plan-id=0';
const PLAN_NAME = 'お得な特典付きプラン'; // plan-id=0 のプラン名

// 予約フォームに既知の値を入力して confirm.html に遷移するヘルパー
async function fillAndNavigateToConfirm(page, {
  term = '2',
  headCount = '2',
  username = '確認テスト太郎',
  contact = 'no',
} = {}) {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');

  // 宿泊日: 明日
  await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    window.$('#date').datepicker('setDate', d);
    window.$('#date').trigger('change');
  });

  await page.locator('#term').fill(term);
  await page.locator('#head-count').fill(headCount);
  await page.locator('#username').fill(username);
  await page.locator('#contact').selectOption(contact);
  await page.locator('#submit-button').click();

  await expect(page).toHaveURL(/confirm\.html/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

// ============================================================
// TC-C01: confirm.html に入力内容が正しく表示される
// ============================================================
test('TC-C01: confirm.html に入力したプラン名・氏名・人数が表示される', async ({ page }) => {
  const username = '確認テスト花子';
  const headCount = '3';

  await fillAndNavigateToConfirm(page, { headCount, username });

  // プラン名が表示される
  await expect(page.getByText(PLAN_NAME)).toBeVisible();

  // 入力した氏名が表示される
  await expect(page.getByText(username)).toBeVisible();

  // 入力した人数が表示される（"3人" または数値"3"として含まれる）
  await expect(page.getByText(new RegExp(`${headCount}`))).toBeVisible();
});

// ============================================================
// TC-C02: 「この内容で予約する」→ 完了モーダルが表示される
// ============================================================
test('TC-C02: 「この内容で予約する」→ 予約完了モーダルが表示される', async ({ page }) => {
  await fillAndNavigateToConfirm(page);

  await page.getByRole('button', { name: 'この内容で予約する' }).click();

  await expect(page.locator('#success-modal')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#success-modal')).toContainText('予約を完了しました');
});

// ============================================================
// TC-C03: 完了モーダルの「閉じる」→ モーダルが非表示になる
// ============================================================
test('TC-C03: 完了モーダルで「閉じる」→ モーダルが非表示になる', async ({ page }) => {
  await fillAndNavigateToConfirm(page);

  await page.getByRole('button', { name: 'この内容で予約する' }).click();
  await expect(page.locator('#success-modal')).toBeVisible({ timeout: 10000 });

  await page.locator('#success-modal').getByRole('button', { name: '閉じる' }).click();

  await expect(page.locator('#success-modal')).not.toBeVisible({ timeout: 5000 });
});
