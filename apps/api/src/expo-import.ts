import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import { createPool } from './db';
import { expoCandidateSchema, runExpoCollection, type ExpoCandidate } from './expo-collector';

/**
 * 박람회 후보 JSON 파일을 운영 DB에 넣는 CLI(2026-09-24 대표 지시 — 「박람회 서울 경기
 * 위주로 싹다 수집해」).
 *
 * 서버 쪽 자동 수집기는 없다 — Gemini 웹 검색 수집기를 2026-09-23에 걷어냈고
 * (`expo-collector.ts` 머리말), 공공데이터 출처는 아직 없다. 그래서 사람이(또는 작업
 * 세션이) 공식 페이지에서 확인해 적은 후보 파일을 **같은 `runExpoCollection` 경로**로
 * 넣는다. 중복 판정 · 공개 기준(신뢰도 70점 · 검증 출처) · 검수 대기열은 그대로
 * 적용된다 — 파일로 들어왔다고 검수를 건너뛰지 않는다.
 *
 *   npm run expo-import --workspace @weddingpick/api -- --file data/expos/2026-09-24.json
 *   npm run expo-import --workspace @weddingpick/api -- --file data/expos/2026-09-24.json --apply
 *
 * `--apply`가 없으면 파일 검증과 요약만 하고 DB에 붙지 않는다.
 */

export function parseExpoFile(raw: string): ExpoCandidate[] {
  return z.array(expoCandidateSchema).parse(JSON.parse(raw));
}

function argValue(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

async function main(): Promise<void> {
  const file = argValue('file');
  if (!file) {
    console.error('후보 파일을 --file로 준다. 예: --file data/expos/2026-09-24.json');
    process.exitCode = 1;
    return;
  }

  // npm --workspace로 돌면 cwd가 apps/api라서 저장소 루트 기준 경로를 먼저 본다.
  const repoRoot = resolve(process.cwd(), process.env.INIT_CWD ?? '.');
  const candidates = parseExpoFile(readFileSync(resolve(repoRoot, file), 'utf8'));

  const byProvince = new Map<string, number>();
  for (const candidate of candidates) {
    byProvince.set(candidate.province, (byProvince.get(candidate.province) ?? 0) + 1);
  }
  console.log(`후보 ${candidates.length}건 · ${[...byProvince].map(([k, v]) => `${k} ${v}`).join(' · ')}`);

  if (!process.argv.includes('--apply')) {
    console.log('검증만 했다. 운영 DB에 넣으려면 --apply를 붙일 것.');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL이 없다.');
    process.exitCode = 1;
    return;
  }
  const pool = createPool(databaseUrl);
  try {
    const result = await runExpoCollection({
      pool,
      discover: async () => candidates,
      model: 'curated-file',
      trigger: 'manual',
    });
    console.log(
      `신규 ${result.created} · 갱신 ${result.updated} · 중복 ${result.duplicates} · 검수 대기(전체) ${result.reviewRequired}`
    );
  } finally {
    await pool.end();
  }
}

if (require.main === module) void main();
