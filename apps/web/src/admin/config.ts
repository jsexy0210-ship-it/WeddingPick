import { z } from 'zod';

/**
 * 관리자 웹 설정.
 *
 * `apps/api`의 `config.ts`와 같은 자리(zod로 환경변수를 한 번에 검증)를 쓴다.
 * 이 서버는 그 서버와 완전히 별도 프로세스다 — 소셜 로그인을 다시 구현하는 대신
 * 공유 비밀(`ADMIN_PASSWORD`) 하나로 문을 잠근다. 지금 운영이 하는 일이
 * `DATABASE_URL`을 쥔 사람이 CLI로 직접 쿼리를 돌리는 것인데, 이 서버는 그
 * 접근을 **읽기 전용 HTTP Basic Auth 뒤로 좁히는 것**이지 새로 여는 문이 아니다.
 */
const configSchema = z.object({
  databaseUrl: z.string().min(1),
  port: z.coerce.number().int().positive().default(3100),
  /** HTTP Basic Auth 비밀번호. 계정 이름은 `admin` 고정 — 계정을 나눌 이유가 아직 없다. */
  adminPassword: z.string().min(16),
});

export type AdminConfig = z.infer<typeof configSchema>;

export function loadAdminConfig(): AdminConfig {
  return configSchema.parse({
    databaseUrl: process.env.DATABASE_URL,
    port: process.env.PORT,
    adminPassword: process.env.ADMIN_PASSWORD,
  });
}
