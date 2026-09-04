import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { build } from './build';
import { SHARE_DESCRIPTION, SHARE_IMAGE, SHARE_TITLE, SITE_ORIGIN } from './social-meta';

test('built public HTML exposes one complete sharing card and preserved icons without JavaScript', async () => {
  const out = join(__dirname, '..', 'dist');
  await build(out);
  const required = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type',
    'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
  for (const name of readdirSync(out).filter((n) => n.endsWith('.html') && n !== 'admin.html')) {
    const html = readFileSync(join(out, name), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    for (const tag of required) {
      expect(head.match(new RegExp(`(?:property|name)="${tag}"`, 'g'))).toHaveLength(1);
    }
    expect(head).toContain(`content="${SITE_ORIGIN}/${name === 'index.html' ? '' : name}"`);
    expect(head).toContain(`content="${SHARE_IMAGE}"`);
  }
  const home = readFileSync(join(out, 'index.html'), 'utf8');
  expect(home).toContain(`content="${SHARE_TITLE}"`);
  expect(home).toContain(`content="${SHARE_DESCRIPTION}"`);
  for (const name of ['favicon-16.png', 'favicon-32.png', 'favicon-48.png', 'apple-touch-icon.png', 'site.webmanifest']) {
    expect(home).toContain(`/assets/${name}`);
    expect(readFileSync(join(out, 'assets', name))).toEqual(readFileSync(join(__dirname, '..', 'public', 'assets', name)));
  }
  const png = readFileSync(join(out, 'assets', 'weddingpick-og.png'));
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});
