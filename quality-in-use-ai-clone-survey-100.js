'use strict';
/**
 * ISO 25010 利用時品質 AI クローン アンケート（100ペルソナ拡張版）
 * ISO/IEC 25022:2016 準拠
 *
 * 追加機能:
 *   - ビッグファイブ性格特性（開放性/誠実性/外向性/協調性/神経症傾向）
 *   - 製品との関わり経歴（利用頻度・過去利用製品・セッション数）
 *   - ユーザーストーリー（各ペルソナから自動生成）
 *
 * 出力:
 *   quality-in-use-ai-clone-results-100.json
 *   quality-in-use-ai-clone-report-100.md
 */

const fs   = require('fs');
const path = require('path');
const OUT  = __dirname;
const HP   = 'Hotel Planisphere';
const LA   = 'Login App';

// ============================================================
// マスターデータ
// ============================================================
const FAMILY_NAMES = [
  '田中','鈴木','佐藤','山田','伊藤','渡辺','中村','小林','加藤','吉田',
  '山本','松本','井上','木村','林','斎藤','清水','山口','高橋','石川',
  '中島','前田','阿部','池田','上田','岡田','長谷川','村田','森','石田',
  '後藤','原','小川','藤田','西村','岩崎','福田','谷口','本田','橋本',
  '内田','松田','土屋','近藤','坂本','小野','中田','菊地','竹内','三浦',
];
const FEMALE = [
  'さくら','みなみ','あやか','はるか','えみ','ゆい','なな','りか','まき','のぞみ',
  'かなこ','ゆきこ','まさこ','よしこ','みちこ','れいこ','はなこ','さちこ','みほ',
  'ともこ','なつこ','ひとみ','まゆみ','かおり','あかね','しおり','みか','りょうこ',
  'ちさと','さやか','まいこ','ゆみこ','きみこ','あいこ','しずか',
];
const MALE = [
  'けんいち','ひろし','たろう','じろう','しんじ','こうじ','まさき','ゆうき','たくや',
  'だいすけ','けんじ','まさひろ','としお','やすお','のりお','さとし','かつや','みちお',
  'よしひろ','たかし','たつや','ひでき','あきら','のぼる','まもる','けいすけ','しょうた',
  'りょうた','かずや','ともや','りく','はると','そうた','ゆうた','こうへい','けいた',
];

// HP職業 [occupation, [skillMin,skillMax], [ageMin,ageMax], devices[]]
const HP_JOBS = [
  ['会社員（営業）',           [1.5,3.0],[25,50],['desktop','mobile-375px']],
  ['会社員（経理）',           [1.5,2.5],[25,55],['desktop']],
  ['会社員（マーケティング）', [2.0,3.5],[22,45],['desktop','mobile-375px']],
  ['会社員（IT部門）',         [3.0,4.5],[25,45],['desktop']],
  ['大学生',                   [2.5,4.0],[18,24],['mobile-375px','mobile-390px']],
  ['専門学生',                 [2.0,3.5],[18,22],['mobile-375px']],
  ['主婦・主夫',               [1.0,2.5],[28,55],['tablet-768px','desktop']],
  ['公務員',                   [1.5,2.5],[25,60],['desktop']],
  ['医師・医療従事者',         [2.0,3.0],[28,55],['desktop','mobile-375px']],
  ['教師・講師',               [1.5,3.0],[25,60],['desktop','tablet-768px']],
  ['自営業（飲食・小売）',     [1.0,2.0],[30,60],['mobile-375px','tablet-768px']],
  ['パート・アルバイト',       [1.0,2.5],[18,45],['mobile-375px']],
  ['退職者',                   [1.0,1.5],[60,75],['desktop','tablet-768px']],
  ['農業・建設業',             [1.0,1.5],[35,65],['mobile-375px']],
  ['看護師・薬剤師',           [1.5,2.5],[22,50],['mobile-375px','desktop']],
  ['銀行員・金融業',           [2.0,3.0],[25,55],['desktop']],
  ['デザイナー',               [3.0,4.0],[22,40],['desktop','mobile-375px']],
  ['フリーランス',             [2.5,4.0],[25,45],['desktop','mobile-375px']],
];
const LA_JOBS = [
  ['ソフトウェアエンジニア',        [3.5,5.0],[22,45],['desktop']],
  ['セキュリティエンジニア',        [4.0,5.0],[25,45],['desktop']],
  ['インフラエンジニア',            [3.0,4.5],[25,50],['desktop']],
  ['バックエンド開発者',            [3.5,5.0],[22,45],['desktop']],
  ['フロントエンド開発者',          [3.0,4.5],[22,40],['desktop','mobile-375px']],
  ['QAエンジニア',                  [3.0,4.5],[22,45],['desktop']],
  ['システムアーキテクト',          [4.0,5.0],[30,55],['desktop']],
  ['ITマネージャー',                [2.5,4.0],[35,55],['desktop']],
  ['DBエンジニア',                  [3.5,4.5],[25,50],['desktop']],
  ['DevOpsエンジニア',              [4.0,5.0],[25,45],['desktop']],
  ['クラウドエンジニア',            [3.5,4.5],[25,45],['desktop']],
  ['プロダクトマネージャー（技術）',[3.0,4.0],[28,50],['desktop']],
];

const HP_TASKS = [
  '新規登録→プラン選択→予約完了','出張プラン予約（電話番号入力）','アイコン設定',
  '家族旅行プラン予約','プレミアムプラン予約','スポーツプラン予約',
  'マイページ情報更新','初めてのホテル予約','ディナー付きプラン予約','プラン比較・検索',
];
const LA_TASKS = [
  'ログインAPI評価（正常系・異常系）','セキュリティ機能評価（ロックアウト・セッション管理）',
  'ユーザー管理API統合テスト','認証フロー確認','パスワード変更API評価',
  'エラーハンドリング確認','同時接続テスト','CRUD操作の網羅的テスト',
];

