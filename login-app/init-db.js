/**
 * DB初期化スクリプト
 * 実行: node init-db.js
 */
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const DB_NAME = 'login_app_db';
const SSL_CONFIG = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
const ADMIN_CONN = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: 'postgres',
  ssl: SSL_CONFIG,
};

async function run() {
  // Step1: データベース作成
  const adminClient = new Client(ADMIN_CONN);
  await adminClient.connect();
  const exists = await adminClient.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]
  );
  if (exists.rows.length === 0) {
    await adminClient.query(`CREATE DATABASE ${DB_NAME}`);
    console.log(`✅ データベース "${DB_NAME}" を作成しました`);
  } else {
    console.log(`ℹ️  データベース "${DB_NAME}" はすでに存在します`);
  }
  await adminClient.end();

  // Step2: テーブル作成・初期データ投入
  const appClient = new Client({ ...ADMIN_CONN, database: DB_NAME });
  await appClient.connect();

  await appClient.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id             VARCHAR(20)                  NOT NULL,
      password_hash       VARCHAR(255)                 NOT NULL,
      password_changed_at TIMESTAMP WITH TIME ZONE     NOT NULL DEFAULT NOW(),
      failed_login_count  SMALLINT                     NOT NULL DEFAULT 0,
      locked_until        TIMESTAMP WITH TIME ZONE,
      is_active           BOOLEAN                      NOT NULL DEFAULT TRUE,
      created_at          TIMESTAMP WITH TIME ZONE     NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMP WITH TIME ZONE     NOT NULL DEFAULT NOW(),
      CONSTRAINT pk_users PRIMARY KEY (user_id),
      CONSTRAINT chk_failed_count CHECK (failed_login_count >= 0)
    )
  `);
  console.log('✅ users テーブルを確認/作成しました');

  await appClient.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id  VARCHAR(128)                 NOT NULL,
      user_id     VARCHAR(20)                  NOT NULL,
      created_at  TIMESTAMP WITH TIME ZONE     NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMP WITH TIME ZONE     NOT NULL,
      is_revoked  BOOLEAN                      NOT NULL DEFAULT FALSE,
      CONSTRAINT pk_sessions PRIMARY KEY (session_id),
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);
  console.log('✅ sessions テーブルを確認/作成しました');

  await appClient.query(`
    CREATE TABLE IF NOT EXISTS login_histories (
      id           BIGSERIAL                        NOT NULL,
      user_id      VARCHAR(20),
      result       VARCHAR(20)                      NOT NULL,
      ip_address   VARCHAR(45),
      attempted_at TIMESTAMP WITH TIME ZONE         NOT NULL DEFAULT NOW(),
      CONSTRAINT pk_login_histories PRIMARY KEY (id),
      CONSTRAINT chk_result CHECK (result IN ('SUCCESS','FAILED','LOCKED','EXPIRED'))
    )
  `);
  console.log('✅ login_histories テーブルを確認/作成しました');

  // 初期ユーザー投入
  const existing = await appClient.query(
    'SELECT user_id FROM users WHERE user_id = $1', ['user001']
  );
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash('P@ssword', 10);
    await appClient.query(
      'INSERT INTO users (user_id, password_hash) VALUES ($1, $2)',
      ['user001', hash]
    );
    console.log('✅ 初期ユーザー user001 を作成しました（パスワード: P@ssword）');
  } else {
    console.log('ℹ️  初期ユーザー user001 はすでに存在します');
  }

  await appClient.end();
  console.log('\n🎉 DB初期化完了');
}

run().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
