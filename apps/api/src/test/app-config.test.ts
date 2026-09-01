import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * 앱을 빌드해서 올릴 수 있는 상태인지.
 *
 * 여기서 걸리는 것들은 전부 **빌드가 끝난 뒤에야** 드러난다 — 번들 ID가 없으면
 * 클라우드 빌드가 중간에 멈추고, 아이콘에 알파 채널이 있으면 심사에서 반려된다.
 * 한 번 왕복에 수십 분이고, 반려는 며칠이다. 여기서 몇 초 만에 잡는다.
 */

type AppConfig = {
  expo: {
    ios?: { bundleIdentifier?: string; buildNumber?: string };
    android?: { package?: string };
    icon?: string;
  };
};

function config(): AppConfig['expo'] {
  return (JSON.parse(readFileSync(join(ROOT, 'apps/mobile/app.json'), 'utf8')) as AppConfig).expo;
}

/**
 * PNG 머리 부분만 읽는다. 이미지 라이브러리를 하나 더 들이지 않으려고.
 *
 * `app.json`의 경로는 그 파일이 있는 `apps/mobile` 기준이다. 저장소 뿌리에서
 * 그대로 이으면 없는 파일을 찾는다.
 */
function png(path: string): { width: number; height: number; hasAlpha: boolean } {
  const data = readFileSync(join(ROOT, 'apps/mobile', path));

  if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error(`${path}는 PNG가 아니다.`);
  }

  /* IHDR: 16~24가 가로·세로, 25가 컬러 타입. 4와 6이 알파를 들고 있다. */
  const colorType = data[25];

  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    hasAlpha: colorType === 4 || colorType === 6,
  };
}

describe('앱 빌드 설정', () => {
  it('iOS 번들 ID가 있다', () => {
    /* 없으면 클라우드 빌드가 물어보다 멈춘다. 대화형이 없는 CI에서는 그냥 실패한다. */
    expect(config().ios?.bundleIdentifier).toBeTruthy();
  });

  it('두 플랫폼이 같은 이름을 쓴다', () => {
    /*
     * 갈라두면 딥링크·푸시 토큰·스토어 연결을 두 벌 관리하게 된다. 나눠야 할
     * 이유가 생기기 전까지는 하나로 둔다.
     */
    const { ios, android } = config();

    expect(ios?.bundleIdentifier).toBe(android?.package);
  });

  it('iOS 빌드 번호가 있다', () => {
    /* `appVersionSource: local`이라 이 값이 없으면 올릴 때 번호가 비어 나간다. */
    expect(config().ios?.buildNumber).toMatch(/^\d+$/);
  });

  it('아이콘이 1024 정사각형이다', () => {
    const icon = png(config().icon!);

    expect(icon.width).toBe(1024);
    expect(icon.height).toBe(1024);
  });

  it('아이콘에 알파 채널이 없다', () => {
    /*
     * **애플이 반려한다.** 투명한 아이콘은 홈 화면에서 뒤가 비치고, 심사가
     * 자동으로 걸러낸다. 눈으로는 안 보이는 문제라 빌드를 올려봐야 알게 된다.
     */
    expect(png(config().icon!).hasAlpha).toBe(false);
  });

  it('빌드 프로필에 iOS 자리가 있다', () => {
    const eas = JSON.parse(readFileSync(join(ROOT, 'apps/mobile/eas.json'), 'utf8')) as {
      build: Record<string, { ios?: unknown }>;
    };

    /* 맥 없이 시험해볼 수 있는 유일한 길이라 시뮬레이터 프로필을 따로 둔다. */
    expect(eas.build.simulator?.ios).toBeTruthy();
    expect(eas.build.preview?.ios).toBeTruthy();
    expect(eas.build.production?.ios).toBeTruthy();
  });
});
