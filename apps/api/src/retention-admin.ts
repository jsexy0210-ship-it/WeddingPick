import { retentionSummary } from '@weddingpick/domain';

import { loadConfig } from './config';
import { createPool } from './db';
import {
  deleteDocument,
  listDueDocuments,
  listHeldForVerification,
  listRetentionAttention,
  markUnreachableForReview,
  sweepExpiredDocuments,
  type AttentionDocument,
  type DueDocument,
} from './retention/worker';
import { createLocalStorage } from './storage/local';
import { createS3Storage } from './storage/s3';
import type { Storage } from './storage/port';

/**
 * 보관 점검 도구.
 *
 * 서비스정책서 4번은 자동삭제 실패에 "알림 및 수동 처리 프로세스"를 요구한다.
 * 워커가 알리는 쪽이고, 여기가 처리하는 쪽이다.
 *
 *   npm run retention --workspace @weddingpick/api -- --operator <user-id> [--off]
 *   npm run retention --workspace @weddingpick/api -- --due
 *   npm run retention --workspace @weddingpick/api -- --delete <document-id>
 *   npm run retention --workspace @weddingpick/api -- --list
 *   npm run retention --workspace @weddingpick/api -- --sweep
 *   npm run retention --workspace @weddingpick/api -- --collect-unreachable
 *
 * 원본을 지우는 것은 사람이 한다(운영 결정). `--due`로 때가 된 것을 보고
 * `--delete`로 하나씩 지운다. 한 번에 다 지우는 명령은 두지 않았다 — 되돌릴 수
 * 없는 일에 "전부"를 붙이면 손이 미끄러졌을 때 남는 것이 없다.
 *
 * `--collect-unreachable`은 목록에 올리기만 한다. 페이지 기록이 없다는 것은 지울
 * 파일을 우리가 모른다는 뜻이므로, 스토리지는 사람이 직접 확인해야 한다.
 * 우리 기록만 보고 "지웠다"고 적으면 그 기록이 거짓이 된다.
 */

const REASON_LABEL: Record<AttentionDocument['reason'], string> = {
  delete_failed: '삭제 실패',
  unreachable: '삭제 작업이 못 봄',
};

/**
 * 어떤 개인정보가 들어 있는 문서인지. 값이 아니라 종류만 남아 있고, 여기서도
 * 종류만 보여준다 — 무엇이 남아 있는지 알아야 얼마나 급한지 판단할 수 있다.
 */
const PERSONAL_INFO_LABEL: Record<string, string> = {
  name: '이름',
  phone: '연락처',
  address: '주소',
  resident_number: '주민번호',
  signature: '서명',
  email: '이메일',
  account: '계좌',
};

function describe(doc: AttentionDocument, now: Date): string {
  const overdueDays = Math.floor(
    (now.getTime() - doc.retentionUntil.getTime()) / (24 * 60 * 60 * 1000)
  );
  const kinds = doc.personalInfoKinds.map((kind) => PERSONAL_INFO_LABEL[kind] ?? kind);

  return (
    `${doc.id}  ${REASON_LABEL[doc.reason]}  기간 지난 지 ${overdueDays}일` +
    (doc.attempts > 0 ? `  시도 ${doc.attempts}회` : '') +
    (kinds.length > 0 ? `  담긴 것: ${kinds.join(', ')}` : '')
  );
}

