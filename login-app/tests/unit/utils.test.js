'use strict';

const {
  isPasswordExpired,
  isLocked,
  RE_USERID,
  RE_PASSWORD,
  MAX_FAIL,
  LOCK_MINUTES,
  PW_EXPIRY_DAYS,
} = require('../../src/utils');

// ヘルパー: N日前のISO文字列を生成
const daysAgo  = (d) => new Date(Date.now() - d  * 24 * 60 * 60 * 1000).toISOString();
const minsLater = (m) => new Date(Date.now() + m  * 60 * 1000).toISOString();
const minsAgo   = (m) => new Date(Date.now() - m  * 60 * 1000).toISOString();

// ============================================================
// isPasswordExpired — 境界値
// ============================================================
describe('isPasswordExpired', () => {

  test('定数: PW_EXPIRY_DAYS は 90', () => {
    expect(PW_EXPIRY_DAYS).toBe(90);
  });

  test('[BV-01] 0日前（今日設定）→ false', () => {
    expect(isPasswordExpired(daysAgo(0))).toBe(false);
  });

  test('[BV-02] 1日前 → false', () => {
    expect(isPasswordExpired(daysAgo(1))).toBe(false);
  });

  test('[BV-03] 89日前（期限-1日）→ false', () => {
    expect(isPasswordExpired(daysAgo(89))).toBe(false);
  });

  test('[BV-04] 90日前（期限ちょうど）→ true', () => {
    expect(isPasswordExpired(daysAgo(90))).toBe(true);
  });

  test('[BV-05] 91日前（期限+1日）→ true', () => {
    expect(isPasswordExpired(daysAgo(91))).toBe(true);
  });

  test('[BV-06] 180日前 → true', () => {
    expect(isPasswordExpired(daysAgo(180))).toBe(true);
  });

  test('[BV-07] Date オブジェクト渡し → 正常動作', () => {
    expect(isPasswordExpired(new Date(daysAgo(91)))).toBe(true);
    expect(isPasswordExpired(new Date(daysAgo(89)))).toBe(false);
  });

});

// ============================================================
// isLocked — 境界値
// ============================================================
describe('isLocked', () => {

  test('[BV-10] null → false（未ロック）', () => {
    expect(isLocked(null)).toBe(false);
  });

  test('[BV-11] undefined → false', () => {
    expect(isLocked(undefined)).toBe(false);
  });

  test('[BV-12] 空文字 → false', () => {
    expect(isLocked('')).toBe(false);
  });

  test('[BV-13] 1分前（過去）→ false（ロック期限切れ）', () => {
    expect(isLocked(minsAgo(1))).toBe(false);
  });

  test('[BV-14] 30分前（ちょうど期限切れ相当）→ false', () => {
    expect(isLocked(minsAgo(30))).toBe(false);
  });

  test('[BV-15] 1分後（未来）→ true（ロック中）', () => {
    expect(isLocked(minsLater(1))).toBe(true);
  });

  test('[BV-16] 30分後（自動ロック解除時刻）→ true', () => {
    expect(isLocked(minsLater(LOCK_MINUTES))).toBe(true);
  });

  test('[BV-17] 9999年（手動永続ロック）→ true', () => {
    expect(isLocked('9999-12-31T00:00:00.000Z')).toBe(true);
  });

});

