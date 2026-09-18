from pathlib import Path
import hashlib,json
root=Path.cwd()
entries=[
 ('apps/mobile/src/features/home/home-summary.tsx','175d6172c29a4f0456f5a0687e9ed8f0dbd79ad3','6cebe8637ef59a074d6cc780d6cef7f67b889d76'),
 ('apps/mobile/src/features/home/canon-components.test.tsx','cc28e9cf1c5e761e39024a4b479dca2772123371','1f361ff411cf9143e6ad954793fb8ef96fad7f55'),
 ('apps/mobile/src/features/navigation/design-recovery.test.ts','436f06dea4c62d80bdc7706acf028ae618c42f49','01c63c46d9837b23ac114f49f2a252163d4d73f5'),
 ('packages/api-contract/src/capture-fixtures.test.ts','bca1c7a425ec4a660a75acc5d0ab5c584f5f9961','02ef5d321f9f120774adc2d04ac23e138c09b24a')]
def blob(data):return hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()
for name,before,after in entries:
 if blob((root/name).read_bytes())!=before:raise SystemExit('Unexpected fixup base: '+name)
p=root/entries[0][0];p.write_text(p.read_text().replace("item.state === 'going'","item.state === 'picking'"))
p=root/entries[1][0];s=p.read_text().replace('type ReactTestRenderer }','type ReactTestRenderer, type ReactTestRendererJSON }').replace("state: 'going'","state: 'picking'")
s=s.replace('const text = (view: ReactTestRenderer) => JSON.stringify(view.toJSON());','''/** 표시되는 자식 문자열만 읽는다. 아이콘 SVG 좌표/스타일 수치를 문구로 세지 않는다. */
function renderedText(node: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null): string {
  if (node === null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(renderedText).join(' ');
  return (node.children ?? []).map(renderedText).join(' ');
}
const text = (view: ReactTestRenderer) => renderedText(view.toJSON());''')
s=s.replace("describe('최신 홈·추천 연결', () => {",'''describe('최신 홈·추천 연결', () => {
  it('별점 검사는 SVG 좌표를 제외하되 실제 표시된 별점은 탐지한다', () => {
    const icon: ReactTestRendererJSON = { type: 'RNSVGPath', props: { d: 'M2 4.80739' }, children: null };
    const rating: ReactTestRendererJSON = { type: 'Text', props: {}, children: ['4.8'] };
    expect(renderedText(icon)).not.toContain('4.8');
    expect(renderedText([icon, rating])).toContain('4.8');
  });''');p.write_text(s)
p=root/entries[2][0];s=p.read_text();s=s.replace("import { execFileSync } from 'node:child_process';\nimport { resolve } from 'node:path';",'''export {};

// 이 테스트에 필요한 Node 경계만 선언한다. 앱 전체의 타입 범위를 넓히지 않는다.
declare const require: (id: string) => unknown;
declare const __dirname: string;
const { execFileSync } = require('node:child_process') as {
  execFileSync: (file: string, args: string[], options: {
    cwd: string; env: Record<string, string | undefined>; encoding: 'utf8'; timeout: number;
  }) => string;
};
const { resolve } = require('node:path') as { resolve: (...paths: string[]) => string };
const runtime = require('node:process') as { execPath: string; env: Record<string, string | undefined> };''').replace('process.env','runtime.env').replace('process.execPath','runtime.execPath');p.write_text(s)
p=root/entries[3][0];s=p.read_text().replace("import { myReportListResponseSchema }", "import { inquiryListResponseSchema } from './inquiries';\nimport { myReportListResponseSchema }").replace("  ['GET /v1/me/reports', myReportListResponseSchema],", "  ['GET /v1/me/reports', myReportListResponseSchema],\n  ['GET /v1/inquiries', inquiryListResponseSchema],");p.write_text(s)
for name,before,after in entries:
 if blob((root/name).read_bytes())!=after:raise SystemExit('Unexpected fixup result: '+name)
print(json.dumps({'ciFixupsVerified':len(entries),'allHashesMatch':True}))
