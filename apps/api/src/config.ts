import { RETENTION_POLICY } from '@weddingpick/domain';
import { z } from 'zod';

const configSchema = z.object({
  databaseUrl: z.string().min(1),
  port: z.coerce.number().int().positive().default(3000),
  /** 세션 유효기간. 만료되면 다시 로그인한다. */
  sessionTtlDays: z.coerce.number().int().positive().default(30),
  storage: z.discriminatedUnion('driver', [
    z.object({
      driver: z.literal('s3'),
      bucket: z.string().min(1),
      /** 계약서 원본을 다루므로 국내 리전을 쓴다. */
      region: z.string().min(1),
      endpoint: z.string().optional(),
    }),
    z.object({ driver: z.literal('local') }),
  ]),
  /**
   * 원본 문서 보관 일수. 기본값은 정해진 정책(30일)이다.
   *
   * 예전에는 기본값 없이 두었다 — 정해지지 않은 값을 지어내지 않으려던 것이다.
   * 이제 정해졌으므로 반대가 된다: 환경변수를 빠뜨린 환경이 무기한 보관으로
   * 떨어지는 것이 정책 위반이다. 값은 도메인의 RETENTION_POLICY 한 곳에 있다.
   */
  originalRetentionDays: z.coerce
    .number()
    .int()
    .positive()
    .default(RETENTION_POLICY.originalDays),

  /**
   * 예정일이 된 원본을 누가 지우는가.
   *
   * - `manual` — 사람이 지운다. 서버는 알리기만 한다. **기본값이다.**
   * - `automatic` — 서버가 지운다.
   *
   * 운영 결정으로 manual을 기본에 둔다. 기본값을 automatic으로 두면, 설정을
   * 빠뜨린 환경이 남의 계약서를 조용히 지운다. 지우지 않고 알리는 쪽이 되돌릴 수
   * 있는 실수다.
   */
  retentionMode: z.enum(['manual', 'automatic']).default('manual'),

  /** 파기할 문서가 처리되지 않은 채 이만큼 지나면 운영자에게 다시 알린다. */
  retentionReminderHours: z.coerce.number().int().positive().default(24),

  /**
   * 브라우저에서 API를 부를 수 있는 출처. 비워두면 CORS 헤더를 내보내지 않는다.
   * 네이티브 앱은 CORS와 무관하다 — 웹에서 붙여볼 때만 필요하다.
   */
  corsOrigins: z.array(z.string().min(1)).default([]),

  /** 제공자별 설정이 없으면 그 제공자 로그인만 막힌다. 서비스 전체가 멈추지는 않는다. */
  appleClientId: z.string().optional(),
  kakaoAppKey: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const storage =
    env.STORAGE_DRIVER === 's3'
      ? {
          driver: 's3' as const,
          bucket: env.S3_BUCKET,
          region: env.S3_REGION,
          endpoint: env.S3_ENDPOINT,
        }
      : { driver: 'local' as const };

  const parsed = configSchema.safeParse({
    databaseUrl: env.DATABASE_URL,
    port: env.PORT,
    sessionTtlDays: env.SESSION_TTL_DAYS,
    storage,
    originalRetentionDays: env.ORIGINAL_RETENTION_DAYS,
    retentionMode: env.RETENTION_MODE,
    retentionReminderHours: env.RETENTION_REMINDER_HOURS,
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    appleClientId: env.APPLE_CLIENT_ID,
    kakaoAppKey: env.KAKAO_APP_KEY,
  });

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`설정이 올바르지 않다: ${fields}`);
  }

  return parsed.data;
}
