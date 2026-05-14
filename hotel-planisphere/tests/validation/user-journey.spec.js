'use strict';
/**
 * バリデーションテスト — E2E ユーザージャーニー
 *
 * ペルソナ起点のシナリオ（画面単位ではなく「人の行動」として検証）:
 *
 * [Persona A: さくら / 旅好き28歳女性 / スマートフォン]
 *   Journey-A: 新規登録 → マイページでプロフィール確認 → プラン一覧 → 予約 → 完了
 *
 * [Persona B: 健一 / 出張ビジネスマン / デスクトップ]
 *   Journey-B: プリセットログイン → 出張ビジネスプランを探す → 電話連絡で予約 → 確認
 *
 * [Persona C: 恵子 / 65歳 / 操作ミスが多い]
 *   Journey-C: アイコン設定 → マイページで確認 → 退会 → ログインできなくなる
 *             （退会フローが一連の行動として完結するか）
 *
 * ベリフィケーションとの違い:
 *   - 各画面を個別にテストするのではなく「人が使う流れ」として繋いで検証する
 *   - 画面間でのデータ引き継ぎ・状態の一貫性を重視する
 */
const { test, expect } = require('@playwright/test');
const { TEST_USER, PRESET_ICHIRO, PRESET_SAKURA, setupLoggedIn, setupPresetLoggedIn, signupUser } = require('../helpers');

const PLAN_URL_0 = 'reserve.html?plan-id=0';

// ============================================================
// Journey-A: さくらの旅行予約フロー（新規登録から予約完了まで）
// ============================================================
test('Journey-A: 新規登録 → マイページ確認 → 予約フォーム → 確認画面 → 予約完了', async ({ page }) => {
  const email = `sakura_journey_${Date.now()}@example.com`;
  const username = '田中さくら';

  // Step 1: 新規会員登録
  await page.goto('signup.html');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('Test1234');
  await page.locator('#password-confirmation').fill('Test1234');
  await page.locator('#username').fill(username);
  await page.locator('#rank-normal').check(); // 一般会員
  await page.getByRole('button', { name: '登録' }).click();
  await expect(page).toHaveURL(/mypage\.html/, { timeout: 10000 });

  // Step 2: マイページで自分の名前が表示される
  await expect(page.getByText(username)).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  // Step 3: 宿泊プラン一覧へ（一般会員 → 9件表示）
  await page.goto('plans.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('a.btn:has-text("このプランで予約")')).toHaveCount(9, { timeout: 10000 });

  // Step 4: プランから予約フォームへ（新タブではなく直接遷移でテスト）
  await page.goto(PLAN_URL_0);
  await page.waitForLoadState('networkidle');

  await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    window.$('#date').datepicker('setDate', d);
    window.$('#date').trigger('change');
  });
  await page.locator('#term').fill('2');
  await page.locator('#head-count').fill('2');
  await page.locator('#username').fill(username);
  await page.locator('#contact').selectOption('no');
  await page.locator('#submit-button').click();

  // Step 5: 確認画面で入力内容が表示される
  await expect(page).toHaveURL(/confirm\.html/, { timeout: 10000 });
  await expect(page.getByText(username)).toBeVisible();

  // Step 6: 予約完了モーダルが表示される
  await page.getByRole('button', { name: 'この内容で予約する' }).click();
  await expect(page.locator('#success-modal')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#success-modal')).toContainText('予約を完了しました');
});

// ============================================================
// Journey-B: 健一の出張予約フロー（ビジネスプラン・電話連絡）
// ============================================================
test('Journey-B: プリセットログイン → 出張プラン確認 → 電話番号入力で予約', async ({ page }) => {
  // Step 1: 既存ユーザー（プレミアム会員）としてログイン
  await setupPresetLoggedIn(page, PRESET_ICHIRO);
  await page.goto('plans.html');
  await page.waitForLoadState('networkidle');

  // Step 2: プレミアム会員として 10件のプランが表示される
  await expect(page.locator('a.btn:has-text("このプランで予約")')).toHaveCount(10, { timeout: 10000 });

  // Step 3: 「出張ビジネスプラン」が表示されることを確認
  await expect(page.getByText('出張ビジネスプラン')).toBeVisible();

  // Step 4: plan-id=5 が出張ビジネスプランと想定して直接遷移
  // (plans.html でリンクを辿ると新タブになるため直接 URL でテスト)
  await page.goto('reserve.html?plan-id=5');
  await page.waitForLoadState('networkidle');

  await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    window.$('#date').datepicker('setDate', d);
    window.$('#date').trigger('change');
  });
  await page.locator('#term').fill('1');
  await page.locator('#head-count').fill('1');
  await page.locator('#username').fill(PRESET_ICHIRO.name);

  // 電話でのご連絡を選択（Persona B の特徴）
  await page.locator('#contact').selectOption('tel');
  await expect(page.locator('#tel')).toBeVisible();
  await page.locator('#tel').fill('01234567891');

  await page.locator('#submit-button').click();

  // Step 5: 確認画面に遷移し、「電話でのご連絡」が表示される
  await expect(page).toHaveURL(/confirm\.html/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  // confirm.html は JS で非同期描画するため toBeVisible で待機する
  await expect(page.getByText(/電話/)).toBeVisible({ timeout: 5000 });

  // Step 6: 予約完了
  await page.getByRole('button', { name: 'この内容で予約する' }).click();
  await expect(page.locator('#success-modal')).toBeVisible({ timeout: 10000 });
});

