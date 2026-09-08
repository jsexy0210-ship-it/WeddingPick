import { createDevProvider } from './auth/dev-provider';
import { createAppleProvider, createGoogleProvider, createKakaoProvider, createNaverProvider } from './auth/identity-provider';
import { assertReleasable } from '@weddingpick/domain';
import { loadConfig, loadLegalNotice } from './config';
import type { AppContext } from './context';
import { createClaudePaymentReader } from './analysis/claude-payment-reader';
import { createPool } from './db';
import { buildServer } from './server';
import { createLocalStorage } from './storage/local';
import { createS3Storage } from './storage/s3';
import { completeWithdrawals } from './withdrawal';

/**
 * 개발용 로그인은 프로덕션이 아니고, 비밀값이 충분히 길 때만 켠다.
 * 둘 중 하나라도 어긋나면 켜지 않는다.
 */
function devProvider() {
  const secret = process.env.DEV_LOGIN_SECRET;

  if (!secret) {
    return undefined;
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('프로덕션에서는 DEV_LOGIN_SECRET을 쓸 수 없다. 무시한다.');
    return undefined;
  }

  if (secret.length < 16) {
    console.error('DEV_LOGIN_SECRET이 너무 짧다(16자 이상). 개발용 로그인을 켜지 않는다.');
    return undefined;
  }

  console.warn('⚠ 개발용 로그인이 켜져 있다. 이 서버는 공개된 곳에 두면 안 된다.');

  return createDevProvider(secret);
}

async function main() {
  const config = loadConfig();

  /*
   * 법적 고지가 비어 있으면 Production은 뜨지 않는다.
   *
   * 사람이 기억하는 대신 배포가 막는다 — 사업자명·등록번호는 화면 구석에 있어서
   * 아무도 안 보고, 다들 "출시 전에 채우겠지"라고 생각한다. 개발·테스트에서는
   * 경고 한 줄만 남기고 뜬다.
   */
  const legalWarning = assertReleasable(process.env.NODE_ENV, loadLegalNotice());

  if (legalWarning) {
    console.warn(`⚠ 법적 고지가 아직 준비되지 않았다. ${legalWarning}`);
  }

  const context: AppContext = {
    config,
    pool: createPool(config.databaseUrl),
    proofReader: createClaudePaymentReader(),
    storage:
      config.storage.driver === 's3'
        ? createS3Storage(config.storage)
        : createLocalStorage(`http://localhost:${config.port}/dev-storage`),
    providers: {
      ...(config.appleClientId && { apple: createAppleProvider(config.appleClientId) }),
      ...(config.kakaoAppKey && {
        kakao: createKakaoProvider({ appKey: config.kakaoAppKey, clientSecret: config.kakaoClientSecret }),
      }),
      ...(config.googleClientId && { google: createGoogleProvider(config.googleClientId) }),
      ...(config.naverClientId && config.naverClientSecret && config.naverRedirectUris.length > 0 && {
        naver: createNaverProvider({
          clientId: config.naverClientId,
          clientSecret: config.naverClientSecret,
          allowedRedirectUris: config.naverRedirectUris,
        }),
      }),
      // 개발용은 apple 자리를 덮어쓴다. 실제 클라이언트 ID가 있으면 그쪽이 이긴다.
      ...(!config.appleClientId && devProvider() && { apple: devProvider()! }),
    },
  };

  const app = buildServer(context);

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`API가 ${config.port} 포트에서 돈다.`);

  /*
   * 탈퇴를 접수했는데 계정 행이 남은 사람을 뜰 때 한 번 지운다.
   *
   * 원래 이 일은 worker(`worker.ts`)가 10분마다 하지만, 지금 배포에는 worker
   * 서비스가 없다(render.yaml). 그동안 Pick 이력 트리거 버그(0080)로 못 지운
   * 계정이 쌓여 있었다 — 서버가 다시 뜨는 배포 때마다 여기서 정리한다.
   * 실패해도 서버는 뜬다 — 다음 배포에 다시 시도한다.
   */
  try {
    const deleted = await completeWithdrawals(context.pool);

    if (deleted > 0) console.log(`탈퇴 접수 계정 ${deleted}건을 지웠다.`);
  } catch (error) {
    console.error('탈퇴 접수 계정 정리에 실패했다.', error);
  }
}

main().catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
