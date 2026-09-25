import React from 'react';
import Model from '../models/note.js';
import { useDesignValues, toStyle, ImageSlot, designHref } from '../runtime/designRuntime.js';

/** 원본 화면 구조와 상태를 보존한 React 디자인 보드. Source: 대메뉴_웨딩노트.dc.html */
export default function NoteBoard(props) {
  const {
    wheelSheet, sheetGrab, sheetClose, icoX, wheelWrap, wheelBand, wheelFadeTop, wheelFadeBottom,
    colDateSheet, dateWheels, navBar, navTitle, navPad, icoBack, qBlock, qTitle,
    qSub, sec, secTitle, rows, uploadGrid, upCell, upT, upS,
    uploadWays, tipRow, tipCheck, tipText, tips, noteBox, mergeBox, noteT,
    noteS, ocrHead, ocrK, ocrV, ocrHint, ocrFields, dockSingle, ctaFull,
    ctaDim, root, intro, eyebrow, h40, introBody, boardRow, grp,
    col, colEventForm, colList, colDetail, colBudget, colForm, colCert1, colCert2,
    tagIdWide, colWide, headAddSm, clHead, secTitleSm, secLabelC, decidedCard, decidedTop,
    decidedName, decidedDate, decidedNote, spendGoRow, spendGoT, memoLinkRow, memoLinkT, decided,
    memoAlwaysBox, memoAlwaysLabel, memoAlwaysText, checklist, noteCard, noteTop, noteTagStyle, noteDate,
    noteBody, notes, spendRow, spendCol, spendLabel, spendDate, spendAmt, spendBadge,
    spends, chRow, chCol, chWho, chWhat, chRight, chTime, chUndo,
    changeLog, col16, col17, col18, col19, col20, tag, tagId,
    tagDesc, phone, bar, scroll, head, h1, headAdd, tabNav,
    card, monthRow, monthNav, navBtn, todayBtn, monthLabel, icoLeft, icoRight,
    dowRow, calGrid, dayList, doneBadge, timeText, icoEdit, icoTrash, icoEditSm,
    icoTrashSm, icoCheckSm, sumRow, donutTop, donutWrap, donutPct, donutCol, sumBig,
    sumRight, track, fill57, sumNote, divider, bRow, bTop, bName,
    bNum, trackSm, bFoot, bFootL, inviteRow, inviteCol, inviteT, inviteS,
    inviteBtn, dimTop, cardDim, cRow, cCol, cName, cMeta, sheetForm,
    formHead, formClose, icoXsm, formDate, sumRightBtn, icoEditSm2, dateInput, dateVal,
    icoCal, modeRow, modes, fieldWrap, fieldLabelRow, fieldLabel, photoAttachCell, photoAttachCol,
    photoAttachT, photoAttachNote, icoCam2, mergedFields, toggleRow, toggleLabel, knob, btnPrimaryFull,
    autoRow, autoBtn, cListHead, cListTitle, cListNote, icoRightSm, uploadBox, icoMic,
    uploadT, uploadS, sheetWrap, sheet, certSheet, ddayCard, ddayTop, ddayDate,
    ddayNum, ddayNote, decidedLinkRow, decidedLinkT, icoChevSm, pastRow, pastText, pastBtn,
    tlWrap, tlG, tlHead, tlTitle, tlRange, tlRow, tlRail, tlLine,
    tlGroups, certFull, certNav, navClose, certScroll, grab, sheetNote, sheetNoteText,
    sheetHead, sheetTitle, sheetSub, sheetBody, aBlock, aRow, aText, aVal,
    sheetDock, btnGhost, btnPrimary, tabBar, tabCell, diffCard, diffHead, diffRow,
    dh1, dh2, dh3, dh4, dc1, dc2, tabsA, tabsB,
    tabsC, dow, days, dayEvents, budgets, consults, eventFields, budgetFields,
    alarmRows, analysis, tabs, diffs, tagRow, tagText
  } = useDesignValues(Model, props);
  return (
<React.Fragment>

<section style={toStyle(root)}>
<div style={toStyle(intro)}>
<span style={toStyle(eyebrow)}>{"WeddingPick · Figma 기준 · 정본 톤"}</span>
<span style={toStyle(h40)}>{"웨딩노트 · /wedding"}</span>
<span style={toStyle(introBody)}>{"OurWedding.tsx의 3탭(캘린더 · 상담기록 · 예산현황)을 옮기고 색 · 서체 · 용어를 정본으로 되돌렸습니다. 상담 녹음 분석은 정본에 없는 신규 기능이라 그대로 두되 「AI 분석 중」 문구만 「정리하고 있어요」로 바꿨습니다."}</span>
</div>
<div style={toStyle(boardRow)}>
<div style={toStyle(grp)}>
<div style={toStyle(col)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"1"}</span>{"캘린더 · WP-NOTE-001"}</div>
<span style={toStyle(tagDesc)}>{"월 격자를 폐기하고 예식일까지 주 단위 흐름으로 바꿨습니다. 지난 일정은 한 줄로 접고, 맨 아래가 예식일입니다. 체크리스트는 일정과 같은 화면에 둡니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={36}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(head)}><span style={toStyle(h1)}>{"웨딩노트"}</span><span style={toStyle(headAdd)}>{"일정 추가"}</span></div>
<div style={toStyle(tabNav)}>{Array.from((tabsA) ?? []).map((t, __index1) => (
<React.Fragment key={__index1}>
<span style={toStyle(t.style)}>{t.label}</span>
</React.Fragment>
))}</div>
<div style={toStyle(ddayCard)}>
<div style={toStyle(ddayTop)}><span style={toStyle(ddayDate)}>{"2027.05.16(토)"}</span><span style={toStyle(ddayNum)}>{"D-236"}</span></div>
<span style={toStyle(ddayNote)}>{"남은 34주 · 이번 주에 할 일 2건"}</span>
<div style={toStyle(decidedLinkRow)}><span style={toStyle(decidedLinkT)}>{"예약현황 4/12"}</span><span style={toStyle(icoChevSm)}></span></div>
</div>
<div style={toStyle(pastRow)}><span style={toStyle(pastText)}>{"지난 일정 2건"}</span><span style={toStyle(pastBtn)}>{"보기"}</span></div>
<div style={toStyle(tlWrap)}>
{Array.from((tlGroups) ?? []).map((g, __index2) => (
<React.Fragment key={__index2}>

<div style={toStyle(tlG)}>
<div style={toStyle(tlHead)}><span style={toStyle(tlTitle)}>{g.title}</span><span style={toStyle(tlRange)}>{g.range}</span></div>
{Array.from((g.items) ?? []).map((i, __index3) => (
<React.Fragment key={__index3}>

<div style={toStyle(tlRow)}>
<div style={toStyle(tlRail)}><span style={toStyle(i.dot)}></span><span style={toStyle(tlLine)}></span></div>
<div style={toStyle(i.card)}>
<span style={toStyle(i.timeStyle)}>{i.time}</span>
<span style={toStyle(i.titleStyle)}>{i.title}</span>
{Boolean(i.hasMeta) ? <> <span style={toStyle(i.metaStyle)}>{i.meta}</span> </> : null}
</div>
</div>

</React.Fragment>
))}
</div>

</React.Fragment>
))}
</div>
<div style={toStyle(sec)}>
<div style={toStyle(clHead)}><span style={toStyle(secTitleSm)}>{"할 일"}</span><span style={toStyle(headAddSm)}>{"추가"}</span></div>
{Array.from((checklist) ?? []).map((c, __index4) => (
<React.Fragment key={__index4}>

<div style={toStyle(c.row)}>
<span style={toStyle(c.check)}></span>
<span style={toStyle(c.label)}>{c.t}</span>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle("height:40px")}></div>
</div>
<div style={toStyle(tabBar)}>{Array.from((tabs) ?? []).map((t, __index5) => (
<React.Fragment key={__index5}>
<div style={toStyle(tabCell)}><span style={toStyle(t.icon)}></span><span style={toStyle(t.label)}>{t.text}</span></div>
</React.Fragment>
))}</div>
</div>
</div>
<div style={toStyle(colEventForm)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"1-1"}</span><span style={toStyle(tagText)}>{"일정 등록 · WP-NOTE-002"}</span></div>
<span style={toStyle(tagDesc)}>{"캘린더에서 빈 날짜를 누르거나 헤더 «추가»를 누르면 열립니다. 제목과 시간만 받고, 알림은 기본으로 켜둡니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={82}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(dimTop)}>
<div style={toStyle(head)}><span style={toStyle(h1)}>{"웨딩노트"}</span><span style={toStyle(headAdd)}>{"추가"}</span></div>
<div style={toStyle(tabNav)}>{Array.from((tabsA) ?? []).map((t, __index6) => (
<React.Fragment key={__index6}>
<span style={toStyle(t.style)}>{t.label}</span>
</React.Fragment>
))}</div>
<div style={toStyle(card)}><div style={toStyle(monthRow)}><span style={toStyle(icoLeft)}></span><span style={toStyle(monthLabel)}>{"2026년 9월"}</span><span style={toStyle(icoRight)}></span></div><div style={toStyle(calGrid)}>{Array.from((days) ?? []).map((d, __index7) => (
<React.Fragment key={__index7}>
<span style={toStyle(d.style)}>{d.n}</span>
</React.Fragment>
))}</div></div>
</div>
<div style={toStyle(sheetWrap)}>
<div style={toStyle(sheetForm)}>
<span style={toStyle(grab)}></span>
<div style={toStyle(formHead)}><span style={toStyle(sheetTitle)}>{"일정 추가"}</span><span style={toStyle(formClose)}><span style={toStyle(icoXsm)}></span></span></div>
<div style={toStyle(fieldWrap)}>
<span style={toStyle(fieldLabel)}>{"날짜"}</span>
<div style={toStyle(dateInput)}><span style={toStyle(dateVal)}>{"2026.09.12(금)"}</span><span style={toStyle(icoCal)}></span></div>
</div>
{Array.from((eventFields) ?? []).map((f, __index8) => (
<React.Fragment key={__index8}>

<div style={toStyle(fieldWrap)}><span style={toStyle(fieldLabel)}>{f.label}</span><div style={toStyle(f.box)}>{f.value}</div></div>

</React.Fragment>
))}
<div style={toStyle(divider)}></div>
{Array.from((alarmRows) ?? []).map((a, __index9) => (
<React.Fragment key={__index9}>

<div style={toStyle(toggleRow)}><span style={toStyle(toggleLabel)}>{a.label}</span><span style={toStyle(a.track)}><span style={toStyle(knob)}></span></span></div>

</React.Fragment>
))}
<div style={toStyle(sheetDock)}><span style={toStyle(btnPrimaryFull)}>{"일정 넣기"}</span></div>
</div>
</div>
</div>
</div>
</div>
<div style={toStyle(grp)}>
<div style={toStyle(colList)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"2"}</span>{"상담기록 · WP-NOTE-004"}</div>
<span style={toStyle(tagDesc)}>{"녹음 파일을 올리면 목록에 쌓입니다. 정리가 끝난 것만 눌러서 열 수 있고, 진행 중인 것은 상태만 보여줍니다. 저장한 것은 진하게 둡니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={115}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(head)}><span style={toStyle(h1)}>{"웨딩노트"}</span><span style={toStyle(headAdd)}>{"상담 추가"}</span></div>
<div style={toStyle(tabNav)}>{Array.from((tabsC) ?? []).map((t, __index10) => (
<React.Fragment key={__index10}>
<span style={toStyle(t.style)}>{t.label}</span>
</React.Fragment>
))}</div>
<div style={toStyle(card)}>
<div style={toStyle(cListHead)}><span style={toStyle(cListTitle)}>{"상담 3건"}</span><span style={toStyle(cListNote)}>{"정리된 내용은 예산에 반영해요"}</span></div>
<div style={toStyle(divider)}></div>
{Array.from((consults) ?? []).map((c, __index11) => (
<React.Fragment key={__index11}>

<div style={toStyle(cRow)}>
<div style={toStyle(cCol)}><span style={toStyle(cName)}>{c.name}</span><span style={toStyle(cMeta)}>{c.meta}</span></div>
<span style={toStyle(c.stateStyle)}>{c.state}</span>
{Boolean(c.arrow) ? <> <span style={toStyle(icoRightSm)}></span> </> : null}
</div>

</React.Fragment>
))}
</div>
<div style={toStyle("height:40px")}></div>
</div>
<div style={toStyle(tabBar)}>{Array.from((tabs) ?? []).map((t, __index12) => (
<React.Fragment key={__index12}>
<div style={toStyle(tabCell)}><span style={toStyle(t.icon)}></span><span style={toStyle(t.label)}>{t.text}</span></div>
</React.Fragment>
))}</div>
</div>
</div>
<div style={toStyle(colDetail)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"2-1"}</span><span style={toStyle(tagText)}>{"정리 결과 · WP-NOTE-005"}</span></div>
<span style={toStyle(tagDesc)}>{"녹음 파일을 올리면 포함 항목 · 별도 비용 · 조건 · 확인 필요로 정리됩니다. 정본에 없는 신규 기능이라 정책 판단이 필요합니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={140}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(dimTop)}>
<div style={toStyle(head)}><span style={toStyle(h1)}>{"웨딩노트"}</span></div>
<div style={toStyle(tabNav)}>{Array.from((tabsC) ?? []).map((t, __index13) => (
<React.Fragment key={__index13}>
<span style={toStyle(t.style)}>{t.label}</span>
</React.Fragment>
))}</div>
<div style={toStyle(cardDim)}>
{Array.from((consults) ?? []).map((c, __index14) => (
<React.Fragment key={__index14}>

<div style={toStyle(cRow)}>
<div style={toStyle(cCol)}><span style={toStyle(cName)}>{c.name}</span><span style={toStyle(cMeta)}>{c.meta}</span></div>
<span style={toStyle(c.stateStyle)}>{c.state}</span>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle(sheetWrap)}>
<div style={toStyle(sheet)}>
<span style={toStyle(grab)}></span>
<div style={toStyle(formHead)}><span style={toStyle(sheetTitle)}>{"블루밍 스튜디오"}</span><span style={toStyle(formClose)}><span style={toStyle(icoXsm)}></span></span></div>
<span style={toStyle(sheetSub)}>{"9월 14일 · 180만원"}</span>
<div className={"nsb"} style={toStyle(sheetBody)}>
{Array.from((analysis) ?? []).map((a, __index15) => (
<React.Fragment key={__index15}>

<div style={toStyle(aBlock)}>
<span style={toStyle(a.titleStyle)}>{a.title}</span>
<div style={toStyle(a.boxStyle)}>
{Array.from((a.items) ?? []).map((i, __index16) => (
<React.Fragment key={__index16}>

<div style={toStyle(aRow)}><span style={toStyle(aText)}>{i.k}</span>{Boolean(i.v) ? <> <span style={toStyle(aVal)}>{i.v}</span> </> : null}</div>

</React.Fragment>
))}
</div>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle(sheetDock)}><span style={toStyle(btnGhost)}>{"수정"}</span><span style={toStyle(btnPrimary)}>{"저장"}</span></div>
</div>
</div>
</div>
</div>
</div>
<div style={toStyle(grp)}>
<div style={toStyle(colBudget)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"3"}</span>{"예산현황 · WP-NOTE-006"}</div>
<span style={toStyle(tagDesc)}>{"전체 사용률은 도넛 차트로, 항목별 진행은 막대로 보여줍니다. Pick 인증 유도는 하단 한 줄."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={182}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(head)}><span style={toStyle(h1)}>{"웨딩노트"}</span><span style={toStyle(headAdd)}>{"예산 추가"}</span></div>
<div style={toStyle(tabNav)}>{Array.from((tabsB) ?? []).map((t, __index17) => (
<React.Fragment key={__index17}>
<span style={toStyle(t.style)}>{t.label}</span>
</React.Fragment>
))}</div>
<div style={toStyle(card)}>
<div style={toStyle(donutTop)}>
<div style={toStyle(donutWrap)}>
<svg width={"88"} height={"88"} viewBox={"0 0 88 88"}>
<circle cx={"44"} cy={"44"} r={"36"} fill={"none"} stroke={"#f2f3f6"} strokeWidth={"12"}></circle>
<circle cx={"44"} cy={"44"} r={"36"} fill={"none"} stroke={"#ff6f61"} strokeWidth={"12"} strokeDasharray={"128.9 97.3"} strokeLinecap={"round"} transform={"rotate(-90 44 44)"}></circle>
</svg>
<span style={toStyle(donutPct)}>{"57%"}</span>
</div>
<div style={toStyle(donutCol)}>
<span style={toStyle(sumBig)}>{"1,000만원"}</span>
<span style={toStyle(sumRightBtn)}>{"예산 1,750만원"}<span style={toStyle(icoEditSm2)}></span></span>
<span style={toStyle(sumNote)}>{"750만원 남았어요"}</span>
</div>
</div>
<div style={toStyle(divider)}></div>
{Array.from((budgets) ?? []).map((b, __index18) => (
<React.Fragment key={__index18}>

<div style={toStyle(bRow)}>
<div style={toStyle(bTop)}><span style={toStyle(bName)}>{b.label}</span><span style={toStyle(bNum)}>{b.text}</span><span style={toStyle(icoEditSm)}></span><span style={toStyle(icoTrashSm)}></span></div>
<div style={toStyle(trackSm)}><span style={toStyle(b.fill)}></span></div>
<div style={toStyle(bFoot)}><span style={toStyle(bFootL)}>{b.state}</span><span style={toStyle(b.pctStyle)}>{b.pct}</span></div>
</div>

</React.Fragment>
))}
<div style={toStyle(divider)}></div>
<div style={toStyle(spendGoRow)}><span style={toStyle(spendGoT)}>{"지출내역"}</span><span style={toStyle(icoChevSm)}></span></div>
</div>
<div style={toStyle("height:40px")}></div>
</div>
<div style={toStyle(tabBar)}>{Array.from((tabs) ?? []).map((t, __index19) => (
<React.Fragment key={__index19}>
<div style={toStyle(tabCell)}><span style={toStyle(t.icon)}></span><span style={toStyle(t.label)}>{t.text}</span></div>
</React.Fragment>
))}</div>
</div>
</div>
<div style={toStyle(colForm)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"3-1"}</span><span style={toStyle(tagText)}>{"예산 항목 추가 · WP-NOTE-007"}</span></div>
<span style={toStyle(tagDesc)}>{"직접 입력과 Pick 인증 사진을 한 화면에 묻었습니다. 사진을 올리면 읽은 값이 필드에 바로 채워지고, 확인이 필요한 값만 코랄로 표시됩니다. 별도의 업로드·확인 화면 없이 여기서 끝납니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={222}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(dimTop)}>
<div style={toStyle(head)}><span style={toStyle(h1)}>{"웨딩노트"}</span><span style={toStyle(headAdd)}>{"추가"}</span></div>
<div style={toStyle(tabNav)}>{Array.from((tabsB) ?? []).map((t, __index20) => (
<React.Fragment key={__index20}>
<span style={toStyle(t.style)}>{t.label}</span>
</React.Fragment>
))}</div>
<div style={toStyle(card)}><div style={toStyle(sumRow)}><span style={toStyle(sumBig)}>{"1,000만원"}</span><span style={toStyle(sumRight)}>{"예산 1,750만원"}</span></div><div style={toStyle(track)}><span style={toStyle(fill57)}></span></div></div>
</div>
<div style={toStyle(sheetWrap)}>
<div style={toStyle(sheetForm)}>
<span style={toStyle(grab)}></span>
<div style={toStyle(formHead)}><span style={toStyle(sheetTitle)}>{"예산 추가"}</span><span style={toStyle(formClose)}><span style={toStyle(icoXsm)}></span></span></div>
<div style={toStyle(photoAttachCell)}>
<span style={toStyle(icoCam2)}></span>
<div style={toStyle(photoAttachCol)}><span style={toStyle(photoAttachT)}>{"사진으로 채우기"}</span><span style={toStyle(photoAttachNote)}>{"영수증 · 문자 캡처를 올리면 아래 항목이 채워져요"}</span></div>
</div>
{Array.from((mergedFields) ?? []).map((f, __index21) => (
<React.Fragment key={__index21}>

<div style={toStyle(fieldWrap)}>
<div style={toStyle(fieldLabelRow)}><span style={toStyle(fieldLabel)}>{f.label}</span>{Boolean(f.tag) ? <> <span style={toStyle(f.tagStyle)}>{f.tag}</span> </> : null}</div>
<div style={toStyle(f.box)}>{f.value}</div>
{Boolean(f.hint) ? <> <span style={toStyle(ocrHint)}>{f.hint}</span> </> : null}
</div>

</React.Fragment>
))}
<div style={toStyle(sheetDock)}><span style={toStyle(btnGhost)}>{"직접입력"}</span><span style={toStyle(btnPrimary)}>{"자동입력"}</span></div>
</div>
</div>
</div>
</div>
<div style={toStyle(col19)}>
<div style={toStyle(tagRow)}><span style={toStyle(tagIdWide)}>{"3-4"}</span><span style={toStyle(tagText)}>{"지출 목록 · WP-OUR-014b"}</span></div>
<span style={toStyle(tagDesc)}>{"예산현황 «내역 보기»에서 들어옵니다. 낸 금액이 있는 항목만 쌓이고, Pick 인증 여부를 옆에 표시합니다. 공통 풀팝업 UX(좌측 X 닫기)로 엽니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={253}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(certNav)}><span style={toStyle(navClose)}><span style={toStyle(icoXsm)}></span></span><span style={toStyle(navTitle)}>{"지출내역"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(sec)}>
{Array.from((spends) ?? []).map((s, __index22) => (
<React.Fragment key={__index22}>

<div style={toStyle(spendRow)}>
<div style={toStyle(spendCol)}><span style={toStyle(spendLabel)}>{s.label}</span><span style={toStyle(spendDate)}>{s.date}</span></div>
<span style={toStyle(spendAmt)}>{s.amt}</span>
{Boolean(s.verified) ? <> <span style={toStyle(spendBadge)}>{"Pick 인증"}</span> </> : null}
</div>

</React.Fragment>
))}
</div>
<div style={toStyle("height:24px")}></div>
</div>
</div>
</div>
</div>
<div style={toStyle("width:100%;flex:0 0 100%;padding:16px 0 0;font-size:22px;line-height:30px;font-weight:700;color:#212124")}>{"빠진 화면 보완"}</div>
<div style={toStyle(col16)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"4"}</span><span style={toStyle(tagText)}>{"예약현황 · WP-OUR-003"}</span></div>
<span style={toStyle(tagDesc)}>{"예약현황을 보는 곳입니다 — 결정한 업종별로 상담예약 내역 전반을 모아 보여줍니다. 메모는 링크 없이 항상 펼쳐 보입니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={278}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(certNav)}><span style={toStyle(navClose)}><span style={toStyle(icoXsm)}></span></span><span style={toStyle(navTitle)}>{"예약현황"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
{Array.from((decided) ?? []).map((d, __index23) => (
<React.Fragment key={__index23}>

<div style={toStyle(sec)}>
<span style={toStyle(secLabelC)}>{d.cat}</span>
<div style={toStyle(decidedCard)}>
<div style={toStyle(decidedTop)}><span style={toStyle(decidedName)}>{d.name}</span><span style={toStyle(decidedDate)}>{d.date}{" 결정"}</span></div>
<span style={toStyle(decidedNote)}>{d.note}</span>
{Boolean(d.memo) ? <> <div style={toStyle(memoAlwaysBox)}><span style={toStyle(memoAlwaysLabel)}>{"메모"}</span><span style={toStyle(memoAlwaysText)}>{d.memo}</span></div> </> : null}
</div>
</div>

</React.Fragment>
))}
<div style={toStyle("height:24px")}></div>
</div>
</div>
</div>
<div style={toStyle(col19)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"5"}</span><span style={toStyle(tagText)}>{"변경내역 · WP-CPL-005"}</span></div>
<span style={toStyle(tagDesc)}>{"배우자와 연결된 경우에만 보입니다. 누가 무엇을 언제 바꿨는지 적고, 되돌리기는 항목별로 있습니다. 공통 풀팝업 UX(좌측 X 닫기)로 엽니다."}</span>
<div style={toStyle(phone)} data-design-frame="true" data-source-line={300}>
<div style={toStyle(bar)}><span>{"9:41"}</span></div>
<div style={toStyle(certNav)}><span style={toStyle(navClose)}><span style={toStyle(icoXsm)}></span></span><span style={toStyle(navTitle)}>{"변경내역"}</span><span style={toStyle(navPad)}></span></div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(sec)}>
{Array.from((changeLog) ?? []).map((c, __index24) => (
<React.Fragment key={__index24}>

<div style={toStyle(chRow)}>
<div style={toStyle(chCol)}><span style={toStyle(chWho)}>{c.who}</span><span style={toStyle(chWhat)}>{c.what}</span></div>
<div style={toStyle(chRight)}><span style={toStyle(chTime)}>{c.time}</span><span style={toStyle(chUndo)}>{"되돌리기"}</span></div>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle("height:24px")}></div>
</div>
</div>
</div>
<div style={toStyle(colWide)}>
<div style={toStyle(tag)}><span style={toStyle(tagId)}>{"6"}</span>{"정본과 다른 점"}</div>
<span style={toStyle(tagDesc)}>{"이 시안에는 이미 반영돼 있습니다. 마지막 두 줄은 정책 결정이 필요한 항목입니다."}</span>
<div style={toStyle(diffCard)}>
<div style={toStyle(diffHead)}><span style={toStyle(dh1)}>{"항목"}</span><span style={toStyle(dh2)}>{"Figma 원본"}</span><span style={toStyle(dh3)}>{"정본 · 이 시안"}</span><span style={toStyle(dh4)}>{"이유"}</span></div>
{Array.from((diffs) ?? []).map((d, __index25) => (
<React.Fragment key={__index25}>

<div style={toStyle(diffRow)}><span style={toStyle(dc1)}>{d.k}</span><span style={toStyle(dc2)}>{d.a}</span><span style={toStyle(d.bs)}>{d.b}</span><span style={toStyle(d.ws)}>{d.why}</span></div>

</React.Fragment>
))}
</div>
</div>
</div>
</section>
</React.Fragment>
  );
}