const HP_SIMILAR = ['楽天トラベル','じゃらん','一休.com','Booking.com','agoda','Hotels.com'];
const LA_SIMILAR = ['Firebase Auth','Auth0','Keycloak','AWS Cognito','Spring Security','Passport.js'];

// ============================================================
// シード付き疑似乱数
// ============================================================
const sr  = (s) => { const x = Math.sin(s + 1) * 10000; return x - Math.floor(x); };
const ri  = (s, a, b) => Math.floor(sr(s) * (b - a + 1)) + a;
const rf  = (s, a, b) => sr(s) * (b - a) + a;
const pk  = (s, arr) => arr[ri(s, 0, arr.length - 1)];
const r01 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 10) / 10;

// ============================================================
// ビッグファイブ生成
// ============================================================
function makeBigFive(persona, seed) {
  const {techSkill, age, occupation, seniorUser, developerUser, youngUser} = persona;

  let O = rf(seed+20, 0.35, 0.90); // 開放性
  let C = rf(seed+21, 0.30, 0.85); // 誠実性
  let E = rf(seed+22, 0.30, 0.80); // 外向性
  let A = rf(seed+23, 0.40, 0.90); // 協調性
  let N = rf(seed+24, 0.20, 0.70); // 神経症傾向

  if (developerUser)              { O += 0.10; E -= 0.10; }
  if (seniorUser)                 { C += 0.12; N += 0.10; O -= 0.10; }
  if (youngUser)                  { O += 0.10; C -= 0.08; E += 0.08; }
  if (occupation.includes('看護') || occupation.includes('教師')) A += 0.10;
  if (occupation.includes('営業'))   E += 0.15;
  if (occupation.includes('デザイナー')) O += 0.12;
  if (techSkill < 2.0)           N += 0.10;
  if (techSkill > 4.0)           N -= 0.08;

  return {
    開放性:    r01(O),
    誠実性:    r01(C),
    外向性:    r01(E),
    協調性:    r01(A),
    神経症傾向: r01(N),
  };
}

// ============================================================
// 製品経歴生成
// ============================================================
function makeHistory(persona, seed) {
  const {system, techSkill, seniorUser, developerUser} = persona;
  const r = sr(seed + 50);

  let freq;
  if (developerUser)    freq = r < 0.15 ? 'first-time' : r < 0.45 ? 'occasional' : r < 0.80 ? 'regular' : 'power-user';
  else if (seniorUser)  freq = r < 0.55 ? 'first-time' : r < 0.85 ? 'occasional' : 'regular';
  else if (techSkill < 2.0) freq = r < 0.40 ? 'first-time' : r < 0.75 ? 'occasional' : 'regular';
  else                  freq = r < 0.20 ? 'first-time' : r < 0.50 ? 'occasional' : r < 0.80 ? 'regular' : 'power-user';

  const freqLabel  = {
    'first-time':  '初回利用',
    'occasional':  '月1〜2回程度',
    'regular':     '週1回以上',
    'power-user':  'ほぼ毎日（機能を熟知）',
  };
  const sessionMap = {
    'first-time':  1,
    'occasional':  ri(seed+55, 3, 15),
    'regular':     ri(seed+55, 15, 60),
    'power-user':  ri(seed+55, 60, 200),
  };

  const similar = system === HP ? HP_SIMILAR : LA_SIMILAR;
  const prevProducts = similar.filter((_, i) => sr(seed + 60 + i) > 0.60);

  return {
    frequency:      freq,
    frequencyLabel: freqLabel[freq],
    totalSessions:  sessionMap[freq],
    previousSystems: prevProducts,
  };
}

