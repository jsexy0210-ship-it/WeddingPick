import React from 'react';
import Model from '../models/devices.js';
import { useDesignValues, toStyle, ImageSlot, designHref } from '../runtime/designRuntime.js';

/** 원본 화면 구조와 상태를 보존한 React 디자인 보드. Source: 웨딩픽 디바이스 대응.dc.html */
export default function DevicesBoard(props) {
  const {
    tag, tagDesc, statusBar, barIcons, header, wordmark, scroll, heroPad,
    cardPad, recessed, tabBar, handle, gestureBar, navBtns, navHome, navRecent,
    h26, t18b, t16g, t14w, specBox, specRow, specK, codeCard,
    codeLabel, codeBlock, codeRow, codeK, codeV, codeNote, ruleCard, ruleTitle,
    ruleBody, tabs, devices, sectionSub, tableCard, theadRow, theadRow3, tbodyRow,
    tbodyRow3, th1, th2, th3, thHalf, td1, td2, tdHalf,
    backRules, platformDiff, letterSpacing, formulas, rules
  } = useDesignValues(Model, props);
  return (
<React.Fragment>

<section style={toStyle("display:flex;flex-direction:column;gap:56px;align-items:flex-start;padding:64px;width:max-content")}>
<div style={toStyle("display:flex;flex-direction:column;gap:10px;max-width:1060px;padding-bottom:8px")}>
<span style={toStyle("font-size:14px;line-height:19px;font-weight:700;color:#ff6f61")}>{"WeddingPick · Device"}</span>
<span style={toStyle("font-size:40px;line-height:52px;font-weight:700;color:#212124")}>{"기기별 하단 여백"}</span>
<span style={toStyle("font-size:18px;line-height:26px;color:#393a40;text-wrap:pretty")}>{"화면을 따로 그리지 않습니다. 같은 화면에 "}<b style={toStyle("color:#212124")}>{"하단 안전 여백만 기기별로 다르게"}</b>{" 넣습니다. 시안의 844px는 iPhone 노치 기준값이고, 실기기에서는 아래 규칙으로 계산합니다."}</span>
</div>
<div style={toStyle("display:flex;gap:32px;align-items:flex-start")}>
{Array.from((devices) ?? []).map((d, __index1) => (
<React.Fragment key={__index1}>

<div style={toStyle("display:flex;flex-direction:column;gap:12px;width:" + String(d.w ?? "") + "px")}>
<div style={toStyle(tag)}><span style={toStyle(d.badge)}>{d.os}</span>{d.name}</div>
<span style={toStyle(tagDesc)}>{d.desc}</span>
<div style={toStyle(d.frame)}>
<div style={toStyle(statusBar)}>
<span>{"9:41"}</span>
<span style={toStyle(barIcons)}>
<svg width={"17"} height={"11"} viewBox={"0 0 17 11"} fill={"#212124"}><rect x={"0"} y={"7"} width={"3"} height={"4"} rx={"1"}></rect><rect x={"4.5"} y={"5"} width={"3"} height={"6"} rx={"1"}></rect><rect x={"9"} y={"2.5"} width={"3"} height={"8.5"} rx={"1"}></rect><rect x={"13.5"} y={"0"} width={"3"} height={"11"} rx={"1"}></rect></svg>
<svg width={"25"} height={"12"} viewBox={"0 0 25 12"} fill={"none"}><rect x={"0.5"} y={"0.5"} width={"21"} height={"11"} rx={"3"} stroke={"#212124"} strokeOpacity={".35"}></rect><rect x={"2"} y={"2"} width={"17"} height={"8"} rx={"1.8"} fill={"#212124"}></rect></svg>
</span>
</div>
<div style={toStyle(header)}>
<span style={toStyle(wordmark)}>{"웨딩픽"}</span>
</div>
<div className={"nsb"} style={toStyle(scroll)}>
<div style={toStyle(heroPad)}>
<span style={toStyle(t16g)}>{"지수 · 준호"}</span>
<span style={toStyle(h26)}>{"두근두근"}<br />{"142일 남았어요"}</span>
</div>
<div style={toStyle(cardPad)}>
<div style={toStyle(recessed)}><span style={toStyle(t14w)}>{"오늘의 Pick"}</span><span style={toStyle(t18b)}>{"강남 A 스튜디오"}</span></div>
<div style={toStyle(recessed)}><span style={toStyle(t14w)}>{"다음 준비"}</span><span style={toStyle(t18b)}>{"드레스 · D-90"}</span></div>
</div>
</div>
<div style={toStyle(tabBar)}>
{Array.from((tabs) ?? []).map((t, __index2) => (
<React.Fragment key={__index2}>

<span style={toStyle(t.style)}>
<svg width={"24"} height={"24"} viewBox={"0 0 24 24"} fill={"none"} stroke={t.stroke} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={t.d1}></path><path d={t.d2}></path></svg>
<span>{t.label}</span>
</span>

</React.Fragment>
))}
</div>
{Boolean(d.safeH) ? <> 
<div style={toStyle(d.safeStyle)}>
{Boolean(d.handle) ? <> <span style={toStyle(handle)}></span> </> : null}
{Boolean(d.navButtons) ? <> 
<span style={toStyle(navBtns)}>
<svg width={"18"} height={"18"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#868b94"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M15 5l-7 7 7 7"}></path></svg>
<span style={toStyle(navHome)}></span>
<span style={toStyle(navRecent)}></span>
</span>
 </> : null}
{Boolean(d.gestureBar) ? <> <span style={toStyle(gestureBar)}></span> </> : null}
</div>
 </> : null}
</div>
<div style={toStyle(specBox)}>
{Array.from((d.specs) ?? []).map((s, __index3) => (
<React.Fragment key={__index3}>

<div style={toStyle(specRow)}>
<span style={toStyle(specK)}>{s.k}</span>
<span style={toStyle(s.vStyle)}>{s.v}</span>
</div>

</React.Fragment>
))}
</div>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:16px;max-width:1180px")}>
<span style={toStyle("font-size:26px;line-height:35px;font-weight:700;color:#212124")}>{"계산 규칙"}</span>
<div style={toStyle(codeCard)}>
<span style={toStyle(codeLabel)}>{"하단 고정 요소 높이"}</span>
<div style={toStyle(codeBlock)}>
{Array.from((formulas) ?? []).map((f, __index4) => (
<React.Fragment key={__index4}>

<div style={toStyle(codeRow)}>
<span style={toStyle(codeK)}>{f.k}</span>
<span style={toStyle(codeV)}>{f.v}</span>
</div>

</React.Fragment>
))}
</div>
<span style={toStyle(codeNote)}>{"safeBottom은 iOS에서 34px, 제스처 안드로이드에서 16~24px, 3버튼 안드로이드에서 0입니다. 3버튼은 시스템 바가 앱 영역 밖에 있어 inset이 0으로 옵니다."}</span>
</div>
<div style={toStyle("display:flex;gap:20px;flex-wrap:wrap")}>
{Array.from((rules) ?? []).map((r, __index5) => (
<React.Fragment key={__index5}>

<div style={toStyle(ruleCard)}>
<span style={toStyle(ruleTitle)}>{r.title}</span>
<span style={toStyle(ruleBody)}>{r.body}</span>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:16px;max-width:1180px")}>
<span style={toStyle("font-size:26px;line-height:35px;font-weight:700;color:#212124")}>{"뒤로가기 처리"}</span>
<span style={toStyle(sectionSub)}>{"안드로이드 물리 버튼과 제스처를 화면마다 처리합니다. 처리하지 않으면 시트만 닫혀야 할 때 화면 전체가 뒤로 갑니다."}</span>
<div style={toStyle(tableCard)}>
<div style={toStyle(theadRow)}>
<span style={toStyle(th1)}>{"상황"}</span>
<span style={toStyle(th2)}>{"뒤로가기를 누르면"}</span>
<span style={toStyle(th3)}>{"처리"}</span>
</div>
{Array.from((backRules) ?? []).map((b, __index6) => (
<React.Fragment key={__index6}>

<div style={toStyle(tbodyRow)}>
<span style={toStyle(td1)}>{b.when}</span>
<span style={toStyle(td2)}>{b.action}</span>
<span style={toStyle(b.tagStyle)}>{b.tag}</span>
</div>

</React.Fragment>
))}
</div>
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:16px;max-width:1180px")}>
<span style={toStyle("font-size:26px;line-height:35px;font-weight:700;color:#212124")}>{"플랫폼별로 갈리는 것"}</span>
<div style={toStyle(tableCard)}>
<div style={toStyle(theadRow3)}>
<span style={toStyle(th1)}>{"항목"}</span>
<span style={toStyle(thHalf)}>{"iOS"}</span>
<span style={toStyle(thHalf)}>{"Android"}</span>
</div>
{Array.from((platformDiff) ?? []).map((p, __index7) => (
<React.Fragment key={__index7}>

<div style={toStyle(tbodyRow3)}>
<span style={toStyle(td1)}>{p.k}</span>
<span style={toStyle(tdHalf)}>{p.ios}</span>
<span style={toStyle(p.andStyle)}>{p.and}</span>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle(codeCard)}>
<span style={toStyle(codeLabel)}>{"자간 · SEED 토큰"}</span>
<div style={toStyle(codeBlock)}>
{Array.from((letterSpacing) ?? []).map((l, __index8) => (
<React.Fragment key={__index8}>

<div style={toStyle(codeRow)}>
<span style={toStyle(codeK)}>{l.k}</span>
<span style={toStyle(codeV)}>{l.v}</span>
</div>

</React.Fragment>
))}
</div>
<span style={toStyle(codeNote)}>{"안드로이드에서 자간을 넣지 않으면 글자가 벌어져 2줄 제목이 3줄로 터집니다. 「이번 주엔 스튜디오를 정할 차례예요」가 대표적입니다."}</span>
</div>
</div>
</section>
</React.Fragment>
  );
}
