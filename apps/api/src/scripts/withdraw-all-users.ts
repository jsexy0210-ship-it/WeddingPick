import { loadConfig } from '../config';
import { createPool } from '../db';
import { createS3Storage } from '../storage/s3';
import { withdraw, WithdrawalRefused } from '../withdrawal';

/**
 * 운영자를 뺀 **모든 계정**을 탈퇴시킨다. 출시 전 한 번 쓰는 도구다
 * (2026-09-11 대표 지시 — 「b로 하고 지금 가입자들 다 탈퇴시켜」, 범위는
 * 「운영자 빼고 전부」로 확정).
 *
 * **`delete-test-user`가 못 하는 일이라 따로 있다.** 그쪽은 일부러 한 명만
 * 지운다 — 「여러 명이 걸리면 지우지 않는다」가 그 도구의 안전장치다. 여기서
 * 필요한 것은 정확히 그 반대이므로, 그 장치를 풀어 쓰는 대신 의도가 이름에
 * 드러나는 도구를 새로 만든다.
 *
 * **저장소의 탈퇴 로직(`withdraw`)을 그대로 쓴다.** 손으로 DELETE를 흘리면
 * 세션 · 동의 · 웨딩 · Pick이 어디까지 딸려 지워지는지 매번 다시 따져야 하고,
 * 그 판단이 틀리면 고아 행이 남는다. 무엇보다 **원본 파기 순서를 건너뛴다** —
 * 계정이 사라지면 그 사람의 파일을 지울 열쇠를 잃는다.
 *
 * ---------------------------------------------------------------------------
 * 운영자는 `withdraw`가 막는다
 * ---------------------------------------------------------------------------
 *
 * 여기서 목록을 거르기도 하지만, 그것만 믿지 않는다. `withdraw` 안쪽이
 * `is_operator`를 보고 `WithdrawalRefused`로 돌려보낸다(withdrawal.ts). 목록
 * 조건을 잘못 적어도 운영자는 지워지지 않는다 — 두 겹으로 막는 자리다.
 *
 * ---------------------------------------------------------------------------
 * 원본이 실제로 지워지는가
 * ---------------------------------------------------------------------------
 *
 * `withdraw`는 `sweepExpiredDocuments`로 그 사람의 원본을 파기한 뒤에야 계정
 * 행을 지운다. 그 파기는 `deps.storage`를 쓴다 — **`STORAGE_DRIVER`가 운영과
 * 다르면 계정만 사라지고 파일은 남는다.** 「지웠다」고 말하면서 남기는 것이
 * 가장 나쁜 결과라, 운영 자료를 지울 때 로컬 드라이버로 도는 것을 막는다.
 */
const CONFIRM = '탈퇴시킨다';

async function main() {
  const args = new Map(
    process.argv.slice(2).map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, '').split('=');
      return [key, rest.join('=')] as const;
    })
  );

  const apply = args.get('confirm') === CONFIRM;
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);

  try {
    /*
     * 아직 탈퇴하지 않은 계정 중 운영자가 아닌 사람. `deleted_at`이 찍힌 계정은
     * 이미 접수된 것이라 다시 넣지 않는다 — 두 번 불러도 같은 결과이긴 하지만,
     * 세는 숫자가 사실과 달라지면 보고가 틀린다.
     */
    const { rows: targets } = await pool.query<{ id: string; provider: string | null }>(
      `SELECT u.id,
              (SELECT i.provider FROM identity.identities i
                WHERE i.user_id = u.id ORDER BY i.last_login_at DESC NULLS LAST LIMIT 1) AS provider
         FROM structured.users u
        WHERE u.deleted_at IS NULL
          AND u.is_operator = false
        ORDER BY u.created_at`
    );

    const { rows: kept } = await pool.query<{ operators: string }>(
      `SELECT count(*)::text AS operators FROM structured.users
        WHERE deleted_at IS NULL AND is_operator = true`
    );

    console.log(`대상 ${targets.length}명 · 남기는 운영자 ${kept[0]!.operators}명`);

    /* 누구인지는 적지 않는다. 제공자별 개수까지가 확인에 필요한 전부다. */
    const byProvider = new Map<string, number>();
    for (const row of targets) {
      const key = row.provider ?? '알 수 없음';
      byProvider.set(key, (byProvider.get(key) ?? 0) + 1);
    }
    for (const [provider, count] of byProvider) console.log(`  ${provider} ${count}명`);

    if (!apply) {
      console.log('');
      console.log(`확인만 했다. 실제로 지우려면 --confirm=${CONFIRM} 을 준다.`);
      return;
    }

    /*
     * **운영 자료를 로컬 드라이버로 지우지 않는다.** 그러면 계정만 사라지고 S3의
     * 원본은 남는다. 여기서 막지 않으면 워크플로 입력 하나가 빠진 것이 「탈퇴
     * 완료」로 보고된다.
     */
    if (config.storage.driver !== 's3') {
      throw new Error(
        'STORAGE_DRIVER=s3 와 버킷 설정이 있어야 한다. 로컬 드라이버로 돌면 원본이 남는다.'
      );
    }

    const storage = createS3Storage(config.storage);
    const deps = { pool, storage };

    let completed = 0;
    let accepted = 0;
    const refused: string[] = [];
    const failed: string[] = [];

    for (const target of targets) {
      try {
        const result = await withdraw(deps, target.id);

        if (result.completed) completed += 1;
        else accepted += 1;
      } catch (error) {
        /*
         * 한 명이 막혔다고 나머지를 두지 않는다. 무엇이 남았는지는 아래에서
         * 개수로 말하고, 이유는 `withdrawal_deletion_failures`에 이미 적힌다.
         */
        if (error instanceof WithdrawalRefused) refused.push(error.message);
        else failed.push(error instanceof Error ? error.message : String(error));
      }
    }

    console.log('');
    console.log(`삭제 완료 ${completed}명`);
    if (accepted > 0) console.log(`접수(원본 파기 대기) ${accepted}명 — 배치 워커가 마저 지운다`);
    if (refused.length > 0) console.log(`거절 ${refused.length}명 — ${[...new Set(refused)].join(' / ')}`);
    if (failed.length > 0) console.log(`실패 ${failed.length}명 — ${[...new Set(failed)].join(' / ')}`);

    const { rows: after } = await pool.query<{ left: string }>(
      `SELECT count(*)::text AS left FROM structured.users
        WHERE deleted_at IS NULL AND is_operator = false`
    );

    console.log(`남은 비운영자 계정 ${after[0]!.left}명`);

    /* 실패는 초록으로 끝내지 않는다. 「돌렸다」가 「지웠다」로 읽히면 안 된다. */
    if (failed.length > 0) process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
