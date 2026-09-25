import { DesignModel } from "../runtime/designRuntime.js";

class Component extends DesignModel {
  renderVals() {
    const P = '#ff6f61';
    const INK = '#212124';
    const SUB = '#4d5159';
    const MUTED = '#868b94';
    const DIM = '#adb1ba';
    const SEC = '#f2f3f6';
    const REC = '#f7f8fa';
    const BORDER = '#eaebee';
    const AMBER = '#805217';
    const GREEN = '#1aa174';
    const DS = 'assets/seed-icons/';
    const ICO = (n, sz, c) => 'display:inline-block;width:' + sz + 'px;height:' + sz + 'px;flex:0 0 ' + sz + 'px;background-color:' + c
      + ';-webkit-mask:url(' + DS + n + '.svg) center/contain no-repeat;mask:url(' + DS + n + '.svg) center/contain no-repeat';

    const IMG = {
      urban: 'uploads/스타일 이미지/urban.png',
      natural: 'uploads/스타일 이미지/natural.png',
      romantic: 'uploads/스타일 이미지/romantic.png',
      glam: 'uploads/스타일 이미지/glamorous.png'
    };

    const seg = (label, on) => ({ label,
      style: 'flex:1;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;cursor:pointer;'
        + (on ? 'background:#fff;color:' + INK + ';box-shadow:0 1px 3px rgba(0,27,55,.10);' : 'color:' + MUTED + ';') });

    const cat = (label, on) => ({ label,
      style: 'flex:0 0 auto;height:34px;padding:0 14px;border-radius:999px;display:inline-flex;align-items:center;font-size:13px;font-weight:700;white-space:nowrap;cursor:pointer;'
        + (on ? 'background:' + INK + ';color:#fff;' : 'background:' + SEC + ';color:' + SUB + ';') });

    const FILLED = ['home', 'search', 'heart', 'profile'];
    const tab = (icon, text, on) => ({ icon: ICO(on && FILLED.indexOf(icon) >= 0 ? icon + '-fill' : icon, 24, on ? INK : MUTED), text,
      label: 'font-size:12px;line-height:16px;font-weight:700;color:' + (on ? INK : MUTED) });

    const STAR_PATH2 = 'M12 2.5l2.9 6 6.6.7-4.9 4.5 1.3 6.5L12 16.9l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.7Z';
    const STARROW2 = (n, sz) => Array.from({ length: 5 }, (_, i) => ({
      style: 'width:' + sz + 'px;height:' + sz + 'px;flex:0 0 ' + sz + 'px;display:inline-block;'
        + '-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'' + STAR_PATH2 + '\'/%3E%3C/svg%3E") center/contain no-repeat;'
        + 'mask:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'' + STAR_PATH2 + '\'/%3E%3C/svg%3E") center/contain no-repeat;'
        + 'background-color:' + (i < n ? P : '#dcdee3') }));
    const rev = (id, src, mark, author, vendor, time, verified, answers, text, likes, comments, liked, stars) => ({
      id, src, mark, author, vendor, time, verified, answers, text, likes, comments, stars: STARROW2(stars || 5, 14),
      likeStyle: 'display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:700;color:' + (liked ? P : SUB),
      likeIcon: ICO(liked ? 'heart-fill' : 'heart', 18, liked ? P : SUB) });

    const guide = (id, src, cat2, title, meta) => ({ id, src, cat: cat2, title, meta });

    const expo = (title, date, place, dday, tag, img, id, past) => ({ title, date, place, dday, tag, img, id,
      thumbCell: 'width:64px;height:64px;flex:0 0 64px;border-radius:8px;overflow:hidden;position:relative',
      card: 'border-radius:10px;padding:16px 20px;display:flex;flex-direction:column;gap:12px;' + (past ? 'background:' + REC + ';' : 'border:1px solid ' + BORDER + ';background:#fff;'),
      nameStyle: 'font-size:16px;font-weight:700;color:' + (past ? DIM : INK),
      ddayStyle: 'font-size:14px;font-weight:700;white-space:nowrap;color:' + (past ? DIM : P),
      tagStyle: 'align-self:flex-start;height:28px;padding:0 10px;border-radius:999px;background:' + SEC + ';color:' + SUB + ';display:inline-flex;align-items:center;font-size:12px;font-weight:700' });

    const ROW = (last) => 'display:flex;align-items:center;gap:12px;min-height:52px;padding:0 20px;' + (last ? '' : 'box-shadow:inset 0 -1px 0 ' + BORDER + ';');
    const my = (label, icon, o) => {
      o = o || {};
      return { label, icon: ICO(icon, 18, MUTED), count: o.count || '',
        toggle: o.toggle || '', arrow: !o.toggle,
        rowStyle: ROW(o.last),
        track: o.toggle === 'on'
          ? 'width:44px;height:26px;flex:0 0 44px;border-radius:999px;background:' + P + ';display:flex;align-items:center;justify-content:flex-end;padding:0 3px;box-sizing:border-box'
          : 'width:44px;height:26px;flex:0 0 44px;border-radius:999px;background:#dcdee3;display:flex;align-items:center;padding:0 3px;box-sizing:border-box' };
    };
    const tgl = (label, on, last) => ({ label, rowStyle: ROW(last),
      track: on
        ? 'width:44px;height:26px;flex:0 0 44px;border-radius:999px;background:' + P + ';display:flex;align-items:center;justify-content:flex-end;padding:0 3px;box-sizing:border-box'
        : 'width:44px;height:26px;flex:0 0 44px;border-radius:999px;background:#dcdee3;display:flex;align-items:center;padding:0 3px;box-sizing:border-box' });

    const badgeS = k => 'padding:4px 9px;border-radius:4px;font-size:12px;font-weight:700;white-space:nowrap;'
      + (k === 'ok' ? 'background:#e8faf6;color:' + GREEN + ';'
        : k === 'warn' ? 'background:#ffe3ba;color:' + AMBER + ';'
          : k === 'no' ? 'background:#ffe5e3;color:#e81607;' : 'background:' + SEC + ';color:' + SUB + ';');

    const cert = (state, kind, date, name, amount, note, action) => ({ state, date, name, amount, note, action: action || '',
      badge: badgeS(kind),
      amtStyle: 'font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;color:' + (amount === '—' ? DIM : INK) });

    const stat = (n, k, kind) => ({ n, k,
      numStyle: 'font-size:24px;font-weight:700;font-variant-numeric:tabular-nums;color:' + (kind === 'ok' ? GREEN : kind === 'warn' ? AMBER : INK) });

    const mr = (id, src, name, meta, badge, last) => ({ id, src, name, meta, badge: badge || '', rowStyle: 'display:flex;align-items:center;gap:12px;min-height:72px;padding:12px 16px;' + (last ? '' : 'box-shadow:inset 0 -1px 0 ' + BORDER + ';') });

    const RADIO = on => 'width:22px;height:22px;flex:0 0 22px;border-radius:999px;'
      + (on
        ? 'background:' + P + ';background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'3.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m5 12.5 4.5 4.5L19 7.5\'/%3E%3C/svg%3E");background-size:14px;background-position:center;background-repeat:no-repeat'
        : 'box-shadow:inset 0 0 0 1.5px #dcdee3');
    const LI = (last) => 'display:flex;align-items:center;gap:12px;min-height:52px;padding:0 16px;' + (last ? '' : 'box-shadow:inset 0 -1px 0 ' + BORDER + ';');
    const li = (label, last) => ({ label, rowStyle: LI(last) });
    const li2 = (label, sub, last) => ({ label, sub, rowStyle: 'display:flex;align-items:center;gap:12px;min-height:64px;padding:0 16px;' + (last ? '' : 'box-shadow:inset 0 -1px 0 ' + BORDER + ';') });
    const kv = (k, v, last) => ({ k, v, rowStyle: LI(last) });
    const skin = (label, color, on, last) => ({ label, mark: RADIO(!!on), rowStyle: LI(last),
      dot: 'width:22px;height:22px;flex:0 0 22px;border-radius:999px;background:' + color });
    const noti = (label, sub, on, last) => ({ label, sub, rowStyle: LI(last),
      track: on
        ? 'width:44px;height:26px;flex:0 0 44px;border-radius:999px;background:' + P + ';display:flex;align-items:center;justify-content:flex-end;padding:0 3px;box-sizing:border-box'
        : 'width:44px;height:26px;flex:0 0 44px;border-radius:999px;background:#dcdee3;display:flex;align-items:center;padding:0 3px;box-sizing:border-box' });
    const faq = (q, a, last) => ({ q, a: a || '',
      wrap: 'display:flex;flex-direction:column;gap:10px;padding:16px;' + (last ? '' : 'box-shadow:inset 0 -1px 0 ' + BORDER + ';'),
      icon: ICO('chevron-right', 18, DIM) + (a ? ';transform:rotate(90deg)' : '') });
    const styleCard = (id, src, label, on) => ({ id, src, label, on,
      cell: 'position:relative;height:186px;border-radius:10px;overflow:hidden;' + (on ? 'box-shadow:inset 0 0 0 2.5px ' + P + ';' : ''),
      shade: 'position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,.45) 100%)' });
    const ax = (q, opts, sel) => ({ q,
      opts: opts.map((label, i) => ({ label,
        style: 'flex:1;height:44px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;text-align:center;'
          + (i === sel ? 'background:#fff5f2;color:' + P + ';box-shadow:inset 0 0 0 1.5px ' + P + ';' : 'background:' + SEC + ';color:' + SUB + ';') })) });
    const styleBtn2 = (label, desc, on) => ({ label, desc,
      card: 'min-height:72px;padding:16px 18px;border-radius:10px;display:flex;align-items:center;gap:12px;box-sizing:border-box;'
        + (on ? 'background:#fff5f2;box-shadow:inset 0 0 0 1.5px ' + P + ';' : 'background:' + REC + ';'),
      nameStyle: 'font-size:17px;font-weight:700;color:' + (on ? P : INK),
      mark: on
        ? 'width:24px;height:24px;flex:0 0 24px;border-radius:999px;background:' + P + ';background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'3.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m5 12.5 4.5 4.5L19 7.5\'/%3E%3C/svg%3E");background-size:14px;background-position:center;background-repeat:no-repeat'
        : 'width:24px;height:24px;flex:0 0 24px;border-radius:999px;box-shadow:inset 0 0 0 1.5px #dcdee3' });
    const diff = (k, a, b, why, warn) => ({ k, a, b, why,
      bStyle: 'width:270px;flex:0 0 270px;font-size:13px;line-height:20px;font-weight:700;color:' + (warn ? AMBER : INK) });

    return {
      grp: 'display:flex;flex-direction:column;gap:24px',
      c1: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c9: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c10: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c11: 'display:flex;flex-direction:column;gap:10px;width:430px',
      cW12: 'display:flex;flex-direction:column;gap:10px;width:900px',
      c13: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c14: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c15: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c16: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c17: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c18: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c19: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c20: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c21: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c22: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c23: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c24: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c25: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c2: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c3: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c4: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c5: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c6: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c7: 'display:flex;flex-direction:column;gap:10px;width:430px',
      c8: 'display:flex;flex-direction:column;gap:10px;width:430px',
      root: 'display:flex;flex-direction:column;gap:32px;padding:64px;width:max-content',
      intro: 'display:flex;flex-direction:column;gap:10px;max-width:960px',
      eyebrow: 'font-size:14px;line-height:19px;font-weight:700;color:' + P,
      h0: 'font-size:40px;line-height:52px;font-weight:700;color:' + INK,
      lead: 'font-size:17px;line-height:26px;color:' + SUB + ';text-wrap:pretty',
      row: 'display:flex;gap:36px;align-items:flex-start;flex-wrap:wrap',
      col: 'display:flex;flex-direction:column;gap:10px;width:430px',
      colWide: 'display:flex;flex-direction:column;gap:10px;width:900px',
      tag: 'height:26px;display:flex;align-items:center;gap:8px;font-size:18px;font-weight:700;color:' + INK + ';white-space:nowrap',
      tagRow: 'height:26px;display:flex;align-items:center;gap:8px;white-space:nowrap',
      tagText: 'font-size:18px;font-weight:700;color:' + INK,
      tagId: 'width:26px;height:26px;flex:0 0 26px;border-radius:6px;background:' + INK + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700',
      tagIdWide: 'height:26px;flex:0 0 auto;padding:0 8px;border-radius:6px;background:' + MUTED + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;white-space:nowrap',
      tagDesc: 'height:66px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;line-height:21px;color:' + SUB + ';text-wrap:pretty',

      phone: 'width:430px;height:932px;border-radius:40px;overflow:hidden;position:relative;display:flex;flex-direction:column;background:#fff;box-shadow:0 15px 75px rgba(0,27,55,.14)',
      bar: 'flex:0 0 44px;display:flex;align-items:center;padding:0 26px;font-size:14px;font-weight:700;color:' + INK,
      head: 'flex:0 0 56px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 20px',
      h1: 'font-size:26px;font-weight:700;color:' + INK,
      headAct: 'font-size:15px;font-weight:700;color:' + P,
      navBar: 'flex:0 0 56px;display:flex;align-items:center;gap:8px;padding:0 16px;box-shadow:inset 0 -1px 0 ' + BORDER,
      navTitle: 'flex:1;min-width:0;text-align:center;font-size:16px;font-weight:700;color:' + INK,
      navPad: 'width:36px;flex:0 0 36px',
      icoBack: ICO('chevron-left', 24, INK) + ';width:36px;flex:0 0 36px;-webkit-mask-size:24px;mask-size:24px',
      icoRight: ICO('chevron-right', 16, DIM),
      icoChat: ICO('chatting', 18, SUB),
      scroll: 'flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;padding-top:16px;scrollbar-width:none',

      segWrap: 'flex:0 0 auto;margin:0 20px 12px;padding:4px;border-radius:10px;background:' + SEC + ';display:flex;gap:2px',
      segReview: [seg('후기', true), seg('웨딩정보', false), seg('박람회', false)],
      segFeed: [seg('후기', false), seg('웨딩정보', true), seg('박람회', false)],
      segExpo: [seg('후기', false), seg('웨딩정보', false), seg('박람회', true)],
      chipBar: 'flex:0 0 auto;display:flex;gap:8px;padding:0 20px 14px;overflow-x:auto;scrollbar-width:none',
      cats: [cat('전체', true), cat('웨딩홀'), cat('스드메'), cat('본식'), cat('예물 · 신혼'), cat('예산')],

      tabBar: 'flex:0 0 76px;display:flex;padding-top:8px;box-shadow:inset 0 1px 0 ' + BORDER,
      tabCell: 'flex:1;display:flex;flex-direction:column;align-items:center;gap:4px',
      tabsLounge: [tab('home', '홈', false), tab('search', '검색', false), tab('heart', 'Pick', false), tab('calendar', '웨딩노트', false), tab('profile', 'MY', false)],
      tabsMy: [tab('home', '홈', false), tab('search', '검색', false), tab('heart', 'Pick', false), tab('calendar', '웨딩노트', false), tab('profile', 'MY', true)],

      revCard: 'flex:0 0 auto;padding:18px 20px;display:flex;flex-direction:column;gap:12px;box-shadow:inset 0 -1px 0 ' + BORDER,
      revHead: 'display:flex;align-items:center;gap:10px',
      revAvatar: 'width:40px;height:40px;flex:0 0 40px;border-radius:999px;background:' + SEC + ';display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:' + SUB,
      revNameCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px',
      revNameRow: 'display:flex;align-items:center;gap:6px',
      revName: 'font-size:15px;font-weight:700;color:' + INK,
      revMeta: 'font-size:12px;color:' + MUTED,
      badgeVerify: 'padding:3px 8px;border-radius:4px;background:#e8faf6;color:' + GREEN + ';font-size:11px;font-weight:700;white-space:nowrap',
      badgeWarn: 'padding:3px 8px;border-radius:4px;background:#ffe3ba;color:' + AMBER + ';font-size:11px;font-weight:700;white-space:nowrap',
      revAnswers: 'display:flex;flex-wrap:wrap;gap:6px',
      revChip: 'height:26px;padding:0 10px;border-radius:999px;background:' + REC + ';display:inline-flex;align-items:center;font-size:12px;font-weight:700;color:' + SUB,
      revImg: 'position:relative;width:100%;height:240px;border-radius:10px;overflow:hidden',
      revText: 'font-size:15px;line-height:24px;color:' + SUB + ';text-wrap:pretty',
      revFoot: 'display:flex;align-items:center;gap:18px',
      revCmt: 'display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:700;color:' + SUB,
      reviews: [
        rev('lr-1', IMG.urban, '수', '수아와 도윤', '강남 A 스튜디오', '2시간 전', true,
          ['빨랐어요', '기대 이상', '명확했어요'],
          '세 곳을 비교하고 정했어요. 최종 금액도 웨딩픽에서 본 범위 안이었습니다.', 42, 8, true, 5),
        rev('lr-2', IMG.romantic, '하', '하린과 우진', '라비드레스', '1일 전', false,
          ['적당했어요', '기대만큼', '보통이었어요'],
          '피팅 전에 원하는 실루엣 세 장만 정해 갔어요. 생각이 명확할수록 빨랐습니다.', 29, 4, false, 4)
      ],

      guideRow: 'flex:0 0 auto;display:flex;gap:14px;padding:16px 20px;box-shadow:inset 0 -1px 0 ' + BORDER,
      guideThumb: 'width:88px;height:88px;flex:0 0 88px;border-radius:10px;overflow:hidden;position:relative',
      guideCol: 'flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px',
      guideCat: 'font-size:12px;font-weight:700;color:' + P,
      guideTitle: 'font-size:15px;line-height:22px;font-weight:700;color:' + INK + ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden',
      guideMeta: 'font-size:12px;color:' + MUTED,
      guides: [
        guide('lg-1', IMG.romantic, '드레스', '첫 피팅 전에 물어볼 여섯 가지', '읽는 데 4분'),
        guide('lg-2', IMG.glam, '예산', '추가금을 줄이는 계약서 확인 항목', '읽는 데 5분'),
        guide('lg-3', IMG.natural, '일정', '본식 4개월 전, 무엇부터 할까', '읽는 데 3분'),
        guide('lg-4', IMG.urban, '스튜디오', '원본을 전부 받는 게 왜 중요한가', '읽는 데 3분')
      ],

      sec: 'flex:0 0 auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:12px',
      secFoot: 'flex:0 0 auto;padding:4px 20px 0;display:flex;flex-direction:column;align-items:center;gap:14px',
      secLabel: 'font-size:13px;font-weight:700;color:' + MUTED,
      note: 'font-size:13px;line-height:20px;color:' + MUTED + ';text-wrap:pretty',
      expoHead: 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px',
      expoCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:4px',
      expoMeta: 'font-size:13px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      expos: [
        expo('더 웨딩페어 코엑스', '9월 19일~20일', '코엑스 D홀', 'D-2', '사전등록 무료', IMG.urban, 'expo-t1'),
        expo('더현대 서울 웨딩위크', '9월 26일~27일', '더현대 서울 6층', 'D-9', '드레스 쇼케이스', IMG.romantic, 'expo-t2'),
        expo('강남 웨딩박람회', '8월 30일 종료', '세텍', '종료', '', IMG.natural, 'expo-t3', true)
      ],

      profCard: 'border-radius:10px;border:1px solid ' + BORDER + ';background:#fff;display:flex;flex-direction:column',
      profTop: 'display:flex;align-items:center;gap:14px;padding:18px',
      profAvatar: 'width:52px;height:52px;flex:0 0 52px;border-radius:999px;background:#fff5f2;color:' + P + ';display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700',
      profCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:4px',
      profNameRow: 'display:flex;align-items:center;gap:7px',
      profName: 'font-size:18px;font-weight:700;color:' + INK,
      profSub: 'font-size:13px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      profDiv: 'height:1px;background:' + BORDER,
      profRow: 'display:flex;align-items:center;gap:12px;min-height:52px;padding:0 18px',
      profRowT: 'flex:1;font-size:15px;color:' + INK,

      listCard: 'border-radius:10px;border:1px solid ' + BORDER + ';background:#fff;display:flex;flex-direction:column;overflow:hidden',
      myLabel: 'flex:1;min-width:0;font-size:15px;color:' + INK + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
      myLabelDim: 'flex:1;min-width:0;font-size:15px;color:' + DIM,
      myCount: 'font-size:14px;font-weight:700;color:' + P + ';font-variant-numeric:tabular-nums',
      knob: 'width:20px;height:20px;border-radius:999px;background:#fff',
      rowPlain: 'display:flex;align-items:center;gap:12px;min-height:52px;padding:0 20px;box-shadow:inset 0 -1px 0 ' + BORDER,
      rowPlainLast: 'display:flex;align-items:center;gap:12px;min-height:52px;padding:0 20px',
      mySections: [
        { title: '내 활동', rows: [
          my('Pick 인증내역', 'check-fill', { count: '4' }),
          my('내가 쓴 후기', 'edit', { count: '2', last: true })
        ] },
        { title: '함께 준비하기', rows: [
          my('연결관리', 'community', { count: '연결됨', last: true })
        ] },
        { title: '라운지', rows: [
          my('리얼후기', 'chatting'),
          my('웨딩정보', 'photo'),
          my('박람회', 'calendar', { last: true })
        ] },
        { title: '고객지원', rows: [
          my('FAQ', 'chatting'),
          my('문의하기', 'edit', { count: '1', last: true })
        ] },
        { title: '약관', rows: [
          my('이용약관', 'bookmark'),
          my('개인정보처리방침', 'bookmark', { last: true })
        ] }
      ],
      verRow: 'font-size:13px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      logout: 'font-size:13px;color:' + DIM + ';text-decoration:underline',

      statRow: 'display:flex;gap:10px',
      statCell: 'flex:1;border-radius:10px;background:' + REC + ';padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:3px',
      statLabel: 'font-size:12px;color:' + MUTED + ';white-space:nowrap',
      certStats: [stat('4', '반영됨', 'ok'), stat('1', '확인 중'), stat('1', '보완 필요', 'warn')],
      certCard: 'border-radius:10px;border:1px solid ' + BORDER + ';padding:16px 18px;display:flex;flex-direction:column;gap:8px',
      certHead: 'display:flex;align-items:center;justify-content:space-between;gap:12px',
      certDate: 'font-size:12px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      certBody: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px',
      certName: 'flex:1;min-width:0;font-size:16px;font-weight:700;color:' + INK + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
      certNote: 'font-size:13px;line-height:20px;color:' + MUTED + ';text-wrap:pretty',
      certBtn: 'align-self:flex-start;height:36px;padding:0 14px;border-radius:6px;background:' + P + ';color:#fff;display:inline-flex;align-items:center;font-size:14px;font-weight:700',
      certs: [
        cert('반영됨', 'ok', '8월 28일', '강남 A 스튜디오', '168만원', '실 제보에 반영됐어요. 이제 Pick 인증 회원이에요.'),
        cert('확인 중', 'warn', '8월 30일', '라비드레스', '112만원', '금액과 자료가 맞는지 보고 있어요.'),
        cert('보완 필요', 'warn', '8월 25일', '메종 브라이드', '—', '사진에서 날짜를 찾지 못했어요. 날짜만 알려주시면 바로 처리돼요.', '날짜 입력하기'),
        cert('안 됐어요', 'no', '8월 12일', '청담 D 스튜디오', '—', '같은 자료가 이미 등록돼 있어요.')
      ],

      coupleCard: 'border-radius:10px;background:#fff5f2;padding:18px;display:flex;align-items:center;gap:14px',
      coupleAvatars: 'display:flex;align-items:center;flex:0 0 auto',
      av1: 'width:44px;height:44px;border-radius:999px;background:#ffe8e4;color:' + P + ';display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700',
      av2: 'width:44px;height:44px;border-radius:999px;background:#fff;color:' + SUB + ';display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;margin-left:-12px;box-shadow:0 0 0 3px #fff5f2',
      coupleCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:4px',
      coupleName: 'font-size:16px;font-weight:700;color:' + INK,
      coupleMeta: 'font-size:13px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      shareOn: [tgl('고른 곳', true), tgl('일정', true), tgl('지출', true), tgl('메모', true, true)],
      shareOff: [tgl('검색 기록', false), tgl('알림설정', false, true)],

      setCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px',
      setK: 'font-size:13px;color:' + MUTED,
      setV: 'font-size:15px;font-weight:700;color:' + INK + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
      weddingSet: [
        { k: '예식일', v: '2027.05.16(토)', rowStyle: 'display:flex;align-items:center;gap:12px;min-height:64px;padding:0 16px;box-shadow:inset 0 -1px 0 ' + BORDER },
        { k: '지역', v: '서울 강남구', rowStyle: 'display:flex;align-items:center;gap:12px;min-height:64px;padding:0 16px;box-shadow:inset 0 -1px 0 ' + BORDER },
        { k: '준비 현황', v: '웨딩홀', rowStyle: 'display:flex;align-items:center;gap:12px;min-height:64px;padding:0 16px;box-shadow:inset 0 -1px 0 ' + BORDER },
        { k: '예산', v: '5,000만원', rowStyle: 'display:flex;align-items:center;gap:12px;min-height:64px;padding:0 16px;box-shadow:inset 0 -1px 0 ' + BORDER },
        { k: '스타일', v: '도시적인 · 로맨틱한', rowStyle: 'display:flex;align-items:center;gap:12px;min-height:64px;padding:0 16px' }
      ],
      noteBox: 'border-radius:10px;background:' + REC + ';padding:18px;display:flex;flex-direction:column;gap:5px',
      noteT: 'font-size:15px;font-weight:700;color:' + INK,
      noteS: 'font-size:13px;line-height:20px;color:' + MUTED,

      mrThumb: 'width:48px;height:48px;flex:0 0 48px;border-radius:8px;overflow:hidden;position:relative',
      mrCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px',
      mrName: 'font-size:15px;font-weight:700;color:' + INK + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
      mrMeta: 'font-size:12px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      writeBtn: 'height:32px;padding:0 14px;border-radius:6px;background:' + P + ';color:#fff;display:inline-flex;align-items:center;font-size:13px;font-weight:700;white-space:nowrap',
      myReviews: [
        mr('mv-1', IMG.urban, '강남 A 스튜디오', '2026.09 · 도움돼요 14', '반론 1'),
        mr('mv-2', IMG.glam, '더채플 강남', '2026.03 · 도움돼요 8', '', true)
      ],
      canWrite: [
        mr('mw-1', IMG.romantic, '라비드레스', 'Pick 인증 완료 · 3월 4일'),
        mr('mw-2', IMG.natural, '청담 헤메', 'Pick 인증 완료 · 4월 2일', '', true)
      ],

      dockSingle: 'flex:0 0 92px;padding:12px 20px;display:flex;box-shadow:inset 0 1px 0 ' + BORDER,
      ctaFull: 'flex:1;height:56px;border-radius:6px;background:' + P + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700',
      ctaDanger: 'flex:1;height:56px;border-radius:6px;background:#ff4133;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700',
      ctaKakao: 'flex:1;height:56px;border-radius:6px;background:#FEE500;color:#191600;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700',
      dockTwo: 'flex:0 0 92px;padding:12px 20px;display:flex;gap:10px;box-shadow:inset 0 1px 0 ' + BORDER,
      btnGhostHalf: 'flex:1;height:56px;border-radius:6px;background:' + SEC + ';color:' + SUB + ';display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700',
      ctaHalf: 'flex:1.4;height:56px;border-radius:6px;background:' + P + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700',
      trackOn: 'width:44px;height:26px;flex:0 0 44px;border-radius:999px;background:' + P + ';display:flex;align-items:center;justify-content:flex-end;padding:0 3px;box-sizing:border-box',

      skinPrev: 'border-radius:10px;background:' + REC + ';padding:18px;display:flex;flex-direction:column;gap:12px',
      skinPrevK: 'font-size:13px;color:' + MUTED,
      skinPrevBtn: 'height:52px;border-radius:6px;background:' + P + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700',
      skins: [
        skin('Coral · 기본', '#ff6f61', true), skin('Red', '#ff4d4d'), skin('Yellow', '#ffc041'),
        skin('Green', '#34c759'), skin('Blue', '#3182f6'), skin('Dark Gray', '#191f28', false, true)
      ],

      notiAll: [
        noti('일정 알림', '등록한 일정 하루 전', true), noti('Pick 변화', '담은 곳 금액 · 혜택 변화', true),
        noti('인증 결과', 'Pick 인증 처리 완료', true), noti('추천 갱신', '진행 중인 업종만', false, true)
      ],
      notiEtc: [noti('마케팅 알림', '혜택 · 이벤트', false), noti('야간 수신', '밤 9시 이후', false, true)],

      delDot: 'width:5px;height:5px;flex:0 0 5px;border-radius:999px;background:' + DIM,
      delNow: [li('계정 · 프로필'), li('배우자 연결'), li('Pick · 스타일'), li('일정 · 지출 · 메모', true)],
      delKeep: [
        li2('실 제보 금액', '이름을 지우고 금액만 남아요'), li2('내가 쓴 후기', '작성자를 지우고 글만 남아요'),
        li2('신고 · 분쟁 기록', '법령상 보존 항목이에요', true)
      ],
      chkRow: 'display:flex;align-items:center;gap:10px;min-height:44px',
      chkOn: 'width:22px;height:22px;flex:0 0 22px;border-radius:4px;background:' + P + ';background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'3.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m5 12.5 4.5 4.5L19 7.5\'/%3E%3C/svg%3E");background-size:14px;background-position:center;background-repeat:no-repeat',
      chkText: 'font-size:15px;color:' + INK,

      faqField: 'height:48px;border-radius:8px;background:' + SEC + ';display:flex;align-items:center;gap:8px;padding:0 14px',
      icoSearch: ICO('search', 18, MUTED),
      faqPh: 'font-size:15px;color:' + MUTED,
      faqCats: [cat('전체', true), cat('Pick 인증'), cat('금액'), cat('계정'), cat('후기')],
      faqHead: 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px',
      faqQ: 'flex:1;font-size:15px;font-weight:700;line-height:22px;color:' + INK + ';text-wrap:pretty',
      faqA: 'font-size:14px;line-height:22px;color:' + SUB + ';text-wrap:pretty',
      faqGo: 'font-size:14px;font-weight:700;color:' + P,
      faqs: [
        faq('Pick 인증은 왜 하나요?', '금액이 실 제보로 모여야 다음 사람이 범위를 볼 수 있어요. 인증하면 후기도 쓸 수 있어요.'),
        faq('사진은 어디까지 보이나요?', '금액과 업체만 읽고 24시간 안에 원본을 지워요. 다른 사람에게 사진은 보이지 않아요.'),
        faq('금액이 제 것과 달라요'), faq('인증이 안 됐다고 나와요'),
        faq('배우자와 연결하면 뭐가 같이 보이나요?'), faq('후기를 고칠 수 있나요?', '', true)
      ],

      qSub: 'font-size:15px;color:' + MUTED,
      styleBtnWrap: 'flex:0 0 auto;padding:0 20px 4px;display:flex;flex-direction:column;gap:10px',
      styleCol: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px',
      styleDesc: 'font-size:13px;line-height:19px;color:' + MUTED,
      styleBtns2: [
        styleBtn2('도시적인', '모던하고 세련된 도심 분위기', true),
        styleBtn2('자연스러운', '편안하고 빛이 좋은 야외 느낌', true),
        styleBtn2('로맨틱한', '부드럽고 사랑스러운 분위기', false),
        styleBtn2('화려한', '풍성하고 존재감 있는 스타일', false)
      ],

      codeCard: 'border-radius:10px;background:' + REC + ';padding:20px;display:flex;flex-direction:column;align-items:center;gap:6px',
      codeK: 'font-size:13px;color:' + MUTED,
      codeText: 'font-size:34px;font-weight:700;letter-spacing:0.08em;color:' + INK + ';font-variant-numeric:tabular-nums',
      codeMeta: 'font-size:13px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      btnRow: 'display:flex;gap:10px',
      btnLine: 'flex:1;height:48px;border-radius:6px;box-shadow:inset 0 0 0 1px #d1d3d8;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:' + INK,
      scopeDot: 'width:5px;height:5px;flex:0 0 5px;border-radius:999px;background:' + P,
      scopeRows: [li('고른 곳 · Pick'), li('일정'), li('지출'), li('메모', true)],
      inviteTitle: 'font-size:22px;font-weight:700;color:' + INK,
      inviteSub: 'font-size:14px;color:' + MUTED + ';font-variant-numeric:tabular-nums',

      doneHero: 'flex:0 0 auto;padding:60px 20px 28px;display:flex;flex-direction:column;align-items:center;gap:14px',
      doneMark: 'width:72px;height:72px;border-radius:999px;background:' + P + ';background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'1.9\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z\'/%3E%3Cpath d=\'M9.4 11.9l1.7 1.7 3.4-3.4\'/%3E%3C/svg%3E");background-size:40px;background-position:center;background-repeat:no-repeat',
      doneTitle: 'font-size:26px;font-weight:700;color:' + INK,
      doneSub: 'font-size:15px;color:' + MUTED,
      doneRows: [
        li2('웨딩노트', '일정 · 지출을 같이 봐요'), li2('Pick', '각자 담고 비교는 같이 봐요'),
        li2('알림', '상대가 바꾸면 알려드려요', true)
      ],
      cutRows: [li('일정 · 지출 공유'), li('Pick 비교 같이 보기'), li('변경 알림', true)],
      keepRows: [
        li2('내가 쓴 일정 · 지출', '그대로 남아요'), li2('내 Pick', '그대로 남아요'),
        li2('Pick 인증내역', '그대로 남아요', true)
      ],

      artHero: 'flex:0 0 auto;position:relative;width:100%;height:240px;overflow:hidden',
      artTitle: 'font-size:24px;line-height:33px;font-weight:700;color:' + INK + ';text-wrap:pretty',
      artMeta: 'font-size:13px;color:' + MUTED + ';font-variant-numeric:tabular-nums',
      artP: 'font-size:16px;line-height:27px;color:' + SUB + ';text-wrap:pretty',
      artBody: [
        '피팅은 한 번에 두세 시간이 걸립니다. 무엇을 물어볼지 정해 가면 그 시간이 절반으로 줄어듭니다.',
        '먼저 대여 기간과 추가금 기준을 확인하세요. 본식 드레스와 촬영 드레스를 같은 곳에서 하는지에 따라 금액이 달라집니다.',
        '헬퍼비 · 수선비 · 피팅 추가 횟수는 계약서에 따로 적히는 항목입니다. 구두로 들은 금액은 실 제보에 남지 않습니다.'
      ],
      relGuides: [
        guide('rl-1', IMG.glam, '예산', '추가금을 줄이는 계약서 확인 항목', '읽는 데 5분'),
        guide('rl-2', IMG.natural, '일정', '본식 4개월 전, 무엇부터 할까', '읽는 데 3분')
      ],

      wvCard: 'border-radius:10px;border:1px solid ' + BORDER + ';padding:14px;display:flex;align-items:center;gap:12px',
      axBlock: 'display:flex;flex-direction:column;gap:10px;padding-bottom:6px',
      axQ: 'font-size:16px;font-weight:700;color:' + INK,
      axRow: 'display:flex;gap:8px',
      wvAxes: [
        ax('상담은 어땠나요?', ['빨랐어요', '적당했어요', '여유있었어요'], 0),
        ax('결과물은 어땠나요?', ['기대 이상', '기대만큼', '괜찮았어요'], 1),
        ax('금액 안내는요?', ['명확했어요', '보통이었어요', '설명해줬어요'], -1)
      ],
      taPh: 'font-size:15px;color:' + MUTED,
      starRow: 'display:flex;gap:2px',
      starPickRow: 'display:flex;gap:6px',
      starPick: Array.from({ length: 5 }, (_, i) => ({
        style: 'width:32px;height:32px;flex:0 0 32px;display:inline-block;cursor:pointer;'
          + '-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M12 2.5l2.9 6 6.6.7-4.9 4.5 1.3 6.5L12 16.9l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.7Z\'/%3E%3C/svg%3E") center/contain no-repeat;'
          + 'mask:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M12 2.5l2.9 6 6.6.7-4.9 4.5 1.3 6.5L12 16.9l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.7Z\'/%3E%3C/svg%3E") center/contain no-repeat;'
          + 'background-color:' + (i < 4 ? P : '#dcdee3') })),

      expoTitleRow: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px',
      expoDday: 'font-size:18px;font-weight:700;color:' + P + ';white-space:nowrap',
      expoTag: 'align-self:flex-start;height:28px;padding:0 10px;border-radius:999px;background:' + SEC + ';color:' + SUB + ';display:inline-flex;align-items:center;font-size:12px;font-weight:700',
      expoK: 'width:84px;flex:0 0 84px;font-size:14px;color:' + MUTED,
      expoV: 'flex:1;font-size:15px;color:' + INK + ';font-variant-numeric:tabular-nums;text-wrap:pretty',
      expoInfo: [
        kv('날짜', '2026.09.19(토)~09.20(일)'), kv('시간', '10:00~18:00'), kv('장소', '코엑스 D홀'),
        kv('주최', '더 웨딩페어'), kv('입장', '사전등록 시 무료', true)
      ],
      expoItems: [li('웨딩홀 · 스드메 상담 부스'), li('드레스 쇼케이스 14:00'), li('사전등록 사은품', true)],

      navSave: 'font-size:15px;font-weight:700;color:' + P + ';white-space:nowrap',
      navTitleL: 'flex:1;min-width:0;text-align:center;font-size:16px;font-weight:700;color:' + INK,
      qBlock2: '',
      avatarSec: 'flex:0 0 auto;padding:24px 20px 20px;display:flex;flex-direction:column;align-items:center;gap:12px',
      avatarBig: 'width:88px;height:88px;border-radius:999px;background:#fff5f2;color:' + P + ';display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700',
      avatarAct: 'font-size:15px;font-weight:700;color:' + P,
      setVal: 'font-size:15px;font-weight:700;color:' + INK + ';white-space:nowrap',
      notiT: 'font-size:15px;color:' + INK,
      notiS: 'font-size:12px;color:' + MUTED,
      kakaoMark: 'width:28px;height:28px;flex:0 0 28px;border-radius:7px;background:#FEE500;color:#191600;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800',
      profileBasic: [
        { k: '닉네임', v: '지수', rowStyle: 'display:flex;align-items:center;gap:12px;min-height:56px;padding:0 16px' }
      ],
      notiRows: [
        { label: '서비스 알림', sub: '일정 · Pick 변화 · 인증 결과', rowStyle: ROW(false),
          track: 'width:44px;height:26px;flex:0 0 44px;border-radius:999px;background:' + P + ';display:flex;align-items:center;justify-content:flex-end;padding:0 3px;box-sizing:border-box' },
        { label: '마케팅 알림', sub: '혜택 · 이벤트', rowStyle: ROW(false),
          track: 'width:44px;height:26px;flex:0 0 44px;border-radius:999px;background:#dcdee3;display:flex;align-items:center;padding:0 3px;box-sizing:border-box' },
        { label: '야간 수신', sub: '밤 9시 이후', rowStyle: ROW(true),
          track: 'width:44px;height:26px;flex:0 0 44px;border-radius:999px;background:#dcdee3;display:flex;align-items:center;padding:0 3px;box-sizing:border-box' }
      ],
      savedCats: [cat('전체', true), cat('웨딩홀'), cat('스드메'), cat('본식'), cat('예물 · 신혼'), cat('예산')],
      icoBookmark: ICO('bookmark', 20, P),
      icoExternal: ICO('chevron-right', 16, '#fff') + ';transform:rotate(-45deg);margin-left:8px',
      savedGuides: [
        guide('sv-1', IMG.romantic, '드레스', '첫 피팅 전에 물어볼 여섯 가지', '9월 8일 저장'),
        guide('sv-2', IMG.glam, '예산', '추가금을 줄이는 계약서 확인 항목', '9월 2일 저장'),
        guide('sv-3', IMG.natural, '일정', '본식 4개월 전, 무엇부터 할까', '8월 28일 저장')
      ],
      qBlock: 'flex:0 0 auto;padding:16px 20px 20px;display:flex;flex-direction:column;gap:8px',
      divider: 'flex:0 0 8px;background:' + SEC,
      pastInquiries: [
        { q: 'Pick 인증이 안 됐어요', date: '8월 12일 · 답변 완료', state: '답변 완료', badge: badgeS('ok'),
          rowStyle: 'display:flex;align-items:center;gap:12px;min-height:64px;padding:0 16px' }
      ],
      qTitle: 'font-size:26px;line-height:35px;letter-spacing:-0.02em;font-weight:700;color:' + INK,
      inquiryTypes: [
        { label: 'Pick 인증이 안 돼요', mark: RADIO(true), rowStyle: ROW(false) },
        { label: '금액이 이상해요', mark: RADIO(false), rowStyle: ROW(false) },
        { label: '업체 정보가 틀렸어요', mark: RADIO(false), rowStyle: ROW(false) },
        { label: '후기를 신고하고 싶어요', mark: RADIO(false), rowStyle: ROW(false) },
        { label: '그 밖의 문의', mark: RADIO(false), rowStyle: ROW(true) }
      ],
      textarea: 'min-height:120px;border-radius:6px;border:1px solid #d1d3d8;padding:14px;font-size:15px;line-height:23px;color:' + INK,
      photoRow: 'display:flex;gap:10px',
      photoAdd: 'width:72px;height:72px;border-radius:8px;border:1px dashed #dcdee3;display:flex;align-items:center;justify-content:center',
      icoCam: ICO('camera', 22, MUTED),

      diffCard: 'width:900px;background:#fff;border:1px solid ' + BORDER + ';border-radius:10px;padding:8px 24px 16px;display:flex;flex-direction:column;box-sizing:border-box',
      diffHead: 'display:flex;align-items:center;gap:16px;min-height:44px;box-shadow:inset 0 -1px 0 #dcdee3',
      diffRow: 'display:flex;align-items:flex-start;gap:16px;min-height:52px;padding:12px 0;box-shadow:inset 0 -1px 0 ' + SEC,
      dh1: 'width:130px;flex:0 0 130px;font-size:12px;font-weight:700;color:' + MUTED,
      dh2: 'width:270px;flex:0 0 270px;font-size:12px;font-weight:700;color:' + MUTED,
      dh3: 'width:270px;flex:0 0 270px;font-size:12px;font-weight:700;color:' + MUTED,
      dh4: 'flex:1;font-size:12px;font-weight:700;color:' + MUTED,
      dc1: 'width:130px;flex:0 0 130px;font-size:13px;line-height:20px;font-weight:700;color:' + INK,
      dc2: 'width:270px;flex:0 0 270px;font-size:13px;line-height:20px;color:' + MUTED,
      dc3: 'flex:1;font-size:12px;line-height:19px;color:' + MUTED,

      diffs: [
        diff('탭 이름', '커뮤니티 · 리얼후기 · 웨딩피드', '라운지 · 후기 · 웨딩정보', '용어사전'),
        diff('후기 평가', '별 5개 · 4.9', '별 5개 + 3축 답변 칩', '숫자 4.9만 뺀다'),
        diff('후기 배지', '가격 제보', 'Pick 인증', '용어사전'),
        diff('글쓰기 진입', '우하단 FAB + 내가 쓴 글 팝오버', '헤더 우측 «글쓰기»', 'FAB를 쓰지 않는다'),
        diff('웨딩정보 썸네일', '01 · 02 · 03 이니셜 색 타일', '실제 이미지 88px', '이미지 있는 곳은 이미지로'),
        diff('TODAY\u0027S PICK 카드', '웨딩정보 하단 검정 카드', '뺌', '홈에 같은 영역이 있다'),
        diff('박람회 헤더', 'UPCOMING FAIR · 이번 주말 한 번에 비교해요', '뺌 · 목록만', '영문 라벨을 쓰지 않는다'),
        diff('박람회 D-day', '없음', 'D-2 · D-9 · 종료', '마감이 가까운 것을 먼저 알린다'),
        diff('박람회 출처', '없음', '주최사 공지에서 모아요', '출처를 밝힌다'),
        diff('MY 제목', 'Playfair Display · MY', '시스템 서체 · MY', 'Playfair를 쓰지 않는다'),
        diff('MY 섹션 라벨', 'UPPERCASE tracking-widest', '한글 13px', 'UPPERCASE를 쓰지 않는다'),
        diff('MY 프로필', '이름 + 결혼 예정일 두 줄', '아바타 + Pick 인증 배지 + D-day', '상태를 먼저 보여준다'),
        diff('라운지 화면', 'Root 탭 · 탭바 있음', '하위 화면 · back nav만', '탭이 아니면 탭바를 두지 않는다'),
        diff('업체 반론 메뉴', 'MY · 고객지원', '뺌', '업체용 기능이라 앱 MY에 두지 않는다'),
        diff('MY 상세', '없음 · 메뉴만 나열', 'Pick 인증 내역 · 연결 관리 · 웨딩 설정 · 내 후기', '누르면 갈 곳이 있어야 한다'),
        diff('로그아웃', '작은 회색 밑줄 + 아이콘', '작은 회색 밑줄', '강조하지 않되 찾을 수는 있게'),
        diff('탭 구성', '홈 · 검색 · Pick · 우리웨딩 · 라운지 · MY 6개', '홈 · 검색 · Pick · 웨딩노트 · MY 5개', '탭은 5칸이 상한'),
        diff('라운지 진입', '탭바 5번째', '홈 하단 «웨딩 소식» 더보기 · MY «둘러보기»', '초기엔 콘텐츠가 적어 탭 한 칸이 죽는다'),
        diff('설정 섹션', 'MY에 알림 · 개인정보 · 계정 3줄', '프로필 한 화면으로 합침', '설정을 두 곳에 나누지 않는다'),
        diff('프로필 카드', '누를 수 없는 정보 표시', '카드 전체 + [>] · 프로필로 이동', '카드를 누르면 내 정보가 나와야 한다'),
        diff('MY 하위', '없음', '7화면 신설', '디자인이 없으면 구현이 제멋대로 된다'),
        diff('메뉴 띄어쓰기', '연결 관리 · 인증 내역 · 웨딩 설정', '연결관리 · 인증내역 · 웨딩설정', '메뉴 4글자는 붙여 쓴다 · 전체 공통'),
        diff('저장한 콘텐츠', '저장한 웨딩 콘텐츠', '스크랩', '짧고 한 단어로'),
        diff('자주 묻는 질문', '자주 묻는 질문', 'FAQ', '메뉴는 짧게'),
        diff('문의', '문의하기 + 내 문의 내역 2줄', '문의하기 1줄 · 내역과 작성 한 화면', '같은 일을 두 곳에 두지 않는다'),
        diff('로그아웃', 'MY 맨 아래', '프로필 · 계정 섹션', '계정 관련은 한곳에'),
        diff('개인정보 내려받기', '있음', '뺌', '쓰지 않는 기능'),
        diff('약관 섹션', '서비스', '약관', '무엇이 들었는지 그대로'),
        diff('프로필 진입', '프로필 수정 별도 줄', '프로필 카드 전체 + [>]', '카드를 누르면 내 정보로')
      ]
    };
  }
}


export default Component;
