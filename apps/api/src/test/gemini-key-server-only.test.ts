import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Gemini 키가 클라이언트로 새지 않는지.
 *
 * 2026-09-14 대표 지시 — 「클라이언트에는 절대 노출하지 않고 API 서버에서만 Gemini
 * API를 호출하도록 구현한다」.
 *
 * **새는 길은 사고가 아니라 오타 하나다.** Expo는 `EXPO_PUBLIC_`으로 시작하는 값을
 * 번들에 글자 그대로 박아 넣는다(`apps/mobile/README.md`). 그 접두사를 붙이는 순간
 * 앱을 받은 사람 누구나 키를 꺼낼 수 있고, 꺼내 쓴 사용량은 우리에게 청구된다.
 * 되돌리려면 키를 폐기하고 새로 발급받는 것 말고 방법이 없다.
 *
 * 사람이 리뷰에서 잡기 어려운 자리다 — 한 줄 추가로 보이고, 이름이 길어 접두사가
 * 눈에 안 띈다. 그래서 시험이 잡는다.
 */

const ROOT = join(__dirname, '..', '..', '..', '..');

/** 앱·웹 번들로 흘러가는 파일들. 여기에 키 이름이 있으면 안 된다. */
const CLIENT_SURFACES = [
  'apps/mobile/eas.json',
  'apps/mobile/app.json',
  'infra/render-env.yml',
  'render.yaml',
];

describe('Gemini 키는 서버에만 있다', () => {
  it('EXPO_PUBLIC_ 접두사를 붙이지 않는다', () => {
    const offenders: string[] = [];

    for (const path of CLIENT_SURFACES) {
      const source = readFileSync(join(ROOT, path), 'utf8');

      if (/EXPO_PUBLIC_\w*GEMINI/i.test(source)) offenders.push(path);
    }

    expect(offenders).toEqual([]);
  });

  it('정적 사이트 서비스에 키를 넣지 않는다', () => {
    /*
     * `infra/render-env.yml`은 서비스마다 블록이 따로다. 정적 사이트(앱 웹뷰 ·
     * 관리자)에 넣은 값은 빌드 때 번들에 들어간다 — API 서비스에만 있어야 한다.
     *
     * 서비스 이름으로 잘라 보는 이유는, 파일 전체에 이름이 한 번 나온다는 것만으로는
     * **어느 서비스 아래에 있는지**를 알 수 없기 때문이다.
     */
    const source = readFileSync(join(ROOT, 'infra/render-env.yml'), 'utf8');
    const blocks = source.split(/\n {2}(?=[^\s#])/);

    const leaked = blocks.filter(
      (block) => block.includes('GEMINI_API_KEY') && !block.startsWith('weddingpickl-sg')
    );

    expect(leaked).toEqual([]);
  });

  it('저장소에 키 값이 커밋돼 있지 않다', () => {
    /*
     * 이름만 적고 값은 GitHub Secrets에서 온다. 누가 실수로 값을 적으면 공개
     * 저장소라 그대로 나간다.
     *
     * Google API 키는 `AIza`로 시작하는 39자다. 그 꼴이 보이면 막는다 — 이 시험이
     * 잡는 것은 **키처럼 생긴 문자열**이지 특정 키가 아니다.
     */
    const suspicious: string[] = [];

    for (const path of [...CLIENT_SURFACES, 'apps/api/.env.example']) {
      const source = readFileSync(join(ROOT, path), 'utf8');

      if (/AIza[0-9A-Za-z_-]{35}/.test(source)) suspicious.push(path);
    }

    expect(suspicious).toEqual([]);
  });

  it('.env.example은 이름만 두고 값을 비운다', () => {
    const source = readFileSync(join(ROOT, 'apps/api/.env.example'), 'utf8');

    expect(source).toMatch(/^GEMINI_API_KEY=\s*$/m);
  });
});

/** 저장소 파일 하나를 읽는다. */
function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

describe('모델 이름은 환경변수다', () => {
  it('코드의 기본값과 배포 값이 같다', () => {
    /*
     * 같은 값이 두 곳에 있다 — `config.ts`의 기본값과 `infra/render-env.yml`의
     * `vars`. **둘 중 하나만 고치면 환경변수를 안 넣은 배포에서 없어진 모델을
     * 부른다**(`gemini-2.5-flash-lite`는 2026-10-16에 사라진다).
     *
     * 값을 한 곳으로 합칠 수 없다 — yml은 Render가 읽고 기본값은 그 yml이 닿지
     * 않은 환경을 위한 것이다. 그래서 갈라지는 것을 여기서 잡는다.
     */
    const config = read('apps/api/src/config.ts');
    const infra = read('infra/render-env.yml');
    const example = read('apps/api/.env.example');

    const fallback = config.match(/geminiModel: z\.string\(\)\.default\('([^']+)'\)/)?.[1];

    expect(fallback).toBeTruthy();
    expect(infra).toContain(`GEMINI_MODEL: ${fallback}`);
    expect(example).toContain(`GEMINI_MODEL=${fallback}`);
  });

  it('모델 이름을 부르는 자리에 박아두지 않는다', () => {
    /* 박아두면 바꾸는 일이 배포가 아니라 수정·검토·머지가 된다. */
    for (const file of [
      'apps/api/src/analysis/gemini-payment-reader.ts',
      'apps/api/src/analysis/gemini-visit-note-reader.ts',
      'apps/api/src/analysis/consultation-reader.ts',
    ]) {
      expect(read(file)).not.toMatch(/'gemini-[\d.]+-flash/);
    }
  });
});
