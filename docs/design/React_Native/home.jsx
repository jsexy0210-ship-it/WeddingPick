import React from 'react';
import Model from '../models/home.js';
import { useDesignValues, toStyle, ImageSlot, designHref } from '../runtime/designRuntime.js';

/** 원본 화면 구조와 상태를 보존한 React 디자인 보드. Source: 대메뉴_홈(로그인, 온보딩).dc.html */
export default function HomeBoard(props) {
  const {
    sumCard, sumK, sumV, sumEdit, sumNote, dockSingle2, ctaFullP, summary,
    prepSec, prepCol, prepNote, amtField, amtVal, amtUnit, amtChips, amtNote,
    answered4, answered3, amtQuick, prepGroups, hroot, hintro, heyebrow, h40,
    introBody, boardRow, hcol, hcolWide, htag, tag2, htagId, htagDesc,
    htagIdWide, tdNav, tdNavT, tdNavPad, tdTabs, termTabs, tdDocTitle, tdDocMeta,
    tdScroll, tdHead, tdTitle, tdMeta, tdArt, tdArtT, tdArtB, termArts,
    hphone, hbar, barIcons, header, wordmark, headIcons, iconBtn, hscroll,
    heroWrap, hero, heroBlob1, heroBlob2, heroInner, heroTop, heroKicker, heroMore,
    dday, heroDate, heroVenueBadge, coupleRow, avWrap, av1, av2, coupleText,
    hsec, secLast, secNoPad, secHead, secHeadPad, secHeadCol, hsecTitle, secTitleOnly,
    secSub, secMeta, moreBtn, pillBtn, prepGrid, prepGridPad, schedWrap, schedDate,
    schedMonth, schedCol, schedTitle, schedMeta, schedule, prepTop, prepEmoji, prepLabel,
    recScroll, recCard, recImgWrap, recImg, feedThumb, feedChev, recBadge, recBody,
    recCat, recName, recLoc, recLocText, recFoot, recPrice, recPicks, recPicksText,
    recTail, catGrid, catCell, catEmoji, catName, feedWrap, feedCard, feedBody,
    feedCat, feedTitle, feedMeta, tabBar, specCard, specCol, specName, specHex,
    kvRow, kvKey, kvVal, splashStage, splashMark, agAllRow, agAllT, agChkOn,
    agList, agItemT, agChev, agSec, agSecT, permGrid, permCell, permCellT,
    agreeReq, agreeOpt, agreeItems, permScroll, permHead, permTitle, permSub, permSec,
    permLabel, permRow, permIcoWrap, permCol, permName, permDesc, permNote, permNoteT,
    permCta, perms, splashName, agesStage, agesTitle, agesNote, dockSingleH, ctaGhostH,
    stateRow, stateCard, stateLabel, stateBig, stateSub, navBarH, icoBackH, navTitleH,
    navPadH, dimWrapH, dimH, benSheet, grabH, formHead, formClose, icoXsm,
    benBig, benSub, benConds, benRow, benDot, benText, benItems, benDock,
    btnGhostH, btnFullH, hdiffCard, hdiffHead, hdh1, hdh2, hdh3, hdh4,
    hdiffRow, hdc1, hdc2, hdc3, newCard, newRow, newRoute, newName,
    newNote, moreRow, recCtaWrap, icoMoreChev, recFootCol, recReports, recReason, todoCard,
    todoTitle, todoSub, todoBtn, nextWrap, nextRow, nextLabel, nextMeta, spendCard,
    spendTop, spendDonutRow, spendDonutWrap, spendDonutPct, spendDonutCol, spendBig, spendOf, spendTrack,
    spendFill, spendNote, secMore, startBox, startT, startS, startBtn, prepEmpty,
    defaultSchedule, prepPartial, prep, recs, nextSteps, feed, tabs, icoSearch,
    icoBell, icoMore, icoLoc, icoChev, typeSpec, hdiffs, newScreens, root,
    intro, eyebrow, h0, lead, row, col, colDone, colWide,
    colWideAfter, tag, tagId, tagDesc, phone, bar, navBar, navTitle,
    navPad, icoBack, scroll, loginBrand, markBox, icoMark, loginTitle, benefitWrap,
    benefitRow, benefitDot, benefitCol, benefitT, benefitText, benefits, loginAuth, ageCta,
    ageRow, ageCheck, ageLabel, kakaoBtn, kakaoMark, legal, stepNav, progTrack,
    prog20, prog40, prog60, prog80, prog100, stepLabel, qBlock, qBlockSm,
    qTitle, qTitleSm, qSub, sec, secTitle, rows, dateField, ddayRow,
    ddayLabel, ddayVal, chipUndecided, answeredWrap, ansRow, ansCheck, ansLabel, ansVal,
    ansEdit, answered, answered2, wheelSheet, sheetGrab, sheetHead, sheetTitle, sheetClose,
    icoX, wheelWrap, wheelBand, wheelFadeTop, wheelFadeBottom, sheetDock, wheels, regionWrap,
    regions, distWrap, districts, styleBtnWrap, styleCol, styleDesc, styleBtns, pgWrap,
    pgHead, pgTitle, cellCheck, styleGrid, styleCell, styleCheck, styleLabel, styles,
    styleHead, selectAll, osToastWrap, osToast, toast, uploadGrid, upCell, upT,
    upS, uploadWays, tipRow, tipCheck, tipText, tips, noteBox, mergeBox,
    noteT, noteS, ocrHead, ocrK, ocrV, ocrHint, ocrFields, dockSingle,
    dockPair, ctaFull, ctaWide, ctaGhost, ctaDim, diffCard, diffHead, diffRow,
    dh1, dh2, dh3, dh4, dc1, dc2, dc3, diffs,
    tagIdWide, tagRow, tagText
  } = useDesignValues(Model, props);
  return (
<React.Fragment>

<section style={toStyle(root)}>
<div style={toStyle(intro)}>
<span style={toStyle(eyebrow)}>{"WeddingPick · Figma → 정본"}</span>
<span style={toStyle(h0)}>{"로그인 → 온보딩 → 홈"}</span>
<span style={toStyle(lead)}>{"카카오 로그인과 5단계 초기 설정을 거쳐 홈에 닿는 흐름입니다. 한 세션에 모았습니다."}</span>
</div>
<div style={toStyle(row)}>
<div style={toStyle("width:100%;flex:0 0 100%;padding:16px 0 0;font-size:22px;line-height:30px;font-weight:700;color:#212124")}>{"1 · 로그인 · 온보딩"}</div>
<div style={toStyle(hcol)}>
<div style={toStyle(htag)}><span style={toStyle(htagId)}>{"1"}</span>{"스플래시 · 시작 · WP-APP-001"}</div>
<span style={toStyle(htagDesc)}>{"앱을 열면 뜹니다. 스킨과 무관하게 Coral 고정이고, 마크는 White입니다. 로그인 여부를 확인하는 동안만 보이고 버튼은 없습니다."}</span>
<div style={toStyle(hphone)} data-design-frame="true" data-source-line={54}>
<div style={toStyle(splashStage)}>
<span style={toStyle(splashMark)}></span>
<span style={toStyle(splashName)}>{"웨딩픽"}</span>
</div>
</div>
</div>
<div style={toStyle(col)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"2"}</span>{"로그인 · WP-AUTH-001"}</div>
<span style={toStyle(tagDesc)}>{"영문 eyebrow와 「✦ 나에게 맞는 순서부터」 카드를 뺐습니다. 브랜드 블록에 flex:1을 주어 버튼이 하단에 붙습니다. 만 14세 확인과 약관 동의는 WP-AUTH-010에서 받습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={65}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(loginBrand)}>
<span style={toStyle(markBox)}>
<svg width={"40"} height={"40"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#ff6f61"} strokeWidth={"1.9"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z"}></path><path d={"M9.4 11.9l1.7 1.7 3.4-3.4"}></path></svg>
</span>
<span style={toStyle(loginTitle)}>{"플래너 없이,"}<br />{"직접 고르는"}<br />{"웨딩 준비"}</span>
<div style={toStyle(benefitWrap)}>
{Array.from((benefits) ?? []).map((b, __index1) => (
<React.Fragment key={__index1}>

<div style={toStyle(benefitRow)}><span style={toStyle(benefitDot)}></span><span style={toStyle(benefitText)}>{b}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(loginAuth)}>
<div style={toStyle(kakaoBtn)}><span style={toStyle(kakaoMark)}>{"k"}</span>{"카카오로 시작하기"}</div>
</div>
</div>
</div>
<div style={toStyle(hcol)}>
<div style={toStyle(htag)}><span style={toStyle(htagId)}>{"3"}</span>{"만 14세 이용 불가 · WP-AUTH-009"}</div>
<span style={toStyle(htagDesc)}>{"카카오 출생연도가 만 14세 미달일 때만 뜹니다. 계정은 만들지 않고, CTA는 coral을 쓰지 않습니다."}</span>
<div style={toStyle(hphone)} data-design-frame="true" data-source-line={87}>
<div style={toStyle(hbar)}><span>{"9:41"}</span></div>
<div style={toStyle(agesStage)}>
<span style={toStyle(agesTitle)}>{"만 14세가 되면"}<br />{"웨딩픽을 이용할 수 있어요"}</span>
<span style={toStyle(agesNote)}>{"계정은 만들지 않았어요. 출생 연도는 삭제했어요."}</span>
</div>
<div style={toStyle(dockSingleH)}><span style={toStyle(ctaGhostH)}>{"돌아가기"}</span></div>
</div>
</div>
<div style={toStyle(hcol)}>
<div style={toStyle(htag)}><span style={toStyle(htagId)}>{"4"}</span>{"약관 동의 · 권한 안내 · WP-AUTH-010"}</div>
<span style={toStyle(htagDesc)}>{"카카오 로그인 직후, 초기 설정 전에 한 번 뜹니다. 필수 5개를 모두 체크해야 버튼이 켜집니다. 필수 · 선택 · 앱 접근 권한 3구획으로 나눴고, 권한은 아이콘 4칸으로만 보여줍니다. OS 권한 창은 각 기능을 처음 쓸 때 하나씩 띄웁니다."}</span>
<div style={toStyle(hphone)} data-design-frame="true" data-source-line={100}>
<div style={toStyle(hbar)}><span>{"9:41"}</span></div>
<div className={"nsb"} style={toStyle(permScroll)}>
<div style={toStyle(permHead)}>
<span style={toStyle(permTitle)}>{"웨딩픽 이용을 위해"}<br />{"동의가 필요해요"}</span>
</div>
<div style={toStyle(agAllRow)}>
<span style={toStyle(agChkOn)}></span>
<span style={toStyle(agAllT)}>{"전체 동의"}</span>
</div>
<div style={toStyle(agSec)}>
<span style={toStyle(agSecT)}>{"필수"}</span>
{Array.from((agreeReq) ?? []).map((a, __index2) => (
<React.Fragment key={__index2}>

<div style={toStyle(a.row)}>
<span style={toStyle(a.chk)}></span>
<span style={toStyle(agItemT)}>{a.label}</span>
{Boolean(a.hasDoc) ? <> <span style={toStyle(agChev)}></span> </> : null}
</div>

</React.Fragment>
))}
</div>
<div style={toStyle(agSec)}>
<span style={toStyle(agSecT)}>{"선택"}</span>
{Array.from((agreeOpt) ?? []).map((a, __index3) => (
<React.Fragment key={__index3}>

<div style={toStyle(a.row)}>
<span style={toStyle(a.chk)}></span>
<span style={toStyle(agItemT)}>{a.label}</span>
{Boolean(a.hasDoc) ? <> <span style={toStyle(agChev)}></span> </> : null}
</div>

</React.Fragment>
))}
</div>
<div style={toStyle(agSec)}>
<span style={toStyle(agSecT)}>{"앱 접근 권한"}</span>
<div style={toStyle(permGrid)}>
{Array.from((perms) ?? []).map((p, __index4) => (
<React.Fragment key={__index4}>

<div style={toStyle(permCell)}>
<span style={toStyle(permIcoWrap)}><span style={toStyle(p.ico)}></span></span>
<span style={toStyle(permCellT)}>{p.name}</span>
</div>

</React.Fragment>
))}
</div>
<span style={toStyle(permNoteT)}>{"기능을 처음 쓸 때 물어봐요. "}<b style={toStyle("font-weight:700")}>{"설정 > 웨딩픽"}</b>{"에서 바꿀 수 있어요."}</span>
</div>
</div>
<div style={toStyle(dockSingleH)}><span style={toStyle(permCta)}>{"동의하고 시작하기"}</span></div>
</div>
</div>
<div style={toStyle(hcol)}>
<div style={toStyle(htag)}><span style={toStyle(htagIdWide)}>{"4-1"}</span>{"약관 상세 · WP-AUTH-011"}</div>
<span style={toStyle(htagDesc)}>{"약관 동의 · MY · 서비스 정보의 >에서 여는 공통 풀팝업입니다. 누른 항목의 탭이 선택된 채로 열리고, 탭은 가로 스크롤합니다. 동의 화면에서 열었을 때만 하단에 «동의하기»가 붙습니다."}</span>
<div style={toStyle(hphone)} data-design-frame="true" data-source-line={150}>
<div style={toStyle(hbar)}><span>{"9:41"}</span></div>
<div style={toStyle(tdNav)}><span style={toStyle(formClose)}><span style={toStyle(icoXsm)}></span></span><span style={toStyle(tdNavT)}>{"약관 상세"}</span><span style={toStyle(tdNavPad)}></span></div>
<div className={"nsb"} style={toStyle(tdTabs)}>
{Array.from((termTabs) ?? []).map((t, __index5) => (
<React.Fragment key={__index5}>
<span style={toStyle(t.style)} onClick={t.onClick}>{t.label}</span>
</React.Fragment>
))}
</div>
<div className={"nsb"} style={toStyle(tdScroll)}>
<div style={toStyle(tdHead)}>
<span style={toStyle(tdTitle)}>{tdDocTitle}</span>
<span style={toStyle(tdMeta)}>{tdDocMeta}</span>
</div>
{Array.from((termArts) ?? []).map((a, __index6) => (
<React.Fragment key={__index6}>

<div style={toStyle(tdArt)}>
<span style={toStyle(tdArtT)}>{a.t}</span>
<span style={toStyle(tdArtB)}>{a.b}</span>
</div>

</React.Fragment>
))}
<div style={toStyle("height:16px")}></div>
</div>
<div style={toStyle(dockSingleH)}><span style={toStyle(permCta)}>{"동의하기"}</span></div>
</div>
</div>
<div style={toStyle(col)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"5"}</span>{"초기 설정 · 1/5 예식일 · WP-AUTH-002"}</div>
<span style={toStyle(tagDesc)}>{"5단계로 늘리고 「JUST FOR YOU」 영문 라벨과 「나중에」 건너뛰기를 없앴습니다. 예식일은 휠 피커로 받습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={176}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(stepNav)}><div style={toStyle(progTrack)}><span style={toStyle(prog20)}></span></div><span style={toStyle(stepLabel)}>{"1/5"}</span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(qBlock)}>
<span style={toStyle(qTitle)}>{"예식일은"}<br />{"언제인가요?"}</span>
<span style={toStyle(qSub)}>{"남은 기간에 맞춰 지금 정할 것부터 알려드려요"}</span>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(dateField)}>{"2027.05.16(토)"}</div>
<div style={toStyle(ddayRow)}><span style={toStyle(ddayLabel)}>{"오늘부터"}</span><span style={toStyle(ddayVal)}>{"250일"}</span></div>
<span style={toStyle(chipUndecided)}>{"아직 정하지 않았어요"}</span>
</div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaFull)}>{"다음"}</span></div>
</div>
</div>
<div style={toStyle(col)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"6"}</span>{"초기 설정 · 2/5 지역 · WP-AUTH-003"}</div>
<span style={toStyle(tagDesc)}>{"예식일과 같은 방식입니다. 필드를 누르면 2열 휠 바텀시트가 올라옵니다. 시/도 하나 · 시/군/구 하나만 고릅니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={197}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(stepNav)}><div style={toStyle(progTrack)}><span style={toStyle(prog40)}></span></div><span style={toStyle(stepLabel)}>{"2/5"}</span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(qBlock)}>
<span style={toStyle(qTitle)}>{"어디에서"}<br />{"식을 올리시나요?"}</span>
<span style={toStyle(qSub)}>{"선택한 지역으로 좁혀드려요"}</span>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(dateField)}>{"서울 강남구"}</div>
</div>
<div style={toStyle(wheelSheet)}>
<div style={toStyle(sheetGrab)}></div>
<div style={toStyle(sheetHead)}><span style={toStyle(sheetTitle)}>{"지역 선택"}</span><span style={toStyle(sheetClose)}><span style={toStyle(icoX)}></span></span></div>
<div style={toStyle(wheelWrap)}>
<div style={toStyle(wheelBand)}></div>
{Array.from((wheels) ?? []).map((w, __index7) => (
<React.Fragment key={__index7}>

<div className={"nsb"} style={toStyle(w.colStyle)}>
{Array.from((w.items) ?? []).map((i, __index8) => (
<React.Fragment key={__index8}>
<span style={toStyle(i.style)}>{i.label}</span>
</React.Fragment>
))}
</div>

</React.Fragment>
))}
<div style={toStyle(wheelFadeTop)}></div>
<div style={toStyle(wheelFadeBottom)}></div>
</div>
<div style={toStyle(sheetDock)}><span style={toStyle(ctaFull)}>{"확인"}</span></div>
</div>
</div>
<div style={toStyle(dockPair)}><span style={toStyle(ctaGhost)}>{"이전"}</span><span style={toStyle(ctaWide)}>{"다음"}</span></div>
</div>
</div>
<div style={toStyle(col)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"7"}</span>{"초기 설정 · 3/5 진행 상황 · WP-AUTH-004"}</div>
<span style={toStyle(tagDesc)}>{"이미 정한 곳을 고릅니다. 고른 카테고리는 내 웨딩 준비에 «결정 완료»로 들어갑니다. 세부 업종은 부제로 적습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={231}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(stepNav)}><div style={toStyle(progTrack)}><span style={toStyle(prog60)}></span></div><span style={toStyle(stepLabel)}>{"3/5"}</span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(qBlock)}>
<span style={toStyle(qTitle)}>{"준비는"}<br />{"어디까지 했나요?"}</span>
<span style={toStyle(qSub)}>{"이미 정한 건 내 웨딩 준비에 바로 넣어드려요"}</span>
</div>
<div style={toStyle(prepSec)}>
{Array.from((prepGroups) ?? []).map((c, __index9) => (
<React.Fragment key={__index9}>

<div style={toStyle(c.cell)}>
<div style={toStyle(prepCol)}><span style={toStyle(c.nameStyle)}>{c.name}</span><span style={toStyle(c.descStyle)}>{c.desc}</span></div>
<span style={toStyle(c.mark)}></span>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle("height:16px")}></div>
</div>
<div style={toStyle(dockPair)}><span style={toStyle(ctaGhost)}>{"이전"}</span><span style={toStyle(ctaWide)}>{"다음"}</span></div>
</div>
</div>
<div style={toStyle(col)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"8"}</span>{"초기 설정 · 4/5 예산 · WP-AUTH-005"}</div>
<span style={toStyle(tagDesc)}>{"구간을 고르지 않고 금액을 직접 적습니다. 만원 단위로 끊어 입력하고, 자주 쓰는 금액은 칩으로 한 번에 넣습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={256}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(stepNav)}><div style={toStyle(progTrack)}><span style={toStyle(prog80)}></span></div><span style={toStyle(stepLabel)}>{"4/5"}</span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(qBlock)}>
<span style={toStyle(qTitle)}>{"앞으로 쓸 예산은"}<br />{"얼마인가요?"}</span>
<span style={toStyle(qSub)}>{"예산에 맞는 업체부터 보여드려요"}</span>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(amtField)}><span style={toStyle(amtVal)}>{"5,000"}</span><span style={toStyle(amtUnit)}>{"만원"}</span></div>
<div style={toStyle(amtChips)}>
{Array.from((amtQuick) ?? []).map((q, __index10) => (
<React.Fragment key={__index10}>
<span style={toStyle(q.style)}>{q.label}</span>
</React.Fragment>
))}
</div>
<span style={toStyle(amtNote)}>{"이미 정한 곳에 쓴 돈은 빼고 적어주세요"}</span>
</div>
</div>
<div style={toStyle(dockPair)}><span style={toStyle(ctaGhost)}>{"이전"}</span><span style={toStyle(ctaWide)}>{"다음"}</span></div>
</div>
</div>
<div style={toStyle(col)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"9"}</span>{"초기 설정 · 5/5 스타일 · WP-AUTH-006"}</div>
<span style={toStyle(tagDesc)}>{"스타일 4종 고정입니다. 이미지를 쓰지 않고 버튼으로 고릅니다. 각 버튼에 어떤 느낌인지 한 줄을 붙여 말로 판단하게 합니다. 개수 제한 없이 원하는 만큼 고를 수 있습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={279}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(stepNav)}><div style={toStyle(progTrack)}><span style={toStyle(prog100)}></span></div><span style={toStyle(stepLabel)}>{"5/5"}</span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(qBlock)}>
<span style={toStyle(qTitle)}>{"어떤 스타일을"}<br />{"좋아하세요?"}</span>
<span style={toStyle(qSub)}>{"마음에 드는 스타일을 골라주세요"}</span>
</div>
<div style={toStyle(styleBtnWrap)}>
{Array.from((styleBtns) ?? []).map((s, __index11) => (
<React.Fragment key={__index11}>

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
<div style={toStyle(dockPair)}><span style={toStyle(ctaGhost)}>{"이전"}</span><span style={toStyle(ctaWide)}>{"다음"}</span></div>
</div>
</div>
<div style={toStyle(colDone)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"10"}</span>{"초기 설정 · 완료 · WP-AUTH-007"}</div>
<span style={toStyle(tagDesc)}>{"홈에 들어가기 전 한 번 더 봅니다. 여기서 바꾸면 해당 단계로 돌아갑니다. 진행바는 100%이고 Back은 두지 않습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={307}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(stepNav)}><div style={toStyle(progTrack)}><span style={toStyle(prog100)}></span></div><span style={toStyle(stepLabel)}>{"완료"}</span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(qBlock)}>
<span style={toStyle(qTitle)}>{"이대로"}<br />{"시작할까요?"}</span>
<span style={toStyle(qSub)}>{"MY에서 언제든 바꿀 수 있어요"}</span>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(sumCard)}>
{Array.from((summary) ?? []).map((s, __index12) => (
<React.Fragment key={__index12}>

<div style={toStyle(s.rowStyle)}>
<span style={toStyle(sumK)}>{s.k}</span>
<span style={toStyle(sumV)}>{s.v}</span>
<span style={toStyle(sumEdit)}>{"바꾸기"}</span>
</div>

</React.Fragment>
))}
</div>
</div>
</div>
<div style={toStyle(dockSingle2)}><span style={toStyle(ctaFullP)}>{"웨딩픽 시작하기"}</span></div>
</div>
</div>
</div>
<div style={toStyle("display:flex;gap:36px;align-items:flex-start;flex-wrap:wrap;max-width:1900px")}>
<div style={toStyle("width:100%;flex:0 0 100%;padding:16px 0 0;font-size:22px;line-height:30px;font-weight:700;color:#212124")}>{"2 · 홈"}</div>
<div style={toStyle("display:flex;flex-direction:column;gap:24px")}>
<div style={toStyle(hcol)}>
<div style={toStyle(htag)}><span style={toStyle(htagId)}>{"11"}</span>{"Home · 중복 정리 · WP-HOME-001"}</div>
<span style={toStyle(htagDesc)}>{"전체 화면 체계에 맞춰 개편했습니다. 별점을 실 제보 건수로 바꿨습니다. «내 웨딩 준비» 카드는 Pick과 연계됩니다 — «자세히»와 각 카드를 누르면 Pick의 해당 업종으로 이동합니다. 상태는 미정 · 상담예약 완료 · Pick 인증 완료 · 계약 완료 4단계이고, 계약 완료면 카드가 코랄로 채워지고 히어로에도 배지로 나옵니다."}</span>
<div style={toStyle(hphone)} data-design-frame="true" data-source-line={339}>
<div style={toStyle(hbar)}><span>{"9:41"}</span><span style={toStyle(barIcons)}><svg width={"17"} height={"11"} viewBox={"0 0 17 11"} fill={"#212124"}><rect x={"0"} y={"7"} width={"3"} height={"4"} rx={"1"}></rect><rect x={"4.5"} y={"5"} width={"3"} height={"6"} rx={"1"}></rect><rect x={"9"} y={"2.5"} width={"3"} height={"8.5"} rx={"1"}></rect><rect x={"13.5"} y={"0"} width={"3"} height={"11"} rx={"1"}></rect></svg><svg width={"25"} height={"12"} viewBox={"0 0 25 12"} fill={"none"}><rect x={"0.5"} y={"0.5"} width={"21"} height={"11"} rx={"3"} stroke={"#212124"} strokeOpacity={".35"}></rect><rect x={"2"} y={"2"} width={"17"} height={"8"} rx={"1.8"} fill={"#212124"}></rect></svg></span></div>
<div style={toStyle(header)}>
<span style={toStyle(wordmark)}>{"웨딩픽"}</span>
<span style={toStyle(headIcons)}>
<span style={toStyle(iconBtn)}><span style={toStyle(icoBell)}></span></span>
</span>
</div>
<div className={"nsb"} style={toStyle(hscroll)}>
<div style={toStyle(heroWrap)}>
<div style={toStyle(hero)}>
<span style={toStyle(heroBlob1)}></span>
<span style={toStyle(heroBlob2)}></span>
<div style={toStyle(heroInner)}>
<div style={toStyle(heroTop)}>
<span style={toStyle(heroKicker)}>{"두근두근"}</span>
<span style={toStyle(heroMore)}><span style={toStyle(icoMore)}></span></span>
</div>
<span style={toStyle(dday)}>{"D-127"}</span>
<span style={toStyle(heroDate)}>{"2027년 1월 15일 (금) · 서울 그랜드 워커힐"}<span style={toStyle(heroVenueBadge)}>{"계약 완료"}</span></span>
<div style={toStyle(coupleRow)}>
<span style={toStyle(avWrap)}><span style={toStyle(av1)}>{"지"}</span><span style={toStyle(av2)}>{"준"}</span></span>
<span style={toStyle(coupleText)}>{"지윤 · 준혁 · 함께 준비 중"}</span>
</div>
</div>
</div>
</div>
<div style={toStyle(secNoPad)}>
<div style={toStyle(secHeadPad)}>
<div style={toStyle(secHeadCol)}>
<span style={toStyle(hsecTitle)}>{"내 웨딩 준비"}</span>
<span style={toStyle(secSub)}>{"지금은 스튜디오 차례예요"}</span>
</div>
<a href={designHref("대메뉴_Pick.dc.html")} style={toStyle(moreRow)}>{"자세히"}<span style={toStyle(icoMoreChev)}></span></a>
</div>
<div style={toStyle(prepGridPad)}>
{Array.from((prep) ?? []).map((p, __index13) => (
<React.Fragment key={__index13}>

<a href={designHref(p.href)} style={toStyle(p.card)}>
<div style={toStyle(prepTop)}>
<span style={toStyle(p.iconStyle)} className={p.iconClass}>{p.iconText}</span>
<span style={toStyle(p.markStyle)}></span>
</div>
<span style={toStyle(prepLabel)}>{p.label}</span>
<span style={toStyle(p.detailStyle)}>{p.detail}</span>
</a>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(hsec)}>
<div style={toStyle(secHead)}>
<div style={toStyle(secHeadCol)}>
<span style={toStyle(hsecTitle)}>{"웨딩일정"}</span>
<span style={toStyle(secSub)}>{"가까운 일정부터 안내드려요"}</span>
</div>
<span style={toStyle(moreRow)}>{"자세히"}<span style={toStyle(icoMoreChev)}></span></span>
</div>
<div style={toStyle(schedWrap)}>
{Array.from((schedule) ?? []).map((s, __index14) => (
<React.Fragment key={__index14}>

<div style={toStyle(s.row)}>
<div style={toStyle(schedDate)}>
<span style={toStyle(schedMonth)}>{s.month}</span>
<span style={toStyle(s.dayStyle)}>{s.day}</span>
</div>
<div style={toStyle(schedCol)}>
<span style={toStyle(schedTitle)}>{s.title}</span>
<span style={toStyle(schedMeta)}>{s.meta}</span>
</div>
<span style={toStyle(s.ddayStyle)}>{s.dday}</span>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(hsec)}>
<div style={toStyle(secHead)}>
<div style={toStyle(secHeadCol)}>
<span style={toStyle(hsecTitle)}>{"예산현황"}</span>
<span style={toStyle(secSub)}>{"예산의 57%를 썼어요"}</span>
</div>
<span style={toStyle(moreRow)}>{"자세히"}<span style={toStyle(icoMoreChev)}></span></span>
</div>
<div style={toStyle(spendCard)}>
<div style={toStyle(spendDonutRow)}>
<div style={toStyle(spendDonutWrap)}>
<svg width={"72"} height={"72"} viewBox={"0 0 72 72"}>
<circle cx={"36"} cy={"36"} r={"28"} fill={"none"} stroke={"#eaebee"} strokeWidth={"10"}></circle>
<circle cx={"36"} cy={"36"} r={"28"} fill={"none"} stroke={"#ff6f61"} strokeWidth={"10"} strokeDasharray={"100.3 75.7"} strokeLinecap={"round"} transform={"rotate(-90 36 36)"}></circle>
</svg>
<span style={toStyle(spendDonutPct)}>{"57%"}</span>
</div>
<div style={toStyle(spendDonutCol)}>
<span style={toStyle(spendBig)}>{"1,000만원"}</span>
<span style={toStyle(spendOf)}>{"예산 1,750만원"}</span>
</div>
</div>
<span style={toStyle(spendNote)}>{"웨딩홀이 예산의 43%로 가장 큰 비중이에요"}</span>
</div>
</div>
<div style={toStyle(secLast)}>
<div style={toStyle(secHead)}>
<div style={toStyle(secHeadCol)}>
<span style={toStyle(hsecTitle)}>{"웨딩 준비 팁"}</span>
<span style={toStyle(secSub)}>{"지금 단계에서 읽어두면 좋아요"}</span>
</div>
<span style={toStyle(moreRow)}>{"자세히"}<span style={toStyle(icoMoreChev)}></span></span>
</div>
<div style={toStyle(feedWrap)}>
{Array.from((feed) ?? []).map((f, __index15) => (
<React.Fragment key={__index15}>

<div style={toStyle(feedCard)}>
<span style={toStyle(f.thumbStyle)}></span>
<div style={toStyle(feedBody)}>
<span style={toStyle(feedCat)}>{f.category}</span>
<span style={toStyle(feedTitle)}>{f.title}</span>
<span style={toStyle(feedMeta)}>{f.meta}</span>
</div>
<span style={toStyle(feedChev)}></span>
</div>

</React.Fragment>
))}
</div>
</div>
</div>
<div style={toStyle(tabBar)}>
{Array.from((tabs) ?? []).map((t, __index16) => (
<React.Fragment key={__index16}>

<div style={toStyle(t.wrapStyle)}>
{Boolean(t.isPick) ? <> 
<span style={toStyle(t.fabStyle)}><span style={toStyle(t.iconStyle)}></span></span>
 </> : null}
{Boolean(t.isPlain) ? <> 
<span style={toStyle(t.iconStyle)}></span>
 </> : null}
<span style={toStyle(t.labelStyle)}>{t.label}</span>
</div>

</React.Fragment>
))}
</div>
</div>
</div>
<div style={toStyle(hcol)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"11-1"}</span><span style={toStyle(tagText)}>{"홈 · 아무것도 없을 때 · WP-HOME-002"}</span></div>
<span style={toStyle(tagDesc)}>{"온보딩만 마치고 아직 아무것도 정하지 않은 경우입니다. 히어로에 예식장 정보가 없고, 4칸 모두 미정입니다. 예산·일정 섹션 대신 시작 안내를 하나만 둡니다."}</span>
<div style={toStyle(hphone)} data-design-frame="true" data-source-line={487}>
<div style={toStyle(hbar)}><span>{"9:41"}</span></div>
<div style={toStyle(header)}><span style={toStyle(wordmark)}>{"웨딩픽"}</span><span style={toStyle(headIcons)}><span style={toStyle(iconBtn)}><span style={toStyle(icoBell)}></span></span></span></div>
<div className={"nsb"} style={toStyle(hscroll)}>
<div style={toStyle(heroWrap)}>
<div style={toStyle(hero)}>
<span style={toStyle(heroBlob1)}></span><span style={toStyle(heroBlob2)}></span>
<div style={toStyle(heroInner)}>
<div style={toStyle(heroTop)}><span style={toStyle(heroKicker)}>{"두근두근"}</span></div>
<span style={toStyle(dday)}>{"D-127"}</span>
<span style={toStyle(heroDate)}>{"예식일만 정했어요 · 장소는 아직이에요"}</span>
</div>
</div>
</div>
<div style={toStyle(secNoPad)}>
<div style={toStyle(secHeadPad)}><div style={toStyle(secHeadCol)}><span style={toStyle(hsecTitle)}>{"내 웨딩 준비"}</span><span style={toStyle(secSub)}>{"아직 정한 게 없어요"}</span></div><a href={designHref("대메뉴_Pick.dc.html")} style={toStyle(moreRow)}>{"자세히"}<span style={toStyle(icoMoreChev)}></span></a></div>
<div style={toStyle(prepGridPad)}>
{Array.from((prepEmpty) ?? []).map((p, __index17) => (
<React.Fragment key={__index17}>

<a href={designHref(p.href)} style={toStyle(p.card)}>
<div style={toStyle(prepTop)}><span style={toStyle(p.iconStyle)} className={p.iconClass}>{p.iconText}</span><span style={toStyle(p.markStyle)}></span></div>
<span style={toStyle(prepLabel)}>{p.label}</span>
<span style={toStyle(p.detailStyle)}>{p.detail}</span>
</a>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(hsec)}>
<div style={toStyle(secHead)}><div style={toStyle(secHeadCol)}><span style={toStyle(hsecTitle)}>{"웨딩일정"}</span><span style={toStyle(secSub)}>{"기본 순서로 안내드려요 · 언제든 바꿀 수 있어요"}</span></div></div>
<div style={toStyle(schedWrap)}>
{Array.from((defaultSchedule) ?? []).map((s, __index18) => (
<React.Fragment key={__index18}>

<div style={toStyle(s.row2)}>
<div style={toStyle(schedDate)}><span style={toStyle(s.numStyle)}>{s.num}</span></div>
<div style={toStyle(schedCol)}><span style={toStyle(schedTitle)}>{s.label}</span><span style={toStyle(schedMeta)}>{"날짜는 아직이에요"}</span></div>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(hsec)}>
<div style={toStyle(secHead)}><div style={toStyle(secHeadCol)}><span style={toStyle(hsecTitle)}>{"예산현황"}</span><span style={toStyle(secSub)}>{"온보딩에서 등록한 예산이에요"}</span></div></div>
<div style={toStyle(spendCard)}>
<div style={toStyle(spendDonutRow)}>
<div style={toStyle(spendDonutWrap)}><svg width={"72"} height={"72"} viewBox={"0 0 72 72"}><circle cx={"36"} cy={"36"} r={"28"} fill={"none"} stroke={"#eaebee"} strokeWidth={"10"}></circle></svg><span style={toStyle(spendDonutPct)}>{"0%"}</span></div>
<div style={toStyle(spendDonutCol)}><span style={toStyle(spendBig)}>{"0원"}</span><span style={toStyle(spendOf)}>{"예산 1,750만원"}</span></div>
</div>
<span style={toStyle(spendNote)}>{"아직 예산 정보가 없어요"}</span>
</div>
</div>
<div style={toStyle(secLast)}>
<div style={toStyle(secHead)}><div style={toStyle(secHeadCol)}><span style={toStyle(hsecTitle)}>{"웨딩 준비 팁"}</span><span style={toStyle(secSub)}>{"지금 단계에서 읽어두면 좋아요"}</span></div></div>
<div style={toStyle(feedWrap)}>
{Array.from((feed) ?? []).map((f, __index19) => (
<React.Fragment key={__index19}>

<div style={toStyle(feedCard)}>
<span style={toStyle(f.thumbStyle)}></span>
<div style={toStyle(feedBody)}><span style={toStyle(feedCat)}>{f.category}</span><span style={toStyle(feedTitle)}>{f.title}</span><span style={toStyle(feedMeta)}>{f.meta}</span></div>
<span style={toStyle(feedChev)}></span>
</div>

</React.Fragment>
))}
</div>
</div>
</div>
<div style={toStyle(tabBar)}>{Array.from((tabs) ?? []).map((t, __index20) => (
<React.Fragment key={__index20}>
<div style={toStyle(t.wrapStyle)}>{Boolean(t.isPick) ? <> <span style={toStyle(t.fabStyle)}><span style={toStyle(t.iconStyle)}></span></span> </> : null}{Boolean(t.isPlain) ? <> <span style={toStyle(t.iconStyle)}></span> </> : null}<span style={toStyle(t.labelStyle)}>{t.label}</span></div>
</React.Fragment>
))}</div>
</div>
</div>
<div style={toStyle(hcol)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"11-2"}</span><span style={toStyle(tagText)}>{"홈 · 일부 정보가 있을 때 · WP-HOME-003"}</span></div>
<span style={toStyle(tagDesc)}>{"한두 업종만 진행 중인 경우입니다. 히어로엔 예식장 정보가 아직 없고, 4칸 중 하나만 상담예약 완료 · 나머지는 미정입니다."}</span>
<div style={toStyle(hphone)} data-design-frame="true" data-source-line={556}>
<div style={toStyle(hbar)}><span>{"9:41"}</span></div>
<div style={toStyle(header)}><span style={toStyle(wordmark)}>{"웨딩픽"}</span><span style={toStyle(headIcons)}><span style={toStyle(iconBtn)}><span style={toStyle(icoBell)}></span></span></span></div>
<div className={"nsb"} style={toStyle(hscroll)}>
<div style={toStyle(heroWrap)}>
<div style={toStyle(hero)}>
<span style={toStyle(heroBlob1)}></span><span style={toStyle(heroBlob2)}></span>
<div style={toStyle(heroInner)}>
<div style={toStyle(heroTop)}><span style={toStyle(heroKicker)}>{"두근두근"}</span></div>
<span style={toStyle(dday)}>{"D-127"}</span>
<span style={toStyle(heroDate)}>{"2027년 1월 15일 (금) · 장소는 아직이에요"}</span>
</div>
</div>
</div>
<div style={toStyle(secNoPad)}>
<div style={toStyle(secHeadPad)}><div style={toStyle(secHeadCol)}><span style={toStyle(hsecTitle)}>{"내 웨딩 준비"}</span><span style={toStyle(secSub)}>{"지금은 웨딩홀 차례예요"}</span></div><a href={designHref("대메뉴_Pick.dc.html")} style={toStyle(moreRow)}>{"자세히"}<span style={toStyle(icoMoreChev)}></span></a></div>
<div style={toStyle(prepGridPad)}>
{Array.from((prepPartial) ?? []).map((p, __index21) => (
<React.Fragment key={__index21}>

<a href={designHref(p.href)} style={toStyle(p.card)}>
<div style={toStyle(prepTop)}><span style={toStyle(p.iconStyle)} className={p.iconClass}>{p.iconText}</span><span style={toStyle(p.markStyle)}></span></div>
<span style={toStyle(prepLabel)}>{p.label}</span>
<span style={toStyle(p.detailStyle)}>{p.detail}</span>
</a>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(hsec)}>
<div style={toStyle(secHead)}><div style={toStyle(secHeadCol)}><span style={toStyle(hsecTitle)}>{"웨딩일정"}</span><span style={toStyle(secSub)}>{"기본 순서로 안내드려요 · 언제든 바꿀 수 있어요"}</span></div></div>
<div style={toStyle(schedWrap)}>
{Array.from((defaultSchedule) ?? []).map((s, __index22) => (
<React.Fragment key={__index22}>

<div style={toStyle(s.row2)}>
<div style={toStyle(schedDate)}><span style={toStyle(s.numStyle)}>{s.num}</span></div>
<div style={toStyle(schedCol)}><span style={toStyle(schedTitle)}>{s.label}</span><span style={toStyle(schedMeta)}>{"날짜는 아직이에요"}</span></div>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(hsec)}>
<div style={toStyle(secHead)}><div style={toStyle(secHeadCol)}><span style={toStyle(hsecTitle)}>{"예산현황"}</span><span style={toStyle(secSub)}>{"온보딩에서 등록한 예산이에요"}</span></div></div>
<div style={toStyle(spendCard)}>
<div style={toStyle(spendDonutRow)}>
<div style={toStyle(spendDonutWrap)}><svg width={"72"} height={"72"} viewBox={"0 0 72 72"}><circle cx={"36"} cy={"36"} r={"28"} fill={"none"} stroke={"#eaebee"} strokeWidth={"10"}></circle><circle cx={"36"} cy={"36"} r={"28"} fill={"none"} stroke={"#ff6f61"} strokeWidth={"10"} strokeDasharray={"12.6 163.4"} strokeLinecap={"round"} transform={"rotate(-90 36 36)"}></circle></svg><span style={toStyle(spendDonutPct)}>{"7%"}</span></div>
<div style={toStyle(spendDonutCol)}><span style={toStyle(spendBig)}>{"120만원"}</span><span style={toStyle(spendOf)}>{"예산 1,750만원"}</span></div>
</div>
<span style={toStyle(spendNote)}>{"웨딩홀 상담 예약금만 냈어요"}</span>
</div>
</div>
<div style={toStyle(secLast)}>
<div style={toStyle(secHead)}><div style={toStyle(secHeadCol)}><span style={toStyle(hsecTitle)}>{"웨딩 준비 팁"}</span><span style={toStyle(secSub)}>{"지금 단계에서 읽어두면 좋아요"}</span></div></div>
<div style={toStyle(feedWrap)}>
{Array.from((feed) ?? []).map((f, __index23) => (
<React.Fragment key={__index23}>

<div style={toStyle(feedCard)}>
<span style={toStyle(f.thumbStyle)}></span>
<div style={toStyle(feedBody)}><span style={toStyle(feedCat)}>{f.category}</span><span style={toStyle(feedTitle)}>{f.title}</span><span style={toStyle(feedMeta)}>{f.meta}</span></div>
<span style={toStyle(feedChev)}></span>
</div>

</React.Fragment>
))}
</div>
</div>
</div>
<div style={toStyle(tabBar)}>{Array.from((tabs) ?? []).map((t, __index24) => (
<React.Fragment key={__index24}>
<div style={toStyle(t.wrapStyle)}>{Boolean(t.isPick) ? <> <span style={toStyle(t.fabStyle)}><span style={toStyle(t.iconStyle)}></span></span> </> : null}{Boolean(t.isPlain) ? <> <span style={toStyle(t.iconStyle)}></span> </> : null}<span style={toStyle(t.labelStyle)}>{t.label}</span></div>
</React.Fragment>
))}</div>
</div>
</div>
</div>
<div style={toStyle(hcolWide)}>
<div style={toStyle(htag)}><span style={toStyle(htagId)}>{"12"}</span>{"홈 상태 3종 · WP-HOME-001"}</div>
<span style={toStyle(htagDesc)}>{"진행 상황 축입니다. 0개 · 1~8개 · 9개 이상이 화면 골격을 바꿉니다. 정보량(실 제보 3건 기준)은 각 카드 안에서 따로 갈립니다."}</span>
<div style={toStyle(stateRow)}>
<div style={toStyle(stateCard)}>
<span style={toStyle(stateLabel)}>{"0개 · 온보딩 직후"}</span>
<span style={toStyle(stateBig)}>{"아직 결정한 게 없어요"}</span>
<span style={toStyle(stateSub)}>{"내 웨딩 준비 4칸이 모두 미정이고 예산·일정은 기본값으로 떠요."}</span>
</div>
<div style={toStyle(stateCard)}>
<span style={toStyle(stateLabel)}>{"1~8개 · 준비 중"}</span>
<span style={toStyle(stateBig)}>{"진행바 38%"}</span>
<span style={toStyle(stateSub)}>{"결정한 것과 남은 것이 같이 보여요. 다음 준비 섹션이 가장 위에 있어요."}</span>
</div>
<div style={toStyle(stateCard)}>
<span style={toStyle(stateLabel)}>{"9개 이상 · 마무리"}</span>
<span style={toStyle(stateBig)}>{"진행바 92%"}</span>
<span style={toStyle(stateSub)}>{"내 웨딩 준비가 대부분 채워지고 웨딩일정과 예산현황이 위로 와요."}</span>
</div>
</div>
</div>
<div style={toStyle(hcol)}>
<div style={toStyle(htag)}><span style={toStyle(htagId)}>{"13"}</span>{"혜택 안내 시트 · WP-SHT-017"}</div>
<span style={toStyle(htagDesc)}>{"온보딩 완료 후 홈 최초 진입 1회, 400ms 뒤 뜹니다. 네 혜택 중 금액이 가장 큰 웨딩지원금 5만원만 내세웁니다."}</span>
<div style={toStyle(hphone)} data-design-frame="true" data-source-line={649}>
<div style={toStyle(hbar)}><span>{"9:41"}</span></div>
<div style={toStyle(dimWrapH)}>
<span style={toStyle(dimH)}></span>
<span style={toStyle(grabH)}></span>
<div style={toStyle(benSheet)}>
<div style={toStyle(formHead)}><span style={toStyle(benBig)}>{"웨딩지원금"}<br />{"5만원"}</span><span style={toStyle(formClose)}><span style={toStyle(icoXsm)}></span></span></div>
<span style={toStyle(benSub)}>{"응모하면 매달 1커플에게 지급해요"}</span>
<div style={toStyle(benConds)}>
{Array.from((benItems) ?? []).map((b, __index25) => (
<React.Fragment key={__index25}>

<div style={toStyle(benRow)}><span style={toStyle(benDot)}></span><span style={toStyle(benText)}>{b}</span></div>

</React.Fragment>
))}
</div>
<div style={toStyle(benDock)}><span style={toStyle(btnGhostH)}>{"나중에"}</span><span style={toStyle(btnFullH)}>{"혜택 보기"}</span></div>
</div>
</div>
</div>
</div>
<div style={toStyle("width:100%;flex:0 0 100%;padding:16px 0 0;font-size:22px;line-height:30px;font-weight:700;color:#212124")}>{"3 · 명세"}</div>
<div style={toStyle(colWideAfter)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"14"}</span>{"온보딩 · 정본과 다른 점"}</div>
<span style={toStyle(tagDesc)}>{"정책 판단이 필요한 항목은 주황색입니다."}</span>
<div style={toStyle(diffCard)}>
<div style={toStyle(diffHead)}><span style={toStyle(dh1)}>{"항목"}</span><span style={toStyle(dh2)}>{"Figma 원본"}</span><span style={toStyle(dh3)}>{"정본 적용"}</span><span style={toStyle(dh4)}>{"근거"}</span></div>
{Array.from((diffs) ?? []).map((d, __index26) => (
<React.Fragment key={__index26}>

<div style={toStyle(diffRow)}><span style={toStyle(dc1)}>{d.k}</span><span style={toStyle(dc2)}>{d.a}</span><span style={toStyle(d.bStyle)}>{d.b}</span><span style={toStyle(dc3)}>{d.why}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(hcol)}>
<div style={toStyle(htag)}><span style={toStyle(htagId)}>{"15"}</span>{"타이포 · 반지름"}</div>
<div style={toStyle(specCard)}>
{Array.from((typeSpec) ?? []).map((t2, __index27) => (
<React.Fragment key={__index27}>

<div style={toStyle(kvRow)}>
<span style={toStyle(kvKey)}>{t2.k}</span>
<span style={toStyle(kvVal)}>{t2.v}</span>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(hcolWide)}>
<div style={toStyle(htag)}><span style={toStyle(htagId)}>{"16"}</span>{"홈 · 정본과 다른 점"}</div>
<span style={toStyle(htagDesc)}>{"Figma 기준을 따르기로 했으므로 아래 항목은 정본 문서(CLAUDE.md · tokens.json · screens.json)를 고쳐야 합니다."}</span>
<div style={toStyle(hdiffCard)}>
<div style={toStyle(hdiffHead)}>
<span style={toStyle(hdh1)}>{"항목"}</span>
<span style={toStyle(hdh2)}>{"정본"}</span>
<span style={toStyle(hdh3)}>{"Figma"}</span>
<span style={toStyle(hdh4)}>{"판단"}</span>
</div>
{Array.from((hdiffs) ?? []).map((d, __index28) => (
<React.Fragment key={__index28}>

<div style={toStyle(hdiffRow)}>
<span style={toStyle(hdc1)}>{d.k}</span>
<span style={toStyle(hdc2)}>{d.a}</span>
<span style={toStyle(hdc3)}>{d.b}</span>
<span style={toStyle(d.verdictStyle)}>{d.verdict}</span>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle(tag2)}><span style={toStyle(htagId)}>{"17"}</span>{"Figma에만 있는 화면"}</div>
<div style={toStyle(newCard)}>
{Array.from((newScreens) ?? []).map((n, __index29) => (
<React.Fragment key={__index29}>

<div style={toStyle(newRow)}>
<span style={toStyle(newRoute)}>{n.route}</span>
<span style={toStyle(newName)}>{n.name}</span>
<span style={toStyle(newNote)}>{n.note}</span>
</div>

</React.Fragment>
))}
</div>
</div>
</div>

</section>
</React.Fragment>
  );
}