function describeDue(doc: DueDocument, now: Date): string {
  const overdueDays = Math.floor(
    (now.getTime() - doc.retentionUntil.getTime()) / (24 * 60 * 60 * 1000)
  );
  const kinds = doc.personalInfoKinds.map((kind) => PERSONAL_INFO_LABEL[kind] ?? kind);

  return (
    `${doc.id}  예정일 ${doc.retentionUntil.toISOString().slice(0, 10)}` +
    (overdueDays > 0 ? ` (${overdueDays}일 지남)` : ' (오늘)') +
    `  파일 ${doc.storageKeys.length}개` +
    (kinds.length > 0 ? `  담긴 것: ${kinds.join(', ')}` : '') +
    // 지우면 그 신청은 확인할 근거를 잃는다. 지우는 사람이 알고 정해야 한다.
    (doc.blocksOpenVerification ? '\n      ⚠ 심사 중인 인증 신청의 증빙이다' : '')
  );
}

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);

  try {
    const openStorage = (): Storage =>
      config.storage.driver === 's3'
        ? createS3Storage(config.storage)
        : createLocalStorage(`http://localhost:${config.port}/dev-storage`);

    if (process.argv.includes('--sweep')) {
      const result = await sweepExpiredDocuments({ pool, storage: openStorage() });

      console.log(`지움 ${result.deleted}건, 실패 ${result.failed}건.`);
      return;
    }

    if (process.argv.includes('--collect-unreachable')) {
      const moved = await markUnreachableForReview(pool);

      console.log(
        moved === 0
          ? '삭제 작업이 못 보는 문서는 없다.'
          : `${moved}건을 처리 목록에 올렸다. 스토리지에 파일이 남아 있는지 직접 확인해야 한다.`
      );
      return;
    }

    const deleteIndex = process.argv.indexOf('--delete');

    if (deleteIndex !== -1) {
      const documentId = process.argv[deleteIndex + 1];

      if (!documentId) {
        console.error('지울 문서 id가 필요하다.');
        process.exitCode = 1;
        return;
      }

      const outcome = await deleteDocument({ pool, storage: openStorage() }, documentId);

      if (!outcome.ok) {
        console.error(`지우지 않았다: ${outcome.reason}`);
        process.exitCode = 1;
        return;
      }

      console.log(`파일 ${outcome.keysDeleted}개를 지웠다. 파기 기록을 남겼다.`);
      return;
    }

    const operatorIndex = process.argv.indexOf('--operator');

    if (operatorIndex !== -1) {
      const userId = process.argv[operatorIndex + 1];

      if (!userId) {
        console.error('운영자로 지정할 사용자 id가 필요하다.');
        process.exitCode = 1;
        return;
      }

      /*
       * 운영자 표시는 사람이 여기서만 켠다. 앱에도 API에도 이 값을 바꾸는 길이
       * 없다 — 알림을 받는 자리이자 남의 계약서를 지우는 자리라, 스스로 올라갈
       * 수 있으면 안 된다.
       */
      const off = process.argv.includes('--off');
      const { rowCount } = await pool.query(
        'UPDATE structured.users SET is_operator = $2 WHERE id = $1::uuid',
        [userId, !off]
      );

      console.log(
        rowCount === 0
          ? '없는 사용자다.'
          : off
            ? '운영자에서 내렸다. 이제 파기 알림을 받지 않는다.'
            : '운영자로 지정했다. 이 사람의 기기로 파기 알림이 간다.'
      );
      return;
    }

    if (process.argv.includes('--due')) {
      const due = await listDueDocuments(pool);

      const held = await listHeldForVerification(pool);

      if (due.length === 0) {
        /*
         * 비어 있는 것을 안전하다고 읽으면 안 된다. 검증 완료 후를 기준으로
         * 삼았으므로, 지울 것이 없어서가 아니라 아직 셈이 시작되지 않아서일 수
         * 있다.
         */
        console.log('파기할 때가 된 원본이 없다.');

        if (held.length > 0) {
          console.log(
            `\n다만 ${held.length}건은 심사가 열려 있어 파기 일정이 서지 않았다.` +
              '\n심사가 끝나야 셈이 시작된다: npm run verifications -- --list'
          );
        }
        return;
      }

      const attention = await listRetentionAttention(pool);
      const now = new Date();

      console.log(retentionSummary({ dueCount: due.length, attentionCount: attention.length }));
      for (const doc of due) console.log(`  ${describeDue(doc, now)}`);

      const blocking = due.filter((doc) => doc.blocksOpenVerification).length;

      if (blocking > 0) {
        console.log(
          `\n${blocking}건은 아직 결론이 나지 않은 인증 신청의 증빙이다. 지우면 그 신청은` +
            '\n확인할 근거를 잃는다. 먼저 심사를 끝내려면: npm run verifications -- --list'
        );
      }

      if (held.length > 0) {
        console.log(
          `\n그 밖에 ${held.length}건은 심사가 열려 있어 아직 일정이 서지 않았다.`
        );
      }

      console.log('\n지우려면: npm run retention -- --delete <id>');
      return;
    }

    if (process.argv.includes('--list')) {
      const attention = await listRetentionAttention(pool);

      if (attention.length === 0) {
        console.log('보관 기간을 넘겨 남아 있는 원본이 없다.');
        return;
      }

      const now = new Date();

      console.log(`손이 필요한 원본 ${attention.length}건:`);
      for (const doc of attention) console.log(`  ${describe(doc, now)}`);

      // 이 상태가 오래 가면 안 된다는 것을 매번 말한다.
      console.log(
        '\n보관 기간이 지난 개인정보다. 스토리지에 파일이 남아 있는지 확인하고 지운 뒤,\n' +
          '문서 행의 deleted_at을 남겨 파기 기록을 만든다.'
      );
      return;
    }

    console.log(
      '--operator, --due, --delete, --list, --sweep, --collect-unreachable 중 하나가 필요하다.'
    );
  } finally {
    await pool.end();
  }
}

/*
 * CLI로 직접 실행했을 때만 돈다. 테스트나 라우트가 이 파일에서 함수를
 * 가져오면(require) `require.main`이 테스트 러너/서버를 가리키므로 여기
 * 걸리지 않는다 — 안 걸리면 가져오기만 해도 `main()`이 돌며 실제 인자 없이
 * 안내 문구로 exitCode를 오염시킨다. 원래 이 파일에는 이 관문이 없었다
 * (다른 admin 도구와 다르게) — HTTP로 열면서 같이 넣었다.
 *
 * 이 파일 자체에서 export할 함수는 없다 — 실제 로직은 전부 `retention/worker.ts`에
 * 이미 있고, 여기는 그 함수들을 CLI 인자로 잇는 얇은 층이다. `--operator`
 * (운영자 지정/해제)만은 **의도적으로 HTTP에 열지 않는다** — 바로 아래 주석대로,
 * 이 값을 바꾸는 API 경로를 두지 않는 것 자체가 자기 자신을 운영자로 올리는
 * 길을 막는 설계다.
 */
if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
