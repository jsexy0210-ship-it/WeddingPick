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

const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

const APP = join(__dirname, '..', '..', 'app');

function screen(...parts: string[]): string {
  return readFileSync(join(APP, ...parts), 'utf8');
}

describe('transient completion flow navigation', () => {
  it('capture 제출 스택은 탭을 떠나면 초기화한다', () => {
    const layout = screen('(tabs)', '_layout.tsx');

    expect(layout).toContain("popToTopOnBlur: name === 'capture'");
  });

  it('Pick 완료 스택은 /pick/done에서 떠날 때만 초기화한다', () => {
    const layout = screen('(tabs)', '_layout.tsx');

    expect(layout).toContain("popToTopOnBlur: tab.name === 'pick' && onPickDone");
  });

  it('Pick 완료 → 지출 추가는 완료 화면 위에 다음 화면을 push하지 않는다', () => {
    const source = screen('(tabs)', 'pick', 'done.tsx');
    const start = source.indexOf('async function goAddExpense()');
    const end = source.indexOf('/* 완료 화면은 뒤로 갈 화면이 아니다.', start);
    const flow = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(flow).toContain('router.replace({');
    expect(flow).not.toContain('router.push({');
  });

  it('자료 확인 접수 완료 → 진행 상황은 완료 페이지를 history에 남기지 않는다', () => {
    const source = screen('(tabs)', 'capture', 'verify', '[quoteId].tsx');
    const start = source.indexOf('if (received)');
    const end = source.indexOf('const levels =', start);
    const done = source.slice(start, end);

    expect(done).toContain('router.replace(\`/capture/verify-status/');
    expect(done).toContain('label="결과로 돌아가기" onPress={depthBack}');
    expect(done).not.toContain('router.back()');
  });

  it('정보 오류·업체 자료·업체 혜택 완료 CTA는 direct-entry fallback을 가진다', () => {
    const files = [
      screen('(tabs)', 'search', '[vendorId]', 'fix-report.tsx'),
      screen('(tabs)', 'my', 'biz', 'data.tsx'),
      screen('(tabs)', 'my', 'biz', 'benefit.tsx'),
    ];

    for (const source of files) {
      expect(source).toContain('onPress={depthBack}');
    }
  });

  it('후기 작성·수정 완료는 명시적으로 후기 목록에서 흐름을 끝낸다', () => {
    const write = screen('(tabs)', 'search', '[vendorId]', 'write-review.tsx');
    const edit = screen('(tabs)', 'search', '[vendorId]', 'edit-review.tsx');

    expect(write).toContain('dismissToOrReplace(\`/search/\${vendorId}/reviews\`)');
    expect(edit).toContain('dismissToOrReplace(\`/search/\${vendorId}/reviews\`)');
  });

  it('배우자 연결·Pick 인증·탈퇴 완료는 replace로 완료 화면을 폐기한다', () => {
    const join = screen('(tabs)', 'wedding', 'join.tsx');
    const payment = screen('(tabs)', 'capture', 'payment', 'register.tsx');
    const withdrawal = screen('(tabs)', 'my', 'withdrawal.tsx');

    expect(join).toContain("router.replace('/wedding'");
    expect(payment).toContain("router.replace('/wedding'");
    expect(withdrawal).toContain("router.replace('/login'");
  });

  it('문의 완료는 state를 닫거나 Depth Back으로 빠져나가는 출구가 둘 다 있다', () => {
    const contact = screen('(tabs)', 'my', 'contact.tsx');

    expect(contact).toContain('onPress={() => setAcknowledgement(null)}');
    expect(contact).toContain('label="돌아가기" onPress={depthBack}');
  });
});
