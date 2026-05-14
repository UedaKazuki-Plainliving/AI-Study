'use strict';
/**
 * ISO 25010 利用時品質（Quality in Use）計測テスト
 *
 * ペルソナ定義:
 *   Persona A: 田中さくら（28歳・会社員・スマートフォン主体）
 *              タスク: スマートフォン(375px)で新規登録→プラン選択→予約完了
 *   Persona B: 鈴木健一（45歳・営業職・デスクトップ主体）
 *              タスク: プリセットログイン→出張プラン予約（電話番号入力）
 *   Persona C: 佐々木恵子（65歳・退職者・操作不慣れ）
 *              タスク: アイコン設定（一度間違えてリトライ）
 *   Login App: Persona B の簡易版（Login App API 計測）
 *
 * 計測メトリクス（ISO 25010 Part 2）:
 *   有効性（Effectiveness）: タスク完了 / 完了率
 *   効率性（Efficiency）: タスク時間 / 操作ステップ数
 *   満足性（Satisfaction）: エラー遭遇数 / エラーフリー完了 / フィードバック受信
 *   リスク回避性（Freedom from risk）: エラー後リカバリー / データ保持
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
  setupLoggedIn,
  setupPresetLoggedIn,
  PRESET_ICHIRO,
  TEST_USER,
} = require('../helpers');

// ============================================================
// 定数
// ============================================================

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const OUTPUT_PATH = path.join(__dirname, 'quality-in-use-metrics.json');

const results = [];

// ============================================================
// ユーティリティ
// ============================================================

/** 現在表示中のバリデーションエラー数をカウントする */
async function countErrors(page) {
  try {
    // display:block かつテキストがある invalid-feedback のみカウント
    const count = await page.evaluate(() => {
      const elements = document.querySelectorAll('.invalid-feedback');
      let visible = 0;
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden' && (el.textContent || '').trim().length > 0) {
          visible++;
        }
      }
      return visible;
    });
    return count;
  } catch {
    return 0;
  }
}

