import { z } from 'zod';
import { type LegalNotice } from '@weddingpick/domain';


const configSchema = z.object({
  databaseUrl: z.string().min(1),
  port: z.coerce.number().int().positive().default(3000),
  /** 세션 유효기간. 만료되면 다시 로그인한다. */
  sessionTtlDays: z.coerce.number().int().positive().default(30),
  /** 운영자(is_operator) 세션 유효기간. 미설정이면 일반 TTL과 같다. */
  operatorSessionTtlDays: z.coerce.number().int().positive().optional(),
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

  /**
   * 결제내역 이미지를 읽는 모델.
   *
   * 스펙 7.3이 "저비용 AI 우선 → confidence 낮으면 상위 모델"이라고 정했다. 두
   * 이름을 설정에 두는 이유는, 그 순서가 실제로 이득인지 재본 뒤에 바꿀 수 있어야
   * 하기 때문이다 — escalation률이 높으면 두 번 부르는 값이 한 번에 좋은 모델을
   * 부르는 값보다 비싸진다. ai_usage_monthly가 그 비율을 센다.
   */
  proofReaderCheapModel: z.string().default('claude-haiku-4-5'),
  proofReaderStrongModel: z.string().default('claude-opus-5'),

  /**
   * 한 사람이 하루에 부를 수 있는 횟수. 스펙 7.3의 사용자별 일일 호출 제한.
   *
   * **기본값이 없다.** 문의 응답 기한·월 예산과 같은 규칙이다 — 정해지기 전에는
   * 숫자를 지어내지 않는다. 지어낸 한도를 걸어두면 실제로 얼마나 부르는지 재보기도
   * 전에 막히고, 막힌 사람은 왜 막혔는지 모른다.
   *
   * 0은 다른 뜻이다. 한 번도 부르지 못하게 하겠다는 결정이고, 그건 누군가 그렇게
   * 정했을 때만 나온다.
   */
  aiDailyCallLimit: z.coerce.number().int().min(0).optional(),

  /**
   * 문서를 읽는 모델.
   *
   * 결제내역 쪽과 같은 규칙으로 설정에 둔다(스펙 7.3 — 모델을 이름으로 박아두지
   * 않는다). 여기 있어야 `ai_usage`에 적는 이름과 실제로 부른 이름이 갈라지지 않는다.
   */
  analysisModel: z.string().default('claude-opus-5'),

  /** 제공자별 설정이 없으면 그 제공자 로그인만 막힌다. 서비스 전체가 멈추지는 않는다. */
  appleClientId: z.string().optional(),
  kakaoAppKey: z.string().optional(),
  /** 카카오 콘솔 보안 탭에서 Client Secret을 "사용함"으로 켠 앱에만 필요하다. */
  kakaoClientSecret: z.string().optional(),
  googleClientId: z.string().optional(),
  naverClientId: z.string().optional(),
  naverClientSecret: z.string().optional(),
  naverRedirectUris: z.array(z.string().url()).default([]),

  /**
   * 관리자 콘솔 부트스트랩 계정.
   *
   * **부트스트랩 전용이다**(2026-09-10 결정). 0102가 계정을 DB로 옮긴 뒤로 이 둘은
   * 「DB에 켜져 있는 슈퍼 관리자가 하나도 없을 때」만 통한다. 그래야 슈퍼 관리자를
   * 전부 꺼뜨린 날에도 되살릴 길이 남고, 평소에는 환경변수를 아는 사람이 등급
   * 체계를 우회하지 못한다.
   *
   * 값 자체는 GitHub Secrets → render-env-sync로 들어온다. **코드·주석·커밋에 실제
   * 아이디나 해시를 적지 않는다.** 여기 있는 것은 이름뿐이다.
   *
   * 설정에 두는 이유는 `process.env`를 라우트 안에서 읽으면 시험에서 그 값을
   * 갈아끼우려고 전역을 건드려야 하기 때문이다 — 시험끼리 서로의 환경을 덮는다.
   */
  adminLoginId: z.string().min(1).optional(),
  adminPasswordHash: z.string().min(1).optional(),
});

export type Config = z.infer<typeof configSchema>;

/**
 * 법적 고지. 사업자명·대표자·등록번호처럼 서비스가 열리려면 반드시 있어야 하는 값들.
 *
 * 설정 스키마에 넣지 않고 따로 읽는 이유: 개발·테스트에서는 비어 있어도 서버가
 * 떠야 한다. 비면 안 되는 것은 **Production으로 나가는 순간**이고, 그 판정은
 * `assertReleasable`이 한다.
 */
export function loadLegalNotice(env: NodeJS.ProcessEnv = process.env): LegalNotice {
  return {
    businessName: env.LEGAL_BUSINESS_NAME,
    representative: env.LEGAL_REPRESENTATIVE,
    registrationNumber: env.LEGAL_REGISTRATION_NUMBER,
    address: env.LEGAL_ADDRESS,
    supportContact: env.LEGAL_SUPPORT_CONTACT,
    privacyOfficer: env.LEGAL_PRIVACY_OFFICER,
    termsEffectiveOn: env.LEGAL_TERMS_EFFECTIVE_ON,
    privacyEffectiveOn: env.LEGAL_PRIVACY_EFFECTIVE_ON,
  };
}

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
    operatorSessionTtlDays: env.OPERATOR_SESSION_TTL_DAYS,
    storage,
    retentionMode: env.RETENTION_MODE,
    retentionReminderHours: env.RETENTION_REMINDER_HOURS,
    proofReaderCheapModel: env.PROOF_READER_CHEAP_MODEL,
    proofReaderStrongModel: env.PROOF_READER_STRONG_MODEL,
    aiDailyCallLimit: env.AI_DAILY_CALL_LIMIT,
    analysisModel: env.ANALYSIS_MODEL,
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    appleClientId: env.APPLE_CLIENT_ID,
    kakaoAppKey: env.KAKAO_APP_KEY,
    kakaoClientSecret: env.KAKAO_CLIENT_SECRET,
    googleClientId: env.GOOGLE_CLIENT_ID,
    naverClientId: env.NAVER_CLIENT_ID,
    naverClientSecret: env.NAVER_CLIENT_SECRET,
    naverRedirectUris: (env.NAVER_REDIRECT_URIS ?? '')
      .split(',')
      .map((uri) => uri.trim())
      .filter(Boolean),
    adminLoginId: env.ADMIN_LOGIN_ID?.trim() || undefined,
    adminPasswordHash: env.ADMIN_PASSWORD_HASH?.trim() || undefined,
  });

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`설정이 올바르지 않다: ${fields}`);
  }

  // Production/staging must use durable object storage; local files disappear on restart.
  if (env.NODE_ENV === 'production' && parsed.data.storage.driver !== 's3') {
    throw new Error('운영 환경은 STORAGE_DRIVER=s3와 영구 버킷 설정이 필요하다.');
  }

  if (env.NODE_ENV === 'production' && !env.S3_BUCKET) {
    throw new Error('운영 환경은 S3_BUCKET 환경변수가 필수다. GitHub Secrets에서 설정하세요.');
  }

  return parsed.data;
}
