import { captureReducer } from '@/features/capture/capture-reducer';
import type { CapturedPage } from '@/features/capture/types';

function page(id: string): CapturedPage {
  return { id, uri: `file:///${id}.jpg`, mimeType: 'image/jpeg', source: 'camera' };
}

describe('captureReducer', () => {
  it('찍은 순서를 유지하며 장을 쌓는다', () => {
    const pages = captureReducer(captureReducer([], { type: 'add', pages: [page('a')] }), {
      type: 'add',
      pages: [page('b'), page('c')],
    });

    expect(pages.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('한 장만 빼고 나머지 순서는 그대로 둔다', () => {
    const pages = captureReducer([page('a'), page('b'), page('c')], { type: 'remove', id: 'b' });

    expect(pages.map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('없는 id를 빼도 목록이 그대로다', () => {
    const before = [page('a')];
    const after = captureReducer(before, { type: 'remove', id: 'zzz' });

    expect(after.map((item) => item.id)).toEqual(['a']);
  });

  it('전부 지우면 빈 목록이 된다', () => {
    expect(captureReducer([page('a'), page('b')], { type: 'clear' })).toEqual([]);
  });
});
