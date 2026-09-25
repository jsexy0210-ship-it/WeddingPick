import { DesignModel } from "../runtime/designRuntime.js";

class Component extends DesignModel {
  renderVals() {
    const P = '#ff6f61', INK = '#212124', MUTED = '#868b94', SUB = '#4d5159', SEC = '#f2f3f6', REC = '#f7f8fa', BORDER = '#eaebee';
    const vP = '#ff6f61', vINK = '#212124', vMUTED = '#868b94', vDIM = '#adb1ba', vSEC = '#f2f3f6', vBORDER = '#eaebee';
    const ICO = (n, px, c) => 'width:' + px + 'px;height:' + px + 'px;flex:0 0 ' + px + 'px;background-color:' + c + ';-webkit-mask:url("assets/seed-icons/' + n + '.svg") center/contain no-repeat;mask:url("assets/seed-icons/' + n + '.svg") center/contain no-repeat;display:inline-block';
    const bg = (u) => 'background:' + SEC + ' url("' + u + '") center/cover no-repeat';
    const IMG = {
      urban: 'uploads/%EC%8A%A4%ED%83%80%EC%9D%BC%20%EC%9D%B4%EB%AF%B8%EC%A7%80/urban.png',
      natural: 'uploads/%EC%8A%A4%ED%83%80%EC%9D%BC%20%EC%9D%B4%EB%AF%B8%EC%A7%80/natural.png',
      romantic: 'uploads/%EC%8A%A4%ED%83%80%EC%9D%BC%20%EC%9D%B4%EB%AF%B8%EC%A7%80/romantic.png',
      glam: 'uploads/%EC%8A%A4%ED%83%80%EC%9D%BC%20%EC%9D%B4%EB%AF%B8%EC%A7%80/glamorous.png',
      a: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=400&h=280&fit=crop&auto=format',
      b: 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=400&h=280&fit=crop&auto=format',
      c: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&h=280&fit=crop&auto=format',
      d: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=280&fit=crop&auto=format'
    };
    const sv = (o) => ({
      name: o.name, categoryLabel: o.cat, location: o.loc, price: o.price, reports: o.reports, badge: o.badge || '', tags: o.tags, confirmed: !!o.confirmed,
      card: 'border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 1px 2px rgba(28,25,23,.05);'
        + (o.confirmed ? 'border:1.5px solid ' + P + ';' : 'border:1px solid ' + BORDER + ';'),
      thumb: 'width:100%;height:116px;border-radius:8px;display:block;' + bg(o.img),
      labelA: o.comparing ? '비교에서 빼기' : '비교에 담기',
      labelB: '상담 예약',
      btnA: 'height:40px;padding:0 4px;display:flex;align-items:center;font-size:13px;font-weight:700;cursor:pointer;color:' + (o.comparing ? P : MUTED),
      btnB: 'height:40px;padding:0 18px;border-radius:6px;display:flex;align-items:center;font-size:13px;font-weight:700;cursor:pointer;' + (o.confirmed ? 'background:' + P + ';color:#fff;' : 'background:#fff;color:' + INK + ';box-shadow:inset 0 0 0 1px ' + BORDER + ';')
    });
    const chip = (l, on) => ({ label: l, style: 'flex:0 0 auto;height:36px;padding:0 14px;border-radius:999px;display:inline-flex;align-items:center;font-size:14px;font-weight:700;white-space:nowrap;' + (on ? 'background:' + INK + ';color:#fff;' : 'background:' + SEC + ';color:' + SUB + ';') });
    const fold = (label, meta) => ({ label, meta });
    const vend = (o) => ({
      id: o.id, src: o.src, cat: o.cat, name: o.name, loc: o.loc, tags: o.tags,
      price: o.price, reports: o.reports,
      priceStyle: 'font-size:12px;line-height:17px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;color:' + (o.scarce ? MUTED : INK),
      heartWrap: 'width:28px;height:28px;flex:0 0 28px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;'
        + (o.picked ? 'background:' + P : 'background:' + REC),
      heartIcon: ICO(o.picked ? 'heart-fill' : 'heart', 16, o.picked ? '#fff' : SUB),
      rank: o.rank || '',
      thumb: 'width:100%;height:116px;border-radius:8px;display:block;' + bg(o.src)
    });
    const seg = (label, on) => ({ label,
      style: 'flex:1;height:48px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;cursor:pointer;'
        + (on ? 'color:' + INK + ';box-shadow:inset 0 -2px 0 ' + INK : 'color:' + MUTED) });
    const cv = (o) => ({ name: o.name, categoryLabel: o.cat, confirmed: !!o.confirmed, photo: 'width:100%;height:104px;border-radius:6px;display:block;' + bg(o.img),
      cta: 'width:100%;height:44px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;' + (o.confirmed ? 'background:' + P + ';color:#fff;' : 'background:#fff;color:' + INK + ';box-shadow:inset 0 0 0 1px ' + BORDER + ';'),
      ctaLabel: o.confirmed ? 'Pick했어요' : 'Pick하기' });
    const rank = (list) => list
      .map(o => ({ name: o.name, categoryLabel: o.cat, confirmed: !!o.confirmed,
        photo: 'width:72px;height:72px;border-radius:10px;flex:0 0 72px;display:block;' + bg(o.img),
        winCount: o.m.filter(x => x.best).length,
        winBadge: 'flex:0 0 auto;height:26px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;display:inline-flex;align-items:center;' + (o.confirmed ? 'background:' + P + ';color:#fff;' : 'background:' + SEC + ';color:' + SUB + ';'),
        metrics: o.m.map(x => ({ label: x.label, v: x.v, best: x.best, valStyle: 'flex:1;text-align:right;font-size:13px;font-variant-numeric:tabular-nums;' + (x.best ? 'font-weight:700;color:' + INK : 'color:' + MUTED) })),
        cardStyle: 'border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px;' + (o.confirmed ? 'border:1.5px solid ' + P + ';background:#fff;' : 'border:1px solid ' + BORDER + ';background:#fff;'),
        cta: 'width:100%;height:44px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;' + (o.confirmed ? 'background:' + P + ';color:#fff;' : 'background:' + SEC + ';color:' + INK + ';'),
        ctaLabel: o.confirmed ? '상담 예약함' : '상담 예약' }))
      .sort((a, b) => b.winCount - a.winCount);
    const cell = (v, best) => ({ v, valStyle: 'font-size:14px;line-height:19px;text-align:center;font-variant-numeric:tabular-nums;' + (best ? 'font-weight:700;color:' + INK : 'color:' + MUTED) });
    const row = (label, cells, section) => ({ label, cells: section ? [] : cells,
      rowStyle: 'display:flex;border-bottom:1px solid ' + BORDER + ';' + (section ? 'background:' + REC + ';' : ''),
      labelStyle: 'width:100px;flex:0 0 100px;position:sticky;left:0;z-index:10;display:flex;align-items:center;padding:' + (section ? '8px 12px' : '16px 12px') + ';box-sizing:border-box;font-weight:700;white-space:nowrap;' + (section ? 'font-size:12px;background:' + REC + ';color:' + MUTED : 'font-size:13px;background:#fff;color:' + SUB) });
    const FILLED = ['home', 'search', 'heart', 'profile'];
    const tab = (icon, text, on) => ({ icon: ICO(on && FILLED.indexOf(icon) >= 0 ? icon + '-fill' : icon, 24, on ? INK : MUTED), text, label: 'font-size:12px;line-height:16px;font-weight:700;color:' + (on ? INK : MUTED) });
    const diff = (k, a, b, why) => ({ k, a, b, why });

    const dt = (day, weekday, sel) => ({ day: day + '일', weekday,
      cell: 'flex:0 0 auto;width:60px;height:72px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;'
        + (sel ? 'background:' + vP + ';' : 'background:' + REC + ';'),
      wd: 'font-size:12px;color:' + (sel ? 'rgba(255,255,255,.72)' : vMUTED),
      dayStyle: 'font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;color:' + (sel ? '#fff' : vINK) });

    const tm = (label, sel) => ({ label,
      style: 'height:48px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;cursor:pointer;'
        + (sel ? 'background:' + vP + ';color:#fff;' : 'background:' + REC + ';color:' + SUB + ';') });

    return {
      decidedB: [{ cat: '웨딩홀', name: '더채플 청담' }, { cat: '스드메', name: '블루밍 스튜디오 외 2' }],
      agencyB: [
        vend({ id: 'pb-1', src: IMG.a, cat: '본식스냅', name: '모먼트 스냅', loc: '서울 강남구', tags: ['자연스러운', '필름'], price: '60~110만원', reports: '실 제보 14건', rank: '1위' }),
        vend({ id: 'pb-2', src: IMG.b, cat: '부케', name: '플로라', loc: '서울 청담동', tags: ['생화', '파스텔'], price: '18~35만원', reports: '실 제보 9건' }),
        vend({ id: 'pb-3', src: IMG.c, cat: '청첩장', name: '페이퍼', loc: '온라인', tags: ['미니멀'], price: '12~28만원', reports: '아직 정보가 적어요 · 3건', scarce: true })
      ],
      foldedB: [fold('예물 · 신혼', '실 제보 46건')],
      vcol: 'display:flex;flex-direction:column;gap:10px;width:430px',
      vtag: 'height:26px;display:flex;align-items:center;gap:8px;font-size:18px;font-weight:700;color:' + vINK + ';white-space:nowrap',
      vtagId: 'width:26px;height:26px;flex:0 0 26px;border-radius:6px;background:' + vINK + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700',
      vtagDesc: 'height:66px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;line-height:21px;color:' + SUB + ';text-wrap:pretty',

      vphone: 'width:430px;height:932px;border-radius:40px;overflow:hidden;position:relative;display:flex;flex-direction:column;background:#fff;box-shadow:0 15px 75px rgba(0,27,55,.14)',
      vbar: 'flex:0 0 44px;display:flex;align-items:center;padding:0 26px;font-size:14px;font-weight:700;color:' + vINK,
      navBar: 'flex:0 0 56px;display:flex;align-items:center;gap:8px;padding:0 16px;box-shadow:inset 0 -1px 0 ' + vBORDER,
      navTitle: 'flex:1;min-width:0;text-align:center;font-size:16px;font-weight:700;color:' + vINK + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
      navRightPad: 'width:36px;flex:0 0 36px',
      vicoBack: ICO('chevron-left', 24, vINK) + ';width:36px;flex:0 0 36px;-webkit-mask-size:24px;mask-size:24px',
      vscroll: 'flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;scrollbar-width:none',
      dimWrap2: 'flex:1;position:relative;overflow:hidden;display:flex;align-items:flex-end',
      dim2: 'position:absolute;inset:0;background:rgba(0,0,0,.45)',
      confirmSheet: 'position:relative;width:100%;background:#fff;border-radius:20px 20px 0 0;padding:12px 24px 28px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px',
      grabber2: 'width:40px;height:4px;border-radius:999px;background:' + BORDER + ';align-self:center',
      confirmTitle: 'font-size:22px;line-height:30px;font-weight:700;color:' + vINK,
      confirmBody: 'font-size:15px;line-height:22px;color:' + SUB,
      confirmRow: 'display:flex;gap:10px;margin-top:6px',
      btnGhost2: 'flex:1;height:52px;border-radius:6px;background:' + SEC + ';color:' + SUB + ';display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700',
      btnDanger2: 'flex:1;height:52px;border-radius:6px;background:#ff4133;color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700',
      decRow: 'display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:72px;padding:0 20px;box-shadow:inset 0 -1px 0 ' + vBORDER,

      sec: 'flex:0 0 auto;padding:20px;display:flex;flex-direction:column;gap:12px',
      secTop: 'flex:0 0 auto;padding:20px;display:flex;flex-direction:column;gap:14px',
      secHead: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px',
      secTitle: 'font-size:17px;font-weight:700;color:' + vINK,
      secMeta: 'font-size:13px;color:' + vMUTED + ';font-variant-numeric:tabular-nums',
      dateWrap: 'display:flex;gap:8px;overflow-x:auto;scrollbar-width:none',
      dates: [dt(18, '금'), dt(19, '토'), dt(20, '일', true), dt(22, '화'), dt(23, '수'), dt(25, '금'), dt(26, '토')],
      timeGrid: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px',
      times: [tm('오전 10시'), tm('오전 11시 반'), tm('오후 1시'), tm('오후 2시', true), tm('오후 3시 반'), tm('오후 5시')],
      textarea: 'min-height:96px;border-radius:6px;border:1px solid #d1d3d8;padding:14px;font-size:15px;color:' + vDIM,
      syncBox: 'border-radius:10px;background:' + REC + ';padding:16px;display:flex;flex-direction:column;gap:4px',
      syncT: 'font-size:15px;font-weight:700;color:' + vINK,
      syncS: 'font-size:13px;color:' + vMUTED,

      rScroll: 'flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;scrollbar-width:none',
      headBlock: 'flex:0 0 auto;padding:4px 20px 24px;display:flex;flex-direction:column;gap:8px',
      rH1: 'font-size:28px;line-height:36px;letter-spacing:-0.02em;font-weight:700;color:' + INK,
      headSub: 'font-size:14px;line-height:21px;color:' + MUTED,
      openSec: 'flex:0 0 auto;display:flex;flex-direction:column;gap:12px;padding-bottom:20px',
      mypickSec: 'flex:0 0 auto;display:flex;flex-direction:column;gap:10px;padding:20px 0 20px;box-shadow:inset 0 1px 0 ' + BORDER,
      catHead: 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 20px',
      catTitle: 'font-size:18px;font-weight:700;color:' + INK,
      catRight: 'display:flex;align-items:center;gap:6px',
      catMeta: 'font-size:13px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      catMetaDim: 'font-size:13px;color:' + MUTED,
      icoUp: ICO('chevron-right', 18, MUTED) + ';transform:rotate(-90deg)',
      icoDown: ICO('chevron-right', 18, MUTED) + ';transform:rotate(90deg)',
      vCard: 'width:204px;flex:0 0 204px;border-radius:12px;background:' + REC + ';overflow:hidden;display:flex;flex-direction:column',
      vBody: 'padding:14px;display:flex;flex-direction:column;gap:3px',
      rMoreRow: 'display:flex;justify-content:flex-end;padding:0 20px',
      moreBtn: 'height:36px;padding:0 16px;border-radius:999px;background:' + SEC + ';color:' + SUB + ';display:inline-flex;align-items:center;font-size:13px;font-weight:700',
      scarceNote: 'padding:0 20px;font-size:12px;color:' + MUTED,
      rSegBar: 'flex:0 0 auto;display:flex;padding:0 20px;margin-bottom:12px;box-shadow:inset 0 -1px 0 ' + BORDER,
      rSegA: [seg('추천', true), seg('내 Pick', false)],
      rTabs: [tab('home', '홈', false), tab('search', '검색', false), tab('heart', 'Pick', true), tab('calendar', '웨딩노트', false), tab('profile', 'MY', false)],
      listWrap: 'display:flex;flex-direction:column;gap:12px;padding:0 20px',
      vCard: 'display:flex;border-radius:16px;border:1px solid ' + BORDER + ';background:#fff;overflow:hidden;box-shadow:0 1px 2px rgba(28,25,23,.05);cursor:pointer',
      vThumbWrap: 'position:relative;flex:0 0 120px;width:120px;padding:8px;box-sizing:border-box',
      vThumb: 'width:100%;height:116px;border-radius:8px;overflow:hidden;background:' + SEC,
      vBadge: 'position:absolute;left:14px;top:14px;padding:2px 8px;border-radius:999px;background:' + INK + ';color:#fff;font-size:10px;line-height:14px;font-weight:700',
      vBody: 'flex:1;min-width:0;padding:14px;display:flex;flex-direction:column;justify-content:space-between',
      vTop: 'display:flex;align-items:flex-start;justify-content:space-between;gap:4px',
      vNameCol: 'display:flex;flex-direction:column;gap:2px;min-width:0;flex:1',
      vCatLabel: 'font-size:10px;line-height:14px;font-weight:700;letter-spacing:.06em;color:' + MUTED,
      vNameText: 'font-size:14px;line-height:19px;font-weight:700;color:' + INK + ';display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
      vLocRow2: 'display:flex;align-items:center;gap:4px;margin-top:4px',
      vLocText: 'font-size:12px;line-height:17px;color:' + MUTED,
      vTags: 'display:flex;flex-wrap:wrap;gap:4px;margin-top:8px',
      vTagChip: 'padding:2px 8px;border-radius:999px;background:' + SEC + ';color:' + MUTED + ';font-size:10px;line-height:14px;font-weight:500;white-space:nowrap',
      vFoot: 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px',
      vPicks: 'font-size:10px;line-height:14px;color:' + MUTED + ';font-variant-numeric:tabular-nums;white-space:nowrap',
      rIcoPin: ICO('location', 12, MUTED),
      doneWrap: 'flex:0 0 auto;display:flex;flex-direction:column;padding:0 20px 8px',
      rDoneRow: 'display:flex;align-items:center;gap:10px;min-height:56px;box-shadow:inset 0 -1px 0 ' + BORDER,
      doneMarkSm: 'width:22px;height:22px;flex:0 0 22px;border-radius:999px;background:' + P + ';display:flex;align-items:center;justify-content:center',
      rIcoCheck: ICO('check-fill', 13, '#fff'),
      allDecided: [
        { cat: '웨딩홀', name: '더채플 청담' }, { cat: '스드메', name: '블루밍 스튜디오 외 2' },
        { cat: '본식', name: '모먼트 스냅 외 2' }, { cat: '예물 · 신혼', name: '라비쥬 외 2' }
      ],
      doneCat: 'font-size:16px;font-weight:700;color:' + INK + ';white-space:nowrap',
      doneName: 'flex:1;min-width:0;text-align:right;font-size:14px;color:' + MUTED + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
      icoChev: ICO('chevron-right', 16, '#adb1ba'),
      decided: [{ cat: '웨딩홀', name: '더채플 청담' }],
      foldWrap: 'flex:0 0 auto;display:flex;flex-direction:column;padding:0 20px',
      foldRow: 'display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px;box-shadow:inset 0 -1px 0 ' + BORDER,
      foldTitle: 'font-size:18px;font-weight:700;color:' + INK,
      foldRight: 'display:flex;align-items:center;gap:6px',
      foldMeta: 'font-size:13px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      doneSec: 'flex:0 0 auto;padding:20px',
      doneCard: 'border-radius:12px;background:' + REC + ';padding:28px 20px;display:flex;flex-direction:column;align-items:center;gap:8px',
      rDoneMark: 'width:48px;height:48px;border-radius:999px;background:#e8faf6;'
        + 'background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%231aa174\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m5 12.5 4.5 4.5L19 7.5\'/%3E%3C/svg%3E");background-size:24px;background-position:center;background-repeat:no-repeat',
      rDoneTitle: 'font-size:17px;font-weight:700;color:' + INK,
      rDoneSub: 'font-size:13px;color:' + MUTED,
      doneBtn: 'margin-top:6px;height:44px;padding:0 20px;border-radius:8px;background:#fff;box-shadow:inset 0 0 0 1px ' + BORDER + ';color:' + INK + ';display:inline-flex;align-items:center;font-size:14px;font-weight:700',
      agency: [
        vend({ id: 'rc-a1', src: IMG.romantic, cat: '스튜디오', name: '블루밍 스튜디오', loc: '서울 강남구', tags: ['#로맨틱한'], price: '198~386만원', reports: '실 제보 9건', rank: '1위', reason: '좋아하는 분위기에 가까워요', picked: false }),
        vend({ id: 'rc-a2', src: IMG.glam, cat: '드레스', name: '그레이스 드레스', loc: '서울 압구정동', tags: ['#로맨틱한', '#화려한'], price: '361~387만원', reports: '실 제보 11건', rank: '2위', reason: '많이 확인된 곳이에요', picked: false }),
        vend({ id: 'rc-a3', src: IMG.urban, cat: '메이크업', name: '오드 메이크업', loc: '서울 청담동', tags: ['#도시적인'], price: '수집 중', reports: '아직 정보가 적어요 · 2건', rank: '3위', reason: '생각한 예산 안에 들어와요', scarce: true, picked: false })
      ],
      scarce: [
        vend({ id: 'rc-b1', src: IMG.natural, cat: '부케', name: '온플라워', loc: '서울 성동구', tags: ['#자연스러운'], price: '수집 중', reason: '좋아하는 분위기에 가까워요', reports: '아직 정보가 적어요 · 2건', scarce: true, picked: false }),
        vend({ id: 'rc-b2', src: IMG.romantic, cat: '부케', name: '블롬 스튜디오', loc: '서울 마포구', tags: ['#로맨틱한'], price: '수집 중', reason: '원하는 날에 가능해요', reports: '아직 정보가 적어요 · 1건', scarce: true, picked: false })
      ],
      folded: [
        fold('본식', '실 제보 22건'),
        fold('예물 · 신혼', '실 제보 46건')
      ],
      root: 'display:flex;flex-direction:column;gap:40px;align-items:flex-start;padding:64px;width:max-content',
      intro: 'display:flex;flex-direction:column;gap:10px;max-width:1000px',
      eyebrow: 'font-size:14px;font-weight:700;color:' + P,
      h40: 'font-size:40px;line-height:52px;font-weight:700;color:' + INK,
      introBody: 'font-size:18px;line-height:26px;color:#393a40;text-wrap:pretty',
      boardRow: 'display:flex;gap:36px;align-items:flex-start;flex-wrap:wrap;max-width:1900px',
      grp: 'display:flex;flex-direction:column;gap:24px',
      col: 'display:flex;flex-direction:column;gap:10px;width:430px',
      colWide: 'display:flex;flex-direction:column;gap:10px;width:900px',
      tag: 'height:26px;display:flex;align-items:center;gap:8px;font-size:18px;font-weight:700;color:' + INK + ';white-space:nowrap',
      tagId: 'width:26px;height:26px;flex:0 0 26px;border-radius:6px;background:' + INK + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700',
      tagDesc: 'height:63px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;line-height:21px;color:' + SUB + ';text-wrap:pretty',
      phone: 'width:430px;height:932px;border-radius:40px;overflow:hidden;position:relative;display:flex;flex-direction:column;background:#fff;box-shadow:0 15px 75px rgba(0,27,55,.14)',
      bar: 'height:44px;flex:0 0 44px;display:flex;align-items:center;padding:0 26px;font-size:14px;font-weight:700;color:' + INK,
      scroll: 'flex:1;overflow-y:auto;scrollbar-width:none',
      head: 'padding:24px 20px 20px;display:flex;flex-direction:column;gap:4px',
      headRow: 'display:flex;align-items:center;gap:10px',
      h1: 'font-size:26px;line-height:35px;font-weight:700;color:' + INK,
      countPill: 'font-size:14px;font-weight:700;color:' + MUTED,
      sub: 'font-size:14px;line-height:20px;color:' + MUTED,
      shareBar: 'margin-top:16px;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:10px;background:' + REC,
      shareLeft: 'display:flex;align-items:center;gap:10px',
      avRow: 'display:flex',
      av1: 'width:32px;height:32px;border-radius:999px;background:#ffe8e4;color:' + P + ';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 0 0 2px ' + REC,
      av2: 'width:32px;height:32px;border-radius:999px;background:' + SEC + ';color:' + SUB + ';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-left:-8px;box-shadow:0 0 0 2px ' + REC,
      shareText: 'font-size:13px;font-weight:700;color:' + INK,
      shareLink: 'font-size:13px;font-weight:700;color:;margin-left:auto' + P,
      banner: 'margin:16px 20px 16px;display:flex;align-items:center;justify-content:space-between;padding:16px;border-radius:10px;background:#fff5f2;border:1px solid #ffd9d4',
      bannerCol: 'display:flex;flex-direction:column;gap:2px',
      bannerT: 'font-size:14px;font-weight:700;color:' + INK,
      bannerS: 'font-size:12px;color:' + MUTED,
      bannerBtn: 'height:36px;padding:0 16px;border-radius:6px;display:flex;align-items:center;background:' + P + ';color:#fff;font-size:14px;font-weight:700;white-space:nowrap',
      chipBar: 'display:flex;gap:8px;padding:0 20px 16px;overflow-x:auto;scrollbar-width:none',
      chipBarSticky: 'flex:0 0 auto;display:flex;gap:8px;padding:4px 20px 16px;overflow-x:auto;scrollbar-width:none',
      list: 'padding:0 20px;display:flex;flex-direction:column;gap:12px',
      cardBody: 'display:flex',
      thumbWrap: 'position:relative;flex:0 0 120px;padding:8px;box-sizing:border-box',
      badge: 'position:absolute;left:14px;top:14px;padding:2px 8px;border-radius:999px;background:' + INK + ';color:#fff;font-size:10px;line-height:14px;font-weight:700',
      checkDot: 'position:absolute;right:12px;top:12px;width:24px;height:24px;border-radius:999px;background:' + P + ';display:flex;align-items:center;justify-content:center',
      icoCheck: ICO('check-fill', 14, '#fff'),
      info: 'flex:1;min-width:0;padding:14px;display:flex;flex-direction:column;justify-content:space-between',
      infoTop: 'display:flex;align-items:flex-start;justify-content:space-between;gap:4px',
      nameCol: 'display:flex;flex-direction:column;gap:2px;min-width:0;flex:1',
      cat: 'font-size:10px;line-height:14px;font-weight:700;letter-spacing:.06em;color:' + MUTED,
      name: 'font-size:14px;line-height:19px;font-weight:700;color:' + INK + ';display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
      icoX: ICO('close-fill', 16, '#adb1ba'),
      loc: 'display:flex;align-items:center;gap:4px;margin-top:4px',
      icoPin: ICO('location', 12, MUTED),
      locText: 'font-size:12px;line-height:17px;color:' + MUTED,
      tags: 'display:flex;flex-wrap:wrap;gap:4px;margin-top:8px',
      tagChip: 'padding:2px 8px;border-radius:999px;background:' + SEC + ';color:' + MUTED + ';font-size:10px;line-height:14px;font-weight:500;white-space:nowrap',
      foot: 'display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:8px',
      price: 'font-size:12px;line-height:17px;font-weight:700;color:' + INK + ';font-variant-numeric:tabular-nums;white-space:nowrap',
      picks: 'font-size:10px;line-height:14px;color:' + MUTED + ';font-variant-numeric:tabular-nums;white-space:nowrap',
      ctaStrip: 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 14px 10px;border-top:1px solid ' + BORDER,
      tabBar: 'flex:0 0 72px;display:flex;box-shadow:inset 0 1px 0 ' + BORDER + ';background:#fff;padding-top:9px',
      tabCell: 'flex:1;display:flex;flex-direction:column;align-items:center;gap:3px',

      cmpHead: 'flex:0 0 56px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 16px;box-shadow:inset 0 -1px 0 ' + BORDER,
      cmpTitleRow: 'display:flex;align-items:baseline;gap:8px',
      cmpTitle: 'flex:1;min-width:0;text-align:center;font-size:16px;font-weight:700;color:' + INK,
      cmpCount: 'font-size:14px;font-weight:700;color:' + MUTED,
      cmpPad: 'width:36px;flex:0 0 36px',
      closeBtn: 'width:36px;height:36px;flex:0 0 36px;border-radius:999px;background:' + SEC + ';display:flex;align-items:center;justify-content:center',
      icoX16: ICO('close-fill', 16, INK),
      hint: 'flex:0 0 auto;padding:16px 24px;display:flex;flex-direction:column;gap:4px;border-bottom:1px solid ' + BORDER,
      swipeRow: 'flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 24px;background:' + REC + ';box-shadow:inset 0 -1px 0 ' + BORDER,
      swipeText: 'font-size:12px;font-weight:700;color:' + MUTED,
      icoSwipeL: ICO('chevron-left', 14, '#adb1ba'),
      icoSwipeR: ICO('chevron-right', 14, '#adb1ba'),
      hintTitle: 'font-size:18px;line-height:24px;font-weight:700;color:' + INK,
      hintText: 'font-size:14px;line-height:20px;color:' + MUTED,
      cmpScroll: 'flex:1;overflow:auto;scrollbar-width:none',
      rankWrap: 'display:flex;flex-direction:column;gap:14px;padding:16px 20px 24px',
      rankHead: 'display:flex;align-items:center;gap:12px',
      rankPhotoWrap: 'position:relative;flex:0 0 auto',
      rankCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px',
      rankMetrics: 'display:flex;flex-direction:column;gap:1px;border-radius:8px;background:' + REC + ';padding:4px 12px',
      rankMRow: 'display:flex;align-items:center;gap:8px;min-height:36px',
      rankMLabel: 'flex:0 0 68px;font-size:12px;color:' + MUTED,
      rankMBest: 'width:6px;height:6px;flex:0 0 6px;border-radius:999px;background:' + P,
      cmpTable: 'min-width:544px;display:flex;flex-direction:column',
      photoRow: 'display:flex;border-bottom:1px solid ' + BORDER + ';background:#fff',
      labelSpacer: 'width:100px;flex:0 0 100px;position:sticky;left:0;z-index:10;background:#fff',
      vCol: 'width:148px;flex:0 0 148px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:4px;box-sizing:border-box',
      vPhotoWrap: 'position:relative;width:100%',
      vRemove: 'position:absolute;right:8px;top:8px;width:24px;height:24px;border-radius:999px;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center',
      icoXw: ICO('close-fill', 12, '#fff'),
      checkDotSm: 'position:absolute;left:8px;top:8px;width:22px;height:22px;border-radius:999px;background:' + P + ';display:flex;align-items:center;justify-content:center',
      icoCheckSm: ICO('check-fill', 12, '#fff'),
      vName: 'margin-top:6px;font-size:13px;font-weight:700;text-align:center;color:' + INK,
      rankVName: 'font-size:15px;font-weight:700;text-align:left;color:' + INK,
      vCat: 'font-size:11px;color:' + MUTED,
      cellStyle: 'width:148px;flex:0 0 148px;padding:16px 12px;display:flex;align-items:center;justify-content:center;box-sizing:border-box',
      ctaRow: 'display:flex;padding:20px 0;background:#fff',

      diffCard: 'width:900px;background:#fff;border-radius:10px;border:1px solid ' + BORDER + ';padding:8px 24px 16px;display:flex;flex-direction:column;box-sizing:border-box',
      diffHead: 'display:flex;gap:16px;min-height:44px;align-items:center;border-bottom:1px solid #dcdee3',
      diffRow: 'display:flex;gap:16px;min-height:52px;padding:13px 0;align-items:flex-start;border-bottom:1px solid ' + SEC,
      dh1: 'width:110px;flex:0 0 110px;font-size:12px;font-weight:700;color:' + MUTED,
      dh2: 'width:250px;flex:0 0 250px;font-size:12px;font-weight:700;color:' + MUTED,
      dh3: 'width:250px;flex:0 0 250px;font-size:12px;font-weight:700;color:' + MUTED,
      dh4: 'width:190px;flex:0 0 190px;font-size:12px;font-weight:700;color:' + MUTED,
      dc1: 'width:110px;flex:0 0 110px;font-size:13px;line-height:20px;font-weight:700;color:' + INK,
      dc2: 'width:250px;flex:0 0 250px;font-size:13px;line-height:20px;color:' + SUB,
      dc3: 'width:250px;flex:0 0 250px;font-size:13px;line-height:20px;color:' + INK,
      dc4: 'width:190px;flex:0 0 190px;font-size:13px;line-height:20px;color:' + MUTED,

      hasComparing: true,
      cats: [chip('전체', true), chip('웨딩홀', false), chip('스드메', false), chip('본식', false), chip('예물 · 신혼', false)],
      afterRemove: [
        sv({ name: '블루밍 스튜디오', cat: '스튜디오', loc: '서울 강남구', price: '80~150만원', reports: '12', badge: '인기', tags: ['자연광'], img: IMG.a, confirmed: true }),
        sv({ name: '포레스트 스튜디오', cat: '스튜디오', loc: '서울 성수동', price: '90~160만원', reports: '7', tags: ['인더스트리얼'], img: IMG.c })
      ],
      toastWrap: 'position:absolute;left:0;right:0;bottom:24px;display:flex;justify-content:center;padding:0 20px',
      toastBar: 'width:100%;max-width:390px;min-height:48px;border-radius:10px;background:' + INK + ';color:#fff;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 18px;box-shadow:0 8px 24px rgba(0,0,0,.24)',
      toastText: 'font-size:14px;font-weight:700;color:#fff',
      toastAction: 'font-size:14px;font-weight:700;color:' + P + ';white-space:nowrap',
      catGroupWrap: 'display:flex;flex-direction:column;gap:28px;padding-top:16px',
      catGroupSec: 'display:flex;flex-direction:column;gap:12px',
      catGroupHead: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:0 20px',
      catGroupTitle: 'font-size:18px;font-weight:700;color:' + INK,
      catGroupMeta: 'font-size:13px;color:' + MUTED,
      moreBtn2: 'margin:0 20px;height:44px;border-radius:8px;background:' + SEC + ';color:' + SUB + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700',
      catGroups: [
        { title: '웨딩홀', anchorId: 'cat-웨딩홀', count: 2, items: [
          sv({ name: '더채플 청담', cat: '웨딩홀', loc: '서울 강남구', price: '3,200~4,100만원', reports: '18', badge: '인기', tags: ['본식전용'], img: IMG.a, confirmed: true }),
          sv({ name: '루이비스스퀘어', cat: '웨딩홀', loc: '서울 송파구', price: '2,800~3,600만원', reports: '11', tags: ['야외정원'], img: IMG.b })
        ] },
        { title: '스드메', anchorId: 'cat-스드메', count: 3, items: [
          sv({ name: '블루밍 스튜디오', cat: '스튜디오', loc: '서울 강남구', price: '80~150만원', reports: '12', badge: '인기', tags: ['자연광', '야외촬영'], img: IMG.a, confirmed: true }),
          sv({ name: '스튜디오 온', cat: '스튜디오', loc: '서울 마포구', price: '70~130만원', reports: '9', tags: ['필름감성'], img: IMG.b, comparing: true }),
          sv({ name: '포레스트 스튜디오', cat: '스튜디오', loc: '서울 성수동', price: '90~160만원', reports: '7', tags: ['인더스트리얼', '넓은공간'], img: IMG.c, comparing: true })
        ] },
        { title: '본식', anchorId: 'cat-본식', count: 1, items: [
          sv({ name: '오드 메이크업', cat: '메이크업', loc: '서울 청담동', price: '45~80만원', reports: '14', badge: '인기', tags: ['당일메이크업'], img: IMG.d })
        ] },
        { title: '예물 · 신혼', anchorId: 'cat-예물신혼', count: 0, items: [] }
      ],
      tabs: [tab('home', '홈', false), tab('search', '검색', false), tab('heart', 'Pick', true), tab('calendar', '웨딩노트', false), tab('profile', 'MY', false)],
      segBar: 'flex:0 0 auto;display:flex;gap:0;padding:0 20px;box-shadow:inset 0 -1px 0 ' + BORDER,
      segA: [seg('추천', true), seg('내 Pick', false)],
      segB: [seg('추천', false), seg('내 Pick', true)],
      tagRow: 'display:flex;align-items:center;gap:8px;min-height:26px',
      tagIdWide: 'height:26px;flex:0 0 auto;padding:0 8px;border-radius:6px;background:' + MUTED + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;white-space:nowrap',
      tagText: 'font-size:18px;line-height:24px;font-weight:700;color:' + INK + ';white-space:nowrap',

      dimTop: 'flex:1;min-height:0;overflow:hidden;opacity:.34;display:flex;flex-direction:column',
      dimHeadRow: 'flex:0 0 auto;padding:16px 20px 12px',
      dimHeadTitle: 'font-size:22px;font-weight:700;color:' + INK,
      dimList: 'flex:1;padding:0 20px;display:flex;flex-direction:column;gap:12px',
      dimCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px',
      dimName: 'font-size:16px;font-weight:700;color:' + INK + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
      dimMeta: 'font-size:13px;color:' + MUTED + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
      dimCards: [
        { name: '블루밍 스튜디오', meta: '152~184만원 · 실 제보 12건',
          card: 'display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;border:1.5px solid ' + P,
          thumb: 'width:64px;height:64px;flex:0 0 64px;border-radius:8px;' + bg(IMG.a) },
        { name: '스튜디오 온', meta: '138~171만원 · 실 제보 9건',
          card: 'display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;border:1px solid ' + BORDER,
          thumb: 'width:64px;height:64px;flex:0 0 64px;border-radius:8px;' + bg(IMG.b) }
      ],

      sheetWrap: 'position:absolute;left:0;right:0;bottom:0;display:flex',
      sheet: 'width:100%;background:#fff;border-radius:20px 20px 0 0;padding:12px 24px 28px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box',
      grab: 'width:40px;height:4px;border-radius:999px;background:' + SEC + ';align-self:center;margin-bottom:8px',
      formHead: 'display:flex;align-items:center;justify-content:space-between;gap:12px',
      formClose: 'width:36px;height:36px;flex:0 0 36px;border-radius:999px;background:' + SEC + ';display:flex;align-items:center;justify-content:center',
      icoXsm: ICO('close-fill', 16, INK),
      sheetTitle: 'font-size:24px;line-height:33px;font-weight:700;color:' + INK,
      sheetBody: 'font-size:15px;line-height:22px;color:' + SUB,
      confirmList: 'display:flex;flex-direction:column;gap:8px;padding:16px;border-radius:10px;background:#fff5f2',
      confirmRow: 'display:flex;align-items:flex-start;gap:9px',
      confirmDot: 'width:5px;height:5px;flex:0 0 5px;margin-top:8px;border-radius:999px;background:' + P,
      confirmText: 'flex:1;font-size:14px;line-height:21px;color:' + SUB,
      confirmRows: ['웨딩노트 준비현황에 «결정 완료»로 들어가요', '예산에 152~184만원이 잡혀요', '준호님에게도 알려드려요'],
      sheetDock: 'display:flex;gap:10px;padding-top:4px',
      btnGhost: 'flex:0 0 40%;height:56px;border-radius:6px;background:' + SEC + ';color:' + SUB + ';display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700',
      btnPrimary: 'flex:1;height:56px;border-radius:6px;background:' + P + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700',

      doneScroll: 'flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;padding:56px 24px 24px;display:flex;flex-direction:column;align-items:center;gap:12px',
      doneMark: 'width:72px;height:72px;border-radius:999px;background:' + P + ';display:flex;align-items:center;justify-content:center;margin-bottom:8px',
      icoCheckBig: ICO('check-fill', 36, '#fff'),
      doneTitle: 'font-size:26px;line-height:35px;font-weight:700;color:' + INK + ';text-align:center',
      doneSub: 'font-size:15px;line-height:22px;color:' + SUB + ';text-align:center',
      doneCards: 'width:100%;margin-top:12px;display:flex;flex-direction:column;border-radius:10px;background:#f7f8fa;overflow:hidden',
      doneRow: 'display:flex;align-items:center;gap:12px;min-height:52px;padding:0 16px;box-shadow:inset 0 -1px 0 #eaebee',
      doneRowT: 'flex:1;min-width:0;font-size:14px;color:' + MUTED,
      doneRowV: 'font-size:14px;font-weight:700;color:' + INK + ';white-space:nowrap',
      doneRows: [
        { k: '웨딩노트', v: '결정 완료' },
        { k: '예산', v: '152~184만원' },
        { k: '배우자', v: '알림 보냄' }
      ],
      nextBox: 'width:100%;margin-top:12px;padding:16px;border-radius:10px;background:#fff5f2;display:flex;flex-direction:column;gap:4px',
      nextT: 'font-size:16px;font-weight:700;color:' + INK,
      nextS: 'font-size:13px;color:' + SUB,
      dockSingle: 'flex:0 0 92px;padding:12px 20px;display:flex;box-shadow:inset 0 1px 0 ' + BORDER,
      ctaFull: 'flex:1;height:56px;border-radius:6px;background:' + P + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700',

      cmpVendors: [
        cv({ name: '블루밍 스튜디오', cat: '스튜디오', img: IMG.a, confirmed: true }),
        cv({ name: '스튜디오 온', cat: '스튜디오', img: IMG.b }),
        cv({ name: '포레스트 스튜디오', cat: '스튜디오', img: IMG.c })
      ],
      rankCards: rank([
        { name: '블루밍 스튜디오', cat: '스튜디오', img: IMG.a, confirmed: true, m: [
          { label: '제보 금액', v: '80~150만원', best: false }, { label: '실 제보', v: '12건', best: true },
          { label: '기준금액', v: '112만원', best: false }, { label: '원본 제공', v: '전체', best: true },
          { label: '보정', v: '20장', best: false }, { label: '5월 주말', v: '가능', best: true }
        ] },
        { name: '스튜디오 온', cat: '스튜디오', img: IMG.b, confirmed: false, m: [
          { label: '제보 금액', v: '70~130만원', best: true }, { label: '실 제보', v: '9건', best: false },
          { label: '기준금액', v: '98만원', best: true }, { label: '원본 제공', v: '전체', best: true },
          { label: '보정', v: '15장', best: false }, { label: '5월 주말', v: '가능', best: true }
        ] },
        { name: '포레스트 스튜디오', cat: '스튜디오', img: IMG.c, confirmed: false, m: [
          { label: '제보 금액', v: '90~160만원', best: false }, { label: '실 제보', v: '7건', best: false },
          { label: '기준금액', v: '124만원', best: false }, { label: '원본 제공', v: '선택 30장', best: false },
          { label: '보정', v: '25장', best: true }, { label: '5월 주말', v: '대기', best: false }
        ] }
      ]),
      diffs: [
        diff('색 · 서체', 'Playfair Display · DM Mono · #e7898d 로즈', '시스템 서체 · #FF6F61 코랄 · SEED 회색', '정본 토큰 고정'),
        diff('Pick 의미', 'Pick하기 = 상담 확정 · 상담취소로 해제', 'Pick = 후보 담기 · 최종 결정은 별도', '정본 핵심 루프'),
        diff('상담 진입', '업체 상세 하단 CTA', '최종 결정 완료 → 상담 잡기', '후보 담기만으로 예약할 수 없다'),
        diff('최종 결정', '없음', '확인 시트 → 완료 화면 신설', '무엇이 어디에 들어가는지 먼저 보여준다'),
        diff('준비 현황', 'Pick 탭 안 «추천» 탭', '별도 화면 · 홈에서만 진입', '담는 곳과 좁히는 곳을 한 탭에'),
        diff('탭 구성', '추천 · 내 Pick 2탭', '없음', '추천 → 비교 → 결정이 한 탭에서 끝난다'),
        diff('Pick 개수', '제한 없음 · 업종별로 쌓인다', '언급 없음', '담는 데 제약을 두지 않는다'),
        diff('결정 이후', '알림톡 발송 → 캘린더 자동 등록', '언급 없음', '업체와 일정까지 이어진다'),
        diff('카드 CTA', '비교하기 + Pick하기 버튼 2개 동일 크기', 'Pick 버튼 1개 · 비교는 텍스트 링크', '화면당 Primary 1개'),
        diff('평가 지표', '별점 4.9 · 리뷰 198건 · 저장 1,247', '5점 별점 + 실 제보 12건', '별점은 3축 답변과 함께 병행'),
        diff('비교 기준', '가격대 · 평점 · 리뷰 · 저장 · 태그 · 뱃지', '제보 금액 · 실 제보 · 기준금액 · 포함 항목 · 조건', '판단에 쓰이는 값만'),
        diff('우세 표시', 'primary 6% 배경 + BEST 배지', '우세값만 700 진하게', '가치판단 표현 금지'),
        diff('비교 결론', '없음', 'Hero에 한 줄 «가장 크게 갈리는 건 보정 장수예요»', '3초 원칙'),
        diff('비교 최대', '5곳', '3곳', '정본 규칙'),
        diff('용어', '가격 제보 · 웨딩노트 · 라운지 · 업체 탐색', 'Pick 인증 · 웨딩노트 · MY · 「탐색」 제거', '용어사전')
      ]
    };
  }
}

export default Component;