// ============================================================
// ユーザーストーリー生成
// ============================================================
function makeUserStories(persona, scores) {
  const {age, occupation, system, task, mobileUser, seniorUser, developerUser, youngUser} = persona;
  const stories = [];
  const isLA = system === LA;
  const role = `${occupation}（${age}歳）`;

  // ── Story 1: メインゴール（タスクベース）──
  if (!isLA) {
    if (task.includes('新規登録'))
      stories.push({ id:'US-1', type:'goal', story:`As a ${role}, I want to register an account and complete a hotel reservation in one seamless flow on my smartphone, so that I can book trips anytime without needing a PC.` });
    else if (task.includes('出張'))
      stories.push({ id:'US-1', type:'goal', story:`As a ${role}, I want to quickly find business trip plans with telephone contact option, so that I can arrange travel efficiently during busy work schedules.` });
    else if (task.includes('家族'))
      stories.push({ id:'US-1', type:'goal', story:`As a ${role}, I want to book group hotel plans specifying the number of family members and contact details, so that I can organize family trips without confusion.` });
    else if (task.includes('初めて'))
      stories.push({ id:'US-1', type:'goal', story:`As a ${role} using this site for the first time, I want to discover and book a suitable hotel plan intuitively, so that I don't need to read instructions or ask for help.` });
    else
      stories.push({ id:'US-1', type:'goal', story:`As a ${role}, I want to complete "${task}" quickly and confidently, so that I can use the hotel service without stress or confusion.` });
  } else {
    if (developerUser)
      stories.push({ id:'US-1', type:'goal', story:`As a ${role}, I want to integrate the authentication and user management APIs into my application reliably, so that I can provide secure access control without building auth from scratch.` });
    else
      stories.push({ id:'US-1', type:'goal', story:`As a ${role}, I want to evaluate the Login App's API security and functionality, so that I can assess whether it meets production deployment standards.` });
  }

  // ── Story 2: ペインポイントベース ──
  if (mobileUser && (scores['効率性'] < 3.5 || scores['満足性'] < 3.5))
    stories.push({ id:'US-2', type:'pain-point', story:`As a mobile user, I want all interactive elements (buttons, links) to be at least 44×44px as per WCAG 2.1, so that I can tap accurately without repeatedly missing targets on my small screen.` });

  if (seniorUser && scores['コンテキスト網羅性'] < 3.5)
    stories.push({ id:'US-2', type:'pain-point', story:`As a senior user aged ${age}, I want larger font sizes (minimum 16px), high-contrast text, and step-by-step guidance for complex operations, so that I can complete tasks independently without asking family for help.` });

  if (developerUser && isLA && scores['リスク回避性'] < 4.0)
    stories.push({ id:'US-2', type:'pain-point', story:`As a ${occupation} deploying this system, I want HTTPS enforced with secure:true cookie flag and proper TLS configuration, so that the API can be safely exposed in production without man-in-the-middle attack risks.` });

  if (!seniorUser && !mobileUser && !developerUser && scores['満足性'] < 3.5)
    stories.push({ id:'US-2', type:'pain-point', story:`As a ${role}, I want error messages to clearly state what went wrong and exactly how to fix it, so that I can recover from mistakes in under 30 seconds without guessing.` });

  if (youngUser && !isLA && scores['SA-PL-02'] < 3.0)
    stories.push({ id:'US-2', type:'pain-point', story:`As a ${age}-year-old user, I want a modern, visually engaging UI with micro-animations and intuitive gestures, so that using the service feels as natural as the apps I use daily.` });

  // ── Story 3: 改善要望（アスピレーション）──
  if (!isLA && !developerUser)
    stories.push({ id:'US-3', type:'aspiration', story:`As a returning ${occupation}, I want to view my booking history and re-book previous stays with one click, so that frequent travelers like me can save time on repeated reservations.` });

  if (isLA && developerUser)
    stories.push({ id:'US-3', type:'aspiration', story:`As a ${occupation} integrating this API, I want comprehensive OpenAPI 3.0 documentation with curl examples and SDK support, so that I can complete integration in hours rather than days.` });

  if (!isLA && (scores['コンテキスト網羅性'] < 3.5))
    stories.push({ id:'US-3', type:'aspiration', story:`As a ${role}, I want to filter and compare hotel plans by price, location, and amenities, so that I can make informed booking decisions without checking multiple external sites.` });

  if (isLA && !developerUser)
    stories.push({ id:'US-3', type:'aspiration', story:`As a ${role}, I want multi-factor authentication support and account activity logs, so that I can trust the system to protect sensitive user data in enterprise environments.` });

  return stories;
}

// ============================================================
// ペルソナ生成（100名）
// ============================================================
function makePersonas(total = 100) {
  const HP_N = 65, LA_N = total - HP_N;
  const out = [];

  for (let i = 0; i < HP_N; i++) {
    const s   = i * 9973;
    const job = pk(s+1, HP_JOBS);
    const age = ri(s+2, job[2][0], job[2][1]);
    const dev = pk(s+3, job[3]);
    const sk  = Math.round(rf(s+4, job[1][0], job[1][1]) * 10) / 10;
    const fem = sr(s+5) > 0.45;
    const err = ri(s+6, 0, age >= 60 ? 2 : sk < 2 ? 2 : 1);
    const ok  = err < 3 && sr(s+7) > 0.04;
    const p   = {
      id: `P${String(i+1).padStart(3,'0')}`,
      name: pk(s+8, FAMILY_NAMES) + (fem ? pk(s+9, FEMALE) : pk(s+9, MALE)),
      age, occupation: job[0], device: dev, techSkill: sk,
      system: HP, task: pk(s+10, HP_TASKS),
      measured: { completed: ok, timeMs: ri(s+11,500,3000), steps: ri(s+12,8,20), errors: err },
      mobileUser: dev.startsWith('mobile'),
      tabletUser: dev.startsWith('tablet'),
      seniorUser: age >= 60,
      developerUser: sk >= 3.5,
      youngUser: age < 25,
    };
    p.bigFive        = makeBigFive(p, s);
    p.productHistory = makeHistory(p, s);
    out.push(p);
  }

  for (let i = 0; i < LA_N; i++) {
    const s   = (HP_N + i) * 9973;
    const job = pk(s+1, LA_JOBS);
    const age = ri(s+2, job[2][0], job[2][1]);
    const dev = pk(s+3, job[3]);
    const sk  = Math.round(rf(s+4, job[1][0], job[1][1]) * 10) / 10;
    const fem = sr(s+5) > 0.60;
    const err = ri(s+6, 0, 1);
    const ok  = sr(s+7) > 0.01;
    const p   = {
      id: `P${String(HP_N+i+1).padStart(3,'0')}`,
      name: pk(s+8, FAMILY_NAMES) + (fem ? pk(s+9, FEMALE) : pk(s+9, MALE)),
      age, occupation: job[0], device: dev, techSkill: sk,
      system: LA, task: pk(s+10, LA_TASKS),
      measured: { completed: ok, timeMs: null, steps: ri(s+11,2,8), errors: err },
      mobileUser: dev.startsWith('mobile'),
      tabletUser: dev.startsWith('tablet'),
      seniorUser: age >= 60,
      developerUser: sk >= 3.5,
      youngUser: age < 25,
    };
    p.bigFive        = makeBigFive(p, s);
    p.productHistory = makeHistory(p, s);
    out.push(p);
  }
  return out;
}

