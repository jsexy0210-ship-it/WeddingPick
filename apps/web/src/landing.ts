import strings from '../../../spec/strings.ko.json';
import tokens from '../../../spec/tokens.json';
import { BUSINESS, BUSINESS_NOTICE_LINES } from '@weddingpick/domain';
import { CONTACT_EMAIL } from './content';
import { socialMeta } from './social-meta';

const S = strings.webLanding;
const T = tokens.webLanding;
const C = tokens.color;
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lines = (s: string): string => esc(s).replace(/\n/g, '<br>');

function mark(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z"/><path d="M9.4 11.9l1.7 1.7 3.4-3.4"/></svg>`;
}

export function marketingHeader(): string {
  return `<header class="wp-header"><div class="wp-shell wp-header-inner">
    <a class="wp-brand" href="/">${mark()}<span>${esc(S.brand)}</span></a>
    <nav aria-label="${esc(S.navLabel)}">${S.nav.map(n => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join('')}</nav>
    <a class="wp-header-cta" href="/#download">${esc(S.launchLink)}</a>
  </div></header>`;
}

export function marketingFooter(): string {
  return `<footer class="wp-footer"><div class="wp-shell">
    <div class="wp-footer-top"><div><a href="/" class="wp-brand">${mark()}<span>${esc(S.brand)}</span></a><p>${esc(S.footerTag)}</p></div>
    <nav aria-label="${esc(S.footerLabel)}">${S.footerLinks.map(n => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join('')}</nav></div>
    <div class="wp-footer-bottom"><div>${BUSINESS_NOTICE_LINES.map(l => `<p>${esc(l)}</p>`).join('')}${CONTACT_EMAIL ? `<a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>` : `<a href="/support.html">${esc(S.contact)}</a>`}</div><p>© ${new Date().getFullYear()} ${esc(BUSINESS.name)}. ${esc(S.copyright)}</p></div>
  </div></footer>`;
}

export function faviconTags(): string {
  return `<link rel="icon" type="image/png" href="/assets/favicon-32.png" sizes="32x32"><link rel="icon" type="image/png" href="/assets/favicon-16.png" sizes="16x16"><link rel="icon" type="image/png" href="/assets/favicon-48.png" sizes="48x48"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/assets/site.webmanifest"><meta name="theme-color" content="${C.brand.primary.value}">`;
}

export const MARKETING_CHROME = `
.wp-shell{width:min(${T.maxWidth}px,calc(100% - 48px));margin-inline:auto}
.wp-header{background:${C.surface.paper.value};border-bottom:1px solid ${C.line.divider.value};position:relative;z-index:5}
.wp-header-inner{min-height:80px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.wp-brand{display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-size:22px;font-weight:700;white-space:nowrap;color:${C.text.ink.value}}
.wp-brand svg{width:28px;height:28px;color:${C.brand.primary.value}}
.wp-header nav{display:flex;gap:32px}.wp-header nav a{font-size:14px;text-decoration:none;min-height:44px;display:flex;align-items:center;color:${C.text.secondary.value}}
.wp-header-cta{display:flex;align-items:center;justify-content:center;min-height:44px;padding:0 20px;border:1px solid ${C.line.divider.value};border-radius:${T.buttonRadius}px;font-size:14px;font-weight:700;text-decoration:none;color:${C.text.ink.value};white-space:nowrap}
.wp-footer{padding:48px 0 32px;background:${C.surface.recessed.value};border-top:1px solid ${C.line.divider.value};color:${C.text.secondary.value}}
.wp-footer-top{display:flex;justify-content:space-between;gap:24px;padding-bottom:32px}.wp-footer-top p{font-size:14px;margin:12px 0 0}
.wp-footer nav{display:flex;flex-wrap:wrap;gap:8px 24px;align-items:start}.wp-footer nav a{display:flex;align-items:center;min-height:44px;font-size:14px;text-decoration:none}
.wp-footer-bottom{border-top:1px solid ${C.line.divider.value};padding-top:24px;display:flex;justify-content:space-between;gap:24px;font-size:13px;line-height:1.7}.wp-footer-bottom p{margin:0}.wp-footer-bottom a{display:inline-block;min-height:32px;overflow-wrap:anywhere}
a:focus-visible,summary:focus-visible{outline:3px solid ${C.text.ink.value};outline-offset:5px}a:hover{text-decoration:underline;text-underline-offset:4px}
@media(max-width:${T.mobileWidth}px){.wp-header-inner{min-height:112px;flex-wrap:wrap;gap:0;padding-block:12px 0}.wp-brand{font-size:20px}.wp-header nav{order:3;width:100%;justify-content:space-between;gap:8px}.wp-header nav a{font-size:13px}.wp-header-cta{padding:0 14px}.wp-footer-top,.wp-footer-bottom{flex-direction:column}.wp-footer nav{gap:0 20px}.wp-footer{padding-top:32px}}
`;

