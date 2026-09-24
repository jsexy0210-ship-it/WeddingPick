import { DesignModel } from "../runtime/designRuntime.js";

class Component extends DesignModel {
  renderVals() {
    const vP = '#ff6f61';
    const vINK = '#212124';
    const SUB = '#4d5159';
    const vMUTED = '#868b94';
    const vDIM = '#adb1ba';
    const vSEC = '#f2f3f6';
    const REC = '#f7f8fa';
    const vBORDER = '#eaebee';
    const AMBER = '#805217';
    const DS = 'assets/seed-icons/';
    const vICO = (n, sz, c) => 'display:inline-block;width:' + sz + 'px;height:' + sz + 'px;flex:0 0 ' + sz + 'px;background-color:' + c
      + ';-webkit-mask:url(' + DS + n + '.svg) center/contain no-repeat;mask:url(' + DS + n + '.svg) center/contain no-repeat';

    const IMG = {
      urban: 'uploads/스타일 이미지/urban.png',
      natural: 'uploads/스타일 이미지/natural.png',
      romantic: 'uploads/스타일 이미지/romantic.png',
      glam: 'uploads/스타일 이미지/glamorous.png'
    };

    const tab = (label, on) => ({ label,
      style: 'flex:1;height:48px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;cursor:pointer;'
        + (on ? 'color:' + vINK + ';box-shadow:inset 0 -2px 0 ' + vINK : 'color:' + vMUTED) });
    const FILLED = ['home', 'search', 'heart', 'profile'];
    const rtab = (icon, text, on) => ({ icon: ICO(on && FILLED.indexOf(icon) >= 0 ? icon + '-fill' : icon, 24, on ? INK : MUTED), text,
      label: 'font-size:12px;line-height:16px;font-weight:700;color:' + (on ? INK : MUTED) });

    const reason = (label, on) => ({ label,
      mark: 'width:20px;height:20px;flex:0 0 20px;margin-top:2px;border-radius:999px;'
        + (on
          ? 'background:' + vP + ';background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'3.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m5 12.5 4.5 4.5L19 7.5\'/%3E%3C/svg%3E");background-size:13px;background-position:center;background-repeat:no-repeat'
          : 'background:' + vSEC),
      text: 'flex:1;font-size:15px;line-height:23px;color:' + (on ? vINK : vMUTED) });

    const pkg = (o) => ({
      name: o.name, meta: o.meta, price: o.price, specs: o.specs,
      card: 'border-radius:10px;padding:20px;display:flex;flex-direction:column;gap:14px;border:1px solid ' + vBORDER + ';background:#fff',
      btn: 'height:48px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;background:' + vSEC + ';color:' + vINK
    });

    const pin = (x, y, price, on) => ({ price,
      style: 'position:absolute;left:' + x + 'px;top:' + y + 'px;height:28px;padding:0 10px;border-radius:999px;display:flex;align-items:center;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,27,55,.18);'
        + (on ? 'background:' + vP + ';color:#fff;' : 'background:#fff;color:' + vINK + ';') });
    const gcell = (id, src) => ({ id, src, cell: 'width:64px;height:64px;flex:0 0 64px;border-radius:6px;overflow:hidden;position:relative' });
    const pdist = (label, n, pct) => ({ label, n: n + '건',
      labelStyle: 'width:150px;flex:0 0 150px;font-size:13px;color:' + vMUTED,
      numStyle: 'width:36px;flex:0 0 36px;text-align:right;font-size:13px;font-weight:700;color:' + vINK + ';font-variant-numeric:tabular-nums',
      fill: 'display:block;height:100%;width:' + Math.round(pct * 100) + '%;background:' + vP });
    const rpt = (label, on) => ({ label,
      rowStyle: 'display:flex;align-items:center;gap:12px;min-height:52px;padding:0 16px;box-shadow:inset 0 -1px 0 ' + vBORDER,
      mark: on
        ? 'width:22px;height:22px;flex:0 0 22px;border-radius:999px;background:' + vP + ';background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'3.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m5 12.5 4.5 4.5L19 7.5\'/%3E%3C/svg%3E");background-size:14px;background-position:center;background-repeat:no-repeat'
        : 'width:22px;height:22px;flex:0 0 22px;border-radius:999px;box-shadow:inset 0 0 0 1.5px #dcdee3' });
    const axis = (q, opts) => ({ q,
      opts: opts.map(([label, n, pct, top]) => ({
        label, n: n + '명',
        labelStyle: 'width:90px;flex:0 0 90px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' + (top ? 'font-weight:700;color:' + vINK : 'color:' + vMUTED),
        fill: 'display:block;width:' + pct + '%;height:100%;border-radius:999px;background:' + (top ? vP : '#ffd6d1'),
        numStyle: 'width:36px;flex:0 0 36px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;' + (top ? 'font-weight:700;color:' + vINK : 'color:' + vMUTED)
      })) });

    const STAR_PATH = 'M12 2.5l2.9 6 6.6.7-4.9 4.5 1.3 6.5L12 16.9l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.7Z';
    const STARROW = (n, sz) => Array.from({ length: 5 }, (_, i) => ({
      style: 'width:' + sz + 'px;height:' + sz + 'px;flex:0 0 ' + sz + 'px;display:inline-block;'
        + '-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'' + STAR_PATH + '\'/%3E%3C/svg%3E") center/contain no-repeat;'
        + 'mask:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'' + STAR_PATH + '\'/%3E%3C/svg%3E") center/contain no-repeat;'
        + 'background-color:' + (i < n ? vP : '#dcdee3') }));
    const rev = (mark, author, date, verified, answers, text, stars) => ({ mark, author, date, verified, answers, text, stars: STARROW(stars, 14) });

    const dt = (day, weekday, sel) => ({ day: day + '일', weekday,
      cell: 'flex:0 0 auto;width:60px;height:72px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;'
        + (sel ? 'background:' + vP + ';' : 'background:' + REC + ';'),
      wd: 'font-size:12px;color:' + (sel ? 'rgba(255,255,255,.72)' : vMUTED),
      dayStyle: 'font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;color:' + (sel ? '#fff' : vINK) });

    const tm = (label, sel) => ({ label,
      style: 'height:48px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;cursor:pointer;'
        + (sel ? 'background:' + vP + ';color:#fff;' : 'background:' + REC + ';color:' + SUB + ';') });

    const faqItem = (q, a) => ({ q, a,
      wrap: 'display:flex;flex-direction:column;gap:10px;padding:16px 0;box-shadow:inset 0 -1px 0 ' + vBORDER,
      icon: vICO('chevron-right', 18, vDIM) + (a ? ';transform:rotate(90deg)' : '') });
    const vdiff = (k, a, b, why, warn) => ({ k, a, b, why,
      bStyle: 'width:270px;flex:0 0 270px;font-size:13px;line-height:20px;font-weight:700;color:' + (warn ? AMBER : vINK) });


    const P = '#ff6f61';
    const INK = '#212124';
    const MUTED = '#868b94';
    const DIM = '#adb1ba';
    const SEC = '#f2f3f6';
    const BORDER = '#eaebee';
    const SANS = "-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif";
    const DISPLAY = 'inherit';
    const MONO = 'inherit';

    const ICO = (name, px, color) => 'width:' + px + 'px;height:' + px + 'px;flex:0 0 ' + px + 'px;'
      + 'background-color:' + color + ';'
      + '-webkit-mask:url("assets/seed-icons/' + name + '.svg") center/contain no-repeat;'
      + 'mask:url("assets/seed-icons/' + name + '.svg") center/contain no-repeat;'
      + 'display:inline-block';

    const CARET = (dir, color) => 'width:14px;height:14px;flex:0 0 14px;opacity:.5;'
      + 'background-color:' + color + ';'
      + '-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'2.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'' + (dir === 'up' ? 'm6 14.5 6-6 6 6' : 'm6 9.5 6 6 6-6') + '\'/%3E%3C/svg%3E") center/contain no-repeat;'
      + 'mask:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'2.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'' + (dir === 'up' ? 'm6 14.5 6-6 6 6' : 'm6 9.5 6 6 6-6') + '\'/%3E%3C/svg%3E") center/contain no-repeat;'
      + 'display:inline-block';

    const chip = (label, on) => ({
      label,
      style: 'flex:0 0 auto;height:36px;display:inline-flex;align-items:center;gap:4px;padding:0 14px;border-radius:999px;font-size:14px;font-weight:700;white-space:nowrap;cursor:pointer;box-sizing:border-box;'
        + (on ? 'background:' + INK + ';color:#fff;border:1px solid ' + INK + ';' : 'background:#fff;color:' + INK + ';border:1px solid ' + BORDER + ';'),
      caret: CARET('down', on ? '#fff' : INK)
    });

    const v = (o) => ({
      name: o.name, categoryLabel: o.categoryLabel, location: o.location, price: o.price,
      reports: o.reports, badge: o.badge || '',
      tags: o.tags,
      thumbStyle: 'width:100%;height:116px;border-radius:8px;background:' + SEC + ' url("' + o.image + '") center/cover no-repeat;display:block',
      heartWrap: 'flex:0 0 28px;width:28px;height:28px;border-radius:999px;display:flex;align-items:center;justify-content:center;margin-top:2px;'
        + (o.picked ? 'background:' + P + ';' : 'background:' + SEC + ';'),
      heartIcon: ICO(o.picked ? 'heart-fill' : 'heart', 14, o.picked ? '#fff' : MUTED)
    });

    const opt = (label, on) => ({
      label, on,
      style: 'display:inline-flex;align-items:center;gap:4px;padding:10px 14px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;cursor:pointer;'
        + (on ? 'background:' + P + ';color:#fff;' : 'background:' + SEC + ';color:' + MUTED + ';')
    });

    const sortPill = (label, on) => ({
      label,
      style: 'flex:0 0 auto;padding:10px 16px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;cursor:pointer;'
        + (on ? 'background:' + INK + ';color:#fff;' : 'background:' + SEC + ';color:' + MUTED + ';')
    });

    const sortRow = (label, on, last) => ({
      label, on,
      rowStyle: 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;cursor:pointer;'
        + (last ? '' : 'border-bottom:1px solid rgba(231,229,228,.5);'),
      labelStyle: 'font-size:14px;line-height:20px;' + (on ? 'font-weight:700;color:' + INK : 'color:' + MUTED)
    });

    const diff = (k, a, b, verdict, kind) => ({
      k, a, b, verdict,
      verdictStyle: 'width:120px;flex:0 0 120px;font-size:13px;line-height:20px;font-weight:700;white-space:nowrap;color:'
        + (kind === 'bad' ? '#dc2626' : kind === 'warn' ? '#b45309' : MUTED)
    });

    return {
      o1: 'display:flex;flex-direction:column;gap:10px;width:430px',
      tabBar: 'flex:0 0 72px;display:flex;box-shadow:inset 0 1px 0 ' + BORDER + ';background:#fff;padding-top:9px',
      tabCell: 'flex:1;display:flex;flex-direction:column;align-items:center;gap:3px',
      rootTabs: [rtab('home', '홈', false), rtab('search', '검색', true), rtab('heart', 'Pick', false), rtab('calendar', '웨딩노트', false), rtab('profile', 'MY', false)],
      o2: 'display:flex;flex-direction:column;gap:10px;width:430px',
      o3: 'display:flex;flex-direction:column;gap:10px;width:430px',
      o4: 'display:flex;flex-direction:column;gap:10px;width:430px',
      o5: 'display:flex;flex-direction:column;gap:10px;width:430px',
      o6: 'display:flex;flex-direction:column;gap:10px;width:430px',
      o7: 'display:flex;flex-direction:column;gap:10px;width:430px',
      o8: 'display:flex;flex-direction:column;gap:10px;width:430px',
      o9: 'display:flex;flex-direction:column;gap:10px;width:880px',
      o10: 'display:flex;flex-direction:column;gap:10px;width:880px',
      o11: 'display:flex;flex-direction:column;gap:10px;width:430px',
      o12: 'display:flex;flex-direction:column;gap:10px;width:430px',
      o13: 'display:flex;flex-direction:column;gap:10px;width:430px',
      o14: 'display:flex;flex-direction:column;gap:10px;width:430px',
      o15: 'display:flex;flex-direction:column;gap:10px;width:430px',

      acSec: 'flex:0 0 auto;padding:16px 20px 4px;display:flex;flex-direction:column;gap:2px',
      acHead: 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:8px',
      acLabel: 'font-size:13px;font-weight:700;color:' + MUTED,
      acClearAll: 'font-size:13px;font-weight:700;color:' + MUTED,
      acRow: 'display:flex;align-items:center;gap:10px;min-height:48px',
      acText: 'flex:1;min-width:0;font-size:15px;color:' + INK,
      acBold: 'font-weight:700;color:' + INK,
      icoClock: ICO('history', 18, MUTED),
      icoX2: ICO('close-fill', 16, DIM),
      icoSearch2: ICO('search', 18, MUTED),
      acRecent: ['강남 A 스튜디오', '한옥 스몰웨딩', '성수 드레스'],
      acSuggest: [
        { m: '강남', rest: ' A 스튜디오' }, { m: '강남', rest: '구 웨딩홀' },
        { m: '강남', rest: '역 드레스샵' }, { m: '강남', rest: '스타일 메이크업' }
      ],

      revTitleRow: 'display:flex;align-items:center;justify-content:space-between;gap:12px',
      writeReviewBtn: 'flex:0 0 auto;height:32px;padding:0 14px;border-radius:6px;background:' + vP + ';color:#fff;display:inline-flex;align-items:center;font-size:13px;font-weight:700;white-space:nowrap',
      mapCardWrap: 'flex:0 0 auto;padding:12px 20px 24px',
      mapCard: 'border-radius:12px;background:#fff;box-shadow:0 4px 16px rgba(0,27,55,.14);padding:16px;display:flex;align-items:center;justify-content:space-between;gap:12px',
      mapCopyBtn: 'flex:0 0 auto;height:36px;padding:0 14px;border-radius:6px;background:' + vSEC + ';color:' + vINK + ';display:inline-flex;align-items:center;font-size:13px;font-weight:700;white-space:nowrap',
      mapCardCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px',

      galNav: 'flex:0 0 56px;display:flex;align-items:center;gap:8px;padding:0 16px;background:#17181c',
      galClose: 'width:36px;height:36px;flex:0 0 36px;border-radius:999px;background:#f2f3f6;display:flex;align-items:center;justify-content:center',
      icoXw: ICO('close-fill', 16, '#212124'),
      navTitleW: 'flex:1;min-width:0;text-align:center;font-size:14px;font-weight:700;color:#fff',
      navRightPad: 'width:36px;flex:0 0 36px',
      galBig: 'flex:1;min-height:0;position:relative;background:#000',
      galStrip: 'flex:0 0 72px;display:flex;gap:4px;padding:8px;background:#17181c;overflow-x:auto;scrollbar-width:none',
      galThumbs: [
        gcell('gt-1', IMG.urban), gcell('gt-2', IMG.natural), gcell('gt-3', IMG.romantic),
        gcell('gt-4', IMG.glam), gcell('gt-5', IMG.urban), gcell('gt-6', IMG.natural),
        gcell('gt-7', IMG.romantic), gcell('gt-8', IMG.glam)
      ],

      secTop: 'flex:0 0 auto;padding:20px;display:flex;flex-direction:column;gap:6px',
      priceBig: 'font-size:26px;font-weight:700;color:' + vINK + ';font-variant-numeric:tabular-nums',
      priceMeta: 'font-size:13px;color:' + vMUTED + ';font-variant-numeric:tabular-nums',
      priceDist: [
        pdist('예산 1,000~2,000만원', 12, 0.7), pdist('예산 2,000~3,000만원', 6, 0.4), pdist('그 밖', 2, 0.15)
      ],

      rptLabel: 'flex:1;font-size:15px;color:' + vINK,
      rptTypes: [
        rpt('가격 · 요금 정보', true), rpt('영업시간 · 연락처', false), rpt('주소 · 위치', false), rpt('영업 종료 · 폐업', false)
      ],
      rptArea: 'min-height:100px;border-radius:8px;background:' + vSEC + ';padding:14px',
      rptInput: 'height:48px;border-radius:8px;background:' + vSEC + ';display:flex;align-items:center;padding:0 14px',
      rptPh: 'font-size:14px;color:' + vMUTED,
      ctaFull2: 'flex:1;height:56px;border-radius:6px;background:' + vP + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700',
      vroot: 'display:flex;flex-direction:column;gap:32px;padding:64px;width:max-content',
      vintro: 'display:none;flex-direction:column;gap:10px;max-width:960px',
      veyebrow: 'font-size:14px;line-height:19px;font-weight:700;color:' + vP,
      h0: 'font-size:40px;line-height:52px;font-weight:700;color:' + vINK,
      lead: 'font-size:17px;line-height:26px;color:' + SUB + ';text-wrap:pretty',
      row: 'display:flex;gap:36px;align-items:flex-start;flex-wrap:wrap',
      vcol: 'display:flex;flex-direction:column;gap:10px;width:430px',
      vcolWide: 'width:100%;flex:0 0 100%;display:flex;flex-direction:column;gap:10px;width:900px',
      vtag: 'height:26px;display:flex;align-items:center;gap:8px;font-size:18px;font-weight:700;color:' + vINK + ';white-space:nowrap',
      vtagId: 'width:26px;height:26px;flex:0 0 26px;border-radius:6px;background:' + vINK + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700',
      vtagDesc: 'height:66px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;line-height:21px;color:' + SUB + ';text-wrap:pretty',

      vphone: 'width:430px;height:932px;border-radius:40px;overflow:hidden;position:relative;display:flex;flex-direction:column;background:#fff;box-shadow:0 15px 75px rgba(0,27,55,.14)',
      vbar: 'flex:0 0 44px;display:flex;align-items:center;padding:0 26px;font-size:14px;font-weight:700;color:' + vINK,
      navBar: 'flex:0 0 56px;display:flex;align-items:center;gap:8px;padding:0 16px;box-shadow:inset 0 -1px 0 ' + vBORDER,
      navTitle: 'flex:1;min-width:0;text-align:center;font-size:16px;font-weight:700;color:' + vINK + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
      navRightPad: 'width:36px;flex:0 0 36px',
      vicoBack: vICO('chevron-left', 24, vINK) + ';width:36px;flex:0 0 36px;-webkit-mask-size:24px;mask-size:24px',
      icoShare: vICO('more-horiz', 22, vINK),
      vscroll: 'flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;scrollbar-width:none',

      heroWrap: 'flex:0 0 auto;position:relative;width:430px;height:290px',
      heroShade: 'position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.55),rgba(0,0,0,0) 55%)',
      heroText: 'position:absolute;left:20px;bottom:18px;display:flex;flex-direction:column;gap:4px',
      heroCat: 'font-size:13px;font-weight:700;color:rgba(255,255,255,.82)',
      heroName: 'font-size:28px;line-height:36px;font-weight:700;color:#fff',
      heroCount: 'position:absolute;right:16px;bottom:18px;height:26px;padding:0 10px;border-radius:999px;background:rgba(0,0,0,.5);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;font-variant-numeric:tabular-nums',

      priceBlock: 'flex:0 0 auto;padding:20px 20px 18px;display:flex;flex-direction:column;gap:5px;box-shadow:inset 0 -1px 0 ' + vBORDER,
      priceBig: 'font-size:30px;line-height:38px;font-weight:700;color:' + vINK + ';font-variant-numeric:tabular-nums',
      priceMeta: 'font-size:13px;color:' + vMUTED + ';font-variant-numeric:tabular-nums',

      tabNav: 'flex:0 0 auto;display:flex;gap:0;padding:0 20px;box-shadow:inset 0 -1px 0 ' + vBORDER,
      tabs: [tab('소개', true), tab('패키지', false), tab('후기', false), tab('정보', false)],
      tabsPkg: [tab('소개', false), tab('패키지', true), tab('후기', false), tab('정보', false)],
      tabsRev: [tab('소개', false), tab('패키지', false), tab('후기', true), tab('정보', false)],

      sec: 'flex:0 0 auto;padding:20px;display:flex;flex-direction:column;gap:12px',
      secTop: 'flex:0 0 auto;padding:20px;display:flex;flex-direction:column;gap:14px',
      secHead: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px',
      secTitle: 'font-size:17px;font-weight:700;color:' + vINK,
      secMeta: 'font-size:13px;color:' + vMUTED + ';font-variant-numeric:tabular-nums',
      note: 'font-size:13px;line-height:20px;color:' + vMUTED + ';text-wrap:pretty',
      divider: 'flex:0 0 8px;background:' + vSEC,

      reasonWrap: 'display:flex;flex-direction:column;gap:10px',
      reasonRow: 'display:flex;align-items:flex-start;gap:10px',
      reasons: [
        reason('고른 스타일이랑 가장 비슷해요', true),
        reason('생각한 예산 안에 들어와요', true),
        reason('원하는 날에 가능해요', false)
      ],

      galWrap: 'display:flex;gap:8px;overflow-x:auto;scrollbar-width:none',
      galCell: 'width:140px;height:140px;flex:0 0 140px;border-radius:10px;overflow:hidden;position:relative',
      gallery: [
        { id: 'vd-g1', src: IMG.urban }, { id: 'vd-g2', src: IMG.natural },
        { id: 'vd-g3', src: IMG.romantic }, { id: 'vd-g4', src: IMG.glam }
      ],

      rows: 'display:flex;flex-direction:column',
      kvRow: 'display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:48px;box-shadow:inset 0 -1px 0 ' + vBORDER,
      kvK: 'font-size:15px;color:' + SUB,
      kvV: 'font-size:15px;font-weight:700;color:' + vINK + ';font-variant-numeric:tabular-nums;white-space:nowrap',
      included: [
        { k: '촬영 시간', v: '4시간' }, { k: '원본', v: '전체' },
        { k: '보정', v: '20장' }, { k: '앨범', v: '10×10 · 20p' }
      ],
      extras: [
        { k: '야외 촬영', v: '25만원' }, { k: '드레스 추가', v: '15만원' }, { k: '주말 촬영', v: '10만원' }
      ],

      pkgHead: 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px',
      pkgNameCol: 'display:flex;flex-direction:column;gap:3px;min-width:0',
      pkgName: 'font-size:18px;font-weight:700;color:' + vINK,
      pkgMeta: 'font-size:13px;color:' + vMUTED + ';font-variant-numeric:tabular-nums',
      pkgPrice: 'font-size:20px;font-weight:700;color:' + vINK + ';font-variant-numeric:tabular-nums;white-space:nowrap',
      pkgGrid: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px',
      pkgCell: 'border-radius:8px;background:' + REC + ';padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:3px',
      pkgCellK: 'font-size:11px;color:' + vMUTED,
      pkgCellV: 'font-size:13px;font-weight:700;color:' + vINK,
      packages: [
        pkg({ name: '베이직', meta: '실 제보 4건', price: '85만원', specs: [{ k: '시간', v: '3시간' }, { k: '컷', v: '200컷' }, { k: '보정', v: '60장' }] }),
        pkg({ name: '프리미엄', meta: '실 제보 6건', price: '120만원', specs: [{ k: '시간', v: '5시간' }, { k: '컷', v: '400컷' }, { k: '보정', v: '100장' }] }),
        pkg({ name: '올인클루시브', meta: '실 제보 2건', price: '180만원', specs: [{ k: '시간', v: '전일' }, { k: '컷', v: '제한 없음' }, { k: '보정', v: '200장' }] })
      ],

      axesWrap: 'display:flex;flex-direction:column;gap:20px',
      axisBlock: 'display:flex;flex-direction:column;gap:8px',
      axisQ: 'font-size:14px;font-weight:700;color:' + vINK,
      axisRow: 'display:flex;align-items:center;gap:10px',
      axisTrack: 'flex:1;height:6px;border-radius:999px;background:' + vSEC + ';overflow:hidden',
      axes: [
        axis('상담은 어땠나요?', [['빨랐어요', 9, 64, true], ['적당했어요', 4, 29], ['여유있었어요', 1, 7]]),
        axis('결과물은 어땠나요?', [['기대 이상', 8, 57, true], ['기대만큼', 5, 36], ['괜찮았어요', 1, 7]]),
        axis('금액 안내는요?', [['명확했어요', 11, 79, true], ['보통이었어요', 2, 14], ['설명해줬어요', 1, 7]])
      ],

      revItem: 'flex:0 0 auto;padding:18px 20px;display:flex;flex-direction:column;gap:10px;box-shadow:inset 0 -1px 0 ' + vBORDER,
      revHead: 'display:flex;align-items:center;gap:10px',
      revAvatar: 'width:36px;height:36px;flex:0 0 36px;border-radius:999px;background:' + vSEC + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:' + SUB,
      revNameCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px',
      revName: 'font-size:15px;font-weight:700;color:' + vINK,
      revDate: 'font-size:12px;color:' + vMUTED + ';font-variant-numeric:tabular-nums',
      badgeVerify: 'padding:4px 9px;border-radius:4px;background:#e8faf6;color:#1aa174;font-size:12px;font-weight:700;white-space:nowrap',
      revAnswers: 'display:flex;flex-wrap:wrap;gap:6px',
      revChip: 'height:28px;padding:0 10px;border-radius:999px;background:' + REC + ';display:inline-flex;align-items:center;font-size:12px;font-weight:700;color:' + SUB,
      revText: 'font-size:15px;line-height:24px;color:' + SUB + ';text-wrap:pretty',
      reviews: [
        rev('김', '김OO', '2026.09', true, ['빨랐어요', '기대 이상', '명확했어요'], '자연광이 예쁜 곳을 찾고 있었는데 상담 때부터 원하는 무드를 잘 이해해주셨어요. 촬영 당일도 편하게 이끌어주셨습니다.', 5),
        rev('박', '박OO', '2026.08', true, ['적당했어요', '기대만큼', '명확했어요'], '예약부터 결과물 받기까지 전반적으로 좋았어요. 다만 대기 시간이 조금 있었습니다.', 4)
      ],
      overallStars: STARROW(5, 18),
      overallScore: '4.8',
      starRow: 'display:flex;gap:2px',
      starSumRow: 'display:flex;align-items:center;gap:8px',
      starScore: 'font-size:16px;font-weight:700;color:' + vINK + ';font-variant-numeric:tabular-nums',

      h1: 'font-size:28px;line-height:38px;font-weight:700;color:' + vINK,
      sub: 'font-size:15px;color:' + vMUTED,
      dateWrap: 'display:flex;gap:8px;overflow-x:auto;scrollbar-width:none',
      dates: [dt(18, '금'), dt(19, '토'), dt(20, '일', true), dt(22, '화'), dt(23, '수'), dt(25, '금'), dt(26, '토')],
      timeGrid: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px',
      times: [tm('오전 10시'), tm('오전 11시 반'), tm('오후 1시'), tm('오후 2시', true), tm('오후 3시 반'), tm('오후 5시')],
      textarea: 'min-height:96px;border-radius:6px;border:1px solid #d1d3d8;padding:14px;font-size:15px;color:' + vDIM,
      syncBox: 'border-radius:10px;background:' + REC + ';padding:16px;display:flex;flex-direction:column;gap:4px',
      syncT: 'font-size:15px;font-weight:700;color:' + vINK,
      syncS: 'font-size:13px;color:' + vMUTED,

      dock: 'flex:0 0 92px;padding:12px 20px;display:flex;gap:10px;box-shadow:inset 0 1px 0 ' + vBORDER,
      dockSingle: 'flex:0 0 92px;padding:12px 20px;display:flex;box-shadow:inset 0 1px 0 ' + vBORDER,
      pickBtn: 'width:56px;height:56px;flex:0 0 56px;border-radius:6px;border:1px solid #dcdee3;display:flex;align-items:center;justify-content:center',
      icoHeart: vICO('heart', 22, vP),
      icoHeartW: vICO('heart', 20, '#fff') + ';margin-right:8px',
      ctaPick: 'flex:1;height:56px;border-radius:6px;background:' + vP + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700',
      ctaMain: 'flex:1;height:56px;border-radius:6px;background:' + vP + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700',
      ctaFull: 'flex:1;height:56px;border-radius:6px;background:' + vP + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700',

      tabsInfo: [tab('소개', false), tab('패키지', false), tab('후기', false), tab('정보', true)],
      infoRow: 'display:flex;align-items:flex-start;justify-content:space-between;gap:16px;min-height:52px;padding:14px 0;box-shadow:inset 0 -1px 0 ' + vBORDER,
      infoK: 'width:84px;flex:0 0 84px;font-size:14px;color:' + vMUTED,
      infoV: 'flex:1;font-size:15px;line-height:23px;color:' + vINK + ';text-wrap:pretty',
      infoRows: [
        { k: '주소', v: '서울 강남구 청담로 12길 8 · 3층' },
        { k: '가는 길', v: '압구정로데오역 3번 출구에서 걸어서 7분' },
        { k: '영업시간', v: '화~금 10시~19시 · 토·일 10시~18시' },
        { k: '쉬는 날', v: '매주 월요일' },
        { k: '전화', v: '02-555-1234' },
        { k: '주차', v: '건물 지하 2시간 무료 · 이후 10분 1,000원' },
        { k: '예약', v: '상담은 예약제예요. 방문 전에 잡아주세요.' }
      ],
      infoPartial: [
        { k: '주소', v: '서울 성동구 성수동' },
        { k: '전화', v: '02-000-0000' }
      ],
      mapText2: '지도는 상담 잡은 뒤에 보여드려요',
      emptyBox: 'border-radius:10px;background:' + REC + ';padding:28px 20px;display:flex;flex-direction:column;align-items:center;gap:6px',
      emptyT: 'font-size:15px;font-weight:700;color:' + vINK,
      emptyS: 'font-size:13px;line-height:20px;color:' + vMUTED + ';text-align:center',
      faqHead: 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px',
      faqQ: 'flex:1;font-size:15px;font-weight:700;color:' + vINK + ';text-wrap:pretty',
      faqA: 'font-size:14px;line-height:22px;color:' + SUB + ';text-wrap:pretty',
      faq: [
        faqItem('예약 취소는 언제까지 되나요?', '촬영 7일 전까지는 전액 돌려드려요. 3일 전까지는 절반이고 그 뒤로는 어려워요. 날짜를 옮기는 건 한 번까지 무료예요.'),
        faqItem('의상은 몇 벌까지 되나요?', '기본 2벌이에요. 한 벌 더 입으시면 15만원이 붙어요.'),
        faqItem('헤어랑 메이크업도 해주나요?', ''),
        faqItem('보정본은 언제 받나요?', ''),
        faqItem('원본도 전부 주시나요?', ''),
        faqItem('비 오면 어떻게 되나요?', '')
      ],
      mapWrap: 'margin-top:14px;height:200px;border-radius:10px;overflow:hidden;background:' + REC,
      mapBtns: 'display:flex;gap:8px;margin-top:10px',
      mapBtn: 'flex:1;height:48px;border-radius:8px;background:' + REC + ';display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:' + vINK,
      fixRow: 'display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;margin-top:6px',
      fixText: 'font-size:14px;color:' + vMUTED,
      icoChevR: vICO('chevron-right', 18, vDIM),
      vdiffCard: 'width:900px;background:#fff;border:1px solid ' + vBORDER + ';border-radius:10px;padding:8px 24px 16px;display:flex;flex-direction:column;box-sizing:border-box',
      vdiffHead: 'display:flex;align-items:center;gap:16px;min-height:44px;box-shadow:inset 0 -1px 0 #dcdee3',
      vdiffRow: 'display:flex;align-items:flex-start;gap:16px;min-height:52px;padding:12px 0;box-shadow:inset 0 -1px 0 ' + vSEC,
      vdh1: 'width:130px;flex:0 0 130px;font-size:12px;font-weight:700;color:' + vMUTED,
      vdh2: 'width:270px;flex:0 0 270px;font-size:12px;font-weight:700;color:' + vMUTED,
      vdh3: 'width:270px;flex:0 0 270px;font-size:12px;font-weight:700;color:' + vMUTED,
      vdh4: 'flex:1;font-size:12px;font-weight:700;color:' + vMUTED,
      vdc1: 'width:130px;flex:0 0 130px;font-size:13px;line-height:20px;font-weight:700;color:' + vINK,
      vdc2: 'width:270px;flex:0 0 270px;font-size:13px;line-height:20px;color:' + vMUTED,
      vdc3: 'flex:1;font-size:12px;line-height:19px;color:' + vMUTED,

      vdiffs: [
        vdiff('별점', '4.9 · 항목별 5점 만점', '5점 별점 + 3축 3지선다', '별점은 남기고 항목 배분만 추가'),
        vdiff('후기 배지', '가격 제보 · 계약 인증', 'Pick 인증', '용어사전'),
        vdiff('금액 라벨', 'VERIFIED PRICE RANGE', '152~184만원 · 실 제보 12건', '영문 라벨을 쓰지 않는다'),
        vdiff('금액 위치', '소개 탭 중간 검정 카드', '히어로 바로 아래 첫 블록', '사진보다 금액이 먼저'),
        vdiff('패키지 배지', '커플들이 가장 많이 선택해요', '실 제보 4 · 6 · 2건', '많이 고른 것과 나에게 맞는 것은 다르다'),
        vdiff('인기 패키지 강조', '검정 헤더 + 그림자 + 코랄 버튼', '없음 · 세 카드 동일', '한 화면에 CTA 하나'),
        vdiff('Pick 버튼', '하트 · 누르면 검정 채움', '하트 · 누르면 코랄 채움', '선택 상태는 코랄'),
        vdiff('하단 CTA', '하트 + «상담 잡기» 2버튼', '«Pick하기» 1버튼', '하트와 상담이 헷갈린다'),
        vdiff('상담 진입', '업체 상세에서 바로', 'Pick → 최종 결정 → 상담 잡기', '후보 담기만으로 예약할 수 없다'),
        vdiff('담당자 카드', 'YOUR CONSULTANT · 별 5개 · 평균 응답 30분', '이름만 · 서브 한 줄', '검증 못 하는 수치를 쓰지 않는다'),
        vdiff('시간 표기', '오전 10:00 · 오후 1:00', '오전 10시 · 오후 1시', '숫자 대신 말로'),
        vdiff('예약 확인', '9월 20일 · 오후 2:00 예약하기', '9월 20일 오후 2시로 잡기', '고른 값을 그대로 말한다'),
        vdiff('공유 안내', '커플 캘린더에 자동으로 공유돼요', '웨딩노트에 같이 올라가요', '탭 이름과 맞춘다'),
        vdiff('FAQ', '소개 탭 아코디언 4개 · 전 업체 공통', '정보 탭 · 업체가 웹에서 등록한 것만', '업체마다 환불·의상·주차 조건이 다르다'),
        vdiff('정보 출처', '앱에 하드코딩', '웹 업체등록 페이지에서 받아옴', '앱은 읽기만 · 편집은 웹'),
        vdiff('미등록 항목', '빈칸 또는 준비 중', '줄 자체를 빼고, 전부 없으면 안내 한 줄', '빈칸을 남기지 않는다'),
        vdiff('업체 소개문', '창가에서 쏟아지는 자연광으로…', '뺌', '업체 광고문을 그대로 싣지 않는다', true)
      ],
      root: 'display:flex;flex-direction:column;gap:40px;align-items:flex-start;padding:64px;width:max-content',
      intro: 'display:flex;flex-direction:column;gap:10px;max-width:1000px',
      eyebrow: 'font-size:14px;line-height:19px;font-weight:700;color:' + P,
      h40: 'font-size:40px;line-height:52px;font-weight:700;color:' + INK + ';font-family:' + DISPLAY,
      introBody: 'font-size:18px;line-height:26px;color:#44403c;text-wrap:pretty',
      boardRow: 'display:flex;gap:36px;align-items:flex-start;flex-wrap:wrap;max-width:1900px',
      col: 'display:flex;flex-direction:column;gap:10px;width:430px',
      colWide: 'display:flex;flex-direction:column;gap:10px;width:880px',
      tag: 'height:26px;display:flex;align-items:center;gap:8px;font-size:18px;line-height:24px;font-weight:700;color:' + INK + ';white-space:nowrap;overflow:hidden',
      tagId: 'width:26px;height:26px;flex:0 0 26px;border-radius:6px;background:' + INK + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700',
      tagDesc: 'height:63px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;line-height:21px;color:#57534e;text-wrap:pretty',

      phone: 'width:430px;height:932px;border-radius:40px;overflow:hidden;position:relative;display:flex;flex-direction:column;background:#fff;box-shadow:0 15px 75px rgba(28,25,23,.14)',
      bar: 'height:44px;flex:0 0 44px;display:flex;align-items:center;justify-content:space-between;padding:0 26px;font-size:14px;font-weight:700;color:' + INK,
      barIcons: 'display:flex;gap:5px;align-items:center',

      stickyHead: 'flex-shrink:0;border-bottom:1px solid rgba(231,229,228,.7);background:rgba(255,255,255,.95);padding:12px 20px 16px;display:flex;flex-direction:column;gap:12px',
      headTop: 'display:flex;align-items:center;gap:8px',
      backBtn: 'width:36px;height:36px;flex:0 0 36px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer',
      headCol: 'display:flex;flex-direction:column;gap:1px;min-width:0;flex:1',
      headTitle: 'font-family:' + DISPLAY + ';font-size:20px;line-height:27px;font-weight:700;letter-spacing:-.02em;color:' + INK,
      headSub: 'font-size:11px;line-height:16px;color:' + MUTED,
      searchRow: 'display:flex;gap:8px',
      searchBox: 'flex:1;min-width:0;height:48px;border-radius:16px;background:' + SEC + ';display:flex;align-items:center;gap:8px;padding:0 16px;box-sizing:border-box',
      searchBoxOn: 'flex:1;min-width:0;height:48px;border-radius:16px;background:' + SEC + ';display:flex;align-items:center;gap:8px;padding:0 16px;box-sizing:border-box',
      searchPh: 'flex:1;min-width:0;font-size:14px;line-height:20px;color:' + MUTED + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
      searchVal: 'flex:1;min-width:0;font-size:14px;line-height:20px;color:' + INK + ';font-weight:500',
      filterBtn: 'width:48px;height:48px;flex:0 0 48px;border-radius:16px;background:' + SEC + ';display:flex;align-items:center;justify-content:center;cursor:pointer',

      chipBar: 'flex-shrink:0;display:flex;align-items:center;gap:8px;padding:12px 20px;overflow-x:auto;scrollbar-width:none',
      chipBarRel: 'flex-shrink:0;position:relative',
      chipBarInner: 'display:flex;align-items:center;gap:8px;padding:12px 20px;overflow-x:auto;scrollbar-width:none',
      chipDiv: 'flex:0 0 auto;width:1px;height:20px;margin:0 4px;background:' + BORDER,
      sortChip: 'flex:0 0 auto;margin-left:auto;height:36px;display:inline-flex;align-items:center;gap:4px;padding:0 14px;border-radius:999px;background:#fff;border:1px solid ' + BORDER + ';font-size:14px;font-weight:700;color:' + INK + ';white-space:nowrap;cursor:pointer;box-sizing:border-box',
      sortChipOn: 'flex:0 0 auto;margin-left:auto;height:36px;display:inline-flex;align-items:center;gap:4px;padding:0 14px;border-radius:999px;background:#fff;border:1px solid ' + BORDER + ';font-size:14px;font-weight:700;color:' + INK + ';white-space:nowrap;cursor:pointer;box-sizing:border-box',
      caretDim: CARET('down', INK),
      caretUp: CARET('up', INK),
      sortPanel: 'position:absolute;right:20px;top:52px;z-index:30;min-width:140px;border-radius:16px;border:1px solid ' + BORDER + ';background:#fff;box-shadow:0 8px 24px rgba(28,25,23,.12);overflow:hidden',
      rowCheck: ICO('check-fill', 14, INK),

      countRow: 'flex-shrink:0;display:flex;align-items:center;gap:12px;padding:12px 20px',
      countText: 'flex:1;min-width:0;font-size:14px;line-height:20px;font-weight:700;color:' + INK + ';white-space:nowrap',

      scroll: 'flex:1 1 auto;overflow-y:auto;overflow-x:hidden;scrollbar-width:none',
      listWrap: 'padding:0 20px 16px;display:flex;flex-direction:column;gap:12px',

      vCard: 'display:flex;border-radius:16px;border:1px solid ' + BORDER + ';background:#fff;overflow:hidden;box-shadow:0 1px 2px rgba(28,25,23,.05);cursor:pointer',
      vThumbWrap: 'position:relative;flex:0 0 120px;width:120px;padding:8px;box-sizing:border-box',
      vThumb: 'width:100%;height:116px;border-radius:8px;object-fit:cover;background:' + SEC + ';display:block',
      vBadge: 'position:absolute;left:14px;top:14px;padding:2px 8px;border-radius:999px;background:' + INK + ';color:#fff;font-size:10px;line-height:14px;font-weight:700',
      vBody: 'flex:1;min-width:0;padding:14px;display:flex;flex-direction:column;justify-content:space-between',
      vTop: 'display:flex;align-items:flex-start;justify-content:space-between;gap:4px',
      vNameCol: 'display:flex;flex-direction:column;gap:2px;min-width:0;flex:1',
      vCat: 'font-size:10px;line-height:14px;font-weight:700;letter-spacing:.06em;color:' + MUTED,
      vName: 'font-size:14px;line-height:19px;font-weight:700;color:' + INK + ';display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
      vLoc: 'display:flex;align-items:center;gap:4px;margin-top:4px',
      vLocText: 'font-size:12px;line-height:17px;color:' + MUTED,
      vTags: 'display:flex;flex-wrap:wrap;gap:4px;margin-top:8px',
      vTag: 'padding:2px 8px;border-radius:999px;background:' + SEC + ';color:' + MUTED + ';font-size:10px;line-height:14px;font-weight:500;white-space:nowrap',
      vFoot: 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px',
      vPrice: 'font-family:' + MONO + ';font-size:12px;line-height:17px;font-weight:600;color:' + INK + ';white-space:nowrap',
      vMetrics: 'display:flex;align-items:center;gap:8px',
      vStarWrap: 'display:flex;align-items:center;gap:2px',
      vRating: 'font-size:12px;line-height:17px;font-weight:600;color:' + INK + ';font-variant-numeric:tabular-nums',
      vPicks: 'font-size:10px;line-height:14px;color:' + MUTED + ';font-variant-numeric:tabular-nums;white-space:nowrap',

      dimWrap: 'flex:1;position:relative;overflow:hidden;display:flex;align-items:flex-end',
      dim: 'position:absolute;inset:0;background:rgba(28,25,23,.35)',
      sheet: 'position:relative;width:100%;max-height:760px;overflow-y:auto;scrollbar-width:none;border-radius:28px 28px 0 0;background:#fff;padding:12px 20px 32px;box-sizing:border-box;display:flex;flex-direction:column',
      grabber: 'width:40px;height:4px;border-radius:999px;background:' + BORDER + ';align-self:center',
      sheetHead: 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 0',
      sheetTitle: 'font-size:18px;line-height:25px;font-weight:700;color:' + INK,
      sheetSub: 'font-size:12px;line-height:17px;color:' + MUTED,
      resetBtn: 'font-size:12px;line-height:17px;font-weight:700;color:' + P + ';white-space:nowrap;cursor:pointer',
      fGroup: 'border-top:1px solid ' + BORDER + ';padding:20px 0;display:flex;flex-direction:column;gap:12px',
      fLabel: 'font-size:14px;line-height:20px;font-weight:700;color:' + INK,
      fOpts: 'display:flex;flex-wrap:wrap;gap:8px',
      optCheck: ICO('check-fill', 14, '#fff'),
      sortSec: 'padding-top:28px;display:flex;flex-direction:column;gap:8px',
      sortLabel: 'font-size:12px;line-height:17px;font-weight:700;color:' + INK,
      sortRow: 'display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px',
      sheetCta: 'flex:0 0 52px;margin-top:32px;height:52px;border-radius:6px;background:' + P + ';color:#fff;font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer',

      emptyWrap: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:0 40px 120px;text-align:center',
      emptyEmoji: 'font-size:36px;line-height:44px',
      emptyCta: 'margin-top:14px;height:48px;padding:0 20px;border-radius:8px;background:' + P + ';color:#fff;display:inline-flex;align-items:center;font-size:15px;font-weight:700',
      nearWrap: 'padding:0 20px 24px;display:flex;flex-direction:column;gap:10px',
      nearLabel: 'font-size:13px;font-weight:700;color:' + MUTED,
      nearRow: 'display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px;box-shadow:inset 0 -1px 0 ' + BORDER,
      nearCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px',
      nearName: 'font-size:15px;font-weight:700;color:' + INK,
      nearMeta: 'font-size:12px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      nearPrice: 'font-size:15px;font-weight:700;color:' + INK + ';font-variant-numeric:tabular-nums;white-space:nowrap',
      nearNote: 'padding-top:6px;font-size:13px;color:' + P + ';font-weight:700',
      nearby: [
        { name: '서촌 B 스튜디오', meta: '실 제보 9건 · 종로구', price: '138~171만원' },
        { name: '성수 F 스튜디오', meta: '실 제보 6건 · 성동구', price: '145~178만원' }
      ],
      emptyTitle: 'font-size:16px;line-height:22px;font-weight:700;color:' + INK,
      emptySub: 'font-size:14px;line-height:20px;color:' + MUTED,

      headTitleRoot: 'font-size:22px;font-weight:700;color:' + INK + ';white-space:nowrap',
      icoBack: ICO('chevron-right', 20, INK) + ';transform:rotate(180deg)',
      icoSearch: ICO('search', 16, MUTED),
      icoSliders: ICO('more-horiz', 16, INK),
      icoX: ICO('close-fill', 16, MUTED),
      icoPin: ICO('location', 12, MUTED),

      diffCard: 'width:880px;background:#fff;border-radius:14px;border:1px solid ' + BORDER + ';padding:8px 24px 16px;display:flex;flex-direction:column;box-sizing:border-box',
      diffHead: 'display:flex;align-items:center;gap:16px;min-height:44px;border-bottom:1px solid #dcdee3',
      diffRow: 'display:flex;align-items:flex-start;gap:16px;min-height:52px;padding:13px 0;border-bottom:1px solid ' + SEC,
      dh1: 'width:130px;flex:0 0 130px;font-size:12px;line-height:17px;font-weight:700;color:' + MUTED,
      dh2: 'width:270px;flex:0 0 270px;font-size:12px;line-height:17px;font-weight:700;color:' + MUTED,
      dh3: 'width:270px;flex:0 0 270px;font-size:12px;line-height:17px;font-weight:700;color:' + MUTED,
      dh4: 'width:120px;flex:0 0 120px;font-size:12px;line-height:17px;font-weight:700;color:' + MUTED,
      dc1: 'width:130px;flex:0 0 130px;font-size:13px;line-height:20px;font-weight:700;color:' + INK + ';text-wrap:pretty',
      dc2: 'width:270px;flex:0 0 270px;font-size:13px;line-height:20px;color:#57534e;text-wrap:pretty',
      dc3: 'width:270px;flex:0 0 270px;font-size:13px;line-height:20px;color:#57534e;text-wrap:pretty',

      chips: [chip('카테고리', false), chip('강남구', true), chip('예산', false), chip('자연스러운', true)],

      vendors: [
        v({ name: '더 라인 웨딩홀', categoryLabel: '웨딩홀', location: '서울 송파구', price: '300~500만원', reports: '실 제보 18건', badge: '인기', tags: ['웨딩홀전용', '야외정원'], picked: false, image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=280&fit=crop&auto=format' }),
        v({ name: '블루밍 스튜디오', categoryLabel: '스튜디오', location: '서울 강남구', price: '80~150만원', reports: '실 제보 12건', badge: '인기', tags: ['자연광', '야외촬영'], picked: true, image: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=400&h=280&fit=crop&auto=format' }),
        v({ name: '스튜디오 온', categoryLabel: '스튜디오', location: '서울 마포구', price: '70~130만원', reports: '실 제보 7건', badge: '', tags: ['필름감성'], picked: false, image: 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=400&h=280&fit=crop&auto=format' }),
        v({ name: '그레이스 드레스', categoryLabel: '드레스', location: '서울 압구정동', price: '150~380만원', reports: '실 제보 22건', badge: '', tags: ['A라인', '볼가운'], picked: false, image: 'https://images.unsplash.com/photo-1525258946800-98cfd641d0de?w=400&h=280&fit=crop&auto=format' }),
        v({ name: '라로쉐 드레스', categoryLabel: '드레스', location: '서울 청담동', price: '200~450만원', reports: '아직 정보가 적어요 · 2건', badge: '신규', tags: ['이탈리안브랜드', '럭셔리'], picked: false, image: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&h=280&fit=crop&auto=format' }),
        v({ name: '오드 메이크업', categoryLabel: '메이크업', location: '서울 청담동', price: '45~80만원', reports: '실 제보 9건', badge: '', tags: ['당일메이크업', '리허설포함'], picked: false, image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=280&fit=crop&auto=format' }),
        v({ name: '뷰티 바이 소이', categoryLabel: '메이크업', location: '서울 강남구', price: '50~90만원', reports: '실 제보 6건', badge: '', tags: ['자연스러운웨딩룩'], picked: false, image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=280&fit=crop&auto=format' })
      ],

      groups: [
        { label: '카테고리', opts: [opt('전체', true), opt('웨딩홀', false), opt('스드메', false), opt('본식', false), opt('예물 · 신혼', false)] },
        { label: '지역', opts: [opt('서울 전체', false), opt('강남구', true), opt('서초구', false), opt('송파구', false), opt('마포구', false)] },
        { label: '예산', opts: [opt('전체', true), opt('500만원 이하', false), opt('500~1,000만원', false), opt('1,000~2,000만원', false), opt('2,000만원 이상', false)] },
        { label: '스타일', opts: [opt('도시적인', false), opt('자연스러운', true), opt('로맨틱한', false), opt('화려한', false)] }
      ],

      sorts: [sortPill('추천순', true), sortPill('금액 낮은순', false), sortPill('금액 높은순', false), sortPill('많이 확인된 순', false)],

      sortRows: [
        sortRow('추천순', true, false),
        sortRow('금액 낮은순', false, false),
        sortRow('많이 확인된 순', false, false),
        sortRow('최근 등록순', false, true)
      ],

      diffs: [
        diff('진입', 'Root 탭 2번 · 검색 홈 없음', '홈 헤더 아이콘 → /search · back으로 홈 복귀', 'IA 수정', 'warn'),
        diff('제목', '검색', '업체 탐색', '「탐색」 금지어', 'bad'),
        diff('필터 칩', '지역 · 예식 월 · 예산이 온보딩 값으로 켜진 채', '전부 비어 있음 · 기본값 없음', '온보딩 연동 필요', 'bad'),
        diff('지역 선택', '시/도 하나 + 시/군/구 하나 · 단일', '서울 전체 · 강남·서초 등 묶음 5개', '단일 원칙 유지', 'warn'),
        diff('스타일', '4종 · 도시적인 · 자연스러운 · 로맨틱한 · 화려한', '4종 · 자연스러운 무드 · 화려한 연출 · 미니멀 · 클래식', '값 통일 필요', 'bad'),
        diff('금액 표기', '152~184만원 · 실 제보 12건', '물결 + 실 제보 건수 병기', '실 제보 규칙 적용'),
        diff('평가', '이용한 사람들의 경험 · 별점 병행', '5점 별점 + 실 제보 건수', '별점과 실 제보를 함께 쓴다'),
        diff('정렬', '추천순 · 금액 낮은순 · 많이 확인된 순 등 5종', '정본 5종으로 교체 · 평점순 제거', '별점을 쓰지 않는다'),
        diff('정렬 위치', '바텀시트', '구분선 우측 칩 드롭다운 · 시트에서 제거', '동작이 갈린다', 'warn'),
        diff('칩 동작', '구분 없음', '좌측 3칩 + 아이콘 = 시트 · 우측 1칩 = 드롭다운', '누르기 전에 예측된다'),
        diff('결과 없음', '조건 풀기 CTA + 비슷한 곳 + 업체 제보', '🔍 이모지 + 안내 2줄 · 행동 없음', '막다른 길 · 보강', 'bad'),
        diff('정보 4단계', '0~2건 수집 중 · 10건+ 기준금액', '없음 · 모든 업체가 금액 노출', '규칙 누락', 'bad'),
        diff('아이콘', 'SEED 세트', 'lucide-react (홈은 SEED)', '한 세트로 통일', 'warn')
      ]
    };
  }
}


export default Component;
