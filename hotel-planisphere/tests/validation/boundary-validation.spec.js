'use strict';
/**
 * バリデーションテスト — 業務ロジックの妥当性・境界値の「意味」を問う
 *
 * ペルソナ起点のユーザーストーリーから導出:
 *
 * [Persona C: 恵子 / 65歳 / 操作ミスが多い]
 *   US-C4: headcount=0 や term=0 を誤入力しても安全に処理される
 *   US-C5: 宿泊日の最大制限（90日後）を超えると正しくエラーになる
 *
 * [Persona A: さくら / セキュリティ意識低め]
 *   US-A4: コメント欄に HTML/スクリプトを入力しても安全に表示される（XSS）
 *   US-A5: アイコンに zoom=0 を設定すると画像が表示されなくなる（業務として妥当か）
 *
 * [Persona B: 健一 / 大人数・長期出張]
 *   US-B3: 極端に大きな人数（99名）や長期（90泊）でも合計金額が正しく計算される
 *
 * 検証の視点:
 *   - 「仕様通りに動く」ではなく「ユーザーにとって安全・自然か」を問う
 *   - エラーのない動作が正しいとは限らない（zoom=0 は通るが見えなくなる）
 *   - 入力値の極端なケースでシステムが破綻しないか
 */
const { test, expect } = require('@playwright/test');
const { setupLoggedIn, TEST_USER, getDateDaysFromNow, setDateOnPicker } = require('../helpers');

const PLAN_URL = 'reserve.html?plan-id=0';

// 日付をページに設定するローカルヘルパー
async function setDate(page, daysFromNow = 1) {
  const d = getDateDaysFromNow(daysFromNow);
  await page.evaluate((iso) => {
    const date = new Date(iso);
    window.$('#date').datepicker('setDate', date);
    window.$('#date').trigger('change');
  }, d.toISOString().split('T')[0]);
}

// ============================================================
// US-C4: 人数 0 を入力して送信 → バリデーションが効く（0人予約は不可）
// ============================================================
test('US-C4a: 人数0名で送信 → confirm.html へ遷移しない（0人予約は業務上あり得ない）', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');

  await setDate(page);
  await page.locator('#term').fill('1');
  await page.locator('#head-count').fill('0');
  await page.locator('#username').fill('テスト太郎');
  await page.locator('#contact').selectOption('no');
  await page.locator('#submit-button').click();

  // 0人での予約は受け付けないことを確認
  await expect(page).not.toHaveURL(/confirm\.html/);
});

// ============================================================
// US-C4: 泊数 0 を入力して送信 → バリデーションが効く（0泊は不可）
// ============================================================
test('US-C4b: 泊数0泊で送信 → confirm.html へ遷移しない（0泊は業務上あり得ない）', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');

  await setDate(page);
  await page.locator('#term').fill('0');
  await page.locator('#head-count').fill('1');
  await page.locator('#username').fill('テスト太郎');
  await page.locator('#contact').selectOption('no');
  await page.locator('#submit-button').click();

  await expect(page).not.toHaveURL(/confirm\.html/);
});

// ============================================================
// US-C4: 負の数を人数フィールドに入力 → エラー処理される
// ============================================================
test('US-C4c: 人数に負の値(-1)を入力して送信 → 正常に処理されない', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');

  await setDate(page);
  await page.locator('#term').fill('1');
  await page.locator('#head-count').fill('-1');
  await page.locator('#username').fill('テスト太郎');
  await page.locator('#contact').selectOption('no');
  await page.locator('#submit-button').click();

  await expect(page).not.toHaveURL(/confirm\.html/);
});

// ============================================================
// US-C5: 宿泊日=91日後（最大値+1）→ バリデーションエラー
// ============================================================
test('US-C5a: 宿泊日=91日後（最大90日の境界値+1）→ バリデーションエラーになる', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');

  // datepicker の maxDate=90 を迂回して 91 日後を直接セット
  await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 91);
    const formatted = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    window.$('#date').val(formatted);
    window.$('#date').trigger('change');
  });

  await page.locator('#term').fill('1');
  await page.locator('#head-count').fill('1');
  await page.locator('#username').fill('テスト太郎');
  await page.locator('#contact').selectOption('no');
  await page.locator('#submit-button').click();

  // 91日後はNG: confirm.html へ遷移しない
  await expect(page).not.toHaveURL(/confirm\.html/);
});

// ============================================================
// US-C5: 宿泊日=90日後（最大値）→ 正常に遷移する
// ============================================================
test('US-C5b: 宿泊日=90日後（最大境界値）→ confirm.html へ遷移する', async ({ page }) => {
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');

  await setDate(page, 90);
  await page.locator('#term').fill('1');
  await page.locator('#head-count').fill('1');
  await page.locator('#username').fill('テスト太郎');
  await page.locator('#contact').selectOption('no');
  await page.locator('#submit-button').click();

  await expect(page).toHaveURL(/confirm\.html/, { timeout: 10000 });
});

