/**
 * 완료/접수 화면은 "성공 상태를 보여준 뒤 다음 사용자 흐름으로 빠져나가는" transient UI다.
 * 이 화면이 history나 숨은 tab stack에 남으면 다음 진입에서 예전 완료 화면이 다시 보인다.
 *
 * 화면 구현을 전부 렌더하는 대신 여기서는 완료 흐름의 네비게이션 계약을 소스 수준으로
 * 고정한다. 각 화면의 실제 성공 API/렌더 회귀는 해당 화면 테스트가 맡고, 이 파일은
 * "완료 뒤 어디로 어떻게 나가느냐"만 감시한다.
 */
declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync, existsSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
  existsSync: (path: string) => boolean;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

const APP = join(__dirname, '..', '..', 'app');

function screen(...parts: string[]): string {
  return readFileSync(join(APP, ...parts), 'utf8');
}

describe('transient completion flow navigation', () => {
  it('Pick 최종 결정 확인 시트와 완료 화면은 없다(2026-09-25 대표 결정 안 A)', () => {
    const layout = screen('_layout.tsx');

    expect(existsSync(join(APP, '(tabs)', 'pick', 'confirm.tsx'))).toBe(false);
    expect(existsSync(join(APP, '(tabs)', 'pick', 'done.tsx'))).toBe(false);
    expect(layout).toContain('<ResultToastHost />');
  });

  it('정보 오류 완료 CTA는 direct-entry fallback을 가진다', () => {
    expect(screen('(tabs)', 'search', '[vendorId]', 'fix-report.tsx')).toContain('onPress: depthBack');
  });

  it('후기 작성 완료는 성공 화면을 쌓지 않고 부모 시트를 닫는다', () => {
    const write = screen('(tabs)', 'search', '[vendorId]', 'write-review.tsx');

    expect(write).toContain('dismissToOrReplace(`/search/${vendorId}`)');
    expect(write).not.toContain('setDone(');
  });

  it('배우자 연결·탈퇴 완료는 replace로 완료 화면을 폐기한다', () => {
    const join = screen('(tabs)', 'wedding', 'join.tsx');
    const withdrawal = screen('(tabs)', 'my', 'withdrawal.tsx');

    expect(join).toContain("router.replace('/wedding'");
    expect(withdrawal).toContain("router.replace('/login'");
  });

  it('문의 완료는 state를 닫거나 Depth Back으로 빠져나가는 출구가 둘 다 있다', () => {
    const contact = screen('(tabs)', 'my', 'contact.tsx');

    expect(contact).toContain('onPress={() => setAcknowledgement(null)}');
    expect(contact).toContain('label="문의 마치기" onPress={depthBack}');
  });
});
