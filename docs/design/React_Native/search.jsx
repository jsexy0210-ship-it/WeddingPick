import React from 'react';
import Model from '../models/search.js';
import { useDesignValues, toStyle, ImageSlot, designHref } from '../runtime/designRuntime.js';

/** 원본 화면 구조와 상태를 보존한 React 디자인 보드. Source: 대메뉴_검색.dc.html */
export default function SearchBoard(props) {
  const {
    o1, tabBar, tabCell, rootTabs, o2, o3, o4, o5,
    o6, o7, o8, o9, o10, o11, o12, o13,
    o14, o15, acSec, acHead, acLabel, acClearAll, acRow, acText,
    acBold, icoClock, icoX2, icoSearch2, acRecent, acSuggest, revTitleRow, writeReviewBtn,
    mapCardWrap, mapCard, mapCopyBtn, mapCardCol, galNav, galClose, icoXw, navTitleW,
    navRightPad, galBig, galStrip, galThumbs, secTop, priceBig, priceMeta, priceDist,
    rptLabel, rptTypes, rptArea, rptInput, rptPh, ctaFull2, vroot, vintro,
    veyebrow, h0, lead, row, vcol, vcolWide, vtag, vtagId,
    vtagDesc, vphone, vbar, navBar, navTitle, vicoBack, icoShare, vscroll,
    heroWrap, heroShade, heroText, heroCat, heroName, heroCount, priceBlock, tabNav,
    tabs, tabsPkg, tabsRev, sec, secHead, secTitle, secMeta, note,
    divider, reasonWrap, reasonRow, reasons, galWrap, galCell, gallery, rows,
    kvRow, kvK, kvV, included, extras, pkgHead, pkgNameCol, pkgName,
    pkgMeta, pkgPrice, pkgGrid, pkgCell, pkgCellK, pkgCellV, packages, axesWrap,
    axisBlock, axisQ, axisRow, axisTrack, axes, revItem, revHead, revAvatar,
    revNameCol, revName, revDate, badgeVerify, revAnswers, revChip, revText, reviews,
    overallStars, overallScore, starRow, starSumRow, starScore, h1, sub, dateWrap,
    dates, timeGrid, times, textarea, syncBox, syncT, syncS, dock,
    dockSingle, pickBtn, icoHeart, icoHeartW, ctaPick, ctaMain, ctaFull, tabsInfo,
    infoRow, infoK, infoV, infoRows, infoPartial, mapText2, emptyBox, emptyT,
    emptyS, faqHead, faqQ, faqA, faq, mapWrap, mapBtns, mapBtn,
    fixRow, fixText, icoChevR, vdiffCard, vdiffHead, vdiffRow, vdh1, vdh2,
    vdh3, vdh4, vdc1, vdc2, vdc3, vdiffs, root, intro,
    eyebrow, h40, introBody, boardRow, col, colWide, tag, tagId,
    tagDesc, phone, bar, barIcons, stickyHead, headTop, backBtn, headCol,
    headTitle, headSub, searchRow, searchBox, searchBoxOn, searchPh, searchVal, filterBtn,
    chipBar, chipBarRel, chipBarInner, chipDiv, sortChip, sortChipOn, caretDim, caretUp,
    sortPanel, rowCheck, countRow, countText, scroll, listWrap, vCard, vThumbWrap,
    vThumb, vBadge, vBody, vTop, vNameCol, vCat, vName, vLoc,
    vLocText, vTags, vTag, vFoot, vPrice, vMetrics, vStarWrap, vRating,
    vPicks, dimWrap, dim, sheet, grabber, sheetHead, sheetTitle, sheetSub,
    resetBtn, fGroup, fLabel, fOpts, optCheck, sortSec, sortLabel, sortRow,
    sheetCta, emptyWrap, emptyEmoji, emptyCta, nearWrap, nearLabel, nearRow, nearCol,
    nearName, nearMeta, nearPrice, nearNote, nearby, emptyTitle, emptySub, headTitleRoot,
    icoBack, icoSearch, icoSliders, icoX, icoPin, diffCard, diffHead, diffRow,
    dh1, dh2, dh3, dh4, dc1, dc2, dc3, chips,
    vendors, groups, sorts, sortRows, diffs
  } = useDesignValues(Model, props);
  return (
<React.Fragment>

<section style={toStyle(root)}>
<div style={toStyle(intro)}>
<span style={toStyle(eyebrow)}>{"WeddingPick · Figma 기준"}</span>
<span style={toStyle(h40)}>{"검색 → 업체상세"}</span>
<span style={toStyle(introBody)}>{"목록에서 업체를 고르고 상세에서 Pick까지 가는 흐름입니다. 업체 카드 규격은 두 화면이 같습니다."}</span>
</div>
<div style={toStyle(boardRow)}>
<div style={toStyle("width:100%;flex:0 0 100%;padding:16px 0 0;font-size:22px;line-height:30px;font-weight:700;color:#212124")}>{"1 · 검색"}</div>
<div style={toStyle(o1)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"1"}</span>{"결과 목록 · 기본 · WP-SRCH-001"}</div>
<span style={toStyle(tagDesc)}>{"칩바 패딩 12/20 균등. 좌측 칩 3개와 우측 슬라이더 아이콘은 필터 시트를 열고, 구분선 오른쪽 정렬 칩만 드롭다운입니다. 두 동작을 선으로 갈라 눌렀을 때 무엇이 뜨는지 예측되게 했습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={51}>
<div style={toStyle(bar)}><span>{"9:41"}</span><span style={toStyle(barIcons)}><svg width={"17"} height={"11"} viewBox={"0 0 17 11"} fill={"#212124"}><rect x={"0"} y={"7"} width={"3"} height={"4"} rx={"1"}></rect><rect x={"4.5"} y={"5"} width={"3"} height={"6"} rx={"1"}></rect><rect x={"9"} y={"2.5"} width={"3"} height={"8.5"} rx={"1"}></rect><rect x={"13.5"} y={"0"} width={"3"} height={"11"} rx={"1"}></rect></svg><svg width={"25"} height={"12"} viewBox={"0 0 25 12"} fill={"none"}><rect x={"0.5"} y={"0.5"} width={"21"} height={"11"} rx={"3"} stroke={"#1c1917"} strokeOpacity={".35"}></rect><rect x={"2"} y={"2"} width={"17"} height={"8"} rx={"1.8"} fill={"#212124"}></rect></svg></span></div>
<div style={toStyle(stickyHead)}>
<div style={toStyle(headTop)}>
<div style={toStyle(headCol)}>
<span style={toStyle(headTitleRoot)}>{"검색"}</span>
</div>
</div>
<div style={toStyle(searchRow)}>
<div style={toStyle(searchBox)}>
<span style={toStyle(icoSearch)}></span>
<span style={toStyle(searchPh)}>{"업체 이름, 지역, 카테고리 검색"}</span>
</div>
<span style={toStyle(filterBtn)}><span style={toStyle(icoSliders)}></span></span>
</div>
</div>
<div style={toStyle(countRow)}>
<span style={toStyle(countText)}>{"7개 업체"}</span>
<span style={toStyle(sortChip)}>{"추천순"}<span style={toStyle(caretDim)}></span></span>
</div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(listWrap)}>
{Array.from((vendors) ?? []).map((v, __index1) => (
<React.Fragment key={__index1}>

<div style={toStyle(vCard)}>
<div style={toStyle(vThumbWrap)}>
<span style={toStyle(v.thumbStyle)}></span>
{Boolean(v.badge) ? <> <span style={toStyle(vBadge)}>{v.badge}</span> </> : null}
</div>
<div style={toStyle(vBody)}>
<div style={toStyle(vTop)}>
<div style={toStyle(vNameCol)}>
<span style={toStyle(vCat)}>{v.categoryLabel}</span>
<span style={toStyle(vName)}>{v.name}</span>
</div>
<span style={toStyle(v.heartWrap)}><span style={toStyle(v.heartIcon)}></span></span>
</div>
<div style={toStyle(vLoc)}>
<span style={toStyle(icoPin)}></span>
<span style={toStyle(vLocText)}>{v.location}</span>
</div>
<div style={toStyle(vTags)}>
{Array.from((v.tags) ?? []).map((t, __index2) => (
<React.Fragment key={__index2}>

<span style={toStyle(vTag)}>{"#"}{t}</span>

</React.Fragment>
))}
</div>
<div style={toStyle(vFoot)}>
<span style={toStyle(vPrice)}>{v.price}</span>
<span style={toStyle(vMetrics)}>
<span style={toStyle(vPicks)}>{v.reports}</span>
</span>
</div>
</div>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(tabBar)}>{Array.from((rootTabs) ?? []).map((t, __index3) => (
<React.Fragment key={__index3}>
<div style={toStyle(tabCell)}><span style={toStyle(t.icon)}></span><span style={toStyle(t.label)}>{t.text}</span></div>
</React.Fragment>
))}</div>
</div>
</div>
<div style={toStyle(o2)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"2"}</span>{"필터 시트 · WP-SRCH-002"}</div>
<span style={toStyle(tagDesc)}>{"5그룹 단일 선택 · 정렬 4종 · CTA에 결과 수. 상단 우측에 초기화가 primary 색 텍스트로 있습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={117}>
<div style={toStyle(bar)}><span>{"9:41"}</span><span style={toStyle(barIcons)}><svg width={"17"} height={"11"} viewBox={"0 0 17 11"} fill={"#212124"}><rect x={"0"} y={"7"} width={"3"} height={"4"} rx={"1"}></rect><rect x={"4.5"} y={"5"} width={"3"} height={"6"} rx={"1"}></rect><rect x={"9"} y={"2.5"} width={"3"} height={"8.5"} rx={"1"}></rect><rect x={"13.5"} y={"0"} width={"3"} height={"11"} rx={"1"}></rect></svg><svg width={"25"} height={"12"} viewBox={"0 0 25 12"} fill={"none"}><rect x={"0.5"} y={"0.5"} width={"21"} height={"11"} rx={"3"} stroke={"#1c1917"} strokeOpacity={".35"}></rect><rect x={"2"} y={"2"} width={"17"} height={"8"} rx={"1.8"} fill={"#212124"}></rect></svg></span></div>
<div style={toStyle(dimWrap)}>
<span style={toStyle(dim)}></span>
<div className={"nsb"} style={toStyle(sheet)}>
<span style={toStyle(grabber)}></span>
<div style={toStyle(sheetHead)}>
<div style={toStyle(headCol)}>
<span style={toStyle(sheetTitle)}>{"필터"}</span>
</div>
<span style={toStyle(resetBtn)}>{"전체 해제"}</span>
</div>
{Array.from((groups) ?? []).map((g, __index4) => (
<React.Fragment key={__index4}>

<div style={toStyle(fGroup)}>
<span style={toStyle(fLabel)}>{g.label}</span>
<div style={toStyle(fOpts)}>
{Array.from((g.opts) ?? []).map((o, __index5) => (
<React.Fragment key={__index5}>

<span style={toStyle(o.style)}>{Boolean(o.on) ? <> <span style={toStyle(optCheck)}></span> </> : null}{o.label}</span>

</React.Fragment>
))}
</div>
</div>

</React.Fragment>
))}
<div style={toStyle(sortSec)}>
<span style={toStyle(sortLabel)}>{"정렬"}</span>
<div className={"nsb"} style={toStyle(sortRow)}>
{Array.from((sorts) ?? []).map((s, __index6) => (
<React.Fragment key={__index6}>

<span style={toStyle(s.style)}>{s.label}</span>

</React.Fragment>
))}
</div>
</div>
<span style={toStyle(sheetCta)}>{"7개 업체 보기"}</span>
</div>
</div>
</div>
</div>
<div style={toStyle(o3)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"3"}</span>{"정렬 드롭다운 · 결과 없음 · WP-SRCH-003"}</div>
<span style={toStyle(tagDesc)}>{"정렬은 칩 아래 인라인 패널입니다. 결과 없음은 이모지 대신 조건 풀기 CTA와 조건이 비슷한 곳을 보여줍니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={156}>
<div style={toStyle(bar)}><span>{"9:41"}</span><span style={toStyle(barIcons)}><svg width={"17"} height={"11"} viewBox={"0 0 17 11"} fill={"#212124"}><rect x={"0"} y={"7"} width={"3"} height={"4"} rx={"1"}></rect><rect x={"4.5"} y={"5"} width={"3"} height={"6"} rx={"1"}></rect><rect x={"9"} y={"2.5"} width={"3"} height={"8.5"} rx={"1"}></rect><rect x={"13.5"} y={"0"} width={"3"} height={"11"} rx={"1"}></rect></svg><svg width={"25"} height={"12"} viewBox={"0 0 25 12"} fill={"none"}><rect x={"0.5"} y={"0.5"} width={"21"} height={"11"} rx={"3"} stroke={"#1c1917"} strokeOpacity={".35"}></rect><rect x={"2"} y={"2"} width={"17"} height={"8"} rx={"1.8"} fill={"#212124"}></rect></svg></span></div>
<div style={toStyle(stickyHead)}>
<div style={toStyle(headTop)}>
<span style={toStyle(backBtn)}><span style={toStyle(icoBack)}></span></span>
<div style={toStyle(headCol)}>
<span style={toStyle(headTitleRoot)}>{"검색"}</span>
</div>
</div>
<div style={toStyle(searchRow)}>
<div style={toStyle(searchBoxOn)}>
<span style={toStyle(icoSearch)}></span>
<span style={toStyle(searchVal)}>{"한옥"}</span>
<span style={toStyle(icoX)}></span>
</div>
<span style={toStyle(filterBtn)}><span style={toStyle(icoSliders)}></span></span>
</div>
</div>
<div style={toStyle(chipBarRel)}>
<div style={toStyle(countRow)}>
<span style={toStyle(countText)}>{"0개 업체"}</span>
<span style={toStyle(sortChipOn)}>{"추천순"}<span style={toStyle(caretUp)}></span></span>
</div>
<div style={toStyle(sortPanel)}>
{Array.from((sortRows) ?? []).map((s, __index7) => (
<React.Fragment key={__index7}>

<div style={toStyle(s.rowStyle)}>
<span style={toStyle(s.labelStyle)}>{s.label}</span>
{Boolean(s.on) ? <> <span style={toStyle(rowCheck)}></span> </> : null}
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(emptyWrap)}>
<div style={toStyle("height:180px")}></div>
<span style={toStyle(emptyTitle)}>{"조건에 맞는 곳이 없어요"}</span>
<span style={toStyle(emptySub)}>{"예산을 풀면 11곳을 볼 수 있어요"}</span>
<span style={toStyle(emptyCta)}>{"예산 조건 풀기"}</span>
</div>
<div style={toStyle(nearWrap)}>
<span style={toStyle(nearLabel)}>{"조건이 비슷한 곳"}</span>
{Array.from((nearby) ?? []).map((n, __index8) => (
<React.Fragment key={__index8}>

<div style={toStyle(nearRow)}>
<div style={toStyle(nearCol)}><span style={toStyle(nearName)}>{n.name}</span><span style={toStyle(nearMeta)}>{n.meta}</span></div>
<span style={toStyle(nearPrice)}>{n.price}</span>
</div>

</React.Fragment>
))}
</div>
</div>
</div>
<div style={toStyle("width:100%;flex:0 0 100%;padding:16px 0 0;font-size:22px;line-height:30px;font-weight:700;color:#212124")}>{"2 · 업체상세"}</div>
<div style={toStyle(o4)}>
<div style={toStyle(vtag)}><span style={toStyle(vtagId)}>{"4"}</span>{"업체 상세 · 소개 · WP-VEND-001"}</div>
<span style={toStyle(vtagDesc)}>{"히어로 아래 첫 블록이 실 제보입니다. 사진보다 금액이 먼저 읽혀야 합니다. 추천 이유는 내 조건과 맞는 것만 체크로 보여줍니다."}</span>
<div style={toStyle(vphone)} data-design-frame="true" data-source-line={214}>
<div style={toStyle(vbar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(vicoBack)}></span><span style={toStyle(navTitle)}>{"강남 A 스튜디오"}</span><span style={toStyle(icoShare)}></span></div>
<div className={"nsb"} style={toStyle(vscroll)}>
<div style={toStyle(heroWrap)}>
<ImageSlot id={"vd-hero"} src={"uploads/스타일 이미지/urban.png"} shape={"rect"} placeholder={""} />
<div style={toStyle(heroShade)}></div>
<div style={toStyle(heroText)}>
<span style={toStyle(heroCat)}>{"스튜디오 · 강남구"}</span>
<span style={toStyle(heroName)}>{"강남 A 스튜디오"}</span>
</div>
<span style={toStyle(heroCount)}>{"1 / 8"}</span>
</div>
<div style={toStyle(priceBlock)}>
<span style={toStyle(priceBig)}>{"152~184만원"}</span>
<span style={toStyle(priceMeta)}>{"실 제보 12건 · 최근 12개월 · 기준금액 168만원"}</span>
</div>
<div style={toStyle(tabNav)}>{Array.from((tabs) ?? []).map((t, __index9) => (
<React.Fragment key={__index9}>
<span style={toStyle(t.style)}>{t.label}</span>
</React.Fragment>
))}</div>
<div style={toStyle(sec)}>
<span style={toStyle(secTitle)}>{"추천 이유"}</span>
<div style={toStyle(reasonWrap)}>
{Array.from((reasons) ?? []).map((r, __index10) => (
<React.Fragment key={__index10}>

<div style={toStyle(reasonRow)}><span style={toStyle(r.mark)}></span><span style={toStyle(r.text)}>{r.label}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secTitle)}>{"포트폴리오"}</span>
<div className={"nsb"} style={toStyle(galWrap)}>
{Array.from((gallery) ?? []).map((g, __index11) => (
<React.Fragment key={__index11}>

<div style={toStyle(galCell)}><ImageSlot id={g.id} src={g.src} shape={"rect"} placeholder={""} /></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secTitle)}>{"포함된 것"}</span>
<div style={toStyle(rows)}>
{Array.from((included) ?? []).map((i, __index12) => (
<React.Fragment key={__index12}>

<div style={toStyle(kvRow)}><span style={toStyle(kvK)}>{i.k}</span><span style={toStyle(kvV)}>{i.v}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secTitle)}>{"따로 드는 비용"}</span>
<div style={toStyle(rows)}>
{Array.from((extras) ?? []).map((e, __index13) => (
<React.Fragment key={__index13}>

<div style={toStyle(kvRow)}><span style={toStyle(kvK)}>{e.k}</span><span style={toStyle(kvV)}>{e.v}</span></div>

</React.Fragment>
))}
</div>
<span style={toStyle(note)}>{"업체가 알려준 금액이에요. 상담에서 달라질 수 있어요."}</span>
</div>
<div style={toStyle("height:24px")}></div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaPick)}><span style={toStyle(icoHeartW)}></span>{"Pick하기"}</span></div>
</div>
</div>
<div style={toStyle(o5)}>
<div style={toStyle(vtag)}><span style={toStyle(vtagId)}>{"5"}</span>{"패키지 · WP-VEND-002"}</div>
<span style={toStyle(vtagDesc)}>{"「커플들이 가장 많이 선택해요」 배지를 뺐습니다. 많이 고른 것과 나에게 맞는 것은 다릅니다. 대신 각 패키지의 실 제보 건수를 적었습니다."}</span>
<div style={toStyle(vphone)} data-design-frame="true" data-source-line={280}>
<div style={toStyle(vbar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(vicoBack)}></span><span style={toStyle(navTitle)}>{"강남 A 스튜디오"}</span><span style={toStyle(icoShare)}></span></div>
<div className={"nsb"} style={toStyle(vscroll)}>
<div style={toStyle(tabNav)}>{Array.from((tabsPkg) ?? []).map((t, __index14) => (
<React.Fragment key={__index14}>
<span style={toStyle(t.style)}>{t.label}</span>
</React.Fragment>
))}</div>
<div style={toStyle(secTop)}>
<span style={toStyle(note)}>{"모두 부가세 포함이에요. 최종 금액은 상담에서 정해져요."}</span>
{Array.from((packages) ?? []).map((p, __index15) => (
<React.Fragment key={__index15}>

<div style={toStyle(p.card)}>
<div style={toStyle(pkgHead)}>
<div style={toStyle(pkgNameCol)}><span style={toStyle(pkgName)}>{p.name}</span><span style={toStyle(pkgMeta)}>{p.meta}</span></div>
<span style={toStyle(pkgPrice)}>{p.price}</span>
</div>
<div style={toStyle(pkgGrid)}>
{Array.from((p.specs) ?? []).map((s, __index16) => (
<React.Fragment key={__index16}>

<div style={toStyle(pkgCell)}><span style={toStyle(pkgCellK)}>{s.k}</span><span style={toStyle(pkgCellV)}>{s.v}</span></div>

</React.Fragment>
))}
</div>
<span style={toStyle(p.btn)}>{"이 구성으로 상담"}</span>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle("height:24px")}></div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaPick)}><span style={toStyle(icoHeartW)}></span>{"Pick하기"}</span></div>
</div>
</div>
<div style={toStyle(o6)}>
<div style={toStyle(vtag)}><span style={toStyle(vtagId)}>{"6"}</span>{"후기 · WP-VEND-003"}</div>
<span style={toStyle(vtagDesc)}>{"4.9 숫자만 없앴습니다. 5점 별점은 3축 3지선다와 함께 두고, 몇 명이 어떻게 답했는지를 막대로 보여줍니다. 「가격 제보」 배지는 「Pick 인증」으로 바꿨습니다."}</span>
<div style={toStyle(vphone)} data-design-frame="true" data-source-line={311}>
<div style={toStyle(vbar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(vicoBack)}></span><span style={toStyle(navTitle)}>{"강남 A 스튜디오"}</span><span style={toStyle(icoShare)}></span></div>
<div className={"nsb"} style={toStyle(vscroll)}>
<div style={toStyle(tabNav)}>{Array.from((tabsRev) ?? []).map((t, __index17) => (
<React.Fragment key={__index17}>
<span style={toStyle(t.style)}>{t.label}</span>
</React.Fragment>
))}</div>
<div style={toStyle(secTop)}>
<div style={toStyle(revTitleRow)}><span style={toStyle(secTitle)}>{"14명이 답했어요"}</span><span style={toStyle(writeReviewBtn)}>{"후기 쓰기"}</span></div>
<div style={toStyle(starSumRow)}><div style={toStyle(starRow)}>{Array.from((overallStars) ?? []).map((s, __index18) => (
<React.Fragment key={__index18}>
<span style={toStyle(s.style)}></span>
</React.Fragment>
))}</div><span style={toStyle(starScore)}>{overallScore}</span></div>
<div style={toStyle(axesWrap)}>
{Array.from((axes) ?? []).map((a, __index19) => (
<React.Fragment key={__index19}>

<div style={toStyle(axisBlock)}>
<span style={toStyle(axisQ)}>{a.q}</span>
{Array.from((a.opts) ?? []).map((o, __index20) => (
<React.Fragment key={__index20}>

<div style={toStyle(axisRow)}><span style={toStyle(o.labelStyle)}>{o.label}</span><span style={toStyle(axisTrack)}><span style={toStyle(o.fill)}></span></span><span style={toStyle(o.numStyle)}>{o.n}</span></div>

</React.Fragment>
))}
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(divider)}></div>
{Array.from((reviews) ?? []).map((r, __index21) => (
<React.Fragment key={__index21}>

<div style={toStyle(revItem)}>
<div style={toStyle(revHead)}>
<span style={toStyle(revAvatar)}>{r.mark}</span>
<div style={toStyle(revNameCol)}><span style={toStyle(revName)}>{r.author}</span><div style={toStyle(starRow)}>{Array.from((r.stars) ?? []).map((s, __index22) => (
<React.Fragment key={__index22}>
<span style={toStyle(s.style)}></span>
</React.Fragment>
))}</div><span style={toStyle(revDate)}>{r.date}</span></div>
{Boolean(r.verified) ? <> <span style={toStyle(badgeVerify)}>{"Pick 인증"}</span> </> : null}
</div>
<div style={toStyle(revAnswers)}>
{Array.from((r.answers) ?? []).map((an, __index23) => (
<React.Fragment key={__index23}>
<span style={toStyle(revChip)}>{an}</span>
</React.Fragment>
))}
</div>
<span style={toStyle(revText)}>{r.text}</span>
</div>

</React.Fragment>
))}
<div style={toStyle("height:24px")}></div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaPick)}><span style={toStyle(icoHeartW)}></span>{"Pick하기"}</span></div>
</div>
</div>
<div style={toStyle(o7)}>
<div style={toStyle(vtag)}><span style={toStyle(vtagId)}>{"7"}</span>{"정보 · WP-VEND-004"}</div>
<span style={toStyle(vtagDesc)}>{"업체가 등록한 내용만 보여줍니다. FAQ도 업체별로 따로 등록하고, 등록하지 않은 항목은 줄 자체를 빼서 빈칸을 남기지 않습니다 — 아무것도 등록 안 된 업체는 이 화면 그대로 «아직 등록된 질문이 없어요» 안내만 남습니다."}</span>
<div style={toStyle(vphone)} data-design-frame="true" data-source-line={353}>
<div style={toStyle(vbar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(vicoBack)}></span><span style={toStyle(navTitle)}>{"강남 A 스튜디오"}</span><span style={toStyle(icoShare)}></span></div>
<div className={"nsb"} style={toStyle(vscroll)}>
<div style={toStyle(tabNav)}>{Array.from((tabsInfo) ?? []).map((t, __index24) => (
<React.Fragment key={__index24}>
<span style={toStyle(t.style)}>{t.label}</span>
</React.Fragment>
))}</div>
<div style={toStyle(sec)}>
<span style={toStyle(secTitle)}>{"기본 정보"}</span>
<div style={toStyle(rows)}>
{Array.from((infoRows) ?? []).map((i, __index25) => (
<React.Fragment key={__index25}>

<div style={toStyle(infoRow)}><span style={toStyle(infoK)}>{i.k}</span><span style={toStyle(infoV)}>{i.v}</span></div>

</React.Fragment>
))}
</div>
<div style={toStyle(mapWrap)}>
<ImageSlot id={"vd-map"} shape={"rect"} placeholder={"카카오맵 캡처 · 핀 중앙"} />
</div>
<div style={toStyle(mapBtns)}>
<span style={toStyle(mapBtn)}>{"지도에서 보기"}</span>
<span style={toStyle(mapBtn)}>{"주소 복사"}</span>
</div>
<div style={toStyle(fixRow)}><span style={toStyle(fixText)}>{"정보가 틀렸나요? 제보하기"}</span><span style={toStyle(icoChevR)}></span></div>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(secHead)}><span style={toStyle(secTitle)}>{"자주 묻는 질문"}</span><span style={toStyle(secMeta)}>{"업체가 등록한 내용"}</span></div>
<div style={toStyle(rows)}>
{Array.from((faq) ?? []).map((f, __index26) => (
<React.Fragment key={__index26}>

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
<div style={toStyle(dockSingle)}><span style={toStyle(ctaPick)}><span style={toStyle(icoHeartW)}></span>{"Pick하기"}</span></div>
</div>
</div>
<div style={toStyle("width:100%;flex:0 0 100%;padding:16px 0 0;font-size:22px;line-height:30px;font-weight:700;color:#212124")}>{"3 · 빠진 화면 보완"}</div>
<div style={toStyle(o11)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"8"}</span>{"자동완성 · WP-SRCH-004"}</div>
<span style={toStyle(tagDesc)}>{"검색창을 누르면 열립니다. 최근 검색은 지우기가 각 줄과 전체 두 군데입니다. 입력 중엔 일치하는 부분만 굵게 표시합니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={396}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(stickyHead)}>
<div style={toStyle(headTop)}><div style={toStyle(headCol)}><span style={toStyle(headTitleRoot)}>{"검색"}</span></div></div>
<div style={toStyle(searchRow)}>
<div style={toStyle(searchBoxOn)}><span style={toStyle(icoSearch)}></span><span style={toStyle(searchVal)}>{"강남 스"}</span><span style={toStyle(icoX)}></span></div>
</div>
</div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(acSec)}>
<div style={toStyle(acHead)}><span style={toStyle(acLabel)}>{"최근 검색"}</span><span style={toStyle(acClearAll)}>{"전체 삭제"}</span></div>
{Array.from((acRecent) ?? []).map((r, __index27) => (
<React.Fragment key={__index27}>

<div style={toStyle(acRow)}><span style={toStyle(icoClock)}></span><span style={toStyle(acText)}>{r}</span><span style={toStyle(icoX2)}></span></div>

</React.Fragment>
))}
</div>
<div style={toStyle(acSec)}>
<span style={toStyle(acLabel)}>{"추천 검색어"}</span>
{Array.from((acSuggest) ?? []).map((s, __index28) => (
<React.Fragment key={__index28}>

<div style={toStyle(acRow)}><span style={toStyle(icoSearch2)}></span><span style={toStyle(acText)}><b style={toStyle(acBold)}>{s.m}</b>{s.rest}</span></div>

</React.Fragment>
))}
</div>
</div>
</div>
</div>
<div style={toStyle(o13)}>
<div style={toStyle(vtag)}><span style={toStyle(vtagId)}>{"10"}</span>{"이미지 전체보기 · WP-VEND-006"}</div>
<span style={toStyle(vtagDesc)}>{"대표 이미지를 누르면 열립니다. 공통 풀팝업 UX(좌측 X 닫기, 중앙 타이틀)로 맞췄고, 몇 장 중 몇 번째인지만 있고 설명이나 좋아요는 없습니다."}</span>
<div style={toStyle(vphone)} data-design-frame="true" data-source-line={424}>
<div style={toStyle(vbar)}><span>{"9:41"}</span></div>
<div style={toStyle(galNav)}><span style={toStyle(galClose)}><span style={toStyle(icoXw)}></span></span><span style={toStyle(navTitleW)}>{"3 / 8"}</span><span style={toStyle(navRightPad)}></span></div>
<div style={toStyle(galBig)}><ImageSlot id={"gal-big"} src={"uploads/스타일 이미지/urban.png"} shape={"rect"} placeholder={""} /></div>
<div className={"nsb"} style={toStyle(galStrip)}>
{Array.from((galThumbs) ?? []).map((g, __index29) => (
<React.Fragment key={__index29}>

<div style={toStyle(g.cell)}><ImageSlot id={g.id} src={g.src} shape={"rect"} placeholder={""} /></div>

</React.Fragment>
))}
</div>
</div>
</div>
<div style={toStyle(o14)}>
<div style={toStyle(vtag)}><span style={toStyle(vtagId)}>{"11"}</span>{"제보 금액 상세 · WP-VEND-007"}</div>
<span style={toStyle(vtagDesc)}>{"업체상세 실 제보 블록에서 «자세히»로 들어옵니다. 구간 · 건수 · 조건별 분포 · 최근 변화 순입니다."}</span>
<div style={toStyle(vphone)} data-design-frame="true" data-source-line={439}>
<div style={toStyle(vbar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(vicoBack)}></span><span style={toStyle(navTitle)}>{"제보 금액"}</span><span style={toStyle(navRightPad)}></span></div>
<div className={"nsb"} style={toStyle(vscroll)}>
<div style={toStyle(secTop)}>
<span style={toStyle(priceBig)}>{"152~184만원"}</span>
<span style={toStyle(priceMeta)}>{"실 제보 12건 · 최근 12개월 · 기준금액 168만원"}</span>
</div>
<div style={toStyle(divider)}></div>
<div style={toStyle(secTop)}>
<span style={toStyle(secTitle)}>{"조건별 분포"}</span>
{Array.from((priceDist) ?? []).map((d, __index30) => (
<React.Fragment key={__index30}>

<div style={toStyle(axisRow)}><span style={toStyle(d.labelStyle)}>{d.label}</span><span style={toStyle(axisTrack)}><span style={toStyle(d.fill)}></span></span><span style={toStyle(d.numStyle)}>{d.n}</span></div>

</React.Fragment>
))}
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secTitle)}>{"최근 변화"}</span>
<span style={toStyle(note)}>{"지난 3개월 168만원 → 이번 달 176만원. 성수기 예약이 몰리는 시기예요."}</span>
</div>
<div style={toStyle("height:24px")}></div>
</div>
</div>
</div>
<div style={toStyle(o15)}>
<div style={toStyle(vtag)}><span style={toStyle(vtagId)}>{"12"}</span>{"정보 오류 제보 · WP-VEND-008"}</div>
<span style={toStyle(vtagDesc)}>{"공식정보 하단 «제보하기»에서 들어옵니다. 항목을 먼저 고르고, 올바른 정보를 적습니다. 근거 링크는 선택입니다."}</span>
<div style={toStyle(vphone)} data-design-frame="true" data-source-line={466}>
<div style={toStyle(vbar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(vicoBack)}></span><span style={toStyle(navTitle)}>{"정보 오류 제보"}</span><span style={toStyle(navRightPad)}></span></div>
<div className={"nsb"} style={toStyle(vscroll)}>
<div style={toStyle(sec)}>
<span style={toStyle(secTitle)}>{"무엇이 틀렸나요?"}</span>
{Array.from((rptTypes) ?? []).map((r, __index31) => (
<React.Fragment key={__index31}>

<div style={toStyle(r.rowStyle)}><span style={toStyle(r.mark)}></span><span style={toStyle(rptLabel)}>{r.label}</span></div>

</React.Fragment>
))}
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secTitle)}>{"올바른 정보"}</span>
<div style={toStyle(rptArea)}><span style={toStyle(rptPh)}>{"정확한 정보를 적어주세요"}</span></div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secTitle)}>{"근거 링크 · 선택"}</span>
<div style={toStyle(rptInput)}><span style={toStyle(rptPh)}>{"공식 홈페이지, SNS 등"}</span></div>
</div>
<div style={toStyle("height:16px")}></div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaFull2)}>{"제출하기"}</span></div>
</div>
</div>
<div style={toStyle(o9)}>
<div style={toStyle(vtag)}><span style={toStyle(vtagId)}>{"13"}</span>{"업체상세 · 정본과 다른 점"}</div>
<span style={toStyle(vtagDesc)}>{"정책 판단이 필요한 항목은 주황색입니다."}</span>
<div style={toStyle(vdiffCard)}>
<div style={toStyle(vdiffHead)}><span style={toStyle(vdh1)}>{"항목"}</span><span style={toStyle(vdh2)}>{"Figma 원본"}</span><span style={toStyle(vdh3)}>{"정본 적용"}</span><span style={toStyle(vdh4)}>{"근거"}</span></div>
{Array.from((vdiffs) ?? []).map((d, __index32) => (
<React.Fragment key={__index32}>

<div style={toStyle(vdiffRow)}><span style={toStyle(vdc1)}>{d.k}</span><span style={toStyle(vdc2)}>{d.a}</span><span style={toStyle(d.bStyle)}>{d.b}</span><span style={toStyle(vdc3)}>{d.why}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(o10)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"14"}</span>{"검색 · 정본과 다른 점"}</div>
<span style={toStyle(tagDesc)}>{"검색은 정본에서 가장 많이 다듬은 영역입니다. Figma 쪽은 정본의 온보딩 연동·실 제보 규칙·단일 선택 원칙이 빠져 있습니다."}</span>
<div style={toStyle(diffCard)}>
<div style={toStyle(diffHead)}>
<span style={toStyle(dh1)}>{"항목"}</span>
<span style={toStyle(dh2)}>{"정본"}</span>
<span style={toStyle(dh3)}>{"Figma"}</span>
<span style={toStyle(dh4)}>{"판단"}</span>
</div>
{Array.from((diffs) ?? []).map((d, __index33) => (
<React.Fragment key={__index33}>

<div style={toStyle(diffRow)}>
<span style={toStyle(dc1)}>{d.k}</span>
<span style={toStyle(dc2)}>{d.a}</span>
<span style={toStyle(dc3)}>{d.b}</span>
<span style={toStyle(d.verdictStyle)}>{d.verdict}</span>
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