function preview(): string {
  const P = S.heroPreview;
  return `<figure class="wp-preview"><figcaption class="wp-preview-caption">${esc(S.example)}</figcaption>
    <div class="wp-preview-app"><div class="wp-preview-top"><span>${esc(P.title)}</span>${mark()}</div>
      <h2>${esc(P.intro)}</h2><p class="wp-preview-filter">${esc(P.condition)}</p>
      <div class="wp-vendor"><div class="wp-vendor-heading"><span class="wp-vendor-initial" aria-hidden="true">A</span><div><span class="wp-mini-label">${esc(P.title)}</span><h3>${esc(P.vendor)}</h3></div><span class="wp-picked">${mark()}</span></div>
        <p class="wp-reason">${esc(P.reason)}</p><strong class="wp-price">${esc(P.price)}</strong><p class="wp-meta">${esc(P.meta)}</p>
      </div>
      <div class="wp-saved-strip"><strong>${esc(P.pick)}</strong><div aria-hidden="true"><span class="wp-letter">A</span><span class="wp-letter">B</span><span class="wp-letter">C</span></div></div>
      <p class="wp-preview-end">${esc(P.compare)}<span aria-hidden="true">↗</span></p>
    </div>
  </figure>`;
}

function comparison(): string {
  const D = S.comparison;
  return `<figure class="wp-comparison"><figcaption><span>${esc(D.caption)}</span></figcaption><div class="wp-table-scroll" role="region" aria-label="${esc(D.caption)}" tabindex="0"><table><thead><tr>${D.columns.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${D.rows.map(row => `<tr>${row.map((v,i) => i === 0 ? `<th scope="row">${esc(v)}</th>` : `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>${esc(D.note)}</p></figure>`;
}

function together(): string {
  const D=S.together;
  return `<figure class="wp-together"><figcaption>${esc(S.example)}</figcaption><div class="wp-pick-sheet"><div class="wp-sheet-top">${mark()}<strong>${esc(D.title)}</strong></div>${D.names.map((n,i) => `<div class="wp-pick-row"><span class="wp-letter">${'AB'[i]}</span><div><strong>${esc(n)}</strong><p>${esc(i === 0 ? D.label : D.solo)}</p></div>${mark()}</div>`).join('')}</div><div class="wp-schedule-sheet"><span>${esc(D.schedule)}</span><div><strong>${esc(D.task)}</strong><span>${esc(D.date)}</span></div></div></figure>`;
}

const STYLE = `
*,*::before,*::after{box-sizing:border-box}html{font-family:${tokens.typography.$fontFamily.web};-webkit-text-size-adjust:100%;scroll-behavior:smooth}body{margin:0;color:${C.text.ink.value};background:${C.surface.paper.value};font-size:${T.bodySize}px;line-height:1.65}a{color:inherit}p,h1,h2,h3,figure{margin:0}h1,h2,h3{font-weight:700;word-break:keep-all;overflow-wrap:anywhere}p{word-break:keep-all;overflow-wrap:anywhere}svg{display:block}section[id]{scroll-margin-top:32px}
${MARKETING_CHROME}
.wp-skip{position:absolute;top:-100px;left:24px;background:white;padding:12px;z-index:10}.wp-skip:focus{top:12px}
.wp-hero{display:grid;grid-template-columns:1.08fr 1fr;gap:64px;align-items:center;padding-block:64px 72px}
.wp-eyebrow{display:block;font-size:${T.smallSize}px;font-weight:700;letter-spacing:.02em;margin-bottom:20px;color:${C.text.secondary.value}}
.wp-hero h1{font-size:${T.heroSize}px;line-height:${T.heroLine};letter-spacing:-.055em;margin-bottom:28px}.wp-lead{font-size:${T.bodySize}px;line-height:1.8;color:${C.text.secondary.value};max-width:520px}
.wp-actions{display:flex;align-items:center;flex-wrap:wrap;gap:16px;margin-top:32px}.wp-primary{min-height:52px;display:inline-flex;align-items:center;justify-content:center;gap:24px;padding:0 24px;background:${C.text.ink.value};color:${C.surface.paper.value};border-radius:${T.buttonRadius}px;text-decoration:none;font-size:16px;font-weight:700}.wp-secondary{display:inline-flex;align-items:center;min-height:44px;font-size:14px;text-underline-offset:5px}.wp-hero-status{font-size:13px;color:${C.text.secondary.value};margin-top:16px}
.wp-preview{background:${T.canvas};padding:24px 32px;border-radius:${T.previewRadius}px;min-width:0}.wp-preview-caption{text-align:center;font-size:13px;color:${C.text.secondary.value};margin-bottom:16px;letter-spacing:.08em}.wp-preview-app{background:${C.surface.paper.value};border:1px solid ${C.line.divider.value};border-radius:${T.cardRadius}px;box-shadow:${T.previewShadow};padding:24px}.wp-preview-top{display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700}.wp-preview-top svg{width:24px;height:24px;color:${C.brand.primary.value}}.wp-preview h2{font-size:24px;letter-spacing:-.04em;line-height:1.4;margin-top:16px}.wp-preview-filter{font-size:12px;color:${C.text.secondary.value};margin:8px 0 20px}.wp-vendor{border:1px solid ${C.line.divider.value};border-radius:12px;padding:16px}.wp-vendor-heading{display:flex;gap:12px;align-items:center}.wp-vendor-initial{display:grid;place-items:center;flex:0 0 44px;height:44px;background:${T.canvas};font-size:24px}.wp-mini-label{font-size:11px;color:${C.text.secondary.value};font-weight:400}.wp-vendor h3{font-size:16px;line-height:1.4}.wp-picked{margin-left:auto;background:${T.highlight};border-radius:50%;padding:8px;color:${C.brand.primaryDark.value}}.wp-picked svg{width:20px;height:20px}.wp-reason{font-size:12px;margin:16px 0 12px}.wp-price{font-size:26px;letter-spacing:-.04em;font-variant-numeric:tabular-nums}.wp-meta{font-size:11px;color:${C.text.secondary.value};line-height:1.65;margin-top:4px}.wp-preview-list{margin-top:20px}.wp-preview-list h3{font-size:14px;margin-bottom:8px}.wp-preview-list h3 span{color:${C.brand.primaryDark.value};margin-left:4px}.wp-preview-list>div{display:flex;align-items:center;gap:10px;border-bottom:1px solid ${C.line.divider.value};padding:8px 0;font-size:12px}.wp-letter{display:grid;place-items:center;background:${C.surface.recessed.value};width:30px;height:30px;font-size:12px;font-weight:700;border-radius:6px;flex-shrink:0}.wp-tiny-mark{margin-left:auto;color:${C.brand.primaryDark.value}}.wp-tiny-mark svg{width:16px;height:16px}.wp-preview-end{display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-top:16px}.wp-preview-note{font-size:11px;color:${C.text.secondary.value};line-height:1.6;margin-top:16px}
.wp-section{padding-block:${T.sectionSpace}px}.wp-heading{font-size:${T.headingSize}px;line-height:${T.headingLine};letter-spacing:-.045em}.wp-section-intro{display:flex;justify-content:space-between;align-items:end;gap:48px}.wp-section-intro p{color:${C.text.secondary.value};font-size:16px;max-width:420px}.wp-how{border-top:1px solid ${C.line.divider.value}}.wp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:32px;margin-top:48px}.wp-step{border-top:2px solid ${C.text.ink.value};padding-top:20px}.wp-step-number{font-size:14px;color:${C.text.secondary.value};font-variant-numeric:tabular-nums}.wp-step h3{font-size:22px;letter-spacing:-.04em;margin:20px 0 12px}.wp-step p{font-size:16px;color:${C.text.secondary.value};line-height:1.8}
.wp-feature{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:64px;align-items:center}.wp-feature-copy>p{color:${C.text.secondary.value};margin-top:24px;font-size:16px;line-height:1.85}.wp-feature-copy .wp-aside{font-size:14px;border-left:2px solid ${C.line.divider.value};padding-left:16px}.wp-comparison{min-width:0;padding:28px;background:${C.surface.paper.value};border:1px solid ${C.line.divider.value};border-radius:${T.cardRadius}px}.wp-comparison figcaption{display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:16px;font-weight:700;margin-bottom:24px}.wp-table-scroll{overflow-x:auto}table{width:100%;table-layout:fixed;border-collapse:collapse;word-break:keep-all;overflow-wrap:anywhere;font-size:12px;font-variant-numeric:tabular-nums;text-align:left}th,td{padding:16px 8px;border-bottom:1px solid ${C.line.divider.value}}thead th{font-weight:700}tbody th{font-weight:400;color:${C.text.secondary.value}}th:nth-child(2),td:nth-child(2){background:${T.highlight}}.wp-comparison>p:not(.wp-preview-note){font-size:12px;color:${C.text.secondary.value};margin-top:20px}.wp-comparison .wp-preview-note{font-size:11px}
.wp-band{background:${C.surface.recessed.value}}.wp-feature-reverse .wp-feature-copy{order:2}.wp-feature-reverse figure{order:1}.wp-points{list-style:none;margin:24px 0 0;padding:0}.wp-points li{font-size:15px;padding:10px 0;border-bottom:1px solid ${C.line.divider.value};display:flex;align-items:center;gap:12px}.wp-points svg{width:18px;height:18px;color:${C.brand.primaryDark.value};flex-shrink:0}
.wp-together{padding:32px;background:${T.canvas};border-radius:${T.previewRadius}px}.wp-together figcaption{font-size:12px;color:${C.text.secondary.value};margin-bottom:16px}.wp-pick-sheet{padding:24px;background:${C.surface.paper.value};border:1px solid ${C.line.divider.value};border-radius:${T.cardRadius}px}.wp-sheet-top{display:flex;align-items:center;gap:10px;font-size:16px;margin-bottom:16px}.wp-sheet-top svg{width:24px;height:24px;color:${C.brand.primaryDark.value}}.wp-pick-row{display:flex;align-items:center;gap:12px;padding:16px 0;border-top:1px solid ${C.line.divider.value}}.wp-pick-row strong{font-size:14px}.wp-pick-row p{font-size:11px;color:${C.text.secondary.value}}.wp-pick-row>svg{width:20px;height:20px;margin-left:auto;color:${C.brand.primaryDark.value}}.wp-schedule-sheet{padding:20px 24px;margin-top:12px;background:${C.surface.paper.value};border:1px solid ${C.line.divider.value};border-radius:12px}.wp-schedule-sheet>span{font-size:12px;color:${C.text.secondary.value}}.wp-schedule-sheet>div{display:flex;justify-content:space-between;gap:16px;margin-top:12px;font-size:14px}
.wp-trust{border-top:1px solid ${C.line.divider.value}}.wp-sources{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px}.wp-source{border-top:1px solid ${C.line.divider.value};padding-top:24px}.wp-source-label{font-size:14px;display:inline-block;color:${C.text.secondary.value}}.wp-source h3{font-size:24px;margin:16px 0 12px;letter-spacing:-.03em}.wp-source p{font-size:16px;line-height:1.8;color:${C.text.secondary.value};max-width:460px}.wp-trust-note{font-size:14px;color:${C.text.secondary.value};margin-top:32px;padding:24px;background:${C.surface.recessed.value};border-radius:12px}
.wp-faq{display:grid;grid-template-columns:.8fr 1.2fr;gap:80px;border-top:1px solid ${C.line.divider.value}}.wp-faq .wp-heading{font-size:32px}.wp-faq .wp-secondary{margin-top:24px}.wp-faq details{border-bottom:1px solid ${C.line.divider.value}}.wp-faq details:first-child{border-top:1px solid ${C.line.divider.value}}.wp-faq summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:20px;align-items:center;font-size:16px;font-weight:700;min-height:72px;padding-block:20px;word-break:keep-all}.wp-faq summary::-webkit-details-marker{display:none}.wp-faq summary::after{content:'+';font-size:24px;font-weight:400;flex-shrink:0}.wp-faq details[open] summary::after{content:'−'}.wp-faq details p{font-size:15px;line-height:1.8;color:${C.text.secondary.value};padding:0 32px 24px 0}
.wp-launch{background:${T.canvas};padding:64px;border-radius:${T.previewRadius}px;margin-bottom:${T.sectionSpace}px;display:flex;align-items:center;justify-content:space-between;gap:40px}.wp-launch .wp-heading{font-size:32px}.wp-launch p{font-size:16px;color:${C.text.secondary.value};margin-top:12px}.wp-launch .wp-launch-note{font-size:13px}.wp-launch .wp-primary{flex-shrink:0}
@media(max-width:${T.tabletWidth}px){.wp-hero{gap:32px;padding-block:48px}.wp-hero h1{font-size:48px}.wp-preview{padding:20px}.wp-preview-app{padding:20px}.wp-feature{gap:32px;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr)}.wp-heading{font-size:34px}.wp-section-intro{gap:32px}.wp-steps{gap:24px}.wp-comparison{padding:20px}.wp-faq{gap:40px}.wp-launch{padding:40px}.wp-launch .wp-heading{font-size:28px}}
@media(max-width:${T.mobileWidth}px){body{font-size:${T.mobileBodySize}px}.wp-hero{grid-template-columns:1fr;gap:32px;padding-block:40px 48px}.wp-hero h1{font-size:${T.mobileHeroSize}px;line-height:1.25;margin-bottom:20px}.wp-eyebrow{font-size:13px;margin-bottom:16px}.wp-lead{font-size:16px}.wp-actions{margin-top:24px;gap:16px}.wp-hero-status{margin-top:12px}.wp-preview{padding:20px;max-width:460px;width:100%;margin-inline:auto}.wp-preview-app{padding:20px}.wp-preview h2{font-size:22px}.wp-preview-note{font-size:12px}.wp-section{padding-block:${T.mobileSectionSpace}px}.wp-heading{font-size:${T.mobileHeadingSize}px}.wp-section-intro{display:block}.wp-section-intro p{margin-top:20px}.wp-steps{grid-template-columns:1fr;gap:28px;margin-top:32px}.wp-step{display:grid;grid-template-columns:32px 1fr;gap:0 16px;padding-top:16px;border-top-width:1px}.wp-step-number{grid-row:1/3;padding-top:2px}.wp-step h3{font-size:20px;margin:0 0 8px}.wp-step p{font-size:16px}.wp-feature{grid-template-columns:1fr;gap:32px}.wp-feature-reverse .wp-feature-copy,.wp-feature-reverse figure{order:initial}.wp-comparison{padding:20px 16px}.wp-comparison figcaption{flex-wrap:wrap;gap:4px;margin-bottom:16px}th,td{padding:14px 8px}.wp-table-scroll{margin-inline:-4px}.wp-comparison .wp-preview-note{font-size:12px}.wp-together{padding:24px}.wp-pick-sheet{padding:20px}.wp-sources{grid-template-columns:1fr;gap:24px;margin-top:32px}.wp-source h3{font-size:22px}.wp-trust-note{padding:20px;font-size:14px}.wp-faq{grid-template-columns:1fr;gap:24px}.wp-faq .wp-heading{font-size:28px}.wp-faq .wp-secondary{margin-top:12px}.wp-faq summary{font-size:16px;min-height:68px}.wp-launch{padding:32px 24px;flex-direction:column;align-items:flex-start;gap:24px;margin-bottom:64px}.wp-launch .wp-heading{font-size:28px}.wp-launch .wp-primary{width:100%}}
.wp-saved-strip{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:20px;padding-top:16px;border-top:1px solid ${C.line.divider.value};font-size:13px}.wp-saved-strip>div{display:flex;gap:4px}.wp-saved-strip strong span{color:${C.brand.primaryDark.value};margin-left:4px}.wp-table-scroll:focus-visible{outline:2px solid ${C.text.ink.value};outline-offset:2px}
.wp-feature-copy,.wp-pick-row>div,.wp-footer-top>div,.wp-footer-bottom>div{min-width:0}.wp-picked,.wp-pick-row>svg{flex-shrink:0}.wp-schedule-sheet>div{flex-wrap:wrap}.wp-preview-caption{letter-spacing:0}.wp-hero h1{letter-spacing:-.04em}
@media(max-width:430px){.wp-preview,.wp-together{padding:16px}.wp-preview-app,.wp-pick-sheet{padding:16px}.wp-price{font-size:22px}.wp-comparison{padding:20px 12px}th,td{padding:12px 4px}.wp-header nav a{font-size:14px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;

export function renderLandingV4(): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(S.metaTitle)}</title><meta name="description" content="${esc(S.metaDescription)}">${socialMeta('/',S.metaTitle,S.metaDescription)}${faviconTags()}<style>${STYLE}</style></head><body>
  <a href="#main" class="wp-skip">${esc(S.skip)}</a>${marketingHeader()}<main id="main">
    <section class="wp-shell wp-hero"><div><span class="wp-eyebrow">${esc(S.eyebrow)}</span><h1>${lines(S.hero)}</h1><p class="wp-lead">${lines(S.lead)}</p><div class="wp-actions"><a class="wp-primary" href="#download">${esc(S.launchLink)}<span aria-hidden="true">↗</span></a><a class="wp-secondary" href="#how">${esc(S.howLink)}</a></div><p class="wp-hero-status">${esc(S.launch)}</p></div>${preview()}</section>
    <section id="how" class="wp-shell wp-section wp-how"><div class="wp-section-intro"><h2 class="wp-heading">${lines(S.stepsTitle)}</h2><p>${lines(S.stepsBody)}</p></div><div class="wp-steps">${S.steps.map(s => `<article class="wp-step"><span class="wp-step-number">${s.n}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></article>`).join('')}</div></section>
    <section class="wp-band"><div class="wp-shell wp-section wp-feature"><div class="wp-feature-copy"><span class="wp-eyebrow">${esc(S.compareLabel)}</span><h2 class="wp-heading">${lines(S.compareTitle)}</h2><p>${esc(S.compareBody)}</p><p class="wp-aside">${esc(S.compareNote)}</p></div>${comparison()}</div></section>
    <section class="wp-shell wp-section wp-feature wp-feature-reverse"><div class="wp-feature-copy"><span class="wp-eyebrow">${esc(S.pickLabel)}</span><h2 class="wp-heading">${lines(S.pickTitle)}</h2><p>${esc(S.pickBody)}</p><ul class="wp-points">${S.pickPoints.map(p => `<li>${mark()}${esc(p)}</li>`).join('')}</ul></div>${together()}</section>
    <section id="trust" class="wp-shell wp-section wp-trust"><span class="wp-eyebrow">${esc(S.trustLabel)}</span><div class="wp-section-intro"><h2 class="wp-heading">${lines(S.trustTitle)}</h2><p>${esc(S.trustBody)}</p></div><div class="wp-sources">${S.sources.map(s => `<article class="wp-source"><span class="wp-source-label">${esc(s.label)}</span><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></article>`).join('')}</div><p class="wp-trust-note">${esc(S.trustNote)}</p></section>
    <section id="faq" class="wp-shell wp-section wp-faq"><div><h2 class="wp-heading">${esc(S.faqTitle)}</h2><a class="wp-secondary" href="/faq.html">${esc(S.faqMore)}</a></div><div>${S.faq.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div></section>
    <section id="download" class="wp-shell wp-launch"><div><h2 class="wp-heading">${esc(S.launch)}</h2><p>${esc(S.launchBody)}</p><p class="wp-launch-note">${esc(S.launchNote)}</p></div><a class="wp-primary" href="/support.html">${esc(S.contact)}<span aria-hidden="true">↗</span></a></section>
  </main>${marketingFooter()}</body></html>`;
}
