import { createDevProvider } from './auth/dev-provider';
import { createAppleProvider, createKakaoProvider } from './auth/identity-provider';
import { loadConfig } from './config';
import type { AppContext } from './context';
import { createPool } from './db';
import { buildServer } from './server';
import { createLocalStorage } from './storage/local';
import { createS3Storage } from './storage/s3';

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

  const context: AppContext = {
    config,
    pool: createPool(config.databaseUrl),
    storage:
      config.storage.driver === 's3'
        ? createS3Storage(config.storage)
        : createLocalStorage(`http://localhost:${config.port}/dev-storage`),
    providers: {
      ...(config.appleClientId && { apple: createAppleProvider(config.appleClientId) }),
      ...(config.kakaoAppKey && { kakao: createKakaoProvider(config.kakaoAppKey) }),
      // 개발용은 apple 자리를 덮어쓴다. 실제 클라이언트 ID가 있으면 그쪽이 이긴다.
      ...(!config.appleClientId && devProvider() && { apple: devProvider()! }),
    },
  };

  const app = buildServer(context);

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`API가 ${config.port} 포트에서 돈다.`);
}

main().catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