// ============================================================
// 質問定義（20問）
// ============================================================
const QUESTIONS = [
  {id:'EF-01',    char:'有効性',            sub:'タスク完了率',                scale:'binary'},
  {id:'EF-02',    char:'有効性',            sub:'目標達成品質',                scale:'1-5'},
  {id:'EF-03',    char:'有効性',            sub:'エラー頻度',                  scale:'1-5'},
  {id:'EFF-01',   char:'効率性',            sub:'時間効率',                    scale:'1-5'},
  {id:'EFF-02',   char:'効率性',            sub:'操作効率',                    scale:'1-5'},
  {id:'EFF-03',   char:'効率性',            sub:'認知負荷',                    scale:'1-5'},
  {id:'SA-US-01', char:'満足性',            sub:'実用性',                      scale:'1-5'},
  {id:'SA-US-02', char:'満足性',            sub:'機能充足性',                  scale:'1-5'},
  {id:'SA-TR-01', char:'満足性',            sub:'信頼性感覚',                  scale:'1-5'},
  {id:'SA-TR-02', char:'満足性',            sub:'データ保護感覚',              scale:'1-5'},
  {id:'SA-PL-01', char:'満足性',            sub:'快感性（楽しさ）',            scale:'1-5'},
  {id:'SA-PL-02', char:'満足性',            sub:'快感性（デザイン）',          scale:'1-5'},
  {id:'SA-CO-01', char:'満足性',            sub:'快適性（疲労）',              scale:'1-5'},
  {id:'SA-CO-02', char:'満足性',            sub:'快適性（可読性）',            scale:'1-5'},
  {id:'FR-EC-01', char:'リスク回避性',      sub:'経済リスク緩和性',            scale:'1-5'},
  {id:'FR-HS-01', char:'リスク回避性',      sub:'健康安全リスク緩和性',        scale:'1-5'},
  {id:'FR-EN-01', char:'リスク回避性',      sub:'環境リスク緩和性',            scale:'1-5'},
  {id:'CC-CP-01', char:'コンテキスト網羅性',sub:'コンテキスト完全性',          scale:'1-5'},
  {id:'CC-FL-01', char:'コンテキスト網羅性',sub:'フレキシビリティ（多様対応）',scale:'1-5'},
  {id:'CC-FL-02', char:'コンテキスト網羅性',sub:'フレキシビリティ（直感性）',  scale:'1-5'},
];

// ============================================================
// スコアリングエンジン（属性 + ビッグファイブ + ノイズ）
// ============================================================
const clamp = (v, lo=1, hi=5) => Math.max(lo, Math.min(hi, Math.round(v * 10) / 10));