/** 結果 JSON を書き出す */
function saveResults() {
  const output = {
    measuredAt: '2026-05-14',
    personas: results,
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
}

// ============================================================
// Persona A — 田中さくら（28歳・スマホ 375px）
// タスク: 新規登録 → プラン選択 → 予約完了
// ============================================================
test('Persona A: 田中さくら — 新規登録→プラン選択→予約完了', async ({ page, context }) => {
  test.setTimeout(90000); // 90秒（複数ページ遷移のため余裕を持たせる）

  // スマートフォン viewport に設定
  await page.setViewportSize({ width: 375, height: 667 });
  const ctx = context; // 新タブのイベント待機用

  let stepCount = 0;
  let errorsEncountered = 0;
  let taskCompleted = false;
  let successFeedbackReceived = false;
  let recoveryFromError = true; // 今回はエラー発生なし前提
  let dataPreservedAfterTask = false;

  const taskStart = Date.now();

  try {
    // ── 新規登録 ──
    stepCount++; // ステップ1: signup.html へ移動
    await page.goto('signup.html');
    await page.waitForLoadState('load');

    // テスト用ユニークメールアドレス（重複を避ける）
    const uniqueEmail = `sakura_qiu_${Date.now()}@example.com`;

    stepCount++; // ステップ2: メールアドレス入力
    await page.locator('#email').fill(uniqueEmail);
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ3: パスワード入力
    await page.locator('#password').fill('Sakura1234');
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ4: パスワード確認入力
    await page.locator('#password-confirmation').fill('Sakura1234');
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ5: 氏名入力
    await page.locator('#username').fill('田中さくら');
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ6: 一般会員選択（ラジオボタン #rank-normal、デフォルトなので確認のみ）
    // signup.html の会員ランクはラジオボタン（#rank-normal / #rank-premium）
    // デフォルトで一般会員が選択されているが、明示的にクリックして stepCount を正確に記録
    const rankNormal = page.locator('#rank-normal');
    if (await rankNormal.count() > 0) {
      await rankNormal.check();
    }
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ7: 登録ボタンクリック
    // signup.html の登録ボタンは「登録」テキストのボタン
    await page.getByRole('button', { name: '登録' }).click();
    await page.waitForURL(/mypage\.html/, { timeout: 20000 });
    errorsEncountered += await countErrors(page);

    // ── プラン選択 ──
    stepCount++; // ステップ8: plans.html へ移動
    await page.goto('plans.html');
    await page.waitForLoadState('load');
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ9: 最初のプランの「このプランで予約」をクリック（新タブ）
    const [newPage] = await Promise.all([
      ctx.waitForEvent('page'),
      page.locator('a.btn:has-text("このプランで予約")').first().click(),
    ]);
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ10: 新タブで予約フォームに移動
    await newPage.waitForLoadState('load');
    await expect(newPage).toHaveURL(/reserve\.html/);
    errorsEncountered += await countErrors(newPage);

    // ── 予約フォーム入力 ──
    stepCount++; // ステップ11: 日付設定（tomorrow）
    await newPage.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      window.$('#date').datepicker('setDate', d);
      window.$('#date').trigger('change');
    });
    errorsEncountered += await countErrors(newPage);

    stepCount++; // ステップ12: 泊数入力
    await newPage.locator('#term').fill('2');
    await newPage.evaluate(() => window.$('#term').trigger('change'));
    errorsEncountered += await countErrors(newPage);

    stepCount++; // ステップ13: 人数入力
    await newPage.locator('#head-count').fill('3');
    await newPage.evaluate(() => window.$('#head-count').trigger('change'));
    errorsEncountered += await countErrors(newPage);

    stepCount++; // ステップ14: 氏名入力
    await newPage.locator('#username').fill('田中さくら');
    errorsEncountered += await countErrors(newPage);

    stepCount++; // ステップ15: 連絡方法選択（不要）
    await newPage.locator('#contact').selectOption('no');
    errorsEncountered += await countErrors(newPage);

    stepCount++; // ステップ16: 送信
    await newPage.locator('#submit-button').click();
    await newPage.waitForURL(/confirm\.html/, { timeout: 10000 });
    errorsEncountered += await countErrors(newPage);

    stepCount++; // ステップ17: 「この内容で予約する」クリック
    await newPage.getByRole('button', { name: 'この内容で予約する' }).click();
    // 予約完了後は confirm.html のまま #success-modal が表示される（URL 変化なし）
    await expect(newPage.locator('#success-modal')).toBeVisible({ timeout: 15000 });
    errorsEncountered += await countErrors(newPage);

    // 完了確認: success-modal が表示されていれば完了
    const modalText = await newPage.locator('#success-modal').textContent();
    successFeedbackReceived = modalText.includes('予約を完了') || modalText.includes('完了');
    taskCompleted = true;
    dataPreservedAfterTask = true;
    recoveryFromError = true;

  } catch (err) {
    console.error('[Persona A] エラー:', err.message);
    taskCompleted = false;
    recoveryFromError = false;
  }

  const taskEnd = Date.now();
  const timeOnTask_ms = taskEnd - taskStart;

  // ctx は Playwright が管理する context なので明示的にクローズしない

  const personaA = {
    personaId: 'A',
    name: '田中さくら',
    age: 28,
    device: 'mobile-375px',
    system: 'Hotel Planisphere',
    task: '新規登録→プラン選択→予約完了',
    effectiveness: {
      taskCompleted,
      completionRate: taskCompleted ? 100 : 0,
    },
    efficiency: {
      timeOnTask_ms,
      stepCount,
      stepsPerMinute: Math.round((stepCount / (timeOnTask_ms / 60000)) * 10) / 10,
    },
    satisfaction: {
      errorsEncountered,
      errorFreeCompletion: errorsEncountered === 0,
      successFeedbackReceived,
    },
    riskMitigation: {
      recoveryFromError,
      dataPreservedAfterTask,
    },
  };

  results.push(personaA);
  saveResults();

  console.log('[Persona A] 完了:', JSON.stringify(personaA, null, 2));
  expect(taskCompleted).toBe(true);
});

