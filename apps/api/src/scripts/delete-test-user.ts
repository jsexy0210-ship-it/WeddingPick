import { loadConfig } from '../config';
import { createPool } from '../db';
import { createLocalStorage } from '../storage/local';
import { createS3Storage } from '../storage/s3';
import { withdraw } from '../withdrawal';

/**
 * 테스트 계정을 지운다. 출시 전, 가입·온보딩을 처음부터 다시 밟아보기 위한 도구다.
 *
 * **저장소의 탈퇴 로직(`withdraw`)을 그대로 쓴다.** 손으로 DELETE를 흘리면 세션·동의·
 * 웨딩·Pick이 어디까지 딸려 지워지는지 매번 다시 따져야 하고, 그 판단이 틀리면
 * 고아 행이 남는다. 탈퇴는 이미 그 순서를 알고 있고 테스트가 지킨다.
 *
 * 사용:
 *   --list                       누가 있는지 본다. 아무것도 바꾸지 않는다.
 *   --email=a@b.kr | --nickname=이름 | --subject=제공자ID   한 명을 지운다.
 *
 * 한 번에 한 명만. 여러 명이 걸리면 지우지 않고 목록을 보여준다 — «전부 삭제»는
 * 이 도구가 하는 일이 아니다.
 */
async function main() {
  const args = new Map(
    process.argv.slice(2).map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, '').split('=');
      return [key, rest.join('=')] as const;
    })
  );

  const config = loadConfig();
  const pool = createPool(config.databaseUrl);

  try {
    if (args.has('list')) {
      const { rows } = await pool.query<{
        provider: string;
        nickname: string | null;
        email: string | null;
        last_login_at: Date | null;
        activated_at: Date | null;
      }>(
        `SELECT i.provider, i.nickname, i.email, i.last_login_at, u.activated_at
         FROM identity.identities i JOIN structured.users u ON u.id = i.user_id
         WHERE u.deleted_at IS NULL
         ORDER BY i.last_login_at DESC NULLS LAST LIMIT 50`
      );
      console.log(`계정 ${rows.length}명`);
      for (const r of rows) {
        // 이메일은 앞 두 글자만. 로그에 전체 주소를 남길 이유가 없다.
        const email = r.email ? `${r.email.slice(0, 2)}…@${r.email.split('@')[1] ?? ''}` : '-';
        console.log(
          `  ${r.provider} · ${r.nickname ?? '-'} · ${email} · 마지막 로그인 ${r.last_login_at?.toISOString() ?? '-'} · ${r.activated_at ? '활성' : '가입 미완'}`
        );
      }
      return;
    }

    const where = args.has('email')
      ? ['i.email = $1', args.get('email')]
      : args.has('nickname')
        ? ['i.nickname = $1', args.get('nickname')]
        : args.has('subject')
          ? ['i.subject = $1', args.get('subject')]
          : null;

    if (!where || !where[1]) {
      throw new Error('--list 또는 --email= / --nickname= / --subject= 중 하나가 필요하다.');
    }

    const { rows } = await pool.query<{ user_id: string; nickname: string | null }>(
      `SELECT DISTINCT i.user_id, i.nickname FROM identity.identities i
       JOIN structured.users u ON u.id = i.user_id
       WHERE ${where[0]} AND u.deleted_at IS NULL`,
      [where[1]]
    );

    if (rows.length === 0) throw new Error('해당하는 계정이 없다.');
    if (rows.length > 1) {
      throw new Error(`계정이 ${rows.length}명 걸렸다. 한 명만 가리키도록 조건을 좁혀라.`);
    }

    const target = rows[0]!;
    const storage =
      config.storage.driver === 's3'
        ? createS3Storage(config.storage)
        : createLocalStorage('http://localhost/dev-storage');

    const result = await withdraw({ pool, storage }, target.user_id);
    console.log(
      `삭제 ${result.completed ? '완료' : '접수(원본 파기 대기)'} — ${target.nickname ?? target.user_id}`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
