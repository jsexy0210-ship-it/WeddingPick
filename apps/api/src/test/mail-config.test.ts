import { loadConfig } from '../config';

/** 키 없이 resend를 선언했을 때 서버가 뜨는지. */
describe('메일 설정', () => {
  const base = { DATABASE_URL: 'postgres://x/y', STORAGE_DRIVER: 'local' };

  it('resend인데 키가 없으면 console로 내려앉는다(터지지 않는다)', () => {
    const config = loadConfig({ ...base, MAIL_DRIVER: 'resend', MAIL_FROM: '웨딩픽 <a@b.kr>' } as never);
    expect(config.mail.driver).toBe('console');
  });

  it('키와 발신 주소가 모두 있으면 resend를 쓴다', () => {
    const config = loadConfig({
      ...base, MAIL_DRIVER: 'resend', RESEND_API_KEY: 're_test', MAIL_FROM: '웨딩픽 <a@b.kr>',
    } as never);
    expect(config.mail).toMatchObject({ driver: 'resend', apiKey: 're_test' });
  });
});