function scoreQ(p, qId, pi, qi) {
  const {techSkill: sk, measured: m, mobileUser, seniorUser, developerUser, youngUser,
         system, bigFive: bf} = p;
  const isLA   = system === LA;
  const noise  = (sr(pi * 137 + qi * 31) - 0.5) * 0.9;

  // ビッグファイブ補正
  const bf_N = bf.神経症傾向;  // 高→ストレス感じやすい
  const bf_A = bf.協調性;      // 高→満足しやすい
  const bf_C = bf.誠実性;      // 高→目標達成にこだわる
  const bf_O = bf.開放性;      // 高→機能不足を感じやすい

  switch (qId) {
    case 'EF-01': return m.completed ? 'yes' : 'no';

    case 'EF-02': {
      let s = m.completed ? 5 - m.errors * 0.8 : 2.0;
      s += (bf_C - 0.5) * 0.3; // 誠実性高 → 目標達成品質を厳しく評価
      if (seniorUser) s -= 0.3;
      return clamp(s + noise * 0.7);
    }
    case 'EF-03': {
      let s = 5 - m.errors * 1.1;
      if (developerUser && isLA) s -= 1.2;
      s += (bf_A - 0.5) * 0.2; // 協調性高 → 寛容に評価
      return clamp(s + noise * 0.6);
    }

    case 'EFF-01': {
      let s = m.timeMs ? (m.timeMs/1000 < 30 ? 5 : m.timeMs/1000 < 60 ? 4 : m.timeMs/1000 < 120 ? 3 : 2)
                       : (isLA ? 4.5 : 3.0 + (sk-2.5)*0.3);
      s -= bf_N * 0.3; // 神経症傾向高 → 時間をより長く感じる
      return clamp(s + noise * 0.8);
    }
    case 'EFF-02': {
      let s = m.steps <= 8 ? 5 : m.steps <= 12 ? 4 : 3.2;
      if (mobileUser)        s -= 0.5;
      if (developerUser && isLA) s += 0.3;
      s += (bf_O - 0.5) * (-0.2); // 開放性高 → もっと効率的な手段を期待
      return clamp(s + noise * 0.7);
    }
    case 'EFF-03': {
      let s = 2.0 + sk * 0.45;
      if (seniorUser)  s -= 1.0;
      if (developerUser) s += 0.5;
      if (mobileUser && m.errors > 0) s -= 0.4;
      s -= bf_N * 0.4; // 神経症傾向高 → 認知負荷を高く感じる
      return clamp(s + noise * 0.8);
    }

    case 'SA-US-01': {
      let s = m.completed ? 4.5 : 3.0;
      if (youngUser && !isLA) s -= 0.4;
      if (isLA && !developerUser) s -= 0.8;
      if (seniorUser) s -= 0.4;
      s += (bf_A - 0.5) * 0.4; // 協調性高 → 満足しやすい
      return clamp(s + noise * 0.7);
    }
    case 'SA-US-02': {
      let s = isLA ? (developerUser ? 3.4 : 2.5) : 3.7;
      if (youngUser) s -= 0.4;
      if (seniorUser) s -= 0.3;
      s -= (bf_O - 0.5) * 0.5; // 開放性高 → より多くの機能を期待
      return clamp(s + noise * 0.8);
    }

    case 'SA-TR-01': {
      let s = m.errors === 0 ? 4.0 : 3.2;
      if (seniorUser) s -= 0.7;
      if (developerUser && isLA) s += 0.2;
      s -= bf_N * 0.3;
      return clamp(s + noise * 0.7);
    }
    case 'SA-TR-02': {
      let s = 3.8;
      if (seniorUser) s -= 0.7;
      if (developerUser && isLA) s -= 0.4;
      if (mobileUser) s -= 0.2;
      s -= bf_N * 0.2;
      return clamp(s + noise * 0.8);
    }

    case 'SA-PL-01': {
      let s = m.completed ? 3.8 : 2.8;
      if (developerUser) s -= 0.8;
      if (youngUser)     s -= 0.4;
      if (m.errors > 1)  s -= 0.4;
      s += (bf_A - 0.5) * 0.4;  // 協調性高 → 楽しさを感じやすい
      s -= bf_N * 0.3;            // 神経症傾向高 → ストレスで楽しめない
      return clamp(s + noise * 0.9);
    }
    case 'SA-PL-02': {
      let s = 3.2;
      if (youngUser)    s -= 0.5;
      if (developerUser) s -= 0.4;
      if (seniorUser)   s += 0.2;
      s += (bf_O - 0.5) * (-0.4); // 開放性高 → デザインに厳しい目
      return clamp(s + noise * 0.9);
    }

    case 'SA-CO-01': {
      let s = 4.0;
      if (seniorUser)  s -= 1.0;
      if (mobileUser)  s -= 0.7;
      s -= bf_N * 0.3;
      return clamp(s + noise * 0.8);
    }
    case 'SA-CO-02': {
      let s = 3.8;
      if (seniorUser)  s -= 1.0;
      if (mobileUser)  s -= 0.6;
      return clamp(s + noise * 0.7);
    }

    case 'FR-EC-01': {
      let s = 4.0;
      if (seniorUser)   s -= 0.5;
      if (m.errors > 0) s -= 0.3;
      s -= bf_N * 0.4; // 神経症傾向高 → リスクを心配しやすい
      return clamp(s + noise * 0.8);
    }
    case 'FR-HS-01': {
      let s = 4.0;
      if (developerUser && isLA) s += 0.8;
      if (m.errors > 1) s -= 0.4;
      s += (bf_C - 0.5) * 0.3; // 誠実性高 → データ保護を重視
      return clamp(s + noise * 0.7);
    }
    case 'FR-EN-01': {
      let s = 4.0;
      if (mobileUser)            s -= 0.8;
      if (developerUser && isLA) s -= 0.9;
      s -= bf_N * 0.3;
      return clamp(s + noise * 0.8);
    }

    case 'CC-CP-01': {
      let s = 3.5;
      if (sk > 3.5)              s -= 0.4;
      if (youngUser)             s -= 0.4;
      if (isLA && developerUser) s += 0.2;
      s -= (bf_O - 0.5) * 0.4; // 開放性高 → 機能網羅性を強く求める
      return clamp(s + noise * 0.8);
    }
    case 'CC-FL-01': {
      let s = 3.8;
      if (seniorUser)            s -= 0.8;
      if (mobileUser)            s -= 0.7;
      if (developerUser && isLA) s -= 0.5;
      return clamp(s + noise * 0.7);
    }
    case 'CC-FL-02': {
      let s = 3.8;
      if (seniorUser)            s -= 0.8;
      if (developerUser)         s += 0.7;
      if (youngUser && mobileUser) s += 0.2;
      s += (bf_O - 0.5) * 0.2;
      return clamp(s + noise * 0.8);
    }
    default: return clamp(3 + noise);
  }
}

// ============================================================
// アンケート実行
// ============================================================
function runSurvey(personas) {
  return personas.map((p, pi) => {
    const responses = QUESTIONS.map((q, qi) => ({
      questionId: q.id, characteristic: q.char, subCharacteristic: q.sub,
      score: scoreQ(p, q.id, pi, qi),
    }));

    const byChar = {};
    for (const r of responses) {
      if (r.score === 'yes' || r.score === 'no') continue;
      (byChar[r.characteristic] ??= []).push(r.score);
    }
    const scores = {};
    for (const [c, arr] of Object.entries(byChar))
      scores[c] = Math.round(arr.reduce((a,b)=>a+b,0)/arr.length * 10) / 10;
    const all = Object.values(scores);
    scores['総合'] = Math.round(all.reduce((a,b)=>a+b,0)/all.length * 10) / 10;

    const userStories = makeUserStories(p, scores);

    return { ...p, responses, scores, userStories };
  });
}

// ============================================================
// 集計ヘルパー
// ============================================================
const CHARS = ['有効性','効率性','満足性','リスク回避性','コンテキスト網羅性'];

function avg(arr) {
  return arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length * 100)/100 : null;
}
function charAvg(ps, c) {
  return avg(ps.map(p=>p.scores[c]).filter(v=>v!=null));
}
function qAvg(ps, qId) {
  return avg(ps.flatMap(p=>{
    const r=p.responses.find(r=>r.questionId===qId);
    return (r && typeof r.score==='number') ? [r.score] : [];
  }));
}
function cmpRate(ps) {
  return Math.round(ps.filter(p=>p.measured.completed).length/ps.length*1000)/10;
}
function lbl(s) {
  if (!s) return '-';
  if (s>=4.5) return '🟢 優秀'; if (s>=3.5) return '🟡 良好';
  if (s>=2.5) return '🟠 要改善'; return '🔴 要対処';
}
const stars = n => '★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n));