// ============================================================
// Journey-C: 恵子の退会フロー（アイコン設定 → 確認 → 退会 → ログイン不可）
// ============================================================
test('Journey-C: 新規登録 → アイコン設定 → マイページで確認 → 退会 → 再ログイン不可', async ({ page }) => {
  const email = `keiko_journey_${Date.now()}@example.com`;
  const password = 'Test1234';

  const TINY_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // Step 1: 新規登録
  await signupUser(page, { email, password, name: '佐々木恵子', rank: 'normal' });

  // Step 2: アイコン設定
  await page.goto('icon.html');
  await page.waitForLoadState('networkidle');

  const pngBuffer = Buffer.from(TINY_PNG_BASE64, 'base64');
  await page.locator('#icon').setInputFiles({
    name: 'test-icon.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
  });
  await expect(page.locator('#zoom')).toBeEnabled({ timeout: 3000 });
  await page.getByRole('button', { name: '確定' }).click();

  // Step 3: マイページでアイコンが表示されることを確認
  await page.goto('mypage.html');
  await page.waitForFunction(
    (em) => {
      try {
        const d = JSON.parse(localStorage.getItem(em) || '{}');
        return !!(d.icon && d.icon.image);
      } catch { return false; }
    },
    email,
    { timeout: 5000 },
  );
  await expect(page.locator('#icon-holder img')).toBeVisible({ timeout: 5000 });

  // Step 4: 退会（confirm + alert ダイアログ）
  const dialogs = [];
  page.on('dialog', (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    dialog.accept();
  });
  await page.getByRole('button', { name: '退会する' }).click();
  await expect(page).toHaveURL(/index\.html|login\.html/, { timeout: 10000 });

  // ダイアログが confirm → alert の順で表示された
  expect(dialogs).toHaveLength(2);
  expect(dialogs[0].type).toBe('confirm');
  expect(dialogs[1].type).toBe('alert');

  // Step 5: 退会後に同じ認証情報でログインできない
  await page.goto('login.html');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#login-button').click();

  await expect(page).not.toHaveURL(/mypage\.html/);
  await expect(page.locator('#email-message')).toBeVisible();
});

// ============================================================
// データ整合性: アイコン保存がユーザー情報（氏名・メール）を消さない
// ============================================================
test('データ整合性: アイコン設定後もマイページに氏名・メールが引き続き表示される', async ({ page }) => {
  // Persona A: アイコン設定後に他のプロフィール情報が消えないか確認
  // 注意: PRESET ユーザーは icon.html へのアクセスが禁止されているため
  //       注入ユーザー（TEST_USER）を使用する
  await setupLoggedIn(page, TEST_USER);

  // アイコン設定
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
  await page.getByRole('button', { name: '確定' }).click();

  // FileReader 完了を待機
  await page.waitForFunction(
    (email) => {
      try {
        const d = JSON.parse(localStorage.getItem(email) || '{}');
        return !!(d.icon && d.icon.image);
      } catch { return false; }
    },
    TEST_USER.email,
    { timeout: 5000 },
  );

  // マイページへ遷移
  await page.goto('mypage.html');

  // 氏名・メールアドレスも引き続き表示される（icon 保存でプロフィールが消えていない）
  await expect(page.getByText(TEST_USER.name)).toBeVisible();
  await expect(page.getByText(TEST_USER.email)).toBeVisible();
  await expect(page.locator('#icon-holder img')).toBeVisible({ timeout: 5000 });
});
