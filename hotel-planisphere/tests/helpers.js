'use strict';

// ユーザーデータ: localStorage key = email, value = JSON
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

// localStorage にユーザーデータを直接注入（UI不要で高速）
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

// ログイン済み状態をセットアップ（ページ移動不要で高速）
async function setupLoggedIn(page, user = TEST_USER) {
  await page.goto('');
  await injectUser(page, user);
  await setSession(page, user.email);
}

// UIでユーザー登録
async function signupUser(page, user = TEST_USER) {
  await page.goto('signup.html');
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.locator('#password-confirmation').fill(user.password);
  await page.locator('#username').fill(user.name);
  await page.getByRole('button', { name: '登録' }).click();
  await page.waitForURL(/mypage\.html/);
}

// 明日の日付を YYYY/MM/DD 形式で返す
function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = { TEST_USER, PREMIUM_USER, injectUser, setSession, setupLoggedIn, signupUser, getTomorrow };
