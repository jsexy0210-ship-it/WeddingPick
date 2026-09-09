#!/usr/bin/env node
/**
 * 아직 적용되지 않은 마이그레이션에 되돌릴 수 없는 구문이 있는지 본다.
 *
 * **왜 필요한가.** main에 push하면 `deploy-staging`이 운영 DB에 마이그레이션을
 * 그대로 적용한다. 저장소에는 실제로 데이터를 지우는 파일이 있다 —
 * `0081_drop_planner_agency_vendors.sql`의 `DELETE FROM structured.vendors`,
 * `0089_taste_category.sql`의 `DELETE FROM structured.taste_preferences`.
 * 잘못된 파일이 하나 들어가면 되돌릴 방법이 없다(Release Audit 1차 P0-6).
 *
 * **막는 것이 목적이 아니다.** 승인하는 사람이 무엇을 승인하는지 알게 하려는
 * 것이다. 의도한 파괴면 그 파일 안에 한 줄 적으면 통과한다:
 *
 *     -- allow-destructive: 폐기한 업종의 업체 행을 지운다(v3.18)
 *
 * 이유를 함께 적게 한 이유는, 표시만 남으면 다음 사람이 복사해 붙이기 때문이다.
 *
 * DATABASE_URL이 있으면 **아직 적용되지 않은 것만** 본다. 없으면 전부 본다 —
 * 그때는 이미 적용된 과거 파일까지 걸리므로, DB 없이 도는 자리에서는 쓰지 않는다.
 */
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const DIR = join(__dirname, '..', 'packages', 'db', 'migrations');

/** 되돌릴 수 없는 구문. 주석과 문자열은 걷어내고 본다. */
const DESTRUCTIVE = [
  { re: /\bDROP\s+TABLE\b/i, what: 'DROP TABLE' },
  { re: /\bDROP\s+SCHEMA\b/i, what: 'DROP SCHEMA' },
  { re: /\bDROP\s+DATABASE\b/i, what: 'DROP DATABASE' },
  { re: /\bDROP\s+COLUMN\b/i, what: 'DROP COLUMN' },
  { re: /\bTRUNCATE\b/i, what: 'TRUNCATE' },
  { re: /\bDELETE\s+FROM\b/i, what: 'DELETE FROM' },
];

const ALLOW = /--\s*allow-destructive:\s*\S+/i;

/** 줄 주석과 작은따옴표 문자열을 지운다 — 주석 속 «DELETE FROM»에 걸리지 않게. */
function strip(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''");
}

async function pendingVersions() {
  const url = process.env.DATABASE_URL;
  const all = readdirSync(DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  if (!url) {
    console.log('DATABASE_URL 없음 — 마이그레이션 전부를 본다.');
    return all;
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.version));

    return all.filter((name) => !applied.has(name.replace(/\.sql$/, '')));
  } catch (error) {
    /*
     * 표가 없으면 빈 DB다 — 전부 밀린 것으로 본다. 조회에 실패했다고 통과시키면
     * 이 검사가 있으나 마나가 된다.
     */
    console.log(`schema_migrations를 읽지 못했다(${error.message}). 전부를 본다.`);
    return all;
  } finally {
    await client.end();
  }
}

async function main() {
  const pending = await pendingVersions();

  if (pending.length === 0) {
    console.log('적용할 마이그레이션이 없다.');
    return;
  }

  console.log(`적용 예정 ${pending.length}개를 본다.`);

  const blocked = [];

  for (const name of pending) {
    const sql = readFileSync(join(DIR, name), 'utf8');

    if (ALLOW.test(sql)) {
      console.log(`  허용 표시 있음 — ${name}`);
      continue;
    }

    const body = strip(sql);
    const hits = DESTRUCTIVE.filter((rule) => rule.re.test(body)).map((rule) => rule.what);

    if (hits.length > 0) blocked.push({ name, hits });
  }

  if (blocked.length === 0) {
    console.log('되돌릴 수 없는 구문 없음.');
    return;
  }

  console.error('');
  console.error('되돌릴 수 없는 구문이 있다. 적용을 멈춘다.');
  for (const { name, hits } of blocked) console.error(`  ${name} — ${hits.join(' · ')}`);
  console.error('');
  console.error('의도한 것이면 그 파일에 한 줄 적는다:');
  console.error('  -- allow-destructive: <왜 지우는지>');
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
