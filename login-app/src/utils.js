'use strict';

const MAX_FAIL       = 5;
const LOCK_MINUTES   = 30;
const PW_EXPIRY_DAYS = 90;
const SALT_ROUNDS    = 10;

// サーバー側バリデーション用正規表現（文字種 + 文字数を一括チェック）
const RE_USERID   = /^[a-zA-Z0-9]{1,20}$/;
const RE_PASSWORD = /^[a-zA-Z0-9!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]{8,32}$/;

/**
 * パスワード有効期限切れ判定
 * @param {string|Date} passwordChangedAt
 * @returns {boolean}
 */
function isPasswordExpired(passwordChangedAt) {
  const days = (Date.now() - new Date(passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24);
  return days >= PW_EXPIRY_DAYS;
}

/**
 * アカウントロック中判定
 * @param {string|Date|null|undefined} lockedUntil
 * @returns {boolean}
 */
function isLocked(lockedUntil) {
  return !!lockedUntil && new Date(lockedUntil) > new Date();
}

module.exports = {
  MAX_FAIL,
  LOCK_MINUTES,
  PW_EXPIRY_DAYS,
  SALT_ROUNDS,
  RE_USERID,
  RE_PASSWORD,
  isPasswordExpired,
  isLocked,
};
