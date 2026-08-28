import { loadConfig } from './config';
import { createPool } from './db';
import {
  listRetentionAttention,
  markUnreachableForReview,
  sweepExpiredDocuments,
  type AttentionDocument,
} from './retention/worker';
import { createLocalStorage } from './storage/local';
import { createS3Storage } from './storage/s3';

/**
 * 보관 점검 도구.
 *
 * 서비스정책서 4번은 자동삭제 실패에 "알림 및 수동 처리 프로세스"를 요구한다.
 * 워커가 알리는 쪽이고, 여기가 처리하는 쪽이다.
 *
 *   npm run retention --workspace @weddingpick/api -- --list
 *   npm run retention --workspace @weddingpick/api -- --sweep
 *   npm run retention --workspace @weddingpick/api -- --collect-unreachable
 *
 * 이 도구는 파일을 지우는 일을 하지 않는다. `--sweep`은 정규 삭제 작업을 한 번
 * 더 돌릴 뿐이고, `--collect-unreachable`은 목록에 올리기만 한다. 남은 파일을
 * 실제로 확인하고 지우는 것은 스토리지를 보는 사람의 일이다 — 우리 기록만 보고
 * "지웠다"고 적으면 그 기록이 거짓이 된다.
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

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);

  try {
    if (process.argv.includes('--sweep')) {
      const storage =
        config.storage.driver === 's3'
          ? createS3Storage(config.storage)
          : createLocalStorage(`http://localhost:${config.port}/dev-storage`);

      const result = await sweepExpiredDocuments({ pool, storage });

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

    console.log('--list, --sweep, --collect-unreachable 중 하나가 필요하다.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
