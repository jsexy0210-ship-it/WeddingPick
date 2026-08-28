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
   * 원본 문서 보관 일수. **정해지지 않으면 자동삭제하지 않는다.**
   * 서비스정책서의 미확정 항목이라 기본값을 두지 않았다 — 임의의 숫자로 남의 계약서를
   * 지우거나, 반대로 무기한 보관하는 쪽을 조용히 고르지 않으려는 것이다.
   */
  originalRetentionDays: z.coerce.number().int().positive().optional(),

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
    appleClientId: env.APPLE_CLIENT_ID,
    kakaoAppKey: env.KAKAO_APP_KEY,
  });

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`설정이 올바르지 않다: ${fields}`);
  }

  return parsed.data;
}
