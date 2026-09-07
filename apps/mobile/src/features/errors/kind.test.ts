import { errorKindOf } from './kind';

/**
 * 전면 오류 화면을 무엇으로 띄울 것인가.
 *
 * 이 갈래가 없어서 «점검 중» 화면을 띄울 방법이 아예 없었다 — `spec/strings.ko.json`에
 * 문구만 있고 쓰는 코드가 0건이었다.
 */
describe('전면 오류 종류', () => {
  it('서버에 닿지 못하면 연결 문제로 본다', () => {
    expect(errorKindOf(null)).toBe('network');
  });

  it('503만 점검으로 읽는다', () => {
    expect(errorKindOf(503)).toBe('maintenance');
  });

  it('사용자가 고칠 수 있는 실수를 점검이라고 하지 않는다', () => {
    // 4xx를 점검으로 덮으면 고칠 수 있는 것을 기다리게 만든다.
    for (const status of [400, 401, 403, 404, 409]) {
      expect(errorKindOf(status)).toBeNull();
    }
  });

  it('우리 잘못인 500을 예정된 작업처럼 보이게 하지 않는다', () => {
    expect(errorKindOf(500)).toBeNull();
  });

  it('정상 응답은 전면으로 덮지 않는다', () => {
    expect(errorKindOf(200)).toBeNull();
  });
});
