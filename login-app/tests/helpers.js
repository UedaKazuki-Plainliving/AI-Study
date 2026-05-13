/**
 * テスト用ヘルパー
 * テストユーザーの作成・削除・状態リセットを提供する
 */

const TEST_USERS = {
  NORMAL:  { userId: 'tstnormal',  password: 'TestP@ss1' },
  LOCK:    { userId: 'tstlock',    password: 'TestP@ss1' },
  EXPIRED: { userId: 'tstexpired', password: 'TestP@ss1' },
  DELETE:  { userId: 'tstdelete',  password: 'TestP@ss1' },
};

const WRONG_PASSWORD = 'WrongP@ss9';

/**
 * テストユーザーを削除→作成して初期状態に戻す
 */
async function resetUser(request, userId, password = 'TestP@ss1') {
  await request.delete(`/api/users/${userId}`);
  const res = await request.post('/api/users', { data: { userId, password } });
  if (res.status() !== 201) {
    throw new Error(`resetUser failed [${userId}]: HTTP ${res.status()}`);
  }
}

/**
 * ログインしてセッションを取得する（成功前提）
 */
async function login(request, userId, password = 'TestP@ss1') {
  return request.post('/api/auth/login', { data: { userId, password } });
}

module.exports = { TEST_USERS, WRONG_PASSWORD, resetUser, login };