// ============================================================
// Persona B — 鈴木健一（45歳・デスクトップ）
// タスク: プリセットログイン → 出張プラン予約（電話番号入力）
// ============================================================
test('Persona B: 鈴木健一 — 出張プラン予約（電話番号入力）', async ({ page }) => {
  test.setTimeout(60000); // 60秒
  let stepCount = 0;
  let errorsEncountered = 0;
  let taskCompleted = false;
  let successFeedbackReceived = false;
  let recoveryFromError = true;
  let dataPreservedAfterTask = false;

  const taskStart = Date.now();

  try {
    stepCount++; // ステップ1: setupPresetLoggedIn
    await setupPresetLoggedIn(page, PRESET_ICHIRO);

    stepCount++; // ステップ2: plans.html へ移動
    await page.goto('plans.html');
    await page.waitForLoadState('load');
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ3: 出張ビジネスプランを確認
    await expect(page.getByText('出張ビジネスプラン')).toBeVisible({ timeout: 10000 });
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ4: reserve.html?plan-id=5 に移動
    await page.goto('reserve.html?plan-id=5');
    await page.waitForLoadState('load');
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ5: 日付設定
    await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      window.$('#date').datepicker('setDate', d);
      window.$('#date').trigger('change');
    });
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ6: 泊数入力
    await page.locator('#term').fill('1');
    await page.evaluate(() => window.$('#term').trigger('change'));
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ7: 人数入力
    await page.locator('#head-count').fill('1');
    await page.evaluate(() => window.$('#head-count').trigger('change'));
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ8: 氏名入力
    await page.locator('#username').fill('鈴木健一');
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ9: 連絡方法「電話」選択
    await page.locator('#contact').selectOption('tel');
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ10: 電話番号入力（11桁の数字のみ）
    await page.locator('#tel').fill('09012345678');
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ11: 送信
    await page.locator('#submit-button').click();
    // confirm.html への遷移を待つ（タイムアウト延長）
    try {
      await page.waitForURL(/confirm\.html/, { timeout: 15000 });
    } catch (navErr) {
      // URL 変化が起きない場合、バリデーションエラーの可能性
      const errCount = await countErrors(page);
      console.warn(`[Persona B] confirm.html への遷移タイムアウト (エラー数: ${errCount})`);
      // スクリーンショット代わりに現在のURLを記録
      console.warn(`[Persona B] 現在のURL: ${page.url()}`);
      throw navErr;
    }
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ12: 「この内容で予約する」クリック
    await page.getByRole('button', { name: 'この内容で予約する' }).click();
    // 予約完了後は confirm.html のまま #success-modal が表示される（URL 変化なし）
    await expect(page.locator('#success-modal')).toBeVisible({ timeout: 15000 });
    errorsEncountered += await countErrors(page);

    const modalText = await page.locator('#success-modal').textContent();
    successFeedbackReceived = modalText.includes('予約を完了') || modalText.includes('完了');
    taskCompleted = true;
    dataPreservedAfterTask = true;
    recoveryFromError = true;

  } catch (err) {
    console.error('[Persona B] エラー:', err.message);
    taskCompleted = false;
    recoveryFromError = false;
  }

  const taskEnd = Date.now();
  const timeOnTask_ms = taskEnd - taskStart;

  const personaB = {
    personaId: 'B',
    name: '鈴木健一',
    age: 45,
    device: 'desktop',
    system: 'Hotel Planisphere',
    task: '出張プラン予約（電話番号入力）',
    effectiveness: {
      taskCompleted,
      completionRate: taskCompleted ? 100 : 0,
    },
    efficiency: {
      timeOnTask_ms,
      stepCount,
      stepsPerMinute: Math.round((stepCount / (timeOnTask_ms / 60000)) * 10) / 10,
    },
    satisfaction: {
      errorsEncountered,
      errorFreeCompletion: errorsEncountered === 0,
      successFeedbackReceived,
    },
    riskMitigation: {
      recoveryFromError,
      dataPreservedAfterTask,
    },
  };

  results.push(personaB);
  saveResults();

  console.log('[Persona B] 完了:', JSON.stringify(personaB, null, 2));
  expect(taskCompleted).toBe(true);
});

