'use strict';

// ============================================================
// テスト用ユーザー定義
// ============================================================

// 注入用テストユーザー（localStorage に直接作成）
const TEST_USER = {
  email: 'taro@example.com',
  password: 'Test1234',
  name: 'テスト太郎',
  rank: 'normal',
};

const PREMIUM_USER = {
  email: 'premium@example.com',
  password: 'Test1234',
  name: 'プレミアム花子',
  rank: 'premium',
};

// サイト組み込みのプリセットユーザー (data/ja/user.json)
// サイト初期化時（page.goto('')）に localStorage へ自動登録される
const PRESET_ICHIRO = {
  email: 'ichiro@example.com',
  password: 'password',
  name: '山田一郎',
  rank: 'premium',
};

const PRESET_SAKURA = {
  email: 'sakura@example.com',
  password: 'pass1234',
  name: '松本さくら',
  rank: 'normal',
};

// ============================================================
// ヘルパー関数
// ============================================================

// localStorage にユーザーデータを注入（UI不要、高速）
async function injectUser(page, user = TEST_USER) {
  await page.evaluate(({ email, data }) => {
    localStorage.setItem(email, JSON.stringify(data));
  }, {
    email: user.email,
    data: {
      email: user.email,
      password: user.password,
      username: user.name,
      rank: user.rank,
      address: '',
      tel: '',
      gender: 'other',
      birthday: '',
      notification: false,
    },
  });
}

// Cookie にセッションをセット（ログイン済み状態を再現）
async function setSession(page, email = TEST_USER.email) {
  await page.context().addCookies([{
    name: 'session',
    value: email,
    domain: 'hotel-example-site.takeyaqa.dev',
    path: '/',
    maxAge: 630720000,
  }]);
}

// 注入ユーザーでログイン済み状態をセットアップ
async function setupLoggedIn(page, user = TEST_USER) {
  await page.goto('');
  await injectUser(page, user);
  await setSession(page, user.email);
}

// プリセットユーザーでログイン済み状態をセットアップ
// page.goto('') でサイト初期化 → プリセットユーザーが localStorage に自動登録される
async function setupPresetLoggedIn(page, presetUser = PRESET_ICHIRO) {
  await page.goto('');
  await setSession(page, presetUser.email);
}

// UI でサインアップして mypage.html まで遷移
async function signupUser(page, user = TEST_USER) {
  await page.goto('signup.html');
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.locator('#password-confirmation').fill(user.password);
  await page.locator('#username').fill(user.name);
  await page.getByRole('button', { name: '登録' }).click();
  await page.waitForURL(/mypage\.html/);
}

// ============================================================
// 日付ユーティリティ
// ============================================================

// 次の平日（月〜金）の Date オブジェクトを返す（明日以降）
function getNextWeekday() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

// 今日から N 日後の Date オブジェクトを返す
function getDateDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ============================================================
// 予約フォームヘルパー
// ============================================================

// datepicker に Date オブジェクトをセット
async function setDateOnPicker(page, date) {
  await page.evaluate((iso) => {
    const d = new Date(iso);
    window.$('#date').datepicker('setDate', d);
    window.$('#date').trigger('change');
  }, date.toISOString());
}

// 日付フィールドに今日の日付を直接セット（datepicker の minDate を迂回）
async function setTodayDirectly(page) {
  await page.evaluate(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    window.$('#date').val(`${y}/${m}/${d}`).trigger('change');
  });
}

// 宿泊数・人数を変更して change イベントを発火
async function fillTermAndHeadCount(page, term, headCount) {
  await page.locator('#term').fill(String(term));
  await page.evaluate(() => window.$('#term').trigger('change'));
  await page.locator('#head-count').fill(String(headCount));
  await page.evaluate(() => window.$('#head-count').trigger('change'));
}

// 合計金額の数値（整数）を取得
async function getBillAmount(page) {
  await page.evaluate(() => window.$('.needs-calc').trigger('change'));
  // 合計が '-' でなくなるまで待機（up to 5秒）
  for (let i = 0; i < 50; i++) {
    const text = await page.locator('#total-bill').textContent();
    if (text && text !== '-') break;
    await page.waitForTimeout(100);
  }
  const text = await page.locator('#total-bill').textContent();
  return parseInt((text ?? '0').replace(/[^0-9]/g, ''), 10);
}

module.exports = {
  TEST_USER,
  PREMIUM_USER,
  PRESET_ICHIRO,
  PRESET_SAKURA,
  injectUser,
  setSession,
  setupLoggedIn,
  setupPresetLoggedIn,
  signupUser,
  getNextWeekday,
  getDateDaysFromNow,
  setDateOnPicker,
  setTodayDirectly,
  fillTermAndHeadCount,
  getBillAmount,
};
