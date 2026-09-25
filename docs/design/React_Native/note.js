import { DesignModel } from "../runtime/designRuntime.js";

class Component extends DesignModel {
  renderVals() {
    const P = '#ff6f61', INK = '#212124', MUTED = '#868b94', SUB = '#4d5159', SEC = '#f2f3f6', REC = '#f7f8fa', BORDER = '#eaebee', AMBER = '#805217', DIM = '#adb1ba';
    const ICO = (n, px, c) => 'width:' + px + 'px;height:' + px + 'px;flex:0 0 ' + px + 'px;background-color:' + c + ';-webkit-mask:url("assets/seed-icons/' + n + '.svg") center/contain no-repeat;mask:url("assets/seed-icons/' + n + '.svg") center/contain no-repeat;display:inline-block';
const ocr = (k, v, sure, hint) => ({ k, v, hint: hint || '', tag: sure ? '읽었어요' : '확인 필요',
      card: 'border-radius:10px;padding:16px 18px;display:flex;flex-direction:column;gap:5px;'
        + (sure ? 'background:' + REC + ';' : 'background:#fff;box-shadow:inset 0 0 0 1.5px ' + P + ';'),
      tagStyle: 'padding:3px 8px;border-radius:4px;font-size:12px;font-weight:700;white-space:nowrap;'
        + (sure ? 'background:' + BORDER + ';color:' + MUTED + ';' : 'background:' + P + ';color:#fff;') });
    const CHECK = (sz, bg) => 'width:' + sz + 'px;height:' + sz + 'px;flex:0 0 ' + sz + 'px;border-radius:999px;background:' + bg
      + ';-webkit-mask:none;position:relative;display:inline-flex;align-items:center;justify-content:center;'
      + 'background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'3.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m5 12.5 4.5 4.5L19 7.5\'/%3E%3C/svg%3E");background-size:' + Math.round(sz * 0.62) + 'px;background-position:center;background-repeat:no-repeat';
    const seg = (on) => ({ label: on.l,
      style: 'flex:1;height:48px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;cursor:pointer;'
        + (on.a ? 'color:' + INK + ';box-shadow:inset 0 -2px 0 ' + INK : 'color:' + MUTED) });
        const day = (n, o) => {
      o = o || {};
      return { n, dot: !!o.dot,
        style: 'position:relative;width:40px;height:40px;margin:0 auto;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:13px;font-variant-numeric:tabular-nums;' + (o.sel ? 'background:' + P + ';color:#fff;font-weight:700;' : 'color:' + SUB + ';'),
        dotStyle: 'position:absolute;bottom:6px;width:4px;height:4px;border-radius:999px;background:' + (o.sel ? '#fff' : P) };
    };
    const dc = (cat, name, date, note, memo) => ({ cat, name, date, note, memo: memo || '' });
    const cl = (t, done) => ({ t, done,
      row: 'padding:10px 0;display:flex;align-items:center;gap:10px;box-shadow:inset 0 -1px 0 ' + BORDER,
      check: 'width:22px;height:22px;flex:0 0 22px;border-radius:999px;' + (done
        ? 'background:' + P + ';background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'3.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m5 12.5 4.5 4.5L19 7.5\'/%3E%3C/svg%3E");background-size:14px;background-position:center;background-repeat:no-repeat'
        : 'box-shadow:inset 0 0 0 1.5px #dcdee3'),
      label: 'flex:1;font-size:15px;' + (done ? 'color:' + MUTED + ';text-decoration:line-through;' : 'color:' + INK + ';') });
    const sp = (label, date, amt, verified) => ({ label, date, amt, verified });
    const tlItem = (time, title, meta, state) => {
      const done = state === 'done', wed = state === 'wed';
      return { time, title, meta, hasMeta: !!meta,
        dot: 'width:' + (wed ? 12 : 9) + 'px;height:' + (wed ? 12 : 9) + 'px;flex:0 0 auto;border-radius:999px;margin-top:16px;background:' + (done ? '#dcdee3' : P),
        card: 'flex:1;min-width:0;padding:14px 16px;border-radius:10px;display:flex;flex-direction:column;gap:3px;'
          + (wed ? 'background:#fff;box-shadow:inset 0 0 0 1.5px ' + P + ';' : 'background:' + (done ? REC : SEC) + ';'),
        timeStyle: 'font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;color:' + (wed ? P : MUTED),
        titleStyle: 'font-size:15px;font-weight:700;' + (done ? 'color:' + MUTED + ';text-decoration:line-through;' : 'color:' + INK + ';'),
        metaStyle: 'font-size:13px;color:' + SUB };
    };
    const ev = (label, time, done) => ({ label, time, done, badge: done,
      row: 'display:flex;align-items:center;gap:10px;min-height:56px;padding:12px 14px;border-radius:10px;background:' + (done ? REC : SEC),
      check: 'width:24px;height:24px;flex:0 0 24px;border-radius:999px;display:flex;align-items:center;justify-content:center;' + (done ? 'background:' + P + ';' : 'border:1.5px solid ' + P + ';box-sizing:border-box;'),
      name: 'flex:1;min-width:0;font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' + (done ? 'color:' + MUTED + ';text-decoration:line-through;' : 'color:' + INK + ';') });
    const bd = (label, spent, budget) => {
      const pct = Math.min(100, Math.round(spent / budget * 100));
      return { label, text: spent.toLocaleString() + ' / ' + budget.toLocaleString() + '만원', pct: pct + '%',
        state: spent > 0 ? spent.toLocaleString() + '만원 냈어요' : '아직 안 냈어요',
        fill: 'display:block;width:' + pct + '%;height:100%;border-radius:999px;background:' + (pct >= 100 ? P : '#ffb3ab'),
        pctStyle: 'font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;color:' + (pct >= 100 ? P : MUTED) };
    };
    const cs = (name, meta, state, kind) => ({ name, meta, state, arrow: kind !== 'work',
      stateStyle: 'font-size:13px;white-space:nowrap;' + (kind === 'saved' ? 'font-weight:700;color:' + INK : kind === 'work' ? 'color:' + AMBER : 'color:' + MUTED) });
    const ab = (title, items, warn) => ({ title, items,
      titleStyle: 'font-size:12px;font-weight:700;color:' + (warn ? AMBER : MUTED),
      boxStyle: 'display:flex;flex-direction:column;gap:8px;padding:14px 16px;border-radius:10px;background:' + (warn ? '#fff8ee' : SEC) });
    const FILLED = ['home', 'search', 'heart', 'profile'];
    const tab = (icon, text, on) => ({ icon: ICO(on && FILLED.indexOf(icon) >= 0 ? icon + '-fill' : icon, 24, on ? INK : MUTED), text, label: 'font-size:12px;line-height:16px;font-weight:700;color:' + (on ? INK : MUTED) });
    const fld = (label, value, ph) => ({ label, value,
      box: 'min-height:52px;border-radius:6px;border:1px solid #d1d3d8;padding:14px;display:flex;align-items:center;font-size:16px;color:' + (ph ? '#adb1ba' : INK) });
    const tg = (label, on) => ({ label,
      track: 'width:52px;height:32px;flex:0 0 52px;border-radius:999px;display:flex;align-items:center;padding:0 3px;box-sizing:border-box;' + (on ? 'background:' + P + ';justify-content:flex-end;' : 'background:#dcdee3;') });
    const diff = (k, a, b, why, kind) => ({ k, a, b, why,
      bs: 'width:250px;flex:0 0 250px;font-size:13px;line-height:20px;color:' + (kind === 'open' ? AMBER : INK) + (kind === 'open' ? ';font-weight:700' : ''),
      ws: 'width:190px;flex:0 0 190px;font-size:13px;line-height:20px;color:' + (kind === 'open' ? AMBER : MUTED) });

    const wheelItem = (label, dist) => ({ label,
      style: 'flex:0 0 48px;height:48px;display:flex;align-items:center;justify-content:center;white-space:nowrap;'
        + (dist === 0 ? 'font-size:20px;font-weight:700;color:' + INK + ';'
          : dist === 1 ? 'font-size:18px;color:' + MUTED + ';'
            : dist === 2 ? 'font-size:17px;color:#c4c8ce;' : 'font-size:16px;color:#e2e5e9;') });
    const wheelCol = (items, sel) => ({
      colStyle: 'flex:1;min-width:0;height:240px;overflow-y:auto;scrollbar-width:none;display:flex;flex-direction:column;padding:96px 0;box-sizing:border-box;position:relative;z-index:2',
      items: items.map((label, i) => wheelItem(label, Math.abs(i - sel)))
    });
    return {

      wheelSheet: 'position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:20px 20px 0 0;padding:12px 24px 28px;display:flex;flex-direction:column;gap:14px;box-shadow:0 -8px 32px rgba(0,27,55,.16);box-sizing:border-box',
      sheetGrab: 'align-self:center;width:40px;height:4px;border-radius:999px;background:' + BORDER,
      sheetClose: 'width:36px;height:36px;flex:0 0 36px;border-radius:999px;background:' + SEC + ';display:flex;align-items:center;justify-content:center',
      icoX: ICO('close-fill', 16, INK),
      wheelWrap: 'position:relative;display:flex;height:240px;overflow:hidden',
      wheelBand: 'position:absolute;left:0;right:0;top:96px;height:48px;border-radius:10px;background:' + REC + ';z-index:1',
      wheelFadeTop: 'position:absolute;left:0;right:0;top:0;height:96px;background:linear-gradient(#fff 30%,rgba(255,255,255,0));pointer-events:none;z-index:3',
      wheelFadeBottom: 'position:absolute;left:0;right:0;bottom:0;height:96px;background:linear-gradient(rgba(255,255,255,0),#fff 70%);pointer-events:none;z-index:3',
      colDateSheet: 'display:flex;flex-direction:column;gap:10px;width:430px;order:3',
      dateWheels: [
        wheelCol(['2026년', '2027년', '2028년', '2029년', '2030년'], 0),
        wheelCol(['7월', '8월', '9월', '10월', '11월'], 2),
        wheelCol(['10일', '11일', '12일', '13일', '14일'], 2)
      ],
      navBar: 'flex:0 0 56px;display:flex;align-items:center;gap:8px;padding:0 16px;box-shadow:inset 0 -1px 0 ' + BORDER,
      navTitle: 'flex:1;min-width:0;text-align:center;font-size:16px;font-weight:700;color:' + INK,
      navPad: 'width:36px;flex:0 0 36px',
      icoBack: ICO('chevron-left', 24, INK) + ';width:36px;flex:0 0 36px;-webkit-mask-size:24px;mask-size:24px',
      qBlock: 'flex:0 0 auto;padding:20px 24px 24px;display:flex;flex-direction:column;gap:10px',
      qTitle: 'font-size:28px;line-height:38px;letter-spacing:-0.02em;font-weight:700;color:' + INK,
      qSub: 'font-size:15px;line-height:23px;color:' + MUTED,

      sec: 'flex:0 0 auto;padding:0 24px 20px;display:flex;flex-direction:column;gap:12px',
      secTitle: 'font-size:15px;font-weight:700;color:' + INK,
      rows: 'display:flex;flex-direction:column;gap:10px',

      uploadGrid: 'display:grid;grid-template-columns:1fr 1fr;gap:11px',
      upCell: 'height:140px;border-radius:10px;background:' + REC + ';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px',
      upT: 'font-size:15px;font-weight:700;color:' + INK,
      upS: 'font-size:12px;color:' + MUTED,
      uploadWays: [
        { icon: ICO('camera', 28, SUB), t: '사진 찍기', s: '지금 촬영해요' },
        { icon: ICO('photo', 28, SUB), t: '앨범에서 고르기', s: '저장한 사진' }
      ],
      tipRow: 'display:flex;align-items:flex-start;gap:9px',
      tipCheck: CHECK(20, '#1aa174'),
      tipText: 'flex:1;font-size:14px;line-height:22px;color:' + SUB,
      tips: ['금액과 업체 이름이 같이 보이게 찍어주세요', '가릴 곳은 손으로 가리고 찍어도 괜찮아요', '여러 장이면 한 장씩 올려주세요'],

      noteBox: 'border-radius:10px;background:' + REC + ';padding:18px;display:flex;flex-direction:column;gap:5px',
      mergeBox: 'border-radius:10px;background:#fff5f2;padding:18px;display:flex;flex-direction:column;gap:5px',
      noteT: 'font-size:15px;font-weight:700;color:' + INK,
      noteS: 'font-size:13px;line-height:20px;color:' + MUTED,

      ocrHead: 'display:flex;align-items:center;gap:8px',
      ocrK: 'flex:1;font-size:13px;color:' + MUTED,
      ocrV: 'font-size:18px;font-weight:700;color:' + INK + ';font-variant-numeric:tabular-nums',
      ocrHint: 'font-size:12px;line-height:18px;color:' + P,
      ocrFields: [
        ocr('낸 금액', '1,520,000원', true),
        ocr('낸 날짜', '2026년 8월 28일', true),
        ocr('업체', '주식회사 모먼트', false, '자료에 적힌 상호가 등록된 업체명과 달라요'),
        ocr('상품', '스튜디오 촬영 패키지', false, '어떤 구성인지 골라주시면 비교에 쓸 수 있어요')
      ],

      dockSingle: 'flex:0 0 92px;padding:12px 24px;display:flex;box-shadow:inset 0 1px 0 ' + BORDER,
      ctaFull: 'flex:1;height:56px;border-radius:6px;background:' + P + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700',
      ctaDim: 'flex:1;height:56px;border-radius:6px;background:' + SEC + ';color:' + DIM + ';display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700',

      root: 'display:flex;flex-direction:column;gap:40px;align-items:flex-start;padding:64px;width:max-content',
      intro: 'display:flex;flex-direction:column;gap:10px;max-width:1000px',
      eyebrow: 'font-size:14px;font-weight:700;color:' + P,
      h40: 'font-size:40px;line-height:52px;font-weight:700;color:' + INK,
      introBody: 'font-size:18px;line-height:26px;color:#393a40;text-wrap:pretty',
      boardRow: 'display:flex;gap:36px;align-items:flex-start;flex-wrap:wrap;max-width:1900px',
      grp: 'display:flex;flex-direction:column;gap:24px',
      col: 'display:flex;flex-direction:column;gap:10px;width:430px',
      colEventForm: 'display:flex;flex-direction:column;gap:10px;width:430px',
      colList: 'display:flex;flex-direction:column;gap:10px;width:430px',
      colDetail: 'display:flex;flex-direction:column;gap:10px;width:430px',
      colBudget: 'display:flex;flex-direction:column;gap:10px;width:430px',
      colForm: 'display:flex;flex-direction:column;gap:10px;width:430px',
      colCert1: 'display:flex;flex-direction:column;gap:10px;width:430px',
      colCert2: 'display:flex;flex-direction:column;gap:10px;width:430px',
      tagIdWide: 'height:26px;flex:0 0 auto;padding:0 8px;border-radius:6px;background:' + MUTED + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;white-space:nowrap',
      colWide: 'display:flex;flex-direction:column;gap:10px;width:900px',
      headAddSm: 'font-size:14px;font-weight:700;color:' + P,
      clHead: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:0 4px',
      secTitleSm: 'font-size:15px;font-weight:700;color:' + INK,
      secLabelC: 'font-size:13px;font-weight:700;color:' + MUTED + ';padding:0 20px',
      decidedCard: 'margin:0 20px;padding:16px 18px;border-radius:10px;background:' + REC + ';display:flex;flex-direction:column;gap:5px',
      decidedTop: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px',
      decidedName: 'font-size:16px;font-weight:700;color:' + INK,
      decidedDate: 'font-size:12px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      decidedNote: 'font-size:13px;color:' + SUB,
      spendGoRow: 'display:flex;align-items:center;justify-content:space-between;min-height:44px',
      spendGoT: 'font-size:14px;font-weight:700;color:' + INK,
      memoLinkRow: 'margin-top:6px;padding-top:8px;display:flex;align-items:center;justify-content:space-between;box-shadow:inset 0 1px 0 ' + BORDER,
      memoLinkT: 'font-size:13px;font-weight:700;color:' + MUTED,
      decided: [
        dc('웨딩홀', '청담 E 웨딩홀', '2026.08.20', '보증 250명 · 계약금 500만원', '주차는 발렛만 가능. 하객 100명 넘으면 추가요금 있음 — 계약서 3조 확인.'),
        dc('스튜디오', '강남 A 스튜디오', '2026.09.08', '9월 촬영 예정', '원본 파일은 촬영 후 2주 안에 요청해야 함.'),
        dc('드레스', '라비드레스', '2026.09.10', '피팅 2회 · 본식 1회', ''),
        dc('메이크업', '청담 헤메', '2026.09.10', '', '')
      ],
      memoAlwaysBox: 'margin-top:8px;padding-top:8px;display:flex;flex-direction:column;gap:3px;box-shadow:inset 0 1px 0 ' + BORDER,
      memoAlwaysLabel: 'font-size:12px;font-weight:700;color:' + MUTED,
      memoAlwaysText: 'font-size:13px;line-height:19px;color:' + SUB + ';text-wrap:pretty',
      checklist: [
        cl('상견례 날짜 정하기', true), cl('웨딩홀 계약금 입금', true), cl('드레스 투어 3곳 예약', false),
        cl('청첩장 문구 정하기', false), cl('신혼여행 견적 받기', false), cl('예물 상담 예약', false)
      ],
      noteCard: 'margin:0 20px;padding:16px 18px;border-radius:10px;border:1px solid ' + BORDER + ';display:flex;flex-direction:column;gap:6px',
      noteTop: 'display:flex;align-items:center;justify-content:space-between;gap:12px',
      noteTagStyle: 'height:24px;padding:0 8px;border-radius:6px;background:' + SEC + ';color:' + SUB + ';display:inline-flex;align-items:center;font-size:12px;font-weight:700',
      noteDate: 'font-size:12px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      noteBody: 'font-size:14px;line-height:21px;color:' + INK + ';text-wrap:pretty',
      notes: [
        { tag: '청담 E 웨딩홀', date: '9.5', body: '주차는 발렛만 가능. 하객 100명 넘으면 추가요금 있음 — 계약서 3조 확인.' },
        { tag: '강남 A 스튜디오', date: '9.1', body: '원본 파일은 촬영 후 2주 안에 요청해야 함.' },
        { tag: '자유 메모', date: '8.28', body: '청첩장은 늦어도 D-60까지 발송하기로.' }
      ],
      spendRow: 'margin:0 20px;padding:14px 0;display:flex;align-items:center;gap:10px;box-shadow:inset 0 -1px 0 ' + BORDER,
      spendCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px',
      spendLabel: 'font-size:15px;font-weight:700;color:' + INK,
      spendDate: 'font-size:12px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      spendAmt: 'font-size:15px;font-weight:700;color:' + INK + ';font-variant-numeric:tabular-nums;white-space:nowrap',
      spendBadge: 'height:24px;padding:0 8px;border-radius:4px;background:#e8faf6;color:#1aa174;display:inline-flex;align-items:center;font-size:11px;font-weight:700;white-space:nowrap',
      spends: [
        sp('웨딩홀 계약금', '10.7', '500만원', true), sp('스튜디오 계약금', '9.5', '80만원', true),
        sp('드레스 예약금', '9.10', '50만원', false), sp('부케 상담', '9.2', '15만원', false),
        sp('메이크업 예약금', '9.10', '20만원', false)
      ],
      chRow: 'margin:0 20px;padding:14px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;box-shadow:inset 0 -1px 0 ' + BORDER,
      chCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px',
      chWho: 'font-size:13px;font-weight:700;color:' + P,
      chWhat: 'font-size:15px;color:' + INK,
      chRight: 'flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:4px',
      chTime: 'font-size:12px;color:' + MUTED + ';font-variant-numeric:tabular-nums;white-space:nowrap',
      chUndo: 'font-size:12px;font-weight:700;color:' + MUTED,
      changeLog: [
        { who: '민준', what: '웨딩홀을 청담 E 웨딩홀로 결정', time: '9.20 14:02' },
        { who: '지수', what: '예산을 1,750만원으로 수정', time: '9.18 09:40' },
        { who: '민준', what: '드레스 투어 일정 추가', time: '9.15 21:11' },
        { who: '지수', what: '스튜디오 후보에서 2곳 제외', time: '9.12 11:30' }
      ],
      col16: 'display:flex;flex-direction:column;gap:10px;width:430px',
      col17: 'display:flex;flex-direction:column;gap:10px;width:430px',
      col18: 'display:flex;flex-direction:column;gap:10px;width:430px',
      col19: 'display:flex;flex-direction:column;gap:10px;width:430px',
      col20: 'display:flex;flex-direction:column;gap:10px;width:430px',
      tag: 'height:26px;display:flex;align-items:center;gap:8px;font-size:18px;font-weight:700;color:' + INK + ';white-space:nowrap',
      tagId: 'width:26px;height:26px;flex:0 0 26px;border-radius:6px;background:' + INK + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700',
      tagDesc: 'height:63px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;line-height:21px;color:' + SUB + ';text-wrap:pretty',
      phone: 'width:430px;height:932px;border-radius:40px;overflow:hidden;position:relative;display:flex;flex-direction:column;background:#fff;box-shadow:0 15px 75px rgba(0,27,55,.14)',
      bar: 'height:44px;flex:0 0 44px;display:flex;align-items:center;padding:0 26px;font-size:14px;font-weight:700;color:' + INK,
      scroll: 'flex:1;overflow-y:auto;scrollbar-width:none',
      head: 'padding:20px 24px 16px;display:flex;align-items:baseline;justify-content:space-between',
      h1: 'font-size:26px;line-height:35px;font-weight:700;color:' + INK,
      headAdd: 'font-size:15px;font-weight:700;color:' + P,
      tabNav: 'flex:0 0 auto;display:flex;gap:0;padding:0 20px;box-shadow:inset 0 -1px 0 ' + BORDER + ';margin-bottom:16px',
      card: 'margin:0 24px;padding:20px;border-radius:10px;border:1px solid ' + BORDER + ';background:#fff;display:flex;flex-direction:column',
      monthRow: 'display:flex;align-items:center;justify-content:space-between;gap:12px',
      monthNav: 'display:flex;align-items:center;gap:4px',
      navBtn: 'width:32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer',
      todayBtn: 'height:32px;padding:0 12px;border-radius:999px;background:#f2f3f6;color:#4d5159;display:inline-flex;align-items:center;font-size:13px;font-weight:700;white-space:nowrap;cursor:pointer',
      monthLabel: 'font-size:20px;font-weight:700;color:' + INK,
      icoLeft: ICO('chevron-left', 20, SUB),
      icoRight: ICO('chevron-right', 20, SUB),
      dowRow: 'margin-top:16px;display:grid;grid-template-columns:repeat(7,1fr);text-align:center',
      calGrid: 'margin-top:4px;display:grid;grid-template-columns:repeat(7,1fr)',
      dayList: 'margin-top:20px;padding-top:16px;border-top:1px solid ' + BORDER + ';display:flex;flex-direction:column;gap:8px',
      doneBadge: 'padding:2px 7px;border-radius:4px;background:' + SEC + ';color:' + MUTED + ';font-size:11px;font-weight:700;white-space:nowrap',
      timeText: 'font-size:12px;color:' + MUTED + ';font-variant-numeric:tabular-nums;white-space:nowrap',
      icoEdit: ICO('edit', 16, MUTED),
      icoTrash: ICO('trash', 16, MUTED),
      icoEditSm: ICO('edit', 14, MUTED),
      icoTrashSm: ICO('trash', 14, MUTED),
      icoCheckSm: ICO('check-fill', 14, '#fff'),

      sumRow: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px',
      donutTop: 'display:flex;align-items:center;gap:16px',
      donutWrap: 'position:relative;width:88px;height:88px;flex:0 0 88px;display:flex;align-items:center;justify-content:center',
      donutPct: 'position:absolute;font-size:16px;font-weight:700;color:' + INK + ';font-variant-numeric:tabular-nums',
      donutCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:4px',
      sumBig: 'font-size:30px;line-height:40px;font-weight:700;color:' + INK + ';font-variant-numeric:tabular-nums',
      sumRight: 'font-size:14px;color:' + MUTED + ';font-variant-numeric:tabular-nums;white-space:nowrap',
      track: 'margin-top:12px;height:8px;border-radius:999px;background:' + SEC + ';overflow:hidden',
      fill57: 'display:block;width:57%;height:100%;border-radius:999px;background:' + P,
      sumNote: 'margin-top:8px;font-size:13px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      divider: 'margin:20px 0;height:1px;background:' + BORDER,
      bRow: 'display:flex;flex-direction:column;gap:6px;padding-bottom:16px',
      bTop: 'display:flex;align-items:center;gap:8px',
      bName: 'flex:1;min-width:0;font-size:15px;font-weight:700;color:' + INK,
      bNum: 'font-size:13px;color:' + MUTED + ';font-variant-numeric:tabular-nums;white-space:nowrap',
      trackSm: 'height:6px;border-radius:999px;background:' + SEC + ';overflow:hidden',
      bFoot: 'display:flex;align-items:baseline;justify-content:space-between',
      bFootL: 'font-size:12px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      inviteRow: 'display:flex;align-items:center;justify-content:space-between;gap:12px',
      inviteCol: 'display:flex;flex-direction:column;gap:2px;min-width:0',
      inviteT: 'font-size:14px;font-weight:700;color:' + INK,
      inviteS: 'font-size:12px;color:' + MUTED,
      inviteBtn: 'height:36px;padding:0 14px;border-radius:6px;display:flex;align-items:center;background:' + P + ';color:#fff;font-size:13px;font-weight:700;white-space:nowrap',

      dimTop: 'flex:1;min-height:0;overflow:hidden;filter:blur(1px);opacity:.45;display:flex;flex-direction:column',
      cardDim: 'margin:0 24px;padding:4px 20px;border-radius:10px;border:1px solid ' + BORDER + ';background:#fff;display:flex;flex-direction:column',
      cRow: 'display:flex;align-items:center;gap:12px;min-height:60px;padding:14px 0;border-bottom:1px solid ' + SEC,
      cCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px',
      cName: 'font-size:15px;font-weight:700;color:' + INK + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
      cMeta: 'font-size:12px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      sheetForm: 'width:100%;background:#fff;border-radius:20px 20px 0 0;padding:12px 24px 28px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box',
      formHead: 'display:flex;align-items:center;justify-content:space-between;gap:12px',
      formClose: 'width:36px;height:36px;flex:0 0 36px;border-radius:999px;background:' + SEC + ';display:flex;align-items:center;justify-content:center',
      icoXsm: ICO('close-fill', 16, INK),
      formDate: 'font-size:14px;font-weight:700;color:' + P + ';font-variant-numeric:tabular-nums',
      sumRightBtn: 'display:inline-flex;align-items:center;gap:5px;font-size:14px;color:' + MUTED + ';font-variant-numeric:tabular-nums;white-space:nowrap;cursor:pointer',
      icoEditSm2: ICO('edit', 14, MUTED),
      dateInput: 'min-height:52px;border-radius:6px;box-shadow:inset 0 0 0 1.5px ;cursor:pointer' + P + ';padding:0 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer',
      dateVal: 'font-size:16px;font-weight:700;color:' + INK + ';font-variant-numeric:tabular-nums',
      icoCal: ICO('calendar', 20, P),
      modeRow: 'display:grid;grid-template-columns:1fr 1fr;gap:8px',
      modes: [
        { label: '직접 입력', sub: '금액을 적어요',
          style: 'border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:3px;cursor:pointer;background:#fff5f2;box-shadow:inset 0 0 0 1.5px ' + P,
          t: 'font-size:15px;font-weight:700;color:' + P, s: 'font-size:12px;color:' + MUTED },
        { label: 'Pick 인증', sub: '사진 한 장이면 돼요',
          style: 'border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:3px;cursor:pointer;background:' + REC,
          t: 'font-size:15px;font-weight:700;color:' + SUB, s: 'font-size:12px;color:' + MUTED }
      ],
      fieldWrap: 'display:flex;flex-direction:column;gap:6px',
      fieldLabelRow: 'display:flex;align-items:center;justify-content:space-between;gap:8px',
      fieldLabel: 'font-size:13px;color:' + SUB,
      photoAttachCell: 'display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:10px;background:' + REC,
      photoAttachCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px',
      photoAttachT: 'font-size:15px;font-weight:700;color:' + INK,
      photoAttachNote: 'font-size:12px;color:' + MUTED,
      icoCam2: ICO('camera', 26, SUB),
      mergedFields: [
        { label: '항목', value: '드레스', tag: '읽었어요', box: 'min-height:52px;border-radius:6px;background:' + REC + ';padding:14px;display:flex;align-items:center;font-size:16px;color:' + INK,
          tagStyle: 'padding:3px 8px;border-radius:4px;font-size:12px;font-weight:700;white-space:nowrap;background:' + BORDER + ';color:' + MUTED },
        { label: '예산', value: '400만원', tag: '확인 필요', hint: '패키지 구성에 따라 달라질 수 있어요',
          box: 'min-height:52px;border-radius:6px;padding:14px;display:flex;align-items:center;font-size:16px;color:' + INK + ';box-shadow:inset 0 0 0 1.5px ' + P,
          tagStyle: 'padding:3px 8px;border-radius:4px;font-size:12px;font-weight:700;white-space:nowrap;background:' + P + ';color:#fff' },
        { label: '낸 금액', value: '154만원', tag: '읽었어요', box: 'min-height:52px;border-radius:6px;background:' + REC + ';padding:14px;display:flex;align-items:center;font-size:16px;color:' + INK,
          tagStyle: 'padding:3px 8px;border-radius:4px;font-size:12px;font-weight:700;white-space:nowrap;background:' + BORDER + ';color:' + MUTED }
      ],
      toggleRow: 'display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px',
      toggleLabel: 'font-size:15px;color:' + INK,
      knob: 'width:26px;height:26px;border-radius:999px;background:#fff',
      btnPrimaryFull: 'width:100%;height:56px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:' + P + ';color:#fff;font-size:18px;font-weight:700',
      autoRow: 'display:flex;justify-content:stretch',
      autoBtn: 'width:100%;height:44px;border-radius:6px;background:#fff5f2;box-shadow:inset 0 0 0 1.5px ' + P + ';color:' + P + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700',
      cListHead: 'display:flex;flex-direction:column;gap:3px',
      cListTitle: 'font-size:20px;font-weight:700;color:' + INK,
      cListNote: 'font-size:13px;color:' + MUTED,
      icoRightSm: ICO('chevron-right', 16, '#adb1ba'),
      uploadBox: 'margin-top:8px;padding:28px 20px;border-radius:10px;border:1px dashed #dcdee3;display:flex;flex-direction:column;align-items:center;gap:6px',
      icoMic: ICO('mic', 22, MUTED),
      uploadT: 'font-size:15px;font-weight:700;color:' + INK,
      uploadS: 'font-size:13px;color:' + MUTED + ';text-align:center',

      sheetWrap: 'position:absolute;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-end',
      sheet: 'width:100%;max-height:800px;background:#fff;border-radius:20px 20px 0 0;padding:12px 24px 28px;display:flex;flex-direction:column;gap:14px;box-sizing:border-box',
      certSheet: 'position:absolute;left:0;right:0;bottom:0;max-height:78%;background:#fff;border-radius:20px 20px 0 0;padding:12px 0 0;display:flex;flex-direction:column',
      ddayCard: 'margin:4px 24px 0;padding:18px 20px;border-radius:12px;background:' + REC + ';display:flex;flex-direction:column;gap:5px',
      ddayTop: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px',
      ddayDate: 'font-size:19px;font-weight:700;color:' + INK + ';font-variant-numeric:tabular-nums',
      ddayNum: 'font-size:19px;font-weight:700;color:' + P + ';font-variant-numeric:tabular-nums',
      ddayNote: 'font-size:13px;color:' + SUB + ';font-variant-numeric:tabular-nums',
      decidedLinkRow: 'margin-top:10px;padding-top:10px;display:flex;align-items:center;justify-content:space-between;box-shadow:inset 0 1px 0 ' + BORDER,
      decidedLinkT: 'font-size:14px;font-weight:700;color:' + INK,
      icoChevSm: ICO('chevron-right', 18, MUTED),
      pastRow: 'margin:0 24px;min-height:46px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:inset 0 -1px 0 ' + BORDER,
      pastText: 'font-size:14px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      pastBtn: 'font-size:14px;font-weight:700;color:' + SUB,
      tlWrap: 'padding:0 24px;display:flex;flex-direction:column',
      tlG: 'display:flex;flex-direction:column',
      tlHead: 'display:flex;align-items:baseline;gap:8px;padding:18px 0 10px',
      tlTitle: 'font-size:15px;font-weight:700;color:' + INK,
      tlRange: 'font-size:13px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      tlRow: 'display:flex;gap:12px;padding-bottom:8px',
      tlRail: 'width:12px;flex:0 0 12px;display:flex;flex-direction:column;align-items:center;gap:6px',
      tlLine: 'flex:1;width:1px;min-height:6px;background:' + BORDER,
      tlGroups: [
        { title: '이번 주', range: '9.22~9.27 · D-236', items: [
          tlItem('9.23(수) 15:00', '강남 A 스튜디오 상담', '', 'next'),
          tlItem('9.26(토) 11:00', '청담 E 웨딩홀 투어', '가족 2명 같이 가요', 'next')
        ] },
        { title: '다음 주', range: '9.28~10.4 · D-229', items: [
          tlItem('9.30(수)', '드레스 투어 3곳 예약하기', '', 'next')
        ] },
        { title: '10월 2주', range: '10.5~10.11 · D-222', items: [
          tlItem('10.7(수)', '웨딩홀 계약금 입금', '예산현황에 지출로 들어가요', 'next'),
          tlItem('10.9(금)', '상견례 날짜 정하기', '', 'done')
        ] },
        { title: '11월', range: 'D-180 구간', items: [
          tlItem('11.14(토)', '스튜디오 촬영일 확정', '', 'next')
        ] },
        { title: '예식', range: '', items: [
          tlItem('2027.05.16(토)', '예식일', '', 'wed')
        ] }
      ],
      certFull: 'flex:1;min-height:0;background:#fff;display:flex;flex-direction:column',
      certNav: 'flex:0 0 56px;display:flex;align-items:center;gap:8px;padding:0 16px;box-shadow:inset 0 -1px 0 ' + BORDER,
      navClose: 'width:36px;height:36px;flex:0 0 36px;border-radius:999px;background:' + SEC + ';display:flex;align-items:center;justify-content:center',
      certScroll: 'flex:1;min-height:0;overflow-y:auto;scrollbar-width:none',
      grab: 'width:40px;height:4px;border-radius:999px;background:' + BORDER + ';align-self:center',
      sheetNote: 'padding:12px 16px;border-radius:10px;background:' + REC,
      sheetNoteText: 'font-size:13px;line-height:19px;color:' + SUB,
      sheetHead: 'display:flex;flex-direction:column;gap:3px',
      sheetTitle: 'font-size:20px;font-weight:700;color:' + INK,
      sheetSub: 'font-size:14px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      sheetBody: 'flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:16px;scrollbar-width:none',
      aBlock: 'display:flex;flex-direction:column;gap:8px',
      aRow: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px',
      aText: 'flex:1;font-size:14px;line-height:20px;color:' + INK + ';text-wrap:pretty',
      aVal: 'font-size:13px;color:' + MUTED + ';font-variant-numeric:tabular-nums;white-space:nowrap',
      sheetDock: 'display:flex;gap:8px;padding-top:4px',
      btnGhost: 'flex:1;height:52px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:' + SEC + ';color:' + SUB + ';font-size:16px;font-weight:700',
      btnPrimary: 'flex:1.4;height:52px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:' + P + ';color:#fff;font-size:16px;font-weight:700',

      tabBar: 'flex:0 0 72px;display:flex;box-shadow:inset 0 1px 0 ' + BORDER + ';background:#fff;padding-top:9px',
      tabCell: 'flex:1;display:flex;flex-direction:column;align-items:center;gap:3px',

      diffCard: 'width:900px;background:#fff;border-radius:10px;border:1px solid ' + BORDER + ';padding:8px 24px 16px;display:flex;flex-direction:column;box-sizing:border-box',
      diffHead: 'display:flex;gap:16px;min-height:44px;align-items:center;border-bottom:1px solid #dcdee3',
      diffRow: 'display:flex;gap:16px;min-height:52px;padding:13px 0;align-items:flex-start;border-bottom:1px solid ' + SEC,
      dh1: 'width:110px;flex:0 0 110px;font-size:12px;font-weight:700;color:' + MUTED,
      dh2: 'width:250px;flex:0 0 250px;font-size:12px;font-weight:700;color:' + MUTED,
      dh3: 'width:250px;flex:0 0 250px;font-size:12px;font-weight:700;color:' + MUTED,
      dh4: 'width:190px;flex:0 0 190px;font-size:12px;font-weight:700;color:' + MUTED,
      dc1: 'width:110px;flex:0 0 110px;font-size:13px;line-height:20px;font-weight:700;color:' + INK,
      dc2: 'width:250px;flex:0 0 250px;font-size:13px;line-height:20px;color:' + SUB,

      tabsA: [seg({ l: '웨딩일정', a: true }), seg({ l: '상담기록', a: false }), seg({ l: '예산현황', a: false })],
      tabsB: [seg({ l: '웨딩일정', a: false }), seg({ l: '상담기록', a: false }), seg({ l: '예산현황', a: true })],
      tabsC: [seg({ l: '웨딩일정', a: false }), seg({ l: '상담기록', a: true }), seg({ l: '예산현황', a: false })],
      dow: '일월화수목금토'.split('').map((l, i) => ({ l, style: 'font-size:12px;font-weight:700;color:' + (i === 0 ? P : MUTED) })),
      days: [day('', {}), day('', {})].concat(Array.from({ length: 30 }, (_, i) => day(i + 1, { sel: i + 1 === 12, dot: [12, 18, 25].includes(i + 1) }))),
      dayEvents: [ev('드레스 피팅', '14:00', false), ev('청첩장 인쇄', '10:00', true)],
      budgets: [bd('웨딩홀', 1000, 1000), bd('스드메', 0, 750), bd('본식', 0, 180), bd('예물 · 신혼', 0, 1200)],
      consults: [
        cs('블루밍 스튜디오', '9월 14일 · 180만원', '정리 완료', 'done'),
        cs('그레이스 웨딩홀', '9월 10일 · 450만원', '저장됨', 'saved'),
        cs('청담 헤메', '9월 16일', '정리하고 있어요', 'work')
      ],
      eventFields: [fld('제목', '드레스 피팅'), fld('시간', '오후 2시')],
      budgetFields: [fld('항목', '드레스'), fld('예산', '400만원'), fld('낸 금액', '아직 안 냈어요', true)],
      alarmRows: [tg('하루 전에 알려주기', true), tg('두 시간 전에 알려주기', true), tg('준호님에게도 알려주기', true)],
      analysis: [
        ab('포함', [{ k: '기본 촬영 6시간' }, { k: '앨범 1권 · 30p' }, { k: '원본 파일 전체' }, { k: '메이크업 1회' }]),
        ab('별도로 확인할 비용', [{ k: '추가 앨범', v: '20만원' }, { k: '드레스 추가 컷', v: '10만원/컷' }]),
        ab('진행 조건', [{ k: '예약금 30만원 · 잔금은 촬영 2주 전', v: '' }, { k: '촬영 1개월 전까지 1회 변경 가능', v: '' }]),
        ab('취소 · 환불', [{ k: '촬영 1개월 전 취소 시 예약금 50% 환불' }]),
        ab('확인 필요', [{ k: '메이크업 추가 비용이 적혀 있지 않아요' }], true)
      ],
      tabs: [tab('home', '홈', false), tab('search', '검색', false), tab('heart', 'Pick', false), tab('calendar', '웨딩노트', true), tab('profile', 'MY', false)],
      diffs: [
        diff('색 · 서체', 'Playfair · DM Mono · 로즈 #e7898d', '시스템 서체 · 코랄 #FF6F61', '정본 토큰 고정'),
        diff('AI 표현', 'AI 분석 중 · AI가 정리했어요', '정리하고 있어요 · 정리했어요', '사용자 화면 AI 금지'),
        diff('제보 진입', '가격 제보하기 · 검은 배너 + 아이콘', 'Pick 인증 · 하단 한 줄', '용어 · 우선순위'),
        diff('예산 그래프', 'conic-gradient 도넛 112px', '가로 진행바 8px', '정본은 원형 그래프 없음'),
        diff('추가 버튼', '우하단 FAB 56px 코랄', '헤더 우측 «추가» 텍스트', '중앙 FAB 금지'),
        diff('금액 단위', '1,000 / 1,000만', '1,000 / 1,000만원', '단위 생략 금지'),
        diff('분석 라벨', '추가 비용 · 상담 조건', '별도로 확인할 비용 · 진행 조건', '용어사전'),
        diff('상담 기능', '녹음 업로드 → 자동 정리 · 신규', '정본에 없음 — 추가할지 결정 필요', '정책 결정 대기', 'open'),
        diff('금액 출처', '상담 정리 금액이 예산에 직접 들어감', '실 제보와 분리할지 결정 필요', '정책 결정 대기', 'open')
      ]
    };
  }
}


export default Component;
