import { createConfirmationQueue, type Confirmation } from './confirmation-queue';

describe('createConfirmationQueue', () => {
  it('아이콘(ok · bad · warn)은 선택 인자로만 전달하고, 안 주면 넣지 않는다', () => {
    const opened: Confirmation[] = [];
    const queue = createConfirmationQueue({
      scope: () => '/pick',
      render: (request) => {
        opened.push(request);
        return () => undefined;
      },
      onError: (error) => { throw error; },
    });

    queue.enqueue('완료', '', [{ text: '확인' }], 'ok');
    expect(opened[0]?.icon).toBe('ok');
    queue.reset();
    queue.enqueue('기본', '', [{ text: '확인' }]);
    expect(opened[1]).not.toHaveProperty('icon');
  });

  it('다이얼로그를 겹치지 않고 순서대로 연다', () => {
    const opened: string[] = [];
    const selectors: Array<(index: number | null) => void> = [];
    const queue = createConfirmationQueue({
      scope: () => '/pick',
      render: (request, select) => {
        opened.push(request.title);
        selectors.push(select);
        return () => undefined;
      },
      onError: (error) => { throw error; },
    });

    queue.enqueue('첫 번째', '', [{ text: '확인' }]);
    queue.enqueue('두 번째', '', [{ text: '확인' }]);

    expect(opened).toEqual(['첫 번째']);
    selectors[0]!(0);
    expect(opened).toEqual(['첫 번째', '두 번째']);
  });

  it('화면 scope가 바뀌면 열린 요청과 대기 요청을 버린다', () => {
    let scope = '/pick';
    const state: { active: Confirmation | null } = { active: null };
    const queue = createConfirmationQueue({
      scope: () => scope,
      render: (request) => {
        state.active = request;
        return () => { state.active = null; };
      },
      onError: (error) => { throw error; },
    });

    queue.enqueue('Pick 확인', '', [{ text: '확인' }]);
    expect(state.active?.title).toBe('Pick 확인');

    scope = '/my';
    queue.checkScope();
    expect(state.active).toBeNull();
  });
});
