// public/assets의 SVG를 단일 HTML에서도 사용할 수 있는 데이터 URL 모듈로 생성한다.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'reports/icon-sources.json'), 'utf8'));
const icons = {};
for (const item of [...manifest.icons].sort((a, b) => a.path.localeCompare(b.path))) {
  const absolute = path.resolve(root, 'public', item.path);
  const publicRoot = path.resolve(root, 'public') + path.sep;
  if (!absolute.startsWith(publicRoot)) throw new Error('잘못된 아이콘 경로: ' + item.path);
  if (!fs.existsSync(absolute)) throw new Error('필수 아이콘 누락: ' + item.path);
  const svg = fs.readFileSync(absolute, 'utf8').trim();
  if (!/^<svg[\s>]/.test(svg) || !/viewBox=/.test(svg) || !/<path[\s>]/.test(svg)) {
    throw new Error('유효하지 않은 SVG: ' + item.path);
  }
  if (/<script\b|<foreignObject\b|on[a-z]+\s*=|(?:href|src)\s*=\s*["']https?:/i.test(svg)) {
    throw new Error('외부 참조 또는 스크립트를 가진 SVG: ' + item.path);
  }
  icons[item.path] = svg;
}
const output = '/** scripts/build-icons.cjs에서 생성. SVG 원본은 public/assets/에서 수정한다. */\n'
  + 'export const iconSvg = ' + JSON.stringify(icons, null, 2) + ';\n'
  + "export const iconAssets = Object.fromEntries(Object.entries(iconSvg).map(([name, svg]) => [name, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)]));\n";
fs.writeFileSync(path.join(root, 'src/iconAssets.js'), output);
console.log('Bundled ' + Object.keys(icons).length + ' SVG icons without external font files.');