// ============================================================
// RE_USERID — ユーザーID バリデーション 境界値
// ============================================================
describe('RE_USERID — ユーザーID正規表現', () => {

  // ---- 有効 ----
  test('[BV-20] 1文字（最小値）→ valid', () => {
    expect(RE_USERID.test('a')).toBe(true);
  });

  test('[BV-21] 20文字（最大値）→ valid', () => {
    expect(RE_USERID.test('a'.repeat(20))).toBe(true);
  });

  test('[BV-22] 英大文字 → valid', () => {
    expect(RE_USERID.test('UserABC')).toBe(true);
  });

  test('[BV-23] 英小文字 → valid', () => {
    expect(RE_USERID.test('user001')).toBe(true);
  });

  test('[BV-24] 数字のみ → valid', () => {
    expect(RE_USERID.test('12345')).toBe(true);
  });

  // ---- 無効 ----
  test('[BV-25] 空文字 → invalid', () => {
    expect(RE_USERID.test('')).toBe(false);
  });

  test('[BV-26] 21文字（最大値+1）→ invalid', () => {
    expect(RE_USERID.test('a'.repeat(21))).toBe(false);
  });

  test('[BV-27] アンダースコア含む → invalid', () => {
    expect(RE_USERID.test('user_001')).toBe(false);
  });

  test('[BV-28] ハイフン含む → invalid', () => {
    expect(RE_USERID.test('user-001')).toBe(false);
  });

  test('[BV-29] アットマーク含む → invalid', () => {
    expect(RE_USERID.test('user@001')).toBe(false);
  });

  test('[BV-30] 全角英字含む → invalid', () => {
    expect(RE_USERID.test('ｕser001')).toBe(false);
  });

  test('[BV-31] スペース含む → invalid', () => {
    expect(RE_USERID.test('user 001')).toBe(false);
  });

  test('[BV-32] 日本語含む → invalid', () => {
    expect(RE_USERID.test('ユーザー001')).toBe(false);
  });

});

// ============================================================
// RE_PASSWORD — パスワード バリデーション 境界値
// ============================================================
describe('RE_PASSWORD — パスワード正規表現', () => {

  // ---- 有効 ----
  test('[BV-40] 8文字・英数字のみ（最小値）→ valid', () => {
    expect(RE_PASSWORD.test('Password')).toBe(true);
  });

  test('[BV-41] 8文字・記号含む → valid', () => {
    expect(RE_PASSWORD.test('P@ssw001')).toBe(true);
  });

  test('[BV-42] 32文字（最大値）→ valid', () => {
    expect(RE_PASSWORD.test('P@ssword' + 'a'.repeat(24))).toBe(true);
  });

  test('[BV-43] 使用可能記号をすべて含む → valid', () => {
    expect(RE_PASSWORD.test('P@ss!"#$%')).toBe(true);
  });

  test('[BV-44] 数字のみ8文字 → valid', () => {
    expect(RE_PASSWORD.test('12345678')).toBe(true);
  });

  // ---- 無効 ----
  test('[BV-45] 空文字 → invalid', () => {
    expect(RE_PASSWORD.test('')).toBe(false);
  });

  test('[BV-46] 7文字（最小値-1）→ invalid', () => {
    expect(RE_PASSWORD.test('P@ss001')).toBe(false);
  });

  test('[BV-47] 33文字（最大値+1）→ invalid', () => {
    expect(RE_PASSWORD.test('P@ssword' + 'a'.repeat(25))).toBe(false);
  });

  test('[BV-48] スペース含む → invalid', () => {
    expect(RE_PASSWORD.test('P@ss w001')).toBe(false);
  });

  test('[BV-49] 日本語含む → invalid', () => {
    expect(RE_PASSWORD.test('パスワード01')).toBe(false);
  });

  test('[BV-50] 全角記号含む → invalid', () => {
    expect(RE_PASSWORD.test('Ｐ@ssword')).toBe(false);
  });

  test('[BV-51] タブ文字含む → invalid', () => {
    expect(RE_PASSWORD.test('P@ssw\t01')).toBe(false);
  });

});

// ============================================================
// 定数チェック
// ============================================================
describe('ビジネスルール定数', () => {

  test('MAX_FAIL は 5', () => {
    expect(MAX_FAIL).toBe(5);
  });

  test('LOCK_MINUTES は 30', () => {
    expect(LOCK_MINUTES).toBe(30);
  });

  test('PW_EXPIRY_DAYS は 90', () => {
    expect(PW_EXPIRY_DAYS).toBe(90);
  });

});
