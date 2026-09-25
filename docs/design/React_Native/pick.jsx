import React from 'react';
import Model from '../models/pick.js';
import { useDesignValues, toStyle, ImageSlot, designHref } from '../runtime/designRuntime.js';

/** 원본 화면 구조와 상태를 보존한 React 디자인 보드. Source: 대메뉴_Pick.dc.html */
export default function PickBoard(props) {
  const {
    decidedB, agencyB, foldedB, vcol, vtag, vtagId, vtagDesc, vphone,
    vbar, navBar, navTitle, navRightPad, vicoBack, vscroll, dimWrap2, dim2,
    confirmSheet, grabber2, confirmTitle, confirmBody, confirmRow, btnGhost2, btnDanger2, decRow,
    sec, secTop, secHead, secTitle, secMeta, dateWrap, dates, timeGrid,
    times, textarea, syncBox, syncT, syncS, rScroll, headBlock, rH1,
    headSub, openSec, mypickSec, catHead, catTitle, catRight, catMeta, catMetaDim,
    icoUp, icoDown, vCard, vBody, rMoreRow, moreBtn, scarceNote, rSegBar,
    rSegA, rTabs, listWrap, vThumbWrap, vThumb, vBadge, vTop, vNameCol,
    vCatLabel, vNameText, vLocRow2, vLocText, vTags, vTagChip, vFoot, vPicks,
    rIcoPin, doneWrap, rDoneRow, doneMarkSm, rIcoCheck, allDecided, doneCat, doneName,
    icoChev, decided, foldWrap, foldRow, foldTitle, foldRight, foldMeta, doneSec,
    doneCard, rDoneMark, rDoneTitle, rDoneSub, doneBtn, agency, scarce, folded,
    root, intro, eyebrow, h40, introBody, boardRow, grp, col,
    colWide, tag, tagId, tagDesc, phone, bar, scroll, head,
    headRow, h1, countPill, sub, shareBar, shareLeft, avRow, av1,
    av2, shareText, shareLink, banner, bannerCol, bannerT, bannerS, bannerBtn,
    chipBar, chipBarSticky, list, cardBody, thumbWrap, badge, checkDot, icoCheck,
    info, infoTop, nameCol, cat, name, icoX, loc, icoPin,
    locText, tags, tagChip, foot, price, picks, ctaStrip, tabBar,
    tabCell, cmpHead, cmpTitleRow, cmpTitle, cmpCount, cmpPad, closeBtn, icoX16,
    hint, swipeRow, swipeText, icoSwipeL, icoSwipeR, hintTitle, hintText, cmpScroll,
    rankWrap, rankHead, rankPhotoWrap, rankCol, rankMetrics, rankMRow, rankMLabel, rankMBest,
    cmpTable, photoRow, labelSpacer, vCol, vPhotoWrap, vRemove, icoXw, checkDotSm,
    icoCheckSm, vName, rankVName, vCat, cellStyle, ctaRow, diffCard, diffHead,
    diffRow, dh1, dh2, dh3, dh4, dc1, dc2, dc3,
    dc4, hasComparing, cats, afterRemove, toastWrap, toastBar, toastText, toastAction,
    catGroupWrap, catGroupSec, catGroupHead, catGroupTitle, catGroupMeta, moreBtn2, catGroups, tabs,
    segBar, segA, segB, tagRow, tagIdWide, tagText, dimTop, dimHeadRow,
    dimHeadTitle, dimList, dimCol, dimName, dimMeta, dimCards, sheetWrap, sheet,
    grab, formHead, formClose, icoXsm, sheetTitle, sheetBody, confirmList, confirmDot,
    confirmText, confirmRows, sheetDock, btnGhost, btnPrimary, doneScroll, doneMark, icoCheckBig,
    doneTitle, doneSub, doneCards, doneRow, doneRowT, doneRowV, doneRows, nextBox,
    nextT, nextS, dockSingle, ctaFull, cmpVendors, rankCards, diffs
  } = useDesignValues(Model, props);
  return (
<React.Fragment>

<section style={toStyle(root)}>
<div style={toStyle(intro)}>
<span style={toStyle(eyebrow)}>{"WeddingPick · Figma 기준 · 정본 톤"}</span>
<span style={toStyle(h40)}>{"Pick · 추천 · 내 Pick"}</span>
<span style={toStyle(introBody)}>{"Pick 탭 한 세션입니다. 추천을 내 Pick과 한 화면에 묻어 탭 전환 없이 카테고리별로 담고 좁힙니다. 색 · 서체 · 용어는 정본으로 되돌렸고 별점 대신 실 제보를 씁니다. 업체 카드는 검색 목록과 같은 규격입니다."}</span>
</div>
<div style={toStyle(boardRow)}>
<div style={toStyle(grp)}>
<div style={toStyle(col)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"1"}</span>{"최종 결정 · 상담 연계 · WP-PICK-001"}</div>
<span style={toStyle(tagDesc)}>{"후보=Pick입니다. 업종별로 카테고리(웨딩홀 · 스드메 · 본식 · 예물·신혼) 칩으로 거릅니다. 곧 3개씩 제공하고 Pick하는 대로 각 업종에 최신순으로 쌓입니다. 카드를 누르면 상담 예약으로 바로 이어집니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={36}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div className={"nsb"} style={toStyle(rScroll)}>
<div style={toStyle(headBlock)}>
<span style={toStyle(rH1)}>{"Pick"}</span>
</div>
<div className={"nsb"} style={toStyle(chipBarSticky)}>
{Array.from((cats) ?? []).map((c, __index1) => (
<React.Fragment key={__index1}>
<span style={toStyle(c.style)}>{c.label}</span>
</React.Fragment>
))}
</div>
<div style={toStyle(mypickSec)}>
{Boolean(hasComparing) ? <> 
<div style={toStyle(banner)}><div style={toStyle(bannerCol)}><span style={toStyle(bannerT)}>{"2곳 담았어요"}</span><span style={toStyle(bannerS)}>{"금액과 조건을 나란히 볼 수 있어요"}</span></div><span style={toStyle(bannerBtn)}>{"비교하기"}</span></div>
 </> : null}
<div style={toStyle(catGroupWrap)}>
{Array.from((catGroups) ?? []).map((g, __index2) => (
<React.Fragment key={__index2}>

<div style={toStyle(catGroupSec)} id={g.anchorId}>
<div style={toStyle(catGroupHead)}><span style={toStyle(catGroupTitle)}>{g.title}</span><span style={toStyle(catGroupMeta)}>{g.count}{"개 · 최신순"}</span></div>
<div style={toStyle(list)}>
{Array.from((g.items) ?? []).map((v, __index3) => (
<React.Fragment key={__index3}>

<div style={toStyle(v.card)}>
<div style={toStyle(cardBody)}>
<div style={toStyle(thumbWrap)}>
<span style={toStyle(v.thumb)}></span>
{Boolean(v.badge) ? <> <span style={toStyle(badge)}>{v.badge}</span> </> : null}
{Boolean(v.confirmed) ? <> <span style={toStyle(checkDot)}><span style={toStyle(icoCheck)}></span></span> </> : null}
</div>
<div style={toStyle(info)}>
<div style={toStyle(infoTop)}>
<div style={toStyle(nameCol)}><span style={toStyle(cat)}>{v.categoryLabel}</span><span style={toStyle(name)}>{v.name}</span></div>
<span style={toStyle(icoX)}></span>
</div>
<div style={toStyle(loc)}><span style={toStyle(icoPin)}></span><span style={toStyle(locText)}>{v.location}</span></div>
<div style={toStyle(tags)}>{Array.from((v.tags) ?? []).map((t, __index4) => (
<React.Fragment key={__index4}>
<span style={toStyle(tagChip)}>{"#"}{t}</span>
</React.Fragment>
))}</div>
<div style={toStyle(foot)}>
<span style={toStyle(price)}>{v.price}</span>
<span style={toStyle(picks)}>{"실 제보 "}{v.reports}{"건"}</span>
</div>
</div>
</div>
<div style={toStyle(ctaStrip)}>
<span style={toStyle(v.btnA)}>{v.labelA}</span>
<a href={designHref("#pick-consult")} style={toStyle(v.btnB)}>{v.labelB}</a>
</div>
</div>

</React.Fragment>
))}
</div>
<span style={toStyle(moreBtn2)}>{"더 보기"}</span>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle("height:24px")}></div>
</div>
<div style={toStyle(tabBar)}>{Array.from((rTabs) ?? []).map((t, __index5) => (
<React.Fragment key={__index5}>
<div style={toStyle(tabCell)}><span style={toStyle(t.icon)}></span><span style={toStyle(t.label)}>{t.text}</span></div>
</React.Fragment>
))}</div>
</div>
</div>
</div>
<div style={toStyle(col)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"1-1"}</span><span style={toStyle(tagText)}>{"비교 · WP-PICK-006"}</span></div>
<span style={toStyle(tagDesc)}>{"스프레드시트형 표를 카드 랭킹형으로 바꿨습니다. 항목별 승수를 세어 가장 많이 앞선 카드를 위에 두고, 각 카드 안에서 이긴 지표에 점을 찍습니다. 좌우 스와이프 없이 세로로만 봅니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={101}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(cmpHead)}>
<span style={toStyle(closeBtn)}><span style={toStyle(icoXsm)}></span></span>
<span style={toStyle(cmpTitle)}>{"비교"}</span>
<span style={toStyle(cmpPad)}></span>
</div>
<div style={toStyle(hint)}><span style={toStyle(hintTitle)}>{"가장 크게 갈리는 건 보정 장수예요"}</span><span style={toStyle(hintText)}>{"금액은 30만원 안에서 비슷해요"}</span></div>
<div className={"nsb"} style={toStyle(cmpScroll)}>
<div style={toStyle(rankWrap)}>
{Array.from((rankCards) ?? []).map((v, __index6) => (
<React.Fragment key={__index6}>

<div style={toStyle(v.cardStyle)}>
<div style={toStyle(rankHead)}>
<div style={toStyle(rankPhotoWrap)}>
<span style={toStyle(v.photo)}></span>
{Boolean(v.confirmed) ? <> <span style={toStyle(checkDotSm)}><span style={toStyle(icoCheckSm)}></span></span> </> : null}
</div>
<div style={toStyle(rankCol)}>
<span style={toStyle(rankVName)}>{v.name}</span>
<span style={toStyle(vCat)}>{v.categoryLabel}</span>
</div>
<span style={toStyle(v.winBadge)}>{v.winCount}{"개 앞서요"}</span>
</div>
<div style={toStyle(rankMetrics)}>
{Array.from((v.metrics) ?? []).map((m, __index7) => (
<React.Fragment key={__index7}>

<div style={toStyle(rankMRow)}>
<span style={toStyle(rankMLabel)}>{m.label}</span>
<span style={toStyle(m.valStyle)}>{m.v}</span>
{Boolean(m.best) ? <> <span style={toStyle(rankMBest)}></span> </> : null}
</div>

</React.Fragment>
))}
</div>
<span style={toStyle(v.cta)}>{v.ctaLabel}</span>
</div>

</React.Fragment>
))}
</div>
</div>
</div>
</div>
<div style={toStyle(col)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"1-2"}</span><span style={toStyle(tagText)}>{"상담 예약 완료 · WP-PICK-010"}</span></div>
<span style={toStyle(tagDesc)}>{"상담 예약 신청 후 뜹니다. 결정 상태 대신 연락을 기다려달라는 안내로 바꿨습니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={144}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div className={"nsb"} style={toStyle(doneScroll)}>
<span style={toStyle(doneMark)}><span style={toStyle(icoCheckBig)}></span></span>
<span style={toStyle(doneTitle)}>{"상담 예약을"}<br />{"요청했어요"}</span>
<span style={toStyle(doneSub)}>{"블루밍 스튜디오 · 9월 20일 오후 2시"}</span>
<div style={toStyle(doneCards)}>
{Array.from((doneRows) ?? []).map((d, __index8) => (
<React.Fragment key={__index8}>

<div style={toStyle(doneRow)}><span style={toStyle(doneRowT)}>{d.k}</span><span style={toStyle(doneRowV)}>{d.v}</span></div>

</React.Fragment>
))}
</div>
<div style={toStyle(nextBox)}>
<span style={toStyle(nextT)}>{"연락을 기다려주세요"}</span>
<span style={toStyle(nextS)}>{"영업일 기준 1~2일 안에 업체가 연락드려요"}</span>
</div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaFull)}>{"웨딩노트에서 확인하기"}</span></div>
</div>
</div>
</div>
<div style={toStyle(vcol)} id={"pick-consult"}>
<div style={toStyle(vtag)}><span style={toStyle(vtagId)}>{"2"}</span>{"상담 예약 · WP-PICK-009"}</div>
<span style={toStyle(vtagDesc)}>{"「YOUR CONSULTANT」 영문 라벨과 작가 별점을 뺐습니다. 날짜 · 시간만 고르면 되고, 하단 CTA가 고른 값을 그대로 말합니다."}</span>
<div style={toStyle(vphone)} data-design-frame="true" data-source-line={168}>
<div style={toStyle(vbar)}><span>{"9:41"}</span></div>
<div style={toStyle(navBar)}><span style={toStyle(vicoBack)}></span><span style={toStyle(navTitle)}>{"상담 예약"}</span><span style={toStyle(navRightPad)}></span></div>
<div className={"nsb"} style={toStyle(vscroll)}>
<div style={toStyle(secTop)}>
<span style={toStyle(h1)}>{"언제 만나면"}<br />{"좋을까요?"}</span>
<span style={toStyle(sub)}>{"강남 A 스튜디오 · 김소연 작가"}</span>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(secHead)}><span style={toStyle(secTitle)}>{"날짜"}</span><span style={toStyle(secMeta)}>{"2026년 9월"}</span></div>
<div className={"nsb"} style={toStyle(dateWrap)}>
{Array.from((dates) ?? []).map((d, __index9) => (
<React.Fragment key={__index9}>

<div style={toStyle(d.cell)}><span style={toStyle(d.wd)}>{d.weekday}</span><span style={toStyle(d.dayStyle)}>{d.day}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secTitle)}>{"시간"}</span>
<div style={toStyle(timeGrid)}>
{Array.from((times) ?? []).map((t, __index10) => (
<React.Fragment key={__index10}>
<span style={toStyle(t.style)}>{t.label}</span>
</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sec)}>
<span style={toStyle(secTitle)}>{"남기고 싶은 말"}</span>
<div style={toStyle(textarea)}>{"원하는 분위기나 궁금한 점을 적어주세요"}</div>
</div>
<div style={toStyle(sec)}>
<div style={toStyle(syncBox)}>
<span style={toStyle(syncT)}>{"웨딩노트에 같이 올라가요"}</span>
<span style={toStyle(syncS)}>{"준호님에게도 이 일정이 보여요"}</span>
</div>
</div>
<div style={toStyle("height:24px")}></div>
</div>
<div style={toStyle(dockSingle)}><span style={toStyle(ctaFull)}>{"9월 20일 오후 2시로 잡기"}</span></div>
</div>
</div>
<div style={toStyle("width:100%;flex:0 0 100%;padding:16px 0 0;font-size:22px;line-height:30px;font-weight:700;color:#212124")}>{"빠진 화면 보완"}</div>
<div style={toStyle(col)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"3"}</span><span style={toStyle(tagText)}>{"삭제 · OS 토스트 안내 · WP-PICK-008"}</span></div>
<span style={toStyle(tagDesc)}>{"확인 바텀시트를 없앴습니다. «빼기»를 누르면 즉시 지워지고 하단에 되돌리기 토스트만 뜹니다. 등록 · 수정 · 삭제 전체가 이 패턴을 씁니다."}</span>
<div style={toStyle(vphone)} data-design-frame="true" data-source-line={211}>
<div style={toStyle(vbar)}><span>{"9:41"}</span></div>
<div className={"nsb"} style={toStyle(vscroll)}>
<div style={toStyle(headBlock)}><span style={toStyle(rH1)}>{"Pick"}</span></div>
<div style={toStyle(list)}>
{Array.from((afterRemove) ?? []).map((v, __index11) => (
<React.Fragment key={__index11}>

<div style={toStyle(v.card)}>
<div style={toStyle(cardBody)}>
<div style={toStyle(thumbWrap)}><span style={toStyle(v.thumb)}></span></div>
<div style={toStyle(info)}>
<div style={toStyle(infoTop)}><div style={toStyle(nameCol)}><span style={toStyle(cat)}>{v.categoryLabel}</span><span style={toStyle(name)}>{v.name}</span></div></div>
<div style={toStyle(loc)}><span style={toStyle(icoPin)}></span><span style={toStyle(locText)}>{v.location}</span></div>
</div>
</div>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(toastWrap)}>
<div style={toStyle(toastBar)}>
<span style={toStyle(toastText)}>{"스튜디오 온을 뺐어요"}</span>
<span style={toStyle(toastAction)}>{"되돌리기"}</span>
</div>
</div>
</div>
</div>
<div style={toStyle(colWide)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"4"}</span>{"Figma 원본에서 고친 것"}</div>
<span style={toStyle(tagDesc)}>{"이 시안에는 이미 반영돼 있습니다. Figma 코드(Pick.tsx)를 그대로 구현하면 정본과 어긋나는 항목입니다."}</span>
<div style={toStyle(diffCard)}>
<div style={toStyle(diffHead)}><span style={toStyle(dh1)}>{"항목"}</span><span style={toStyle(dh2)}>{"Figma 원본"}</span><span style={toStyle(dh3)}>{"정본 · 이 시안"}</span><span style={toStyle(dh4)}>{"이유"}</span></div>
{Array.from((diffs) ?? []).map((d, __index12) => (
<React.Fragment key={__index12}>

<div style={toStyle(diffRow)}><span style={toStyle(dc1)}>{d.k}</span><span style={toStyle(dc2)}>{d.a}</span><span style={toStyle(dc3)}>{d.b}</span><span style={toStyle(dc4)}>{d.why}</span></div>

</React.Fragment>
))}
</div>
</div>

</section>
</React.Fragment>
  );
}
