import type { TermsArticle, PrivacySection } from './legal-documents';
const INK = '#212124';
const SEC = '#4D5159';
const TER = '#868B94';
const BAND = '#F2F3F6';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function legalText(text: string): string {
  return esc(text).replace(/https:\/\/[^\s<>]+/g, url => `<a href="${url}">${url}</a>`);
}

export function legalDocument(articles: TermsArticle[]): string {
  const toc = articles.map((a, i) => `
    <a href="#article-${i}">${esc(a.t)}</a>`).join('');

  const content = articles.map((a, i) => {
    const clauses = a.l.map((text, ci) => `
      <div style="display:flex;gap:12px;align-items:flex-start">
        <span style="width:22px;height:22px;flex:0 0 22px;border-radius:6px;background:${BAND};color:${TER};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums">${ci + 1}</span>
        <span style="flex:1;font-size:16px;line-height:27px;color:${SEC}">${legalText(text)}</span>
      </div>`).join('');

    return `<section id="article-${i}" style="display:flex;flex-direction:column;gap:12px">
      <h2 style="font-size:19px;line-height:26px;font-weight:700;color:${INK};margin:0">${esc(a.t)}</h2>
      <div style="display:flex;flex-direction:column;gap:8px">${clauses}</div>
    </section>`;
  }).join('');

  return `<div class="sp-legal">
    <details class="sp-toc"><summary>목차 보기</summary><nav aria-label="문서 목차">${toc}</nav></details>
    <div class="sp-content">${content}</div>
  </div>`;
}

export function privacyDocument(sections: PrivacySection[]): string {
  const toc = sections.map((s, i) => `
    <a href="#ps-${i}">${esc(s.t)}</a>`).join('');

  const content = sections.map((s, i) => {
    let body: string;
    if (s.table && s.cols && s.rows) {
      const header = `<thead><tr>${s.cols.map(c => `<th scope="col">${esc(c.label)}</th>`).join('')}</tr></thead>`;
      const rows = s.rows.map(r => `<tr>${r.map((cell, ci) => {
        const tag = ci === 0 ? 'th' : 'td';
        return `<${tag}${ci === 0 ? ' scope="row"' : ''}><span class="sp-cell-label" aria-hidden="true">${esc(s.cols![ci]!.label)}</span>${legalText(cell)}</${tag}>`;
      }).join('')}</tr>`).join('');
      body = `${s.lead ? `<p style="font-size:15px;line-height:24px;color:${SEC};margin:0 0 12px">${esc(s.lead)}</p>` : ''}
        <table class="sp-policy-table" aria-label="${esc(s.t)}">${header}<tbody>${rows}</tbody></table>`;
    } else {
      const clauses = (s.l ?? []).map((text, ci) => `
        <div style="display:flex;gap:12px;align-items:flex-start">
          <span style="width:22px;height:22px;flex:0 0 22px;border-radius:6px;background:${BAND};color:${TER};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums">${ci + 1}</span>
          <span style="flex:1;font-size:16px;line-height:27px;color:${SEC}">${legalText(text)}</span>
        </div>`).join('');
      body = `<div style="display:flex;flex-direction:column;gap:8px">${clauses}</div>`;
    }

    return `<section id="ps-${i}" style="display:flex;flex-direction:column;gap:12px">
      <h2 style="font-size:19px;line-height:26px;font-weight:700;color:${INK};margin:0">${esc(s.t)}</h2>
      ${body}
    </section>`;
  }).join('');

  return `<div class="sp-legal">
    <details class="sp-toc"><summary>목차 보기</summary><nav aria-label="문서 목차">${toc}</nav></details>
    <div class="sp-content">${content}</div>
  </div>`;
}

/** 공개 API와 웹은 동일한 렌더러로 원문을 이스케이프한다. 관리자가 HTML을 주입할 수 없다. */
export function publishedLegalBody(doc: 'terms' | 'privacy' | 'marketing', sections: PrivacySection[]): string {
  return doc === 'privacy' ? privacyDocument(sections) : legalDocument(sections.map((s) => ({ t: s.t, l: s.l ?? [] })));
}

