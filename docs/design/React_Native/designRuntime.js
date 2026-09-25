import React from 'react';
import { assetOverrides } from '../assetOverrides.js';

export class DesignModel {
  constructor(props = {}, notify = () => {}) { this.props = props; this.state = {}; this.notify = notify; }
  setState(update) {
    const patch = typeof update === 'function' ? update(this.state, this.props) : update;
    this.state = { ...this.state, ...patch };
    this.notify();
  }
}
export function useDesignValues(Model, props = {}) {
  const [, forceUpdate] = React.useReducer(n => n + 1, 0);
  const model = React.useRef(null);
  if (!model.current) model.current = new Model(props, forceUpdate);
  model.current.props = props;
  return model.current.renderVals();
}
const missingIcon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="black" d="M4 3h16v18H4V3Zm2 2v14h12V5H6Zm5 10h2v2h-2v-2Zm-2-5a3 3 0 1 1 4.3 2.7c-.3.1-.3.4-.3 1.3h-2c0-1.4.1-2.1 1.3-2.7a1 1 0 1 0-1.3-1.3H9Z"/></svg>');
const missingPhoto = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#eaebee"/><g fill="none" stroke="#b5bac3" stroke-width="2"><rect x="182" y="132" width="36" height="30" rx="3"/><circle cx="192" cy="142" r="3"/><path d="m184 159 10-10 7 7 5-5 10 10"/></g></svg>');
export function resolveAsset(source) {
  if (!source) return null;
  if (/^(data:|blob:)/.test(source)) return source;
  let key = String(source); try { key = decodeURIComponent(key); } catch { /* Preserve a malformed original URL in the report. */ }
  return assetOverrides[key] || null;
}
const cache = new Map();
let declaration;
const camelCase = key => key.startsWith('--') ? key : key.replace(/^-ms-/, 'ms-').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
/** CSS 문자열을 브라우저 CSS 파서로 읽는다. SVG data URL 안의 세미콜론도 보존한다. */
export function toStyle(input) {
  if (!input) return undefined;
  if (typeof input === 'object') return input;
  const original = String(input);
  if (cache.has(original)) return cache.get(original);
  const rewritten = original.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g, (full, a, b, c) => {
    const path = (a ?? b ?? c ?? '').trim();
    if (/^(data:|blob:)/.test(path)) return full;
    const resolved = resolveAsset(path);
    return 'url("' + (resolved || (/(?:seed-icons|material-icons)/.test(path) ? missingIcon : missingPhoto)).replace(/"/g, '%22') + '")';
  });
  if (!declaration) declaration = document.createElement('div').style;
  declaration.cssText = rewritten;
  const result = {};
  for (let i = 0; i < declaration.length; i++) {
    const key = declaration.item(i);
    result[camelCase(key)] = declaration.getPropertyValue(key).trim();
  }
  if (cache.size > 10000) cache.clear();
  cache.set(original, result);
  return result;
}
export function ImageSlot({ src, style, placeholder, shape, radius, ...rest }) {
  const resolved = resolveAsset(src);
  const common = { display: 'block', overflow: 'hidden', background: '#eaebee', ...style };
  if (radius && !common.borderRadius) common.borderRadius = Number(radius) || radius;
  if (shape === 'circle') common.borderRadius = '50%';
  if (resolved) return React.createElement('img', { ...rest, src: resolved, alt: placeholder || '', style: { objectFit: 'cover', ...common } });
  return React.createElement('span', { ...rest, role: 'img', 'aria-label': '원본 이미지 미첨부: ' + (src || placeholder || ''), 'data-missing-asset': src || 'unassigned', title: src || '원본 이미지가 첨부되지 않았습니다.', style: { ...common, backgroundImage: `url("${missingPhoto}")`, backgroundPosition: 'center', backgroundSize: 'cover' } });
}
const hrefGroups = { '대메뉴_홈(로그인, 온보딩).dc.html': 'home', '대메뉴_검색.dc.html': 'search', '대메뉴_Pick.dc.html': 'pick', '대메뉴_웨딩노트.dc.html': 'note', '대메뉴_MY.dc.html': 'my' };
export function designHref(value) {
  if (!value) return undefined;
  const href = String(value);
  const [file, anchor] = href.split('#');
  const group = hrefGroups[file];
  if (group) return '#' + group + (anchor ? '?anchor=' + encodeURIComponent(anchor) : '');
  if (href.startsWith('#')) {
    const current = window.location.hash.slice(1).split('?')[0] || 'home';
    return '#' + current + '?anchor=' + encodeURIComponent(href.slice(1));
  }
  return href;
}