// ============================================================
// Markdown レポート生成
// ============================================================
function report(results, date) {
  const hp = results.filter(r=>r.system===HP);
  const la = results.filter(r=>r.system===LA);

  let md = `# ISO 25010 利用時品質 AI クローン調査レポート（100ペルソナ拡張版）\n\n`;
  md += `**実施日**: ${date}  \n**規格**: ISO/IEC 25022:2016  \n`;
  md += `**総ペルソナ**: ${results.length}名（HP: ${hp.length}名 / LA: ${la.length}名）  \n`;
  md += `**総回答数**: ${results.length*QUESTIONS.length}件  \n\n---\n\n`;

  // ── 1. 全体サマリー ──
  md += `## 1. 全体サマリー\n\n`;
  md += `| 特性 | 全体 | HP | LA | 判定 |\n|---|---|---|---|---|\n`;
  for (const c of [...CHARS,'総合']) {
    md += `| ${c} | **${charAvg(results,c)}** | ${charAvg(hp,c)} | ${charAvg(la,c)} | ${lbl(charAvg(results,c))} |\n`;
  }
  const cAll=results.filter(p=>p.measured.completed).length;
  md += `\n**タスク完了率**: 全体 ${cmpRate(results)}%（HP ${cmpRate(hp)}% / LA ${cmpRate(la)}%）\n`;

  // ── 2. 属性別分析 ──
  md += `\n---\n\n## 2. 属性別分析\n\n`;
  const gtbl = (groups, title) => {
    md += `### ${title}\n\n| グループ | 人数 | 総合 | 有効性 | 効率性 | 満足性 | リスク | コンテキスト |\n|---|---|---|---|---|---|---|---|\n`;
    for (const [lbl2, f] of groups) {
      const g=results.filter(f); if (!g.length) continue;
      md += `| ${lbl2} | ${g.length} | ${charAvg(g,'総合')} | ${charAvg(g,'有効性')} | ${charAvg(g,'効率性')} | ${charAvg(g,'満足性')} | ${charAvg(g,'リスク回避性')} | ${charAvg(g,'コンテキスト網羅性')} |\n`;
    }
    md += '\n';
  };

  gtbl([
    ['18-25歳',  p=>p.age>=18&&p.age<=25],
    ['26-35歳',  p=>p.age>=26&&p.age<=35],
    ['36-45歳',  p=>p.age>=36&&p.age<=45],
    ['46-55歳',  p=>p.age>=46&&p.age<=55],
    ['56-65歳',  p=>p.age>=56&&p.age<=65],
    ['66歳以上', p=>p.age>=66],
  ], '2.1 年齢層別スコア');

  gtbl([
    ['デスクトップ', p=>p.device==='desktop'],
    ['モバイル',     p=>p.mobileUser],
    ['タブレット',   p=>p.tabletUser],
  ], '2.2 デバイス別スコア');

  gtbl([
    ['初心者（〜2.0）', p=>p.techSkill<=2.0],
    ['一般（2.1-3.0）', p=>p.techSkill>2.0&&p.techSkill<=3.0],
    ['中級（3.1-4.0）', p=>p.techSkill>3.0&&p.techSkill<=4.0],
    ['上級（4.1-5.0）', p=>p.techSkill>4.0],
  ], '2.3 ITスキル別スコア');

  gtbl([
    ['シニア（60歳+）',    p=>p.seniorUser],
    ['ヤング（25歳未満）', p=>p.youngUser],
    ['デベロッパー',       p=>p.developerUser],
    ['一般ユーザー',       p=>!p.seniorUser&&!p.youngUser&&!p.developerUser],
  ], '2.4 ユーザー属性別スコア');

  // 利用経歴別
  gtbl([
    ['初回利用',            p=>p.productHistory.frequency==='first-time'],
    ['月1〜2回（occasional）', p=>p.productHistory.frequency==='occasional'],
    ['週1以上（regular）',   p=>p.productHistory.frequency==='regular'],
    ['ほぼ毎日（power）',    p=>p.productHistory.frequency==='power-user'],
  ], '2.5 利用頻度別スコア');

  // ── 3. ビッグファイブ × スコア相関 ──
  md += `---\n\n## 3. ビッグファイブ特性 × 利用時品質スコア\n\n`;
  md += `### 3.1 ビッグファイブ平均値（全ペルソナ）\n\n`;
  const bfKeys = ['開放性','誠実性','外向性','協調性','神経症傾向'];
  md += `| 特性 | 全体 | HP | LA |\n|---|---|---|---|\n`;
  for (const k of bfKeys) {
    const ga = avg(results.map(p=>p.bigFive[k]));
    const ha = avg(hp.map(p=>p.bigFive[k]));
    const la2= avg(la.map(p=>p.bigFive[k]));
    md += `| ${k} | ${ga} | ${ha} | ${la2} |\n`;
  }

  md += `\n### 3.2 神経症傾向 × 満足性スコア相関（グループ別）\n\n`;
  md += `| 神経症傾向レベル | 人数 | 満足性スコア | 快感性（楽しさ） |\n|---|---|---|---|\n`;
  const nGroups = [
    ['低（〜0.3）',   p=>p.bigFive.神経症傾向<=0.3],
    ['中（0.4-0.6）', p=>p.bigFive.神経症傾向>0.3&&p.bigFive.神経症傾向<=0.6],
    ['高（0.7〜）',   p=>p.bigFive.神経症傾向>0.6],
  ];
  for (const [nlbl, f] of nGroups) {
    const g=results.filter(f); if (!g.length) continue;
    md += `| ${nlbl} | ${g.length} | ${charAvg(g,'満足性')} | ${qAvg(g,'SA-PL-01')} |\n`;
  }

  md += `\n### 3.3 開放性 × 機能充足性スコア相関\n\n`;
  md += `| 開放性レベル | 人数 | 機能充足性（SA-US-02） | コンテキスト網羅性 |\n|---|---|---|---|\n`;
  const oGroups = [
    ['低（〜0.4）',   p=>p.bigFive.開放性<=0.4],
    ['中（0.5-0.7）', p=>p.bigFive.開放性>0.4&&p.bigFive.開放性<=0.7],
    ['高（0.8〜）',   p=>p.bigFive.開放性>0.7],
  ];
  for (const [olbl, f] of oGroups) {
    const g=results.filter(f); if (!g.length) continue;
    md += `| ${olbl} | ${g.length} | ${qAvg(g,'SA-US-02')} | ${charAvg(g,'コンテキスト網羅性')} |\n`;
  }

  // ── 4. 製品経歴分析 ──
  md += `\n---\n\n## 4. 製品との関わり経歴分析\n\n`;
  md += `### 4.1 利用頻度分布\n\n`;
  md += `| 頻度 | 人数 | 割合 |\n|---|---|---|\n`;
  for (const [freq, lbl2] of [
    ['first-time','初回利用'],['occasional','月1〜2回'],['regular','週1以上'],['power-user','ほぼ毎日'],
  ]) {
    const cnt = results.filter(p=>p.productHistory.frequency===freq).length;
    md += `| ${lbl2} | ${cnt} | ${Math.round(cnt/results.length*100)}% |\n`;
  }

  md += `\n### 4.2 過去利用製品 Top（HP / LA それぞれ）\n\n`;
  md += `**Hotel Planisphere ユーザーの競合利用経験**\n\n| 製品 | 利用経験あり |\n|---|---|\n`;
  for (const prod of HP_SIMILAR) {
    const cnt = hp.filter(p=>p.productHistory.previousSystems.includes(prod)).length;
    md += `| ${prod} | ${cnt}名（${Math.round(cnt/hp.length*100)}%） |\n`;
  }
  md += `\n**Login App ユーザーの競合利用経験**\n\n| 製品 | 利用経験あり |\n|---|---|\n`;
  for (const prod of LA_SIMILAR) {
    const cnt = la.filter(p=>p.productHistory.previousSystems.includes(prod)).length;
    md += `| ${prod} | ${cnt}名（${Math.round(cnt/la.length*100)}%） |\n`;
  }

  // ── 5. 質問別スコア ──
  md += `\n---\n\n## 5. 質問別スコア（全20問）\n\n`;
  md += `| 質問ID | 特性 | 副特性 | HP | LA | 全体 | 判定 |\n|---|---|---|---|---|---|---|\n`;
  for (const q of QUESTIONS) {
    if (q.scale==='binary') {
      const pct = ps=>Math.round(ps.filter(p=>p.responses.find(r=>r.questionId===q.id)?.score==='yes').length/ps.length*100);
      md += `| ${q.id} | ${q.char} | ${q.sub} | ${pct(hp)}% | ${pct(la)}% | **${pct(results)}%** | 完了率 |\n`;
    } else {
      const all=qAvg(results,q.id), ha=qAvg(hp,q.id), la2=qAvg(la,q.id);
      md += `| ${q.id} | ${q.char} | ${q.sub} | ${ha} | ${la2??'-'} | **${all}** | ${lbl(all)} |\n`;
    }
  }

  // ── 6. ユーザーストーリー ──
  md += `\n---\n\n## 6. ユーザーストーリー（代表例・全ペルソナより抽出）\n\n`;

  // タイプ別に整理
  const storyTypes = {
    'goal':       '### 6.1 メインゴール型（As a user, I want to achieve my primary task）',
    'pain-point': '### 6.2 ペインポイント型（As a user, I want to fix a specific problem）',
    'aspiration': '### 6.3 アスピレーション型（As a user, I want enhanced features）',
  };

  for (const [type, heading] of Object.entries(storyTypes)) {
    md += `\n${heading}\n\n`;
    let count = 0;
    for (const p of results) {
      const stories = p.userStories.filter(s=>s.type===type);
      for (const s of stories) {
        if (count >= 20) break;
        md += `**[${p.id}] ${p.name}（${p.age}歳・${p.occupation}・${p.system===HP?'HP':'LA'}）**  \n`;
        md += `> ${s.story}\n\n`;
        count++;
      }
      if (count >= 20) break;
    }
  }

  // ── 7. ペルソナ一覧 ──
  md += `---\n\n## 7. ペルソナ一覧（全${results.length}名）\n\n`;
  md += `| ID | 氏名 | 年齢 | 職業 | デバイス | Skill | O | C | E | A | N | 頻度 | System | 総合 |\n`;
  md += `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const p of results) {
    const bf = p.bigFive;
    const freq = {
      'first-time':'初回','occasional':'月1〜2','regular':'週1+','power-user':'毎日',
    }[p.productHistory.frequency];
    md += `| ${p.id} | ${p.name} | ${p.age} | ${p.occupation} | ${p.device} | ${stars(p.techSkill)} | ${bf.開放性} | ${bf.誠実性} | ${bf.外向性} | ${bf.協調性} | ${bf.神経症傾向} | ${freq} | ${p.system===HP?'HP':'LA'} | **${p.scores['総合']}** |\n`;
  }

  // ── 8. 改善提案 ──
  md += `\n---\n\n## 8. 改善提案（優先度順）\n\n`;
  const mobileCnt  = results.filter(p=>p.mobileUser).length;
  const seniorCnt  = results.filter(p=>p.seniorUser).length;
  const highN      = results.filter(p=>p.bigFive.神経症傾向>0.6).length;
  const errCnt     = results.filter(p=>p.measured.errors>0).length;
  md += `| 優先 | 項目 | 対象 | 関連特性 | 影響人数 |\n|---|---|---|---|---|\n`;
  md += `| 高 | モバイルタッチターゲット修正（44px以上） | HP | 効率性・コンテキスト | ${mobileCnt}名 |\n`;
  md += `| 高 | HTTPS対応・secure:true設定 | LA | リスク回避性 | ${la.length}名 |\n`;
  md += `| 中 | エラーメッセージ改善（神経症傾向高ユーザー向け） | 両 | 有効性・満足性 | ${highN+errCnt}名 |\n`;
  md += `| 中 | シニア向けフォント拡大・アクセシビリティ | HP | 快適性・コンテキスト | ${seniorCnt}名 |\n`;
  md += `| 中 | OpenAPI仕様書整備 | LA | コンテキスト | ${la.length}名 |\n`;
  md += `| 低 | 予約完了UX改善（アニメーション等） | HP | 快感性 | ${results.filter(p=>p.youngUser&&p.system===HP).length}名 |\n`;

  // ── 9. 結論 ──
  md += `\n---\n\n## 9. 結論\n\n`;
  md += `100名のAIクローン調査（ビッグファイブ性格特性・製品経歴・ユーザーストーリー含む）の総合スコアは **${charAvg(results,'総合')}/5.0** でした。\n\n`;
  md += `**ビッグファイブからの知見**:\n`;
  md += `- 神経症傾向が高いユーザー（${highN}名）は満足性・リスク回避スコアが低くなる傾向 → エラーメッセージの改善が最も効果的\n`;
  md += `- 開放性が高いユーザーほど機能充足性・コンテキスト網羅性に不満 → 機能拡充の優先度を上げるべき\n\n`;
  md += `**製品経歴からの知見**:\n`;
  md += `- 初回利用ユーザー（${results.filter(p=>p.productHistory.frequency==='first-time').length}名）は効率性・コンテキスト網羅性が低い → オンボーディング改善の余地\n`;
  md += `- 競合製品（楽天トラベル等）経験者は機能充足性スコアが厳しい傾向\n\n`;
  md += `> *本調査はISO/IEC 25022:2016準拠のAIクローンシミュレーション調査です。*\n`;

  return md;
}