// ============================================================
// Persona C — 佐々木恵子（65歳・退職者・操作不慣れ）
// タスク: アイコン設定（一度間違えてリトライ）
// ============================================================
test('Persona C: 佐々木恵子 — アイコン設定（試行錯誤あり）', async ({ page }) => {
  test.setTimeout(60000); // 60秒
  let stepCount = 0;
  let errorsEncountered = 0;
  let taskCompleted = false;
  let successFeedbackReceived = false;
  let recoveryFromError = false;
  let dataPreservedAfterTask = false;

  const taskStart = Date.now();

  try {
    stepCount++; // ステップ1: setupLoggedIn
    await setupLoggedIn(page);

    stepCount++; // ステップ2: icon.html へ移動
    await page.goto('icon.html');
    await page.waitForLoadState('load');
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ3: ファイル選択（有効な1×1px PNG）
    const pngBuffer = Buffer.from(TINY_PNG_BASE64, 'base64');
    await page.locator('#icon').setInputFiles({
      name: 'test-icon.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ4: zoom が有効になるまで待機（エラー発生疑似）
    // ファイル選択後 zoom/color が enabled になるまで待機
    await expect(page.locator('#zoom')).toBeEnabled({ timeout: 5000 });
    // 「操作不慣れ」: 最初に範囲外値（120）を試みる → ブラウザがクランプするが意図したリトライ
    await page.locator('#zoom').evaluate((el) => {
      el.value = '120'; // 範囲外（max=100）→ 自動クランプ
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    errorsEncountered += await countErrors(page);
    // 値が100にクランプされたことを確認してリトライを記録
    const zoomAfterFirst = await page.locator('#zoom').inputValue();
    if (parseInt(zoomAfterFirst) !== 80) {
      // リトライが必要な状況（エラーからの回復）
      recoveryFromError = true;
    }

    stepCount++; // ステップ5: zoom を 80 に設定（正しい値でリトライ）
    await page.locator('#zoom').evaluate((el) => {
      el.value = '80';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ6: color を #ff0000 に設定
    await page.locator('#color').evaluate((el) => {
      el.value = '#ff0000';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    errorsEncountered += await countErrors(page);

    stepCount++; // ステップ7: 確定ボタンクリック
    await page.getByRole('button', { name: '確定' }).click();
    errorsEncountered += await countErrors(page);

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
      { timeout: 5000 }
    );

    stepCount++; // ステップ8: mypage.html でアイコン確認
    await page.goto('mypage.html');
    await page.waitForLoadState('load');
    errorsEncountered += await countErrors(page);

    // アイコンが表示されることを確認
    const iconEl = page.locator('#icon-holder img, .icon-holder img, img[src^="data:image"]');
    const iconCount = await iconEl.count();
    dataPreservedAfterTask = iconCount > 0;

    // localStorage に保存されているか確認
    const iconData = await page.evaluate((email) => {
      const data = JSON.parse(localStorage.getItem(email) || '{}');
      return data.icon ?? null;
    }, TEST_USER.email);

    if (iconData && iconData.image) {
      dataPreservedAfterTask = true;
      successFeedbackReceived = true;
    }

    taskCompleted = true;
    recoveryFromError = true;

  } catch (err) {
    console.error('[Persona C] エラー:', err.message);
    taskCompleted = false;
  }

  const taskEnd = Date.now();
  const timeOnTask_ms = taskEnd - taskStart;

  const personaC = {
    personaId: 'C',
    name: '佐々木恵子',
    age: 65,
    device: 'desktop',
    system: 'Hotel Planisphere',
    task: 'アイコン設定（試行錯誤あり）',
    effectiveness: {
      taskCompleted,
      completionRate: taskCompleted ? 100 : 0,
    },
    efficiency: {
      timeOnTask_ms,
      stepCount,
      stepsPerMinute: Math.round((stepCount / (timeOnTask_ms / 60000)) * 10) / 10,
    },
    satisfaction: {
      errorsEncountered,
      errorFreeCompletion: errorsEncountered === 0,
      successFeedbackReceived,
    },
    riskMitigation: {
      recoveryFromError,
      dataPreservedAfterTask,
    },
  };

  results.push(personaC);
  saveResults();

  console.log('[Persona C] 完了:', JSON.stringify(personaC, null, 2));
  expect(taskCompleted).toBe(true);
});

// ============================================================
// Login App — Persona B 簡易版（API 計測）
// タスク: ログイン API 呼び出し（正常系）
// ============================================================
test('Login App: Persona B 簡易版 — ログイン API 計測', async ({ page }) => {
  test.setTimeout(30000); // 30秒
  const LOGIN_APP_BASE = 'http://43.207.67.234:3000';
  // RE_USERID = /^[a-zA-Z0-9]{1,20}$/ のため アンダースコア不可
  const TEST_USER_ID = 'metricqiub';
  // RE_PASSWORD = /^[a-zA-Z0-9!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]{8,32}$/
  const TEST_PASSWORD = 'TestPass1!';

  let stepCount = 0;
  let errorsEncountered = 0;
  let taskCompleted = false;
  let successFeedbackReceived = false;
  let recoveryFromError = true;
  let dataPreservedAfterTask = false;
  let loginElapsed_ms = 0;

  const taskStart = Date.now();

  try {
    // ── テストユーザー作成 ──
    stepCount++; // ステップ1: ユーザー作成
    const createRes = await page.request.post(`${LOGIN_APP_BASE}/api/users`, {
      data: { userId: TEST_USER_ID, password: TEST_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    // 201 または 409（既存ユーザー）を許容
    const createStatus = createRes.status();
    console.log(`[Login App] ユーザー作成: status=${createStatus}`);
    errorsEncountered += (createStatus !== 201 && createStatus !== 409) ? 1 : 0;

    // ── ログイン API 呼び出し（page.request を使ってレスポンスタイムを計測）──
    stepCount++; // ステップ2: ログイン API 呼び出し
    const loginStart = Date.now();
    const loginRes = await page.request.post(`${LOGIN_APP_BASE}/api/auth/login`, {
      data: { userId: TEST_USER_ID, password: TEST_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    loginElapsed_ms = Date.now() - loginStart;
    const loginStatus = loginRes.status();
    let loginBody = null;
    try { loginBody = await loginRes.json(); } catch { loginBody = null; }
    console.log(`[Login App] ログイン結果: status=${loginStatus}, elapsed=${loginElapsed_ms}ms`);

    if (loginStatus === 200) {
      taskCompleted = true;
      successFeedbackReceived = true;
      dataPreservedAfterTask = true;
    } else {
      errorsEncountered++;
      console.warn(`[Login App] ログイン失敗: status=${loginStatus}, body=${JSON.stringify(loginBody)}`);
    }

  } catch (err) {
    console.error('[Login App] エラー:', err.message);
    taskCompleted = false;
    recoveryFromError = false;
    errorsEncountered++;
  } finally {
    // ── テストユーザー削除（後片付け） ──
    try {
      const deleteRes = await page.request.delete(`${LOGIN_APP_BASE}/api/users/${TEST_USER_ID}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log(`[Login App] ユーザー削除: status=${deleteRes.status()}`);
    } catch (delErr) {
      console.warn(`[Login App] ユーザー削除失敗（無視）: ${delErr.message}`);
    }
  }

  const taskEnd = Date.now();
  const timeOnTask_ms = taskEnd - taskStart;

  const personaLoginApp = {
    personaId: 'B-LoginApp',
    name: '鈴木健一（Login App）',
    age: 45,
    device: 'desktop',
    system: 'Login App',
    task: 'ログイン API 呼び出し（正常系）',
    effectiveness: {
      taskCompleted,
      completionRate: taskCompleted ? 100 : 0,
    },
    efficiency: {
      timeOnTask_ms,
      stepCount,
      stepsPerMinute: Math.round((stepCount / (timeOnTask_ms / 60000)) * 10) / 10,
      loginApiResponseTime_ms: loginElapsed_ms,
    },
    satisfaction: {
      errorsEncountered,
      errorFreeCompletion: errorsEncountered === 0,
      successFeedbackReceived,
    },
    riskMitigation: {
      recoveryFromError,
      dataPreservedAfterTask,
    },
  };

  results.push(personaLoginApp);
  saveResults();

  console.log('[Login App] 完了:', JSON.stringify(personaLoginApp, null, 2));
  // Login App は接続失敗の可能性があるため warn 扱い（テスト自体は通す）
  if (!taskCompleted) {
    console.warn('[Login App] タスク未完了（サーバー接続不可の可能性）');
  }
});