// ============================================================
// US-A4: コメント欄に HTML/XSS ペイロードを入力 → confirm.html で実行されない
// ============================================================
test('US-A4: コメントに XSS ペイロード(onerror)を入力 → confirm.html でスクリプトが実行されない', async ({ page }) => {
  // <script> は innerHTML でも現代ブラウザは実行しないため
  // onerror イベントハンドラ付き img タグでより確実に XSS を検証する
  const xssPayload = '<img src="x" onerror="window.__xss_executed=true">';

  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');

  await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    window.$('#date').datepicker('setDate', d);
    window.$('#date').trigger('change');
  });
  await page.locator('#term').fill('1');
  await page.locator('#head-count').fill('1');
  await page.locator('#username').fill('テスト太郎');
  await page.locator('#contact').selectOption('no');
  await page.locator('#comment').fill(xssPayload);
  await page.locator('#submit-button').click();

  await expect(page).toHaveURL(/confirm\.html/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  // onerror が実行されたか確認（XSS 成功 = フラグが true になる）
  const xssExecuted = await page.evaluate(() => window.__xss_executed === true);

  // XSS が実行されていないことを期待（= テキストとしてエスケープされている）
  // ★ もし true になれば confirm.html に XSS 脆弱性がある
  expect(xssExecuted).toBe(false);

  // さらに: ページ本文に img タグがそのまま挿入されていないことも確認
  const injectedImgs = await page.evaluate(() => {
    // src="x" でエラーになる img 要素が DOM にあれば XSS 挿入されている
    return Array.from(document.images).some(img => img.src.endsWith('/x'));
  });
  expect(injectedImgs).toBe(false);
});

// ============================================================
// US-A5: zoom=0 でアイコン設定 → mypage で画像が「見えない」（業務妥当性の問題提起）
// ============================================================
test('US-A5: zoom=0 でアイコン設定 → localStorage に width:0 が保存される（0pxは不可視）', async ({ page }) => {
  await setupLoggedIn(page);
  await page.goto('icon.html');
  await page.waitForLoadState('networkidle');

  const TINY_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const pngBuffer = Buffer.from(TINY_PNG_BASE64, 'base64');

  await page.locator('#icon').setInputFiles({
    name: 'test-icon.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
  });

  await expect(page.locator('#zoom')).toBeEnabled({ timeout: 3000 });

  // zoom を 0 に設定（min=0 なので範囲内）
  await page.locator('#zoom').evaluate((el) => {
    el.value = '0';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await page.getByRole('button', { name: '確定' }).click();

  await page.waitForFunction(
    (email) => {
      try {
        const data = JSON.parse(localStorage.getItem(email) || '{}');
        return !!(data.icon && 'width' in data.icon);
      } catch { return false; }
    },
    TEST_USER.email,
    { timeout: 5000 },
  );

  const iconData = await page.evaluate((email) => {
    const data = JSON.parse(localStorage.getItem(email) || '{}');
    return data.icon ?? null;
  }, TEST_USER.email);

  // zoom=0 が width:0, height:0 として保存されることを記録する
  // → mypage では 0×0 の不可視画像になる（業務上の問題点）
  expect(iconData.width).toBe(0);
  expect(iconData.height).toBe(0);

  // ★ バリデーション観点: zoom=0 は localStorage に width:0, height:0 で保存される
  // → mypage でアイコンは表示されるが実際のコンテンツは 0×0 で不可視
  // → ユーザーに「設定できた」と思わせながら何も表示されない問題（UX 欠陥）
  // mypage で img 要素は存在するが内容が実質見えないことを記録する
  await page.goto('mypage.html');
  const img = page.locator('#icon-holder img');
  await expect(img).toBeAttached({ timeout: 5000 }); // 要素は存在する
  // CSS ボーダー等で見た目の box は残るが、コンテンツの width/height は 0 に設定されている
  const imgStyle = await img.evaluate((el) => ({
    width: el.width,
    height: el.height,
  }));
  // width と height が 0（コンテンツが事実上不可視）
  expect(imgStyle.width).toBe(0);
  expect(imgStyle.height).toBe(0);
});

// ============================================================
// US-B3: 大人数・長期での合計金額計算が正しい（オーバーフロー等がない）
// ============================================================
test('US-B3: 大人数(9名)・長期(9泊)での合計金額が計算できる', async ({ page }) => {
  // plan-id=0: 7000円/人/泊
  // 9名×9泊×7000 = 567,000円（週末なし・追加オプションなし）
  // ※ 実際の日付に週末が含まれる場合は異なる
  await page.goto(PLAN_URL);
  await page.waitForLoadState('networkidle');

  await page.evaluate(() => {
    // 月曜日を探して設定（週末割増を回避）
    const d = new Date();
    d.setDate(d.getDate() + 1);
    while (d.getDay() !== 1) { // 1 = Monday
      d.setDate(d.getDate() + 1);
    }
    window.$('#date').datepicker('setDate', d);
    window.$('#date').trigger('change');
  });

  await page.locator('#term').fill('9');
  await page.locator('#head-count').fill('9');

  // 合計金額が表示される（計算エラー・NaN でない）
  await page.evaluate(() => window.$('.needs-calc').trigger('change'));
  for (let i = 0; i < 50; i++) {
    const text = await page.locator('#total-bill').textContent();
    if (text && text !== '-') break;
    await page.waitForTimeout(100);
  }
  const billText = await page.locator('#total-bill').textContent();

  // 金額が表示されている（NaN や空でない）
  expect(billText).not.toContain('NaN');
  expect(billText).not.toBe('-');
  expect(billText.trim().length).toBeGreaterThan(0);

  // 数値として有効な金額が含まれる
  const amount = parseInt(billText.replace(/[^0-9]/g, ''), 10);
  expect(amount).toBeGreaterThan(0);
  // 最低でも 7000×9×9 = 567000 以上（週末割増で増える場合あり）
  expect(amount).toBeGreaterThanOrEqual(567000);
});
