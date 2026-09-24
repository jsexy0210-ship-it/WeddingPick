import React from 'react';
import Model from '../models/common.js';
import { useDesignValues, toStyle, ImageSlot, designHref } from '../runtime/designRuntime.js';

/** 원본 화면 구조와 상태를 보존한 React 디자인 보드. Source: 공통_다이얼로그 빈상태 로더.dc.html */
export default function CommonBoard(props) {
  const {
    cats, allCats, rootStyle, Lcol, Leyebrow, Lh40, h26, Llead,
    Ltag, LtagId, LtagIdWide, tagIdBrand, LtagDesc, Lphone, Lbar, barIcons,
    navBack, backBtn, navTitle, centerWrap, Ldock, ctaGhost, orbitWrap, orbitRing,
    orbitSpin, orbitDot, textWrap, h24, subLine, stepList, spinBig, sheetCard,
    iconGrid, iconCell, iconBox, iconLabel, specLabel, spinRow, spinCell, arcRow,
    arcSpin, slowBox, Lhr, hrThin, noteTitle, noteBody, skWrap, skHero,
    skWide, skNarrow, skRow, skThumb, tableCard, thead, tbody, th1,
    th2, th3, td1, td3, ruleCard, steps, stepsOld, ocrSteps,
    spinners, skRows, usage, Lrules, lroot, lintro, leyebrow, h40,
    llead, lcard, specCard, cardTitle, lrow, cell, box, label,
    spec, use, inlineBox, inlineRing, inlineText, centerBox, ringMd, fullBox,
    ringLg, fullText, sizes, rows, kvRow, k, v, hr,
    note, table, eroot, eintro, eeyebrow, eh0, elead, erow,
    ecol, ecolWide, etag, etag2, etagText, etagId, etagIdDark, etagDesc,
    ephone, ebar, navBar, navPad, icoBack, icoChev, scroll, sec,
    secHead, secTitle, moreRow, emptyCard, emptyT, emptyS, rowsWrap, dataRow,
    dataK, dataV, doneWrap, doneTitle, doneSub, itemBox, itemRow, itemMark,
    itemCol, itemK, itemV, nextCard, nextLabel, nextTitle, dock, btnGhost,
    tabBar, tabCell, escreens, ecard, rRow, rK, rV, rules,
    ewHead, ewRow, ewh1, ewh2, ewh3, ewc1, ewc2, ewc3,
    copies, root, intro, eyebrow, h0, lead, row, col,
    colWide, tag, tag2, tagText, tagId, tagIdDark, tagDesc, typeRow,
    typeCard, typeHead, typeId, typeName, typeWhen, typeSpecWrap, specRow, specK,
    specV, types, phone, bar, bgWrap, bgHead, bgTitle, bgBody,
    bgRow, bgRowT, grab, dBody, itemWrap, toastAct, screens, card,
    mHead, mRow, mh1, mh2, mh3, mc1, mc3, matrix,
    wHead, wRow, wh1, wh2, wh3, wc1, wc2, wc3,
    words, iRow, iK, iV, impl
  } = useDesignValues(Model, props);
  return (
<React.Fragment>

<section style={toStyle(root)}>
<div style={toStyle(intro)}>
<span style={toStyle(eyebrow)}>{"WeddingPick · WP-DLG"}</span>
<span style={toStyle(h0)}>{"공통 · 다이얼로그 · 빈 상태 · 로더"}</span>
<span style={toStyle(lead)}>{"화면마다 다시 만들지 않는 공통 부품입니다. 알림 · 확인 · 바텀시트 6유형, 빈 상태와 완료 화면, 업종 아이콘 순회 로더를 한곳에 모았습니다."}</span>
</div>
<div style={toStyle("width:100%;flex:0 0 100%;padding:0 0 4px;font-size:22px;line-height:30px;font-weight:700;color:#212124")}>{"1 · 다이얼로그"}</div>
<div style={toStyle(typeRow)}>
{Array.from((types) ?? []).map((t, __index1) => (
<React.Fragment key={__index1}>

<div style={toStyle(typeCard)}>
<div style={toStyle(typeHead)}><span style={toStyle(typeId)}>{t.id}</span><span style={toStyle(typeName)}>{t.name}</span></div>
<span style={toStyle(typeWhen)}>{t.when}</span>
<div style={toStyle(typeSpecWrap)}>
{Array.from((t.spec) ?? []).map((s, __index2) => (
<React.Fragment key={__index2}>

<div style={toStyle(specRow)}><span style={toStyle(specK)}>{s.k}</span><span style={toStyle(specV)}>{s.v}</span></div>

</React.Fragment>
))}
</div>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle(row)}>
{Array.from((screens) ?? []).map((s, __index3) => (
<React.Fragment key={__index3}>

<div style={toStyle(col)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{s.code}</span><span style={toStyle(tagText)}>{s.title}</span></div>
<span style={toStyle(tagDesc)}>{s.desc}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={68}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(bgWrap)}>
<div style={toStyle(bgHead)}><span style={toStyle(bgTitle)}>{s.bgTitle}</span></div>
<div style={toStyle(bgBody)}>
{Array.from((s.bgRows) ?? []).map((r, __index4) => (
<React.Fragment key={__index4}>

<div style={toStyle(bgRow)}><span style={toStyle(bgRowT)}>{r}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(s.dimStyle)}></div>
{Boolean(s.isSheet) ? <> 
<div style={toStyle(s.sheetStyle)}>
{Boolean(s.grab) ? <> <span style={toStyle(grab)}></span> </> : null}
{Boolean(s.icon) ? <> <span style={toStyle(s.iconStyle)}></span> </> : null}
<span style={toStyle(s.titleStyle)}>{s.dTitle}</span>
{Boolean(s.dBody) ? <> <span style={toStyle(s.bodyStyle)}>{s.dBody}</span> </> : null}
{Boolean(s.items) ? <> 
<div style={toStyle(s.itemBox)}>
{Array.from((s.items) ?? []).map((i, __index5) => (
<React.Fragment key={__index5}>

<div style={toStyle(i.rowStyle)}>{Boolean(i.mark) ? <> <span style={toStyle(i.mark)}></span> </> : null}<span style={toStyle(i.textStyle)}>{i.label}</span></div>

</React.Fragment>
))}
</div>
 </> : null}
{Boolean(s.btns) ? <> 
<div style={toStyle(s.btnRow)}>
{Array.from((s.btns) ?? []).map((b, __index6) => (
<React.Fragment key={__index6}>
<span style={toStyle(b.style)}>{b.label}</span>
</React.Fragment>
))}
</div>
 </> : null}
</div>
 </> : null}
{Boolean(s.isToast) ? <> 
<div style={toStyle(s.toastWrap)}><span style={toStyle(s.toastStyle)}>{s.dTitle}{Boolean(s.toastAct) ? <> <span style={toStyle(toastAct)}>{s.toastAct}</span> </> : null}</span></div>
 </> : null}
</div>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle(colWide)}>
<div style={toStyle(tag)}><span style={toStyle(tagIdDark)}>{"규칙"}</span><span style={toStyle(tagText)}>{"언제 무엇을 쓰는가"}</span></div>
<div style={toStyle(card)}>
<div style={toStyle(mHead)}><span style={toStyle(mh1)}>{"상황"}</span><span style={toStyle(mh2)}>{"유형"}</span><span style={toStyle(mh3)}>{"이유"}</span></div>
{Array.from((matrix) ?? []).map((m, __index7) => (
<React.Fragment key={__index7}>

<div style={toStyle(mRow)}><span style={toStyle(mc1)}>{m.k}</span><span style={toStyle(m.tStyle)}>{m.t}</span><span style={toStyle(mc3)}>{m.why}</span></div>

</React.Fragment>
))}
</div>
<div style={toStyle(tag2)}><span style={toStyle(tagIdDark)}>{"문구"}</span><span style={toStyle(tagText)}>{"제목 · 본문 · 버튼 틀"}</span></div>
<div style={toStyle(card)}>
<div style={toStyle(wHead)}><span style={toStyle(wh1)}>{"쓰는 말"}</span><span style={toStyle(wh2)}>{"쓰지 않는 말"}</span><span style={toStyle(wh3)}>{"이유"}</span></div>
{Array.from((words) ?? []).map((w, __index8) => (
<React.Fragment key={__index8}>

<div style={toStyle(wRow)}><span style={toStyle(wc1)}>{w.ok}</span><span style={toStyle(wc2)}>{w.no}</span><span style={toStyle(wc3)}>{w.why}</span></div>

</React.Fragment>
))}
</div>
<div style={toStyle(tag2)}><span style={toStyle(tagIdDark)}>{"구현"}</span><span style={toStyle(tagText)}>{"지켜야 하는 것"}</span></div>
<div style={toStyle(card)}>
{Array.from((impl) ?? []).map((i, __index9) => (
<React.Fragment key={__index9}>

<div style={toStyle(iRow)}><span style={toStyle(iK)}>{i.k}</span><span style={toStyle(iV)}>{i.v}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle("width:100%;flex:0 0 100%;padding:16px 0 0;font-size:22px;line-height:30px;font-weight:700;color:#212124")}>{"2 · 빈 상태 · 완료"}</div>
<div style={toStyle(erow)}>
{Array.from((escreens) ?? []).map((s, __index10) => (
<React.Fragment key={__index10}>

<div style={toStyle(ecol)}>
<div style={toStyle(etag)}><span style={toStyle(etagId)}>{s.code}</span><span style={toStyle(etagText)}>{s.title}</span></div>
<span style={toStyle(etagDesc)}>{s.desc}</span>
<div style={toStyle(ephone)} data-design-frame="true" data-source-line={140}>
<div style={toStyle(ebar)}><span>{"9:41"}</span></div>
{Boolean(s.nav) ? <> 
<div style={toStyle(navBar)}>{Boolean(s.back) ? <> <span style={toStyle(icoBack)}></span> </> : null}<span style={toStyle(s.navStyle)}>{s.nav}</span><span style={toStyle(navPad)}></span></div>
 </> : null}
<div className={"nsb"} style={toStyle(scroll)}>
{Boolean(s.sections) ? <> 
{Array.from((s.sections) ?? []).map((c, __index11) => (
<React.Fragment key={__index11}>

<div style={toStyle(c.wrapStyle)}>
<div style={toStyle(secHead)}><span style={toStyle(secTitle)}>{c.title}</span>{Boolean(c.more) ? <> <span style={toStyle(moreRow)}>{c.more}<span style={toStyle(icoChev)}></span></span> </> : null}</div>
{Boolean(c.empty) ? <> 
<div style={toStyle(c.bodyStyle)}>
<div style={toStyle(emptyCard)}>
<span style={toStyle(emptyT)}>{c.emptyT}</span>
<span style={toStyle(emptyS)}>{c.emptyS}</span>
{Boolean(c.cta) ? <> <span style={toStyle(c.ctaStyle)}>{c.cta}</span> </> : null}
</div>
</div>
 </> : null}
{Boolean(c.rows) ? <> 
<div style={toStyle(rowsWrap)}>
{Array.from((c.rows) ?? []).map((r, __index12) => (
<React.Fragment key={__index12}>

<div style={toStyle(dataRow)}><span style={toStyle(dataK)}>{r.k}</span><span style={toStyle(dataV)}>{r.v}</span></div>

</React.Fragment>
))}
</div>
 </> : null}
</div>

</React.Fragment>
))}
 </> : null}
{Boolean(s.done) ? <> 
<div style={toStyle(doneWrap)}>
<span style={toStyle(s.markStyle)}></span>
<span style={toStyle(doneTitle)}>{s.doneT}</span>
<span style={toStyle(doneSub)}>{s.doneS}</span>
{Boolean(s.items) ? <> 
<div style={toStyle(itemBox)}>
{Array.from((s.items) ?? []).map((i, __index13) => (
<React.Fragment key={__index13}>

<div style={toStyle(itemRow)}><span style={toStyle(itemMark)}></span><div style={toStyle(itemCol)}><span style={toStyle(itemK)}>{i.k}</span><span style={toStyle(itemV)}>{i.v}</span></div></div>

</React.Fragment>
))}
</div>
 </> : null}
{Boolean(s.nextCard) ? <> 
<div style={toStyle(nextCard)}><span style={toStyle(nextLabel)}>{"다음"}</span><span style={toStyle(nextTitle)}>{s.nextCard}</span></div>
 </> : null}
</div>
 </> : null}
</div>
{Boolean(s.dock) ? <> 
<div style={toStyle(dock)}>
{Boolean(s.dock2) ? <> <span style={toStyle(btnGhost)}>{s.dock2}</span> </> : null}
<span style={toStyle(s.dockStyle)}>{s.dock}</span>
</div>
 </> : null}
{Boolean(s.tabs) ? <> 
<div style={toStyle(tabBar)}>{Array.from((s.tabs) ?? []).map((t, __index14) => (
<React.Fragment key={__index14}>
<div style={toStyle(tabCell)}><span style={toStyle(t.icon)}></span><span style={toStyle(t.label)}>{t.text}</span></div>
</React.Fragment>
))}</div>
 </> : null}
</div>
</div>

</React.Fragment>
))}
</div>

<div style={toStyle(ecolWide)}>
<div style={toStyle(etag)}><span style={toStyle(etagIdDark)}>{"규칙"}</span><span style={toStyle(etagText)}>{"빈 상태 · 완료 화면"}</span></div>
<div style={toStyle(ecard)}>
{Array.from((rules) ?? []).map((r, __index15) => (
<React.Fragment key={__index15}>

<div style={toStyle(rRow)}><span style={toStyle(rK)}>{r.k}</span><span style={toStyle(rV)}>{r.v}</span></div>

</React.Fragment>
))}
</div>
<div style={toStyle(etag2)}><span style={toStyle(etagIdDark)}>{"문구"}</span><span style={toStyle(etagText)}>{"빈 상태 카피"}</span></div>
<div style={toStyle(ecard)}>
<div style={toStyle(ewHead)}><span style={toStyle(ewh1)}>{"화면"}</span><span style={toStyle(ewh2)}>{"제목"}</span><span style={toStyle(ewh3)}>{"설명 · 버튼"}</span></div>
{Array.from((copies) ?? []).map((c, __index16) => (
<React.Fragment key={__index16}>

<div style={toStyle(ewRow)}><span style={toStyle(ewc1)}>{c.w}</span><span style={toStyle(ewc2)}>{c.t}</span><span style={toStyle(ewc3)}>{c.s}</span></div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle("width:100%;flex:0 0 100%;padding:16px 0 0;font-size:22px;line-height:30px;font-weight:700;color:#212124")}>{"3 · 로더"}</div>
<div style={toStyle("display:flex;gap:36px;align-items:flex-start;flex-wrap:wrap")}>
<div id={"30a"} style={toStyle(Lcol)}>
<div style={toStyle(Ltag)}><span style={toStyle(LtagIdWide)}>{"3-1"}</span>{"업종 순회 로딩 · WP-LOAD-001"}</div>
<span style={toStyle(LtagDesc)}>{"온보딩에서 «아직»으로 남은 업종만 순회합니다. 이미 결정한 업종(웨딩홀)은 빼고 돕니다."}</span>
<div style={toStyle(Lphone)} data-design-frame="true" data-source-line={229}>
<div style={toStyle(Lbar)}><span>{"9:41"}</span><span style={toStyle(barIcons)}><svg width={"17"} height={"11"} viewBox={"0 0 17 11"} fill={"#212124"}><rect x={"0"} y={"7"} width={"3"} height={"4"} rx={"1"}></rect><rect x={"4.5"} y={"5"} width={"3"} height={"6"} rx={"1"}></rect><rect x={"9"} y={"2.5"} width={"3"} height={"8.5"} rx={"1"}></rect><rect x={"13.5"} y={"0"} width={"3"} height={"11"} rx={"1"}></rect></svg><svg width={"25"} height={"12"} viewBox={"0 0 25 12"} fill={"none"}><rect x={"0.5"} y={"0.5"} width={"21"} height={"11"} rx={"3"} stroke={"#212124"} strokeOpacity={".35"}></rect><rect x={"2"} y={"2"} width={"17"} height={"8"} rx={"1.8"} fill={"#212124"}></rect></svg></span></div>
<div style={toStyle(centerWrap)}>
<div style={toStyle(orbitWrap)}>
<span style={toStyle(orbitRing)}></span>
<span style={toStyle(orbitSpin)}><span style={toStyle(orbitDot)}></span></span>
{Array.from((cats) ?? []).map((c, __index17) => (
<React.Fragment key={__index17}>

<span style={toStyle(c.iconWrap)}>
<svg width={"34"} height={"34"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#ff6f61"} strokeWidth={"1.7"} strokeLinecap={"round"} strokeLinejoin={"round"}>
<path d={c.d1}></path>
<path d={c.d2}></path>
</svg>
</span>

</React.Fragment>
))}
</div>
<div style={toStyle(textWrap)}>
<span style={toStyle(h24)}>{"지수님에게 맞는 곳을"}<br />{"찾고 있어요"}</span>
<span style={toStyle(subLine)}>{"10초 안에 끝나요"}</span>
</div>
<div style={toStyle(stepList)}>
{Array.from((steps) ?? []).map((s, __index18) => (
<React.Fragment key={__index18}>

<span style={toStyle(s.row)}>
<span style={toStyle(s.dot)}></span>
<span style={toStyle(s.label)}>{s.name}</span>
</span>

</React.Fragment>
))}
</div>
</div>
</div>
</div>
<div id={"30b"} style={toStyle(Lcol)}>
<div style={toStyle(Ltag)}><span style={toStyle(LtagIdWide)}>{"3-2"}</span>{"업종 아이콘 8종 · WP-LOAD-002"}</div>
<span style={toStyle(LtagDesc)}>{"라인 아이콘. stroke 1.7 · round cap. 순회 로딩과 업종 칩에 같은 글리프를 씁니다."}</span>
<div style={toStyle(sheetCard)}>
<div style={toStyle(iconGrid)}>
{Array.from((allCats) ?? []).map((c, __index19) => (
<React.Fragment key={__index19}>

<div style={toStyle(iconCell)}>
<span style={toStyle(iconBox)}>
<svg width={"28"} height={"28"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#4d5159"} strokeWidth={"1.7"} strokeLinecap={"round"} strokeLinejoin={"round"}>
<path d={c.d1}></path>
<path d={c.d2}></path>
</svg>
</span>
<span style={toStyle(iconLabel)}>{c.name}</span>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle(Lhr)}></div>
<div style={toStyle("display:flex;flex-direction:column;gap:6px")}>
<span style={toStyle(noteTitle)}>{"순회 순서"}</span>
<span style={toStyle(noteBody)}>{"준비 순서와 같게 둡니다. 한 아이콘이 1.4초 머물고 전체 7초에 한 바퀴 돕니다. 순서를 임의로 섞지 않습니다."}</span>
</div>
</div>
</div>
<div id={"30c"} style={toStyle(Lcol)}>
<div style={toStyle(Ltag)}><span style={toStyle(LtagIdWide)}>{"3-3"}</span>{"기본 로더 · 업종 아이콘 순회 · WP-LOAD-003"}</div>
<span style={toStyle(LtagDesc)}>{"원형 스피너를 쓰지 않습니다. 업종 아이콘이 도는 것 하나로 통일하고 크기만 바꿉니다."}</span>
<div style={toStyle(sheetCard)}>
<div style={toStyle(spinRow)}>
{Array.from((spinners) ?? []).map((sp, __index20) => (
<React.Fragment key={__index20}>

<div style={toStyle(spinCell)}>
<span style={toStyle(sp.box)}>
{Array.from((sp.items) ?? []).map((it, __index21) => (
<React.Fragment key={__index21}>

<span style={toStyle(it.wrap)}>
<svg width={it.px} height={it.px} viewBox={"0 0 24 24"} fill={"none"} stroke={"#ff6f61"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}>
<path d={it.d1}></path><path d={it.d2}></path>
</svg>
</span>

</React.Fragment>
))}
</span>
<span style={toStyle(iconLabel)}>{sp.label}</span>
<span style={toStyle(specLabel)}>{sp.spec}</span>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle(Lhr)}></div>
<div style={toStyle(arcRow)}>
<span style={toStyle(slowBox)}>{"700ms"}</span>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle(noteTitle)}>{"응답이 늦으면 무조건 띄워요"}</span>
<span style={toStyle(noteBody)}>{"700ms를 넘으면 화면 성격과 무관하게 이 로더를 띄웁니다. 빈 화면이나 멈춘 화면을 보여주지 않습니다."}</span>
</div>
</div>
</div>
</div>
<div id={"30d"} style={toStyle(Lcol)}>
<div style={toStyle(Ltag)}><span style={toStyle(LtagIdWide)}>{"3-4"}</span>{"목록 뼈대 · WP-LOAD-004"}</div>
<span style={toStyle(LtagDesc)}>{"목록에는 스피너를 쓰지 않습니다. 3줄까지만 뼈대를 그립니다."}</span>
<div style={toStyle(Lphone)} data-design-frame="true" data-source-line={324}>
<div style={toStyle(Lbar)}><span>{"9:41"}</span><span style={toStyle(barIcons)}><svg width={"17"} height={"11"} viewBox={"0 0 17 11"} fill={"#212124"}><rect x={"0"} y={"7"} width={"3"} height={"4"} rx={"1"}></rect><rect x={"4.5"} y={"5"} width={"3"} height={"6"} rx={"1"}></rect><rect x={"9"} y={"2.5"} width={"3"} height={"8.5"} rx={"1"}></rect><rect x={"13.5"} y={"0"} width={"3"} height={"11"} rx={"1"}></rect></svg><svg width={"25"} height={"12"} viewBox={"0 0 25 12"} fill={"none"}><rect x={"0.5"} y={"0.5"} width={"21"} height={"11"} rx={"3"} stroke={"#212124"} strokeOpacity={".35"}></rect><rect x={"2"} y={"2"} width={"17"} height={"8"} rx={"1.8"} fill={"#212124"}></rect></svg></span></div>
<div style={toStyle(navBack)}>
<span style={toStyle(backBtn)}><svg width={"24"} height={"24"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#212124"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M14.5 5 8 12l6.5 7"}></path></svg></span>
<span style={toStyle(navTitle)}>{"검색 결과"}</span>
</div>
<div style={toStyle(skWrap)}>
<span style={toStyle(skHero)}></span>
<span style={toStyle(skWide)}></span>
<span style={toStyle(skNarrow)}></span>
<div style={toStyle(hrThin)}></div>
{Array.from((skRows) ?? []).map((r, __index22) => (
<React.Fragment key={__index22}>

<div style={toStyle(skRow)}>
<span style={toStyle(skThumb)}></span>
<div style={toStyle("flex:1;display:flex;flex-direction:column;gap:8px")}>
<span style={toStyle(r.a)}></span>
<span style={toStyle(r.b)}></span>
</div>
</div>

</React.Fragment>
))}
</div>
</div>
</div>
<div id={"30e"} style={toStyle(Lcol)}>
<div style={toStyle(Ltag)}><span style={toStyle(LtagIdWide)}>{"3-5"}</span>{"처리 중 · 단계 표시 · WP-LOAD-005"}</div>
<span style={toStyle(LtagDesc)}>{"단계가 있는 처리는 무엇이 끝났고 무엇이 남았는지 보여줍니다. 끝난 단계는 체크로 바뀝니다."}</span>
<div style={toStyle(Lphone)} data-design-frame="true" data-source-line={351}>
<div style={toStyle(Lbar)}><span>{"9:41"}</span><span style={toStyle(barIcons)}><svg width={"17"} height={"11"} viewBox={"0 0 17 11"} fill={"#212124"}><rect x={"0"} y={"7"} width={"3"} height={"4"} rx={"1"}></rect><rect x={"4.5"} y={"5"} width={"3"} height={"6"} rx={"1"}></rect><rect x={"9"} y={"2.5"} width={"3"} height={"8.5"} rx={"1"}></rect><rect x={"13.5"} y={"0"} width={"3"} height={"11"} rx={"1"}></rect></svg><svg width={"25"} height={"12"} viewBox={"0 0 25 12"} fill={"none"}><rect x={"0.5"} y={"0.5"} width={"21"} height={"11"} rx={"3"} stroke={"#212124"} strokeOpacity={".35"}></rect><rect x={"2"} y={"2"} width={"17"} height={"8"} rx={"1.8"} fill={"#212124"}></rect></svg></span></div>
<div style={toStyle(navBack)}>
<span style={toStyle(backBtn)}><svg width={"24"} height={"24"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#212124"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M6 6l12 12M18 6 6 18"}></path></svg></span>
</div>
<div style={toStyle(centerWrap)}>
<span style={toStyle(spinBig)}></span>
<div style={toStyle(textWrap)}>
<span style={toStyle(h24)}>{"올려주신 자료를"}<br />{"읽고 있어요"}</span>
<span style={toStyle(subLine)}>{"10초 안에 끝나요"}</span>
</div>
<div style={toStyle(stepList)}>
{Array.from((ocrSteps) ?? []).map((s, __index23) => (
<React.Fragment key={__index23}>

<span style={toStyle(s.row)}>
<span style={toStyle(s.dot)}>
{Boolean(s.done) ? <> 
<svg width={"11"} height={"11"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#fff"} strokeWidth={"3.6"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"m5 12.5 4.5 4.5L19 7.5"}></path></svg>
 </> : null}
</span>
<span style={toStyle(s.label)}>{s.name}</span>
</span>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(Ldock)}><button style={toStyle(ctaGhost)}>{"취소"}</button></div>
</div>
</div>
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:16px;max-width:1180px")}>
<span style={toStyle(h26)}>{"어디에 무엇을 쓰나"}</span>
<div style={toStyle(tableCard)}>
<div style={toStyle(thead)}>
<span style={toStyle(th1)}>{"상황"}</span>
<span style={toStyle(th2)}>{"쓰는 것"}</span>
<span style={toStyle(th3)}>{"문구"}</span>
</div>
{Array.from((usage) ?? []).map((u, __index24) => (
<React.Fragment key={__index24}>

<div style={toStyle(tbody)}>
<span style={toStyle(td1)}>{u.when}</span>
<span style={toStyle(u.whatStyle)}>{u.what}</span>
<span style={toStyle(td3)}>{u.copy}</span>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle("display:flex;gap:20px;flex-wrap:wrap")}>
{Array.from((Lrules) ?? []).map((r, __index25) => (
<React.Fragment key={__index25}>

<div style={toStyle(ruleCard)}>
<span style={toStyle(noteTitle)}>{r.title}</span>
<span style={toStyle(noteBody)}>{r.body}</span>
</div>

</React.Fragment>
))}
</div>
</div>
</section>
</React.Fragment>
  );
}
