import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(__dirname, 'wedding-feed.tsx'), 'utf8');

describe('관리자 웨딩피드 비동기 폼 회귀', () => {
  it('카테고리 변경 뒤 늦게 온 Gemini 초안을 버린다', () => {
    expect(source).toContain('const requestedCategory = form.categoryLabel');
    expect(source).toContain('current.categoryLabel === requestedCategory');
    expect(source).toContain('disabled={draftGenerating}');
  });

  it('닫은 폼의 이미지 업로드 완료가 새 폼을 바꾸지 않는다', () => {
    expect(source).toContain('const formRevision = useRef(0)');
    expect(source).toContain('if (formRevision.current !== revision) return');
    expect(source).toContain('onClose={closePostEditor}');
  });
});
