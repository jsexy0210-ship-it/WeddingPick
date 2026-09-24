import React from 'react';
import Model from '../models/my.js';
import { useDesignValues, toStyle, ImageSlot, designHref } from '../runtime/designRuntime.js';

/** 원본 화면 구조와 상태를 보존한 React 디자인 보드. Source: 대메뉴_MY.dc.html */
export default function MyBoard(props) {
  const {
    grp, c1, c9, c10, c11, cW12, c13, c14,
    c15, c16, c17, c18, c19, c20, c21, c22,
    c23, c24, c25, c2, c3, c4, c5, c6,
    c7, c8, root, intro, eyebrow, h0, lead, row,
    col, colWide, tag, tagRow, tagText, tagId, tagIdWide, tagDesc,
    phone, bar, head, h1, headAct, navBar, navTitle, navPad,
    icoBack, icoRight, icoChat, scroll, segWrap, segReview, segFeed, segExpo,
    chipBar, cats, tabBar, tabCell, tabsLounge, tabsMy, revCard, revHead,
    revAvatar, revNameCol, revNameRow, revName, revMeta, badgeVerify, badgeWarn, revAnswers,
    revChip, revImg, revText, revFoot, revCmt, reviews, guideRow, guideThumb,
    guideCol, guideCat, guideTitle, guideMeta, guides, sec, secFoot, secLabel,
    note, expoHead, expoCol, expoMeta, expos, profCard, profTop, profAvatar,
    profCol, profNameRow, profName, profSub, profDiv, profRow, profRowT, listCard,
    myLabel, myLabelDim, myCount, knob, rowPlain, rowPlainLast, mySections, verRow,
    logout, statRow, statCell, statLabel, certStats, certCard, certHead, certDate,
    certBody, certName, certNote, certBtn, certs, coupleCard, coupleAvatars, av1,
    av2, coupleCol, coupleName, coupleMeta, shareOn, shareOff, setCol, setK,
    setV, weddingSet, noteBox, noteT, noteS, mrThumb, mrCol, mrName,
    mrMeta, writeBtn, myReviews, canWrite, dockSingle, ctaFull, ctaDanger, ctaKakao,
    dockTwo, btnGhostHalf, ctaHalf, trackOn, skinPrev, skinPrevK, skinPrevBtn, skins,
    notiAll, notiEtc, delDot, delNow, delKeep, chkRow, chkOn, chkText,
    faqField, icoSearch, faqPh, faqCats, faqHead, faqQ, faqA, faqGo,
    faqs, qSub, styleBtnWrap, styleCol, styleDesc, styleBtns2, codeCard, codeK,
    codeText, codeMeta, btnRow, btnLine, scopeDot, scopeRows, inviteTitle, inviteSub,
    doneHero, doneMark, doneTitle, doneSub, doneRows, cutRows, keepRows, artHero,
    artTitle, artMeta, artP, artBody, relGuides, wvCard, axBlock, axQ,
    axRow, wvAxes, taPh, starRow, starPickRow, starPick, expoTitleRow, expoDday,
    expoTag, expoK, expoV, expoInfo, expoItems, navSave, navTitleL, qBlock2,
    avatarSec, avatarBig, avatarAct, setVal, notiT, notiS, kakaoMark, profileBasic,
    notiRows, savedCats, icoBookmark, icoExternal, savedGuides, qBlock, divider, pastInquiries,
    qTitle, inquiryTypes, textarea, photoRow, photoAdd, icoCam, diffCard, diffHead,
    diffRow, dh1, dh2, dh3, dh4, dc1, dc2, dc3,
    diffs, decidedNote
  } = useDesignValues(Model, props);
  return (
<React.Fragment>

<section style={toStyle(root)}>
<div style={toStyle(intro)}>
<span style={toStyle(eyebrow)}>{"WeddingPick · Figma → 정본"}</span>
<span style={toStyle(h0)}>{"MY · 라운지"}</span>
<span style={toStyle(lead)}>{"Figma My.tsx · Community.tsx를 정본 톤으로 옮겼습니다. 4.9 같은 평균 숫자와 영문 라벨 · FAB를 걷어냈고, 별점 5개는 3축 답변과 함께 남겼습니다. 「가격 제보」는 Pick 인증으로 바꿨습니다. MY는 메뉴 나열에 그치지 않도록 상세 7화면을 함께 그렸습니다."}</span>
</div>
<div style={toStyle(row)}>
<div style={toStyle("width:100%;flex:0 0 100%;padding:0 0 4px;font-size:22px;line-height:30px;font-weight:700;color:#212124")}>{"MY"}</div>
<div style={toStyle(c1)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"1"}</span>{"MY · WP-MY-001"}</div>
<span style={toStyle(tagDesc)}>{"설정 섹션을 없애고 프로필 카드를 눌러 들어가게 합니다. 메뉴 4글자는 띄어쓰기 없이 붙입니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={54}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(head)}><span style={toStyle(h1)}>{"MY"}</span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(sec)}>
<div style={toStyle(profCard)}>
<div style={toStyle(profTop)}>
<span style={toStyle(profAvatar)}>{"지"}</span>
<div style={toStyle(profCol)}>
<div style={toStyle(profNameRow)}><span style={toStyle(profName)}>{"김지수"}</span><span style={toStyle(badgeVerify)}>{"Pick 인증"}</span></div>
<span style={toStyle(profSub)}>{"2027.05.16(토) · 250일 남았어요"}</span>
</div>
<span style={toStyle(icoRight)}></span>
</div>
<div style={toStyle(profDiv)}></div>
<div style={toStyle(profRow)}><span style={toStyle(profRowT)}>{"내 웨딩설정"}</span><span style={toStyle(icoRight)}></span></div>
</div>
</div>
{Array.from((mySections) ?? []).map((s, __index1) => (
<React.Fragment key={__index1}>

<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{s.title}</span>
<div style={toStyle(listCard)}>
{Array.from((s.rows) ?? []).map((r, __index2) => (
<React.Fragment key={__index2}>

<div style={toStyle(r.rowStyle)}>
<span style={toStyle(r.icon)}></span>
<span style={toStyle(myLabel)}>{r.label}</span>
{Boolean(r.count) ? <> <span style={toStyle(myCount)}>{r.count}</span> </> : null}
{Boolean(r.toggle) ? <> <span style={toStyle(r.track)}><span style={toStyle(knob)}></span></span> </> : null}
{Boolean(r.arrow) ? <> <span style={toStyle(icoRight)}></span> </> : null}
</div>

</React.Fragment>
))}
</div>
</div>

</React.Fragment>
))}
<div style={toStyle(secFoot)}>
<span style={toStyle(verRow)}>{"앱 버전 1.0.0"}</span>
</div>
<div style={toStyle("height:24px")}></div>
</div>
<div style={toStyle(tabBar)}>{Array.from((tabsMy) ?? []).map((t, __index3) => (
<React.Fragment key={__index3}>
<div style={toStyle(tabCell)}><span style={toStyle(t.icon)}></span><span style={toStyle(t.label)}>{t.text}</span></div>
</React.Fragment>
))}</div>
</div>
</div>
<div style={toStyle(c2)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"2"}</span><span style={toStyle(tagText)}>{"프로필 · WP-MY-002"}</span></div>
<span style={toStyle(tagDesc)}>{"MY 상단 프로필 카드를 누르면 들어옵니다. 설정 섹션을 흡수해 이름 · 알림 · 계정을 한 화면에서 다룹니다. 로그아웃과 탈퇴가 맨 아래입니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={100}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"프로필"}</span><span style={toStyle(navSave)}>{"저장"}</span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(avatarSec)}>
<span style={toStyle(avatarBig)}>{"지"}</span>
<span style={toStyle(avatarAct)}>{"사진 바꾸기"}</span>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"기본"}</span>
<div style={toStyle(listCard)}>
{Array.from((profileBasic) ?? []).map((r, __index4) => (
<React.Fragment key={__index4}>

<div style={toStyle(r.rowStyle)}><span style={toStyle(myLabel)}>{r.k}</span><span style={toStyle(setVal)}>{r.v}</span><span style={toStyle(icoRight)}></span></div>

</React.Fragment>
))}
</div>
<span style={toStyle(note)}>{"배우자와 다른 사용자 모두에게 이 닉네임으로 보여요."}</span>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"알림"}</span>
<div style={toStyle(listCard)}>
{Array.from((notiAll) ?? []).map((n, __index5) => (
<React.Fragment key={__index5}>

<div style={toStyle(n.rowStyle)}>
<div style={toStyle(setCol)}><span style={toStyle(notiT)}>{n.label}</span><span style={toStyle(notiS)}>{n.sub}</span></div>
<span style={toStyle(n.track)}><span style={toStyle(knob)}></span></span>
</div>

</React.Fragment>
))}
</div>
<span style={toStyle(note)}>{"진행 중인 업종에서만 보내고 하루 최대 2건이에요."}</span>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"계정"}</span>
<div style={toStyle(listCard)}>
<div style={toStyle(rowPlain)}><span style={toStyle(kakaoMark)}>{"K"}</span><div style={toStyle(setCol)}><span style={toStyle(notiT)}>{"카카오"}</span><span style={toStyle(notiS)}>{"jisoo****@kakao.com"}</span></div><span style={toStyle(badgeVerify)}>{"연결됨"}</span></div>
<div style={toStyle(rowPlain)}><span style={toStyle(myLabel)}>{"가입일"}</span><span style={toStyle(setVal)}>{"2026.08.04"}</span></div>
<div style={toStyle(rowPlain)}><span style={toStyle(myLabel)}>{"로그인 유지"}</span><span style={toStyle(trackOn)}><span style={toStyle(knob)}></span></span></div>
<div style={toStyle(rowPlain)}><span style={toStyle(myLabel)}>{"로그아웃"}</span><span style={toStyle(icoRight)}></span></div>
<div style={toStyle(rowPlainLast)}><span style={toStyle(myLabelDim)}>{"회원 탈퇴"}</span><span style={toStyle(icoRight)}></span></div>
</div>
</div>
<div style={toStyle("height:24px")}></div>
</div>
</div>
</div>
<div style={toStyle(c3)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"3"}</span><span style={toStyle(tagText)}>{"내 웨딩설정 · WP-MY-003"}</span></div>
<span style={toStyle(tagDesc)}>{"온보딩에서 받은 다섯 가지를 그대로 보여주고 각각 바꿀 수 있게 합니다. 바꾸면 추천이 다시 계산된다고 하단에 적습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={147}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"내 웨딩설정"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(sec)}>
<div style={toStyle(listCard)}>
{Array.from((weddingSet) ?? []).map((r, __index6) => (
<React.Fragment key={__index6}>

<div style={toStyle(r.rowStyle)}>
<div style={toStyle(setCol)}><span style={toStyle(setK)}>{r.k}</span><span style={toStyle(setV)}>{r.v}</span></div>
<span style={toStyle(icoRight)}></span>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(noteBox)}><span style={toStyle(noteT)}>{"바꾸면 추천이 다시 계산돼요"}</span><span style={toStyle(noteS)}>{"지금까지 고른 곳과 지출 기록은 그대로 남아요."}</span></div>
</div>
<div style={toStyle("height:24px")}></div>
</div>
</div>
</div>
<div style={toStyle(c4)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"4"}</span><span style={toStyle(tagText)}>{"Pick 인증내역 · WP-MY-004"}</span></div>
<span style={toStyle(tagDesc)}>{"인증 결과를 상태별로 보여줍니다. 보완이 필요한 건에만 행동 버튼을 답니다. 안 된 건은 이유를 적습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={172}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"Pick 인증내역"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(sec)}>
<div style={toStyle(statRow)}>
{Array.from((certStats) ?? []).map((c, __index7) => (
<React.Fragment key={__index7}>

<div style={toStyle(statCell)}><span style={toStyle(c.numStyle)}>{c.n}</span><span style={toStyle(statLabel)}>{c.k}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
{Array.from((certs) ?? []).map((c, __index8) => (
<React.Fragment key={__index8}>

<div style={toStyle(certCard)}>
<div style={toStyle(certHead)}><span style={toStyle(c.badge)}>{c.state}</span><span style={toStyle(certDate)}>{c.date}</span></div>
<div style={toStyle(certBody)}><span style={toStyle(certName)}>{c.name}</span><span style={toStyle(c.amtStyle)}>{c.amount}</span></div>
<span style={toStyle(certNote)}>{c.note}</span>
{Boolean(c.action) ? <> <span style={toStyle(certBtn)}>{c.action}</span> </> : null}
</div>

</React.Fragment>
))}
</div>
<div style={toStyle("height:24px")}></div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaFull)}>{"새로 인증하기"}</span></div>
</div>
</div>
<div style={toStyle(c5)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"5"}</span><span style={toStyle(tagText)}>{"연결관리 · WP-MY-005"}</span></div>
<span style={toStyle(tagDesc)}>{"같이 보는 것과 각자 보는 것을 토글로 나눕니다. 연결 끊기는 맨 아래 회색으로 두고 강조하지 않습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={202}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"연결관리"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(sec)}>
<div style={toStyle(coupleCard)}>
<span style={toStyle(coupleAvatars)}><span style={toStyle(av1)}>{"지"}</span><span style={toStyle(av2)}>{"준"}</span></span>
<div style={toStyle(coupleCol)}>
<span style={toStyle(coupleName)}>{"준호님과 함께 준비 중"}</span>
<span style={toStyle(coupleMeta)}>{"8월 12일 연결 · 고른 곳 3곳 · 일정 5개"}</span>
</div>
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"같이 보는 것"}</span>
<div style={toStyle(listCard)}>
{Array.from((shareOn) ?? []).map((r, __index9) => (
<React.Fragment key={__index9}>

<div style={toStyle(r.rowStyle)}><span style={toStyle(myLabel)}>{r.label}</span><span style={toStyle(r.track)}><span style={toStyle(knob)}></span></span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"각자 보는 것"}</span>
<div style={toStyle(listCard)}>
{Array.from((shareOff) ?? []).map((r, __index10) => (
<React.Fragment key={__index10}>

<div style={toStyle(r.rowStyle)}><span style={toStyle(myLabel)}>{r.label}</span><span style={toStyle(r.track)}><span style={toStyle(knob)}></span></span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(listCard)}>
<div style={toStyle(rowPlain)}><span style={toStyle(myLabel)}>{"변경 내역 보기"}</span><span style={toStyle(icoRight)}></span></div>
<div style={toStyle(rowPlainLast)}><span style={toStyle(myLabelDim)}>{"연결 끊기"}</span><span style={toStyle(icoRight)}></span></div>
</div>
</div>
<div style={toStyle("height:24px")}></div>
</div>
</div>
</div>
<div style={toStyle(c6)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"6"}</span><span style={toStyle(tagText)}>{"내가 쓴 후기 · WP-MY-006"}</span></div>
<span style={toStyle(tagDesc)}>{"쓴 후기와 쓸 수 있는 곳을 나눕니다. 업체 반론이 달린 후기는 표시해서 확인을 유도합니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={245}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"내가 쓴 후기"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"쓴 후기 2개"}</span>
<div style={toStyle(listCard)}>
{Array.from((myReviews) ?? []).map((r, __index11) => (
<React.Fragment key={__index11}>

<div style={toStyle(r.rowStyle)}>
<div style={toStyle(mrThumb)}><ImageSlot id={r.id} src={r.src} shape={"rect"} placeholder={""} /></div>
<div style={toStyle(mrCol)}><span style={toStyle(mrName)}>{r.name}</span><span style={toStyle(mrMeta)}>{r.meta}</span></div>
{Boolean(r.badge) ? <> <span style={toStyle(badgeWarn)}>{r.badge}</span> </> : null}
<span style={toStyle(icoRight)}></span>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"쓸 수 있는 곳 2개"}</span>
<div style={toStyle(listCard)}>
{Array.from((canWrite) ?? []).map((r, __index12) => (
<React.Fragment key={__index12}>

<div style={toStyle(r.rowStyle)}>
<div style={toStyle(mrThumb)}><ImageSlot id={r.id} src={r.src} shape={"rect"} placeholder={""} /></div>
<div style={toStyle(mrCol)}><span style={toStyle(mrName)}>{r.name}</span><span style={toStyle(mrMeta)}>{r.meta}</span></div>
<span style={toStyle(writeBtn)}>{"쓰기"}</span>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle("height:24px")}></div>
</div>
</div>
</div>
<div style={toStyle(c8)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"7"}</span><span style={toStyle(tagText)}>{"문의하기 · WP-MY-008"}</span></div>
<span style={toStyle(tagDesc)}>{"내역과 작성을 한 화면에 합쳤습니다. 지난 문의가 위에 쌓이고 아래에서 새로 씁니다. 답변 시간을 미리 적습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={282}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"문의하기"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"지난 문의 1건"}</span>
<div style={toStyle(listCard)}>
{Array.from((pastInquiries) ?? []).map((p, __index13) => (
<React.Fragment key={__index13}>

<div style={toStyle(p.rowStyle)}>
<div style={toStyle(setCol)}><span style={toStyle(notiT)}>{p.q}</span><span style={toStyle(notiS)}>{p.date}</span></div>
<span style={toStyle(p.badge)}>{p.state}</span>
<span style={toStyle(icoRight)}></span>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(divider)}></div>
<div style={toStyle(qBlock)}>
<span style={toStyle(qTitle)}>{"어떤 점이"}<br />{"궁금하세요?"}</span>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(listCard)}>
{Array.from((inquiryTypes) ?? []).map((t, __index14) => (
<React.Fragment key={__index14}>

<div style={toStyle(t.rowStyle)}><span style={toStyle(t.mark)}></span><span style={toStyle(myLabel)}>{t.label}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"내용"}</span>
<div style={toStyle(textarea)}>{"Pick 인증을 올렸는데 아직 반영이 안 됐어요"}</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"사진 · 선택"}</span>
<div style={toStyle(photoRow)}><span style={toStyle(photoAdd)}><span style={toStyle(icoCam)}></span></span></div>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(noteBox)}><span style={toStyle(noteT)}>{"평일 오전 10시부터 오후 6시까지 답변드려요"}</span><span style={toStyle(noteS)}>{"주말과 공휴일에 남긴 문의는 다음 영업일에 처리해요."}</span></div>
</div>
<div style={toStyle("height:24px")}></div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaFull)}>{"문의 보내기"}</span></div>
</div>
</div>
<div style={toStyle("width:100%;flex:0 0 100%;padding:16px 0 4px;font-size:22px;line-height:30px;font-weight:700;color:#212124")}>{"라운지"}</div>
<div style={toStyle(grp)}>
<div style={toStyle(c9)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"8"}</span>{"리얼후기 · WP-LNG-001"}</div>
<span style={toStyle(tagDesc)}>{"별 5개를 3축 답변 칩과 함께 둡니다. 「가격 제보」 배지는 Pick 인증입니다. 우하단 FAB는 없애고 헤더 우측 텍스트로 옮겼습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={332}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"리얼후기"}</span><span style={toStyle(headAct)}>{"글쓰기"}</span></div>
<div className={"nsb"} style={toStyle(chipBar)}>{Array.from((cats) ?? []).map((c, __index15) => (
<React.Fragment key={__index15}>
<span style={toStyle(c.style)}>{c.label}</span>
</React.Fragment>
))}</div>
<div className={"nsb"} style={toStyle(scroll)}>
{Array.from((reviews) ?? []).map((r, __index16) => (
<React.Fragment key={__index16}>

<div style={toStyle(revCard)}>
<div style={toStyle(revHead)}>
<span style={toStyle(revAvatar)}>{r.mark}</span>
<div style={toStyle(revNameCol)}>
<div style={toStyle(revNameRow)}><span style={toStyle(revName)}>{r.author}</span>{Boolean(r.verified) ? <> <span style={toStyle(badgeVerify)}>{"Pick 인증"}</span> </> : null}</div>
<div style={toStyle(starRow)}>{Array.from((r.stars) ?? []).map((s, __index17) => (
<React.Fragment key={__index17}>
<span style={toStyle(s.style)}></span>
</React.Fragment>
))}</div>
<span style={toStyle(revMeta)}>{r.vendor}{" · "}{r.time}</span>
</div>
</div>
<div style={toStyle(revAnswers)}>{Array.from((r.answers) ?? []).map((a, __index18) => (
<React.Fragment key={__index18}>
<span style={toStyle(revChip)}>{a}</span>
</React.Fragment>
))}</div>
<div style={toStyle(revImg)}><ImageSlot id={r.id} src={r.src} shape={"rect"} placeholder={""} /></div>
<span style={toStyle(revText)}>{r.text}</span>
<div style={toStyle(revFoot)}><span style={toStyle(r.likeStyle)}><span style={toStyle(r.likeIcon)}></span>{r.likes}</span><span style={toStyle(revCmt)}><span style={toStyle(icoChat)}></span>{r.comments}</span></div>
</div>

</React.Fragment>
))}
<div style={toStyle("height:24px")}></div>
</div>
</div>
</div>
<div style={toStyle(c24)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"8-1"}</span><span style={toStyle(tagText)}>{"후기 쓰기 · WP-LNG-005"}</span></div>
<span style={toStyle(tagDesc)}>{"Pick 인증한 업체만 쓸 수 있습니다. 5점 별점과 3축 3지선다를 함께 받고, 글은 안 써도 올릴 수 있습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={361}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"후기 쓰기"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(sec)}>
<div style={toStyle(wvCard)}>
<div style={toStyle(mrThumb)}><ImageSlot id={"wv-1"} src={"uploads/스타일 이미지/urban.png"} shape={"rect"} placeholder={""} /></div>
<div style={toStyle(mrCol)}><span style={toStyle(mrName)}>{"강남 A 스튜디오"}</span><span style={toStyle(mrMeta)}>{"Pick 인증 완료 · 2026.09.08"}</span></div>
<span style={toStyle(badgeVerify)}>{"Pick 인증"}</span>
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"전체 별점"}</span>
<div style={toStyle(starPickRow)}>{Array.from((starPick) ?? []).map((s, __index19) => (
<React.Fragment key={__index19}>
<span style={toStyle(s.style)}></span>
</React.Fragment>
))}</div>
</div>
<div style={toStyle(sec)}>
{Array.from((wvAxes) ?? []).map((a, __index20) => (
<React.Fragment key={__index20}>

<div style={toStyle(axBlock)}>
<span style={toStyle(axQ)}>{a.q}</span>
<div style={toStyle(axRow)}>
{Array.from((a.opts) ?? []).map((o, __index21) => (
<React.Fragment key={__index21}>
<span style={toStyle(o.style)}>{o.label}</span>
</React.Fragment>
))}
</div>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"사진 · 선택"}</span>
<div style={toStyle(photoRow)}>
<div style={toStyle(photoAdd)}><span style={toStyle(icoCam)}></span></div>
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"더 남기고 싶은 말 · 선택"}</span>
<div style={toStyle(textarea)}><span style={toStyle(taPh)}>{"다음 사람이 알면 좋을 것을 적어주세요"}</span></div>
<span style={toStyle(note)}>{"닉네임으로 올라가요. 금액은 실 제보에서 따로 집계돼요."}</span>
</div>
<div style={toStyle("height:16px")}></div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaFull)}>{"올리기"}</span></div>
</div>
</div>
</div>
<div style={toStyle(grp)}>
<div style={toStyle(c10)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"9"}</span>{"웨딩정보 · WP-LNG-002"}</div>
<span style={toStyle(tagDesc)}>{"Figma의 「01 · 02 · 03」 이니셜 타일을 실제 이미지로 바꿨습니다. TODAY'S PICK 검정 카드는 뺐습니다 — 홈에 같은 영역이 있습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={408}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"웨딩정보"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(chipBar)}>{Array.from((cats) ?? []).map((c, __index22) => (
<React.Fragment key={__index22}>
<span style={toStyle(c.style)}>{c.label}</span>
</React.Fragment>
))}</div>
<div className={"nsb"} style={toStyle(scroll)}>
{Array.from((guides) ?? []).map((g, __index23) => (
<React.Fragment key={__index23}>

<div style={toStyle(guideRow)}>
<div style={toStyle(guideThumb)}><ImageSlot id={g.id} src={g.src} shape={"rect"} placeholder={""} /></div>
<div style={toStyle(guideCol)}>
<span style={toStyle(guideCat)}>{g.cat}</span>
<span style={toStyle(guideTitle)}>{g.title}</span>
<span style={toStyle(guideMeta)}>{g.meta}</span>
</div>
</div>

</React.Fragment>
))}
<div style={toStyle("height:24px")}></div>
</div>
</div>
</div>
<div style={toStyle(c23)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"9-1"}</span><span style={toStyle(tagText)}>{"글 상세 · WP-LNG-004"}</span></div>
<span style={toStyle(tagDesc)}>{"웨딩정보 목록에서 들어옵니다. 스크랩은 우상단 하나뿐이고, 본문 끝에 같은 업종 글을 이어 붙입니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={431}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"웨딩정보"}</span><span style={toStyle(icoBookmark)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(artHero)}>
<ImageSlot id={"art-hero"} src={"uploads/스타일 이미지/romantic.png"} shape={"rect"} placeholder={""} />
</div>
<div style={toStyle(sec)}>
<span style={toStyle(guideCat)}>{"드레스"}</span>
<span style={toStyle(artTitle)}>{"첫 피팅 전에 물어볼 여섯 가지"}</span>
<span style={toStyle(artMeta)}>{"2026.09.08 · 읽는 데 4분"}</span>
</div>
<div style={toStyle(sec)}>
{Array.from((artBody) ?? []).map((p, __index24) => (
<React.Fragment key={__index24}>

<span style={toStyle(artP)}>{p}</span>

</React.Fragment>
))}
</div>
<div style={toStyle(divider)}></div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"함께 보면 좋아요"}</span>
</div>
{Array.from((relGuides) ?? []).map((g, __index25) => (
<React.Fragment key={__index25}>

<div style={toStyle(guideRow)}>
<div style={toStyle(guideThumb)}><ImageSlot id={g.id} src={g.src} shape={"rect"} placeholder={""} /></div>
<div style={toStyle(guideCol)}><span style={toStyle(guideCat)}>{g.cat}</span><span style={toStyle(guideTitle)}>{g.title}</span><span style={toStyle(guideMeta)}>{g.meta}</span></div>
</div>

</React.Fragment>
))}
<div style={toStyle("height:24px")}></div>
</div>
</div>
</div>
</div>
<div style={toStyle(grp)}>
<div style={toStyle(c11)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"10"}</span>{"박람회 · WP-LNG-003"}</div>
<span style={toStyle(tagDesc)}>{"「UPCOMING FAIR」 영문 라벨과 배너를 뺐습니다. 마감이 가까운 것에 D-day를 붙이고 지난 일정은 회색으로 내립니다. 출처를 하단에 적습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={468}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"박람회"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(sec)}>
{Array.from((expos) ?? []).map((e, __index26) => (
<React.Fragment key={__index26}>

<div style={toStyle(e.card)}>
<div style={toStyle(expoHead)}>
<div style={toStyle(e.thumbCell)}><ImageSlot id={e.id} src={e.img} shape={"rect"} placeholder={""} /></div>
<div style={toStyle(expoCol)}>
<span style={toStyle(e.nameStyle)}>{e.title}</span>
<span style={toStyle(expoMeta)}>{e.date}</span>
<span style={toStyle(expoMeta)}>{e.place}</span>
</div>
<span style={toStyle(e.ddayStyle)}>{e.dday}</span>
</div>
{Boolean(e.tag) ? <> <span style={toStyle(e.tagStyle)}>{e.tag}</span> </> : null}
</div>

</React.Fragment>
))}
<span style={toStyle(note)}>{"주최사 공지에서 모아요. 방문 전에 한 번 더 확인해주세요."}</span>
</div>
<div style={toStyle("height:24px")}></div>
</div>
</div>
</div>
<div style={toStyle(c25)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"10-1"}</span><span style={toStyle(tagText)}>{"박람회 상세 · WP-LNG-006"}</span></div>
<span style={toStyle(tagDesc)}>{"사전등록은 주최사 페이지로 넘깁니다. 누르면 인앱 브라우저로 주최사 페이지를 띄웁니다 — 앱을 나가지 않습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={498}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"박람회"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(artHero)}>
<ImageSlot id={"expo-hero"} src={"uploads/스타일 이미지/glamorous.png"} shape={"rect"} placeholder={""} />
</div>
<div style={toStyle(sec)}>
<div style={toStyle(expoTitleRow)}><span style={toStyle(artTitle)}>{"더 웨딩페어 코엑스"}</span><span style={toStyle(expoDday)}>{"D-2"}</span></div>
<span style={toStyle(expoTag)}>{"사전등록 무료"}</span>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(listCard)}>
{Array.from((expoInfo) ?? []).map((i, __index27) => (
<React.Fragment key={__index27}>

<div style={toStyle(i.rowStyle)}><span style={toStyle(expoK)}>{i.k}</span><span style={toStyle(expoV)}>{i.v}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"이런 게 있어요"}</span>
<div style={toStyle(listCard)}>
{Array.from((expoItems) ?? []).map((i, __index28) => (
<React.Fragment key={__index28}>

<div style={toStyle(i.rowStyle)}><span style={toStyle(scopeDot)}></span><span style={toStyle(myLabel)}>{i.label}</span></div>

</React.Fragment>
))}
</div>
<span style={toStyle(note)}>{"주최사 공지에서 모아요. 방문 전에 한 번 더 확인해주세요."}</span>
</div>
<div style={toStyle("height:16px")}></div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaFull)}>{"주최사 사전등록 열기"}<span style={toStyle(icoExternal)}></span></span></div>
</div>
</div>
</div>
<div style={toStyle(c16)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"11"}</span><span style={toStyle(tagText)}>{"회원탈퇴 · WP-MY-012"}</span></div>
<span style={toStyle(tagDesc)}>{"지워지는 것과 남는 것을 나눠 먼저 보여줍니다. 확인 체크 없이는 버튼이 눌리지 않고, 실행 버튼만 빨강입니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={535}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"회원탈퇴"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(qBlock)}>
<span style={toStyle(qTitle)}>{"탈퇴하면"}<br />{"이렇게 돼요"}</span>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"바로 지워져요"}</span>
<div style={toStyle(listCard)}>
{Array.from((delNow) ?? []).map((d, __index29) => (
<React.Fragment key={__index29}>

<div style={toStyle(d.rowStyle)}><span style={toStyle(delDot)}></span><span style={toStyle(myLabel)}>{d.label}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"남아요"}</span>
<div style={toStyle(listCard)}>
{Array.from((delKeep) ?? []).map((d, __index30) => (
<React.Fragment key={__index30}>

<div style={toStyle(d.rowStyle)}><div style={toStyle(setCol)}><span style={toStyle(notiT)}>{d.label}</span><span style={toStyle(notiS)}>{d.sub}</span></div></div>

</React.Fragment>
))}
</div>
<span style={toStyle(note)}>{"이름과 계정은 지우고 금액만 남겨요. 누가 냈는지는 남지 않아요."}</span>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(chkRow)}><span style={toStyle(chkOn)}></span><span style={toStyle(chkText)}>{"안내를 확인했어요"}</span></div>
</div>
<div style={toStyle("height:16px")}></div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaDanger)}>{"탈퇴하기"}</span></div>
</div>
</div>
<div style={toStyle(c17)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"12"}</span><span style={toStyle(tagText)}>{"FAQ · WP-MY-013"}</span></div>
<span style={toStyle(tagDesc)}>{"질문만 쌓아두지 않고 카테고리로 거릅니다. 첫 항목은 펼친 상태로 두고, 맨 아래에서 문의로 넘깁니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={571}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"FAQ"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(chipBar)}>{Array.from((faqCats) ?? []).map((c, __index31) => (
<React.Fragment key={__index31}>
<span style={toStyle(c.style)}>{c.label}</span>
</React.Fragment>
))}</div>
<div style={toStyle(sec)}>
<div style={toStyle(listCard)}>
{Array.from((faqs) ?? []).map((f, __index32) => (
<React.Fragment key={__index32}>

<div style={toStyle(f.wrap)}>
<div style={toStyle(faqHead)}><span style={toStyle(faqQ)}>{f.q}</span><span style={toStyle(f.icon)}></span></div>
{Boolean(f.a) ? <> <span style={toStyle(faqA)}>{f.a}</span> </> : null}
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle("height:24px")}></div>
</div>
<div style={toStyle(tabBar)}>{Array.from((tabsMy) ?? []).map((t, __index33) => (
<React.Fragment key={__index33}>
<div style={toStyle(tabCell)}><span style={toStyle(t.icon)}></span><span style={toStyle(t.label)}>{t.text}</span></div>
</React.Fragment>
))}</div>
</div>
</div>
<div style={toStyle(c18)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"13"}</span><span style={toStyle(tagText)}>{"스타일 다시 고르기 · WP-MY-014"}</span></div>
<span style={toStyle(tagDesc)}>{"웨딩설정의 스타일 행에서 들어옵니다. 온보딩 5/5와 같은 텍스트 버튼 목록입니다 — 이미지 없이 라벨과 한 줄 설명으로 고릅니다. 최대 2개, 3개째는 토스트입니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={595}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"스타일"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(qBlock)}>
<span style={toStyle(qTitle)}>{"어떤 스타일을"}<br />{"좋아하세요?"}</span>
<span style={toStyle(qSub)}>{"마음에 드는 스타일을 골라주세요"}</span>
</div>
<div style={toStyle(styleBtnWrap)}>
{Array.from((styleBtns2) ?? []).map((s, __index34) => (
<React.Fragment key={__index34}>

<div style={toStyle(s.card)}>
<div style={toStyle(styleCol)}>
<span style={toStyle(s.nameStyle)}>{s.label}</span>
<span style={toStyle(styleDesc)}>{s.desc}</span>
</div>
<span style={toStyle(s.mark)}></span>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaFull)}>{"저장하기"}</span></div>
</div>
</div>
<div style={toStyle("width:100%;flex:0 0 100%;padding:16px 0 4px;font-size:22px;line-height:30px;font-weight:700;color:#212124")}>{"배우자 연결"}</div>
<div style={toStyle(grp)}>
<div style={toStyle(c19)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"14"}</span><span style={toStyle(tagText)}>{"배우자 초대 · WP-CPL-001"}</span></div>
<span style={toStyle(tagDesc)}>{"연결관리에서 들어옵니다. 카카오 공유가 Primary고 코드는 대체 경로입니다. 무엇이 공유되는지 먼저 보여줍니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={625}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"배우자 초대"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(qBlock)}>
<span style={toStyle(qTitle)}>{"같이 준비할"}<br />{"사람을 초대해요"}</span>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(codeCard)}>
<span style={toStyle(codeK)}>{"초대 코드"}</span>
<span style={toStyle(codeText)}>{"7K2M4D"}</span>
<span style={toStyle(codeMeta)}>{"오늘 23:59까지 쓸 수 있어요"}</span>
</div>
<div style={toStyle(btnRow)}>
<span style={toStyle(btnLine)}>{"코드 복사"}</span>
<span style={toStyle(btnLine)}>{"코드 다시 받기"}</span>
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"연결하면 같이 봐요"}</span>
<div style={toStyle(listCard)}>
{Array.from((scopeRows) ?? []).map((s, __index35) => (
<React.Fragment key={__index35}>

<div style={toStyle(s.rowStyle)}><span style={toStyle(scopeDot)}></span><span style={toStyle(myLabel)}>{s.label}</span></div>

</React.Fragment>
))}
</div>
<span style={toStyle(note)}>{"검색 기록과 알림 설정은 각자 봐요."}</span>
</div>
<div style={toStyle("height:16px")}></div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaKakao)}>{"카카오로 초대하기"}</span></div>
</div>
</div>
<div style={toStyle(c20)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"14-1"}</span><span style={toStyle(tagText)}>{"초대 수락 · WP-CPL-002"}</span></div>
<span style={toStyle(tagDesc)}>{"초대 링크로 들어온 화면입니다. 누가 초대했는지 먼저 보여주고, 수락하지 않아도 앱은 쓸 수 있게 「나중에」를 남깁니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={661}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(navPad)}></span><span style={toStyle(navTitle)}>{"초대"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(avatarSec)}>
<span style={toStyle(avatarBig)}>{"지"}</span>
<span style={toStyle(inviteTitle)}>{"지수님이 초대했어요"}</span>
<span style={toStyle(inviteSub)}>{"2027.05.16(토) 예식 · 서울 강남구"}</span>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"수락하면 같이 봐요"}</span>
<div style={toStyle(listCard)}>
{Array.from((scopeRows) ?? []).map((s, __index36) => (
<React.Fragment key={__index36}>

<div style={toStyle(s.rowStyle)}><span style={toStyle(scopeDot)}></span><span style={toStyle(myLabel)}>{s.label}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(noteBox)}>
<span style={toStyle(noteT)}>{"내가 담은 Pick은 그대로예요"}</span>
<span style={toStyle(noteS)}>{"두 사람의 Pick이 합쳐지지 않아요. 각자 담고 비교는 같이 봐요."}</span>
</div>
</div>
<div style={toStyle("height:16px")}></div>
</div>
<div style={toStyle(dockTwo)}><span style={toStyle(btnGhostHalf)}>{"나중에"}</span><span style={toStyle(ctaHalf)}>{"수락하기"}</span></div>
</div>
</div>
<div style={toStyle(c21)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"14-2"}</span><span style={toStyle(tagText)}>{"연결 완료 · WP-CPL-003"}</span></div>
<span style={toStyle(tagDesc)}>{"완료 화면이라 back을 두지 않습니다. 무엇이 어디에 들어갔는지 항목으로 적고 다음 행동은 하나입니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={693}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(doneHero)}>
<span style={toStyle(doneMark)}></span>
<span style={toStyle(doneTitle)}>{"함께 준비해요"}</span>
<span style={toStyle(doneSub)}>{"지수님과 연결됐어요"}</span>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"이렇게 반영됐어요"}</span>
<div style={toStyle(listCard)}>
{Array.from((doneRows) ?? []).map((d, __index37) => (
<React.Fragment key={__index37}>

<div style={toStyle(d.rowStyle)}><div style={toStyle(setCol)}><span style={toStyle(notiT)}>{d.label}</span><span style={toStyle(notiS)}>{d.sub}</span></div></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(coupleCard)}>
<div style={toStyle(coupleAvatars)}><span style={toStyle(av1)}>{"지"}</span><span style={toStyle(av2)}>{"민"}</span></div>
<div style={toStyle(coupleCol)}><span style={toStyle(coupleName)}>{"지수 · 민준"}</span><span style={toStyle(coupleMeta)}>{"연결 2026.09.22"}</span></div>
</div>
</div>
<div style={toStyle("height:16px")}></div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaFull)}>{"웨딩노트로 가기"}</span></div>
</div>
</div>
<div style={toStyle(c22)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"14-3"}</span><span style={toStyle(tagText)}>{"연결 해제 · WP-CPL-006"}</span></div>
<span style={toStyle(tagDesc)}>{"공유가 끝나는 것과 각자 남는 것을 나눠 적습니다. 해제해도 내가 쓴 기록은 지워지지 않습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={724}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"연결 해제"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(qBlock)}>
<span style={toStyle(qTitle)}>{"해제하면"}<br />{"이렇게 돼요"}</span>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"끝나요"}</span>
<div style={toStyle(listCard)}>
{Array.from((cutRows) ?? []).map((c, __index38) => (
<React.Fragment key={__index38}>

<div style={toStyle(c.rowStyle)}><span style={toStyle(delDot)}></span><span style={toStyle(myLabel)}>{c.label}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secLabel)}>{"그대로예요"}</span>
<div style={toStyle(listCard)}>
{Array.from((keepRows) ?? []).map((c, __index39) => (
<React.Fragment key={__index39}>

<div style={toStyle(c.rowStyle)}><div style={toStyle(setCol)}><span style={toStyle(notiT)}>{c.label}</span><span style={toStyle(notiS)}>{c.sub}</span></div></div>

</React.Fragment>
))}
</div>
<span style={toStyle(note)}>{"다시 초대하면 같이 볼 수 있어요."}</span>
</div>
<div style={toStyle("height:16px")}></div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaDanger)}>{"연결 해제하기"}</span></div>
</div>
</div>
<div style={toStyle(c19)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"1-14"}</span><span style={toStyle(tagText)}>{"이용약관 · WP-MY-015"}</span></div>
<span style={toStyle(tagDesc)}>{"MY 홈 «약관» 섹션의 이용약관 행을 누르면 목록 없이 바로 원문이 뜹니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={757}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"이용약관"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(sec)}>
<span style={toStyle(note)}>{"v1.0 · 2026년 9월 1일 시행"}</span>
<span style={toStyle(decidedNote)}>{"약관 전문은 관리자에서 조문 단위로 편집합니다. 이 화면은 원문 전체를 그대로 보여줍니다."}</span>
</div>
<div style={toStyle("height:24px")}></div>
</div>
<div style={toStyle(tabBar)}>{Array.from((tabsMy) ?? []).map((t, __index40) => (
<React.Fragment key={__index40}>
<div style={toStyle(tabCell)}><span style={toStyle(t.icon)}></span><span style={toStyle(t.label)}>{t.text}</span></div>
</React.Fragment>
))}</div>
</div>
</div>
<div style={toStyle(c19)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"1-15"}</span><span style={toStyle(tagText)}>{"개인정보처리방침 · WP-MY-015b"}</span></div>
<span style={toStyle(tagDesc)}>{"같은 방식으로, «개인정보처리방침» 행을 누르면 바로 원문이 뜹니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={774}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(icoBack)}></span><span style={toStyle(navTitle)}>{"개인정보처리방침"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(sec)}>
<span style={toStyle(note)}>{"v1.0 · 2026년 9월 1일 시행"}</span>
<span style={toStyle(decidedNote)}>{"약관 전문은 관리자에서 조문 단위로 편집합니다. 이 화면은 원문 전체를 그대로 보여줍니다."}</span>
</div>
<div style={toStyle("height:24px")}></div>
</div>
<div style={toStyle(tabBar)}>{Array.from((tabsMy) ?? []).map((t, __index41) => (
<React.Fragment key={__index41}>
<div style={toStyle(tabCell)}><span style={toStyle(t.icon)}></span><span style={toStyle(t.label)}>{t.text}</span></div>
</React.Fragment>
))}</div>
</div>
</div>
<div style={toStyle(cW12)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"15"}</span>{"정본과 다른 점"}</div>
<span style={toStyle(tagDesc)}>{"정책 판단이 필요한 항목은 주황색입니다."}</span>
<div style={toStyle(diffCard)}>
<div style={toStyle(diffHead)}><span style={toStyle(dh1)}>{"항목"}</span><span style={toStyle(dh2)}>{"Figma 원본"}</span><span style={toStyle(dh3)}>{"정본 적용"}</span><span style={toStyle(dh4)}>{"근거"}</span></div>
{Array.from((diffs) ?? []).map((d, __index42) => (
<React.Fragment key={__index42}>

<div style={toStyle(diffRow)}><span style={toStyle(dc1)}>{d.k}</span><span style={toStyle(dc2)}>{d.a}</span><span style={toStyle(d.bStyle)}>{d.b}</span><span style={toStyle(dc3)}>{d.why}</span></div>

</React.Fragment>
))}
</div>
</div>
</div>
</div></section>
</React.Fragment>
  );
}