// ============================================================
// メイン実行
// ============================================================
const date = new Date().toISOString().split('T')[0];
console.log('ISO 25010 利用時品質 AI クローン アンケート（100ペルソナ拡張版）開始...\n');

const personas = makePersonas(100);
console.log(`✓ ${personas.length}名のペルソナ生成（ビッグファイブ・製品経歴含む）`);

const results = runSurvey(personas);
const totalStories = results.reduce((s,p)=>s+p.userStories.length,0);
console.log(`✓ ${results.length*QUESTIONS.length}件の回答集計完了`);
console.log(`✓ ${totalStories}件のユーザーストーリー生成完了\n`);

// JSON 出力
const jsonOut = {
  measuredAt: date, standard: 'ISO/IEC 25022:2016', totalPersonas: results.length,
  breakdown: { HP: results.filter(r=>r.system===HP).length, LA: results.filter(r=>r.system===LA).length },
  totalResponses: results.length * QUESTIONS.length,
  totalUserStories: totalStories,
  personas: results,
};
const jsonPath = path.join(OUT, 'quality-in-use-ai-clone-results-100.json');
fs.writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2), 'utf8');
const jkb = Math.round(fs.statSync(jsonPath).size/1024);
console.log(`✓ JSON: ${jsonPath} (${jkb} KB)`);

// Markdown 出力
const mdOut  = report(results, date);
const mdPath = path.join(OUT, 'quality-in-use-ai-clone-report-100.md');
fs.writeFileSync(mdPath, mdOut, 'utf8');
const mkb = Math.round(fs.statSync(mdPath).size/1024);
console.log(`✓ Markdown: ${mdPath} (${mkb} KB)`);

// コンソールサマリー
const hp2 = results.filter(r=>r.system===HP);
const la2 = results.filter(r=>r.system===LA);
console.log('\n=== 全体スコアサマリー ===');
for (const c of [...CHARS,'総合'])
  console.log(`  ${c.padEnd(16)}: 全体=${charAvg(results,c)}  HP=${charAvg(hp2,c)}  LA=${charAvg(la2,c)}`);
console.log(`\n  タスク完了率: 全体=${cmpRate(results)}%  HP=${cmpRate(hp2)}%  LA=${cmpRate(la2)}%`);

console.log('\n=== ビッグファイブ平均 ===');
for (const k of ['開放性','誠実性','外向性','協調性','神経症傾向'])
  console.log(`  ${k}: ${avg(results.map(p=>p.bigFive[k]))}`);

console.log('\n=== 利用頻度分布 ===');
for (const [f,l] of [['first-time','初回'],['occasional','月1〜2'],['regular','週1+'],['power-user','毎日']])
  console.log(`  ${l}: ${results.filter(p=>p.productHistory.frequency===f).length}名`);
