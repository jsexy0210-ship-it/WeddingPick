import React from 'react';
import Model from '../models/components.js';
import { useDesignValues, toStyle, ImageSlot, designHref } from '../runtime/designRuntime.js';

/** 원본 화면 구조와 상태를 보존한 React 디자인 보드. Source: 웨딩픽 컴포넌트 시트.dc.html */
export default function ComponentsBoard(props) {
  const {
    rootStyle, skins, fixed, type, grid, spacing, radii, tabs,
    terms, skeletonSpecs, imageSpecs, checks
  } = useDesignValues(Model, props);
  return (
<React.Fragment>

<section style={toStyle(rootStyle)}>
<div style={toStyle("display:flex;flex-direction:column;gap:10px;max-width:900px")}>
<span style={toStyle("font-size:14px;line-height:19px;font-weight:700;color:var(--wp-accent,#ff6f61)")}>{"WeddingPick Design System"}</span>
<span style={toStyle("font-size:40px;line-height:52px;letter-spacing:-1px;font-weight:700;color:#212124")}>{"컴포넌트 시트"}</span>
<span style={toStyle("font-size:18px;line-height:26px;color:#393a40;text-wrap:pretty")}>{"모든 화면은 이 문서의 토큰과 규격만 사용합니다. 여기에 없는 값을 새로 만들지 않습니다."}</span>
<span style={toStyle("font-size:16px;line-height:24px;color:#4d5159;text-wrap:pretty")}>{"기반은 SEED(당근)입니다. 색 · 타이포 · 라운드 · 굵기는 SEED 토큰을 그대로 따르고, Primary만 웨딩픽 코랄로 치환합니다. SEED는 웹폰트를 배포하지 않으므로 서체는 시스템 서체를 씁니다."}</span>
<div style={toStyle("margin-top:6px;padding:16px 18px;border-radius:10px;background:#f7f8fa;display:flex;flex-direction:column;gap:6px")}>
<span style={toStyle("font-size:14px;line-height:19px;font-weight:700;color:#4d5159")}>{"SEED에서 의도적으로 벗어난 항목 · 1건"}</span>
<span style={toStyle("font-size:16px;line-height:24px;color:#393a40;text-wrap:pretty")}>{"좌우 Gutter는 SEED 기본값 16이 아니라 "}<b style={toStyle("color:#212124")}>{"24"}</b>{"를 씁니다. 금액과 건수가 화면 절반을 차지해 숨 쉴 공간이 더 필요하다는 확정 정책을 따릅니다. 그 외 모든 값은 SEED를 따릅니다."}</span>
</div>
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:20px")}>
<div style={toStyle("display:flex;align-items:baseline;gap:12px")}>
<span style={toStyle("font-size:14px;line-height:19px;font-weight:700;color:#868b94;font-variant-numeric:tabular-nums")}>{"01"}</span>
<span style={toStyle("font-size:24px;line-height:32px;font-weight:700;color:#212124")}>{"컬러"}</span>
</div>
<div style={toStyle("display:flex;gap:20px;flex-wrap:wrap")}>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:18px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"스킨 컬러 6종"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94")}>{"사용자가 고릅니다. 기본값은 Coral이에요"}</span>
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:2px")}>
{Array.from((skins) ?? []).map((s, __index1) => (
<React.Fragment key={__index1}>

<div>
<div style={toStyle("display:flex;align-items:center;gap:14px;min-height:52px;padding:8px 0")}>
<span style={toStyle(s.chip)}></span>
<span style={toStyle("flex:1;min-width:0;font-size:16px;line-height:22px;font-weight:700;color:#212124")}>{s.name}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{s.hex}</span>
</div>
<div style={toStyle("height:1px;background:rgba(0,27,55,.06)")}></div>
</div>

</React.Fragment>
))}
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#4d5159;text-wrap:pretty")}>{"Dark Gray를 고르면 Pick 계열만 Coral을 유지합니다. Pick이 일반 UI와 같은 색이 되면 강조가 사라져요."}</span>
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:18px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"고정 컬러"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94")}>{"스킨을 바꿔도 변하지 않아요"}</span>
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:2px")}>
{Array.from((fixed) ?? []).map((f, __index2) => (
<React.Fragment key={__index2}>

<div>
<div style={toStyle("display:flex;align-items:center;gap:14px;min-height:48px;padding:6px 0")}>
<span style={toStyle(f.chip)}></span>
<span style={toStyle("flex:1;min-width:0;font-size:16px;line-height:22px;color:#393a40")}>{f.name}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{f.hex}</span>
</div>
<div style={toStyle("height:1px;background:rgba(0,27,55,.06)")}></div>
</div>

</React.Fragment>
))}
</div>
</div>
</div>
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:20px")}>
<div style={toStyle("display:flex;align-items:baseline;gap:12px")}>
<span style={toStyle("font-size:14px;line-height:19px;font-weight:700;color:#868b94;font-variant-numeric:tabular-nums")}>{"02"}</span>
<span style={toStyle("font-size:24px;line-height:32px;font-weight:700;color:#212124")}>{"타이포그래피"}</span>
</div>
<div style={toStyle("width:860px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:2px")}>
{Array.from((type) ?? []).map((t, __index3) => (
<React.Fragment key={__index3}>

<div>
<div style={toStyle("display:flex;align-items:center;gap:24px;padding:14px 0")}>
<span style={toStyle("width:132px;flex:0 0 132px;font-size:14px;line-height:19px;font-weight:700;color:#212124")}>{t.role}</span>
<span style={toStyle("flex:1;min-width:0;" + String(t.sample ?? ""))}>{t.text}</span>
<span style={toStyle("width:210px;flex:0 0 210px;text-align:right;font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{t.spec}</span>
</div>
<div style={toStyle("height:1px;background:rgba(0,27,55,.06)")}></div>
</div>

</React.Fragment>
))}
<span style={toStyle("padding-top:16px;font-size:14px;line-height:19px;color:#4d5159;text-wrap:pretty")}>{"SEED 타이포 역할 밖의 크기는 쓰지 않습니다. 15 · 17 · 19 · 22px 금지. 굵기는 regular와 bold 둘뿐이고 semibold는 없습니다. 자간은 iOS 기준 0이며 임의로 좁히지 않습니다."}</span>
</div>
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:20px")}>
<div style={toStyle("display:flex;align-items:baseline;gap:12px")}>
<span style={toStyle("font-size:14px;line-height:19px;font-weight:700;color:#868b94;font-variant-numeric:tabular-nums")}>{"03"}</span>
<span style={toStyle("font-size:24px;line-height:32px;font-weight:700;color:#212124")}>{"그리드 · 간격 · 모서리"}</span>
</div>
<div style={toStyle("display:flex;gap:20px;flex-wrap:wrap")}>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:2px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124;padding-bottom:12px")}>{"고정 수치"}</span>
{Array.from((grid) ?? []).map((g, __index4) => (
<React.Fragment key={__index4}>

<div>
<div style={toStyle("display:flex;align-items:center;gap:16px;min-height:48px;padding:6px 0")}>
<span style={toStyle("flex:1;min-width:0;font-size:16px;line-height:22px;color:#393a40")}>{g.name}</span>
<span style={toStyle("font-size:16px;line-height:22px;font-weight:700;color:#212124;font-variant-numeric:tabular-nums")}>{g.value}</span>
</div>
<div style={toStyle("height:1px;background:rgba(0,27,55,.06)")}></div>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:18px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"허용 간격 토큰"}</span>
<div style={toStyle("display:flex;flex-wrap:wrap;gap:8px")}>
{Array.from((spacing) ?? []).map((sp, __index5) => (
<React.Fragment key={__index5}>

<span style={toStyle("height:36px;display:flex;align-items:center;padding:0 14px;border-radius:999px;background:#f2f3f6;font-size:14px;font-weight:700;color:#393a40;font-variant-numeric:tabular-nums")}>{sp}</span>

</React.Fragment>
))}
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#4d5159;text-wrap:pretty")}>{"21 · 23 · 27px 같은 임의값을 만들지 않습니다. 필요하면 가장 가까운 토큰으로 내립니다."}</span>
<div style={toStyle("height:1px;background:rgba(0,27,55,.06)")}></div>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"모서리"}</span>
<div style={toStyle("display:flex;flex-wrap:wrap;gap:12px")}>
{Array.from((radii) ?? []).map((r, __index6) => (
<React.Fragment key={__index6}>

<div style={toStyle("display:flex;flex-direction:column;align-items:center;gap:8px")}>
<span style={toStyle(r.box)}></span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{r.label}</span>
</div>

</React.Fragment>
))}
</div>
</div>
</div>
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:20px")}>
<div style={toStyle("display:flex;align-items:baseline;gap:12px")}>
<span style={toStyle("font-size:14px;line-height:19px;font-weight:700;color:#868b94;font-variant-numeric:tabular-nums")}>{"04"}</span>
<span style={toStyle("font-size:24px;line-height:32px;font-weight:700;color:#212124")}>{"컴포넌트"}</span>
</div>
<div style={toStyle("display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start")}>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"Header"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"높이 56 · 좌 24 / 우 20 · 아이콘 24px, 터치 40 · 간격 2"}</span>
</div>
<div style={toStyle("width:342px;border:1px dashed rgba(0,27,55,.14);border-radius:6px;overflow:hidden")}>
<div style={toStyle("height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px 0 24px;background:#fff")}>
<span style={toStyle("font-size:20px;line-height:27px;font-weight:700;color:#212124")}>{"웨딩픽"}</span>
<span style={toStyle("display:flex;gap:2px")}>
<span style={toStyle("width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center")}><svg width={"24"} height={"24"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#393a40"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M11 4.2a6.9 6.9 0 1 0 0 13.8 6.9 6.9 0 0 0 0-13.8z"}></path><path d={"M16.2 16.2 20.8 20.8"}></path></svg></span>
<span style={toStyle("width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center")}><svg width={"24"} height={"24"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#393a40"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M18 9.4a6 6 0 1 0-12 0c0 4.8-2 5.8-2 5.8h16s-2-1-2-5.8"}></path><path d={"M13.7 19.4a2 2 0 0 1-3.4 0"}></path></svg></span>
</span>
</div>
<div style={toStyle("height:1px;background:rgba(0,27,55,.06)")}></div>
<div style={toStyle("height:56px;display:flex;align-items:center;gap:4px;padding:0 20px 0 12px;background:#fff")}>
<span style={toStyle("width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center")}><svg width={"24"} height={"24"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#212124"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M14.5 5 8 12l6.5 7"}></path></svg></span>
<span style={toStyle("flex:1;min-width:0;font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"강남 A 스튜디오"}</span>
<span style={toStyle("width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center")}><svg width={"24"} height={"24"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#393a40"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={"M15.5 6.8 8.5 10.4M8.5 13.6l7 3.6"}></path><path d={"M18.5 8.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM5.5 14.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM18.5 20.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z"}></path></svg></span>
</div>
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#4d5159;text-wrap:pretty")}>{"뒤로가기 화면도 같은 56px입니다. 제목은 Card Title 17/600, 로고는 Section 20/700."}</span>
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"Hero"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"패딩 12/24/26 · 요소 간격 14 · 높이 140~168"}</span>
</div>
<div style={toStyle("width:342px;border:1px dashed rgba(0,27,55,.14);border-radius:6px;padding:12px 24px 26px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px")}>
<div style={toStyle("display:flex;align-items:baseline;gap:8px")}>
<span style={toStyle("font-size:16px;line-height:22px;color:#4d5159")}>{"지수님 · 예식까지"}</span>
<span style={toStyle("font-size:16px;line-height:22px;font-weight:700;color:var(--wp-accent,#ff6f61);font-variant-numeric:tabular-nums")}>{"D-142"}</span>
</div>
<span style={toStyle("font-size:26px;line-height:35px;font-weight:700;color:#212124")}>{"이번 주엔 스튜디오를"}<br />{"정할 차례예요"}</span>
<div style={toStyle("display:flex;align-items:center;gap:10px")}>
<div style={toStyle("flex:1;height:6px;border-radius:999px;background:#eaebee;overflow:hidden")}><div style={toStyle("width:45%;height:100%;border-radius:999px;background:var(--wp-accent,#ff6f61)")}></div></div>
<span style={toStyle("font-size:14px;line-height:19px;font-weight:700;color:#868b94;font-variant-numeric:tabular-nums")}>{"9/20 완료"}</span>
</div>
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#4d5159;text-wrap:pretty")}>{"Title 최대 2줄, Sub 정확히 1줄. 한 화면에 Hero는 하나. 추천 이유는 Hero가 아니라 추천 영역에 씁니다."}</span>
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"Section Header"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"제목 title2 20/bold · 설명 subtitle2 14/gray-600 · 아래 간격 14 · 섹션 간 28"}</span>
</div>
<div style={toStyle("width:342px;border:1px dashed rgba(0,27,55,.14);border-radius:6px;padding:20px 24px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:20px;line-height:27px;font-weight:700;color:#212124")}>{"웨딩픽 TOP 3"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94")}>{"강남 스튜디오 · 최근 12개월"}</span>
</div>
<div style={toStyle("height:44px;border-radius:6px;background:#f2f3f6")}></div>
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#4d5159")}>{"설명 줄은 선택입니다. 넣으면 반드시 1줄."}</span>
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"Recommendation Card"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"306×auto · 이미지 228 · 본문 패딩 16/18/18 · Radius 10"}</span>
</div>
<div style={toStyle("width:306px;border:1px solid #dcdee3;border-radius:10px;overflow:hidden;display:flex;flex-direction:column")}>
<div style={toStyle("position:relative;width:100%;height:228px")}>
<ImageSlot id={"cs-rec"} src={"uploads/samples-1788175716407-57s9.jpg"} shape={"rect"} placeholder={""} />
<span style={toStyle("position:absolute;top:12px;left:12px;background:rgba(0,0,0,.5);color:#fff;font-size:13px;line-height:18px;font-weight:700;padding:5px 10px;border-radius:999px")}>{"1위"}</span>
</div>
<div style={toStyle("padding:16px 18px 18px;display:flex;flex-direction:column;gap:14px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:6px")}>
<span style={toStyle("font-size:14px;line-height:19px;font-weight:700;color:var(--wp-accent,#ff6f61)")}>{"고른 사진이랑 가장 비슷해요"}</span>
<span style={toStyle("font-size:24px;line-height:32px;font-weight:700;color:#212124")}>{"강남 A 스튜디오"}</span>
<span style={toStyle("font-size:16px;line-height:22px;color:#4d5159")}>{"원본 전체 · 보정 20장 · 5월 주말 가능"}</span>
</div>
<div style={toStyle("height:1px;background:#eaebee")}></div>
<div style={toStyle("display:flex;flex-direction:column;gap:3px")}>
<span style={toStyle("font-size:24px;line-height:32px;font-weight:700;color:#212124;font-variant-numeric:tabular-nums")}>{"152~184만원"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"실 제보 12건 · 최근 12개월"}</span>
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#393a40")}>{"이번 달 계약 시 앨범 업그레이드"}</span>
<div style={toStyle("display:flex;align-items:center;gap:10px")}>
<span style={toStyle("flex:1;height:56px;border-radius:6px;background:var(--wp-pick,#ff6f61);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700")}>{"Pick하기"}</span>
<span style={toStyle("height:56px;padding:0 16px;display:flex;align-items:center;color:#393a40;font-size:16px;font-weight:700")}>{"비교"}</span>
</div>
</div>
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#4d5159;text-wrap:pretty")}>{"순서 고정: 이미지 → 추천 이유 → 업체명 → 조건 → 실 제보 → 혜택 → Pick."}</span>
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"Vendor Card · Data Card"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"Row 최소 56 · 썸네일 52 / Radius 6 · Data Card 패딩 20 / Radius 10"}</span>
</div>
<div style={toStyle("width:342px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:2px")}>
<div style={toStyle("display:flex;align-items:center;gap:12px;min-height:56px;padding:12px 0")}>
<div style={toStyle("width:52px;height:52px;flex:0 0 52px;position:relative")}><ImageSlot id={"cs-v1"} src={"uploads/samples-1788175716419-flvg.jpg"} shape={"rounded"} radius={"6"} placeholder={""} /></div>
<div style={toStyle("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
<span style={toStyle("display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"강남 A 웨딩홀 프리미엄관"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"실 제보 21건 · 웨딩홀"}</span>
</div>
<span style={toStyle("font-size:16px;line-height:22px;font-weight:700;color:#212124;font-variant-numeric:tabular-nums;white-space:nowrap")}>{"1,480~1,820만원"}</span>
</div>
<div style={toStyle("height:1px;background:#eaebee")}></div>
<div style={toStyle("display:flex;align-items:center;gap:12px;min-height:56px;padding:12px 0")}>
<div style={toStyle("width:52px;height:52px;flex:0 0 52px;border-radius:6px;background:#f2f3f6")}></div>
<div style={toStyle("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"청담 D 스튜디오"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94")}>{"아직 정보가 적어요 · 3건"}</span>
</div>
<span style={toStyle("font-size:16px;line-height:22px;font-weight:700;color:#868b94;white-space:nowrap")}>{"수집 중"}</span>
</div>
</div>
<div style={toStyle("border-radius:10px;background:#f7f8fa;padding:20px;display:flex;flex-direction:column;gap:12px")}>
<span style={toStyle("font-size:26px;line-height:35px;font-weight:700;color:#212124;font-variant-numeric:tabular-nums")}>{"152~184만원"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"실 제보 12건 · 최근 12개월 · 기준금액 168만원"}</span>
</div>
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#4d5159;text-wrap:pretty")}>{"긴 업체명은 한 줄로 자릅니다. 이미지가 없으면 카테고리 기본 이미지로 대체합니다."}</span>
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"Feed Card"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"2열 · 간격 11 · 이미지 16:11 · Radius 6"}</span>
</div>
<div style={toStyle("width:342px;display:grid;grid-template-columns:1fr 1fr;gap:11px;align-items:stretch")}>
<div style={toStyle("display:flex;flex-direction:column;gap:10px;min-width:0")}>
<div style={toStyle("position:relative;width:100%;aspect-ratio:16/11;border-radius:6px;overflow:hidden")}><ImageSlot id={"cs-f1"} src={"uploads/samples-1788175716375-3z0c.jpg"} shape={"rect"} placeholder={""} /></div>
<div style={toStyle("height:92px;display:flex;flex-direction:column;gap:2px;min-width:0")}>
<span style={toStyle("display:block;height:26px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"강남 A 드레스"}</span>
<span style={toStyle("display:block;height:22px;font-size:16px;line-height:22px;font-weight:700;color:#212124;font-variant-numeric:tabular-nums")}>{"88~124만원"}</span>
<span style={toStyle("display:block;height:19px;font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"실 제보 14건"}</span>
<span style={toStyle("display:block;height:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:19px;color:#868b94")}>{"드레스 투어 일정이 남아 있어요"}</span>
</div>
<span style={toStyle("margin-top:auto;height:40px;border:1px solid #dcdee3;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#212124")}>{"Pick하기"}</span>
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:10px;min-width:0")}>
<div style={toStyle("width:100%;aspect-ratio:16/11;border-radius:6px;background:#f2f3f6;display:flex;align-items:center;justify-content:center")}>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94")}>{"사진 준비 중"}</span>
</div>
<div style={toStyle("height:92px;display:flex;flex-direction:column;gap:2px;min-width:0")}>
<span style={toStyle("display:block;height:26px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"청담 D 스튜디오"}</span>
<span style={toStyle("display:block;height:22px;font-size:16px;line-height:22px;font-weight:700;color:#868b94")}>{"수집 중"}</span>
<span style={toStyle("display:block;height:19px;font-size:14px;line-height:19px;color:#868b94")}>{"아직 정보가 적어요 · 3건"}</span>
<span style={toStyle("display:block;height:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:19px;color:#868b94")}>{"5월 주말이 남아 있어요"}</span>
</div>
<span style={toStyle("margin-top:auto;height:40px;border:1px solid #dcdee3;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#212124")}>{"Pick하기"}</span>
</div>
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#4d5159;text-wrap:pretty")}>{"같은 행은 이미지 비율 16:11, 텍스트 영역 92px 고정, CTA 하단선 일치. 업체명·금액·건수·이유는 각각 1줄이고 넘치면 말줄임합니다."}</span>
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"Button"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"Primary 52(xlarge) · Secondary 48(large) · Small 40(medium) · Radius 6"}</span>
</div>
<div style={toStyle("width:342px;display:flex;flex-direction:column;gap:10px")}>
<span style={toStyle("height:56px;border-radius:6px;background:var(--wp-pick,#ff6f61);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700")}>{"Pick하기 · Primary"}</span>
<span style={toStyle("height:56px;border-radius:6px;border:1.5px solid var(--wp-pick,#ff6f61);background:color-mix(in oklab,var(--wp-pick,#ff6f61) 7%,#fff);color:var(--wp-pick,#ff6f61);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700")}>{"Pick 완료 · Selected"}</span>
<span style={toStyle("height:48px;border-radius:6px;border:1px solid #dcdee3;background:#fff;color:#212124;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700")}>{"결제내역 등록하기 · Secondary"}</span>
<span style={toStyle("height:40px;border-radius:6px;border:1px solid #dcdee3;background:#fff;color:#212124;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700")}>{"후보에 담기 · Small"}</span>
<span style={toStyle("height:56px;border-radius:6px;background:var(--wp-pick,#ff6f61);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;opacity:.4")}>{"Pick하기 · Disabled"}</span>
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#4d5159;text-wrap:pretty")}>{"화면당 Primary는 1개. 누르면 scale 0.98, 색은 바꾸지 않습니다. Disabled는 회색으로 칠하지 않고 투명도 0.4."}</span>
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"Chip · Badge"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"Chip 36 / Radius 999 · Badge 13/700 · 순위 배지 12/700"}</span>
</div>
<div style={toStyle("width:342px;display:flex;flex-direction:column;gap:14px")}>
<div style={toStyle("display:flex;flex-wrap:wrap;gap:8px")}>
<span style={toStyle("height:36px;display:flex;align-items:center;padding:0 14px;border-radius:999px;background:var(--wp-accent,#ff6f61);color:#fff;font-size:14px;font-weight:700")}>{"강남"}</span>
<span style={toStyle("height:36px;display:flex;align-items:center;padding:0 14px;border-radius:999px;background:#f2f3f6;color:#393a40;font-size:14px;font-weight:700")}>{"서초"}</span>
<span style={toStyle("height:36px;display:flex;align-items:center;padding:0 14px;border-radius:999px;background:#f2f3f6;color:#393a40;font-size:14px;font-weight:700")}>{"5월 예식"}</span>
<span style={toStyle("height:36px;display:flex;align-items:center;padding:0 14px;border-radius:999px;background:#f2f3f6;color:#868b94;font-size:14px;font-weight:700;opacity:.5")}>{"마감"}</span>
</div>
<div style={toStyle("display:flex;flex-wrap:wrap;gap:8px;align-items:center")}>
<span style={toStyle("padding:5px 10px;border-radius:999px;background:rgba(0,0,0,.5);color:#fff;font-size:13px;line-height:18px;font-weight:700")}>{"1위"}</span>
<span style={toStyle("padding:4px 9px;border-radius:6px;background:color-mix(in oklab,var(--wp-pick,#ff6f61) 12%,#fff);color:var(--wp-pick,#ff6f61);font-size:14px;line-height:19px;font-weight:700")}>{"Pick 완료"}</span>
<span style={toStyle("padding:4px 9px;border-radius:6px;background:#e8faf6;color:#1aa174;font-size:14px;line-height:19px;font-weight:700")}>{"인증완료"}</span>
<span style={toStyle("padding:4px 9px;border-radius:6px;background:#fff5e0;color:#b57a00;font-size:14px;line-height:19px;font-weight:700")}>{"확인필요"}</span>
<span style={toStyle("padding:4px 9px;border-radius:6px;background:#ffeceb;color:#e03131;font-size:14px;line-height:19px;font-weight:700")}>{"반려"}</span>
</div>
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#4d5159")}>{"상태 배지 색은 스킨과 무관하게 고정입니다."}</span>
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"Bottom Sheet"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"상단 Radius 24 · 패딩 24 · 핸들 40×4 · 350ms"}</span>
</div>
<div style={toStyle("width:342px;border-radius:6px;overflow:hidden;background:rgba(0,0,0,.45);padding-top:56px")}>
<div style={toStyle("background:#fff;border-radius:20px 20px 0 0;padding:12px 24px 24px;display:flex;flex-direction:column;gap:20px")}>
<span style={toStyle("width:40px;height:4px;border-radius:999px;background:#eaebee;align-self:center")}></span>
<div style={toStyle("display:flex;flex-direction:column;gap:6px")}>
<span style={toStyle("font-size:24px;line-height:32px;font-weight:700;color:#212124")}>{"강남 A 스튜디오를 Pick할까요?"}</span>
<span style={toStyle("font-size:16px;line-height:22px;color:#4d5159")}>{"언제든 바꿀 수 있어요"}</span>
</div>
<div style={toStyle("display:flex;gap:10px")}>
<span style={toStyle("flex:1;height:56px;border-radius:6px;background:#f2f3f6;color:#393a40;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700")}>{"다시 볼게요"}</span>
<span style={toStyle("flex:1.4;height:56px;border-radius:6px;background:var(--wp-pick,#ff6f61);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700")}>{"Pick하기"}</span>
</div>
</div>
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#4d5159")}>{"로그인도 화면 전환 대신 이 시트로 처리합니다."}</span>
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"Tab Bar"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"72 + Safe Area · 아이콘 24 / stroke 1.8 · 터치 52"}</span>
</div>
<div style={toStyle("width:342px;border:1px dashed rgba(0,27,55,.14);border-radius:6px;overflow:hidden")}>
<div style={toStyle("height:72px;display:flex;align-items:flex-start;background:#fff;border-top:1px solid #dcdee3;padding-top:9px")}>
{Array.from((tabs) ?? []).map((t, __index7) => (
<React.Fragment key={__index7}>

<span style={toStyle(t.style)}>
<span style={toStyle(t.iconWrap)}>
<svg width={"24"} height={"24"} viewBox={"0 0 24 24"} fill={"none"} stroke={t.stroke} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"}><path d={t.d1}></path><path d={t.d2}></path><path d={t.d3}></path></svg>
<span style={toStyle(t.badge)}></span>
</span>
<span>{t.label}</span>
</span>

</React.Fragment>
))}
</div>
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#4d5159;text-wrap:pretty")}>{"활성 #212124 / 비활성 #8B95A1. Pick 아이콘은 후보 카드 위 체크 형태이고, Pick한 항목이 있으면 스킨색 점이 붙습니다. 혜택·제보는 Root Tab이 아닙니다."}</span>
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"Empty State"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"패딩 28/20 · 문구 15 · 행동 버튼 48 · 삽화 없음"}</span>
</div>
<div style={toStyle("width:342px;display:flex;flex-direction:column;gap:12px")}>
<div style={toStyle("border-radius:10px;background:#f7f8fa;padding:28px 20px;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center")}>
<span style={toStyle("font-size:16px;line-height:24px;color:#4d5159")}>{"아직 등록한 결제내역이 없어요"}<br />{"영수증 한 장이면 자동으로 정리해드려요"}</span>
<span style={toStyle("height:48px;padding:0 22px;border:1px solid #dcdee3;border-radius:6px;background:#fff;color:#212124;display:flex;align-items:center;font-size:16px;font-weight:700")}>{"결제내역 등록하기"}</span>
</div>
<div style={toStyle("border-radius:10px;background:#f7f8fa;padding:20px;display:flex;flex-direction:column;gap:6px")}>
<span style={toStyle("font-size:16px;line-height:24px;font-weight:700;color:#212124")}>{"지금은 받을 수 있는 혜택이 없어요"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94")}>{"새 혜택이 열리면 알려드릴게요"}</span>
</div>
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#4d5159")}>{"빈 상태에도 다음 행동이 하나 있어야 합니다."}</span>
</div>
</div>
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:20px")}>
<div style={toStyle("display:flex;align-items:baseline;gap:12px")}>
<span style={toStyle("font-size:14px;line-height:19px;font-weight:700;color:#868b94;font-variant-numeric:tabular-nums")}>{"05"}</span>
<span style={toStyle("font-size:24px;line-height:32px;font-weight:700;color:#212124")}>{"사용자 노출 용어"}</span>
</div>
<div style={toStyle("display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start")}>
<div style={toStyle("width:860px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:2px")}>
<div style={toStyle("display:flex;align-items:center;gap:24px;padding-bottom:12px")}>
<span style={toStyle("width:180px;flex:0 0 180px;font-size:14px;line-height:19px;font-weight:700;color:#868b94")}>{"개념"}</span>
<span style={toStyle("flex:1;min-width:0;font-size:14px;line-height:19px;font-weight:700;color:#868b94")}>{"최종 표기"}</span>
<span style={toStyle("width:280px;flex:0 0 280px;font-size:14px;line-height:19px;font-weight:700;color:#868b94")}>{"사용하지 않음"}</span>
</div>
{Array.from((terms) ?? []).map((w, __index8) => (
<React.Fragment key={__index8}>

<div>
<div style={toStyle("height:1px;background:rgba(0,27,55,.06)")}></div>
<div style={toStyle("display:flex;align-items:center;gap:24px;min-height:52px;padding:8px 0")}>
<span style={toStyle("width:180px;flex:0 0 180px;font-size:16px;line-height:22px;color:#4d5159")}>{w.concept}</span>
<span style={toStyle("flex:1;min-width:0;font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{w.use}</span>
<span style={toStyle("width:280px;flex:0 0 280px;font-size:16px;line-height:22px;color:#868b94;text-decoration:line-through")}>{w.avoid}</span>
</div>
</div>

</React.Fragment>
))}
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"Skeleton 규격"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94")}>{"뼈대 크기는 실제 컴포넌트와 같은 값을 씁니다"}</span>
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:2px")}>
{Array.from((skeletonSpecs) ?? []).map((s, __index9) => (
<React.Fragment key={__index9}>

<div>
<div style={toStyle("display:flex;align-items:center;gap:12px;min-height:52px;padding:10px 0")}>
<span style={toStyle("width:88px;flex:0 0 88px;font-size:14px;line-height:19px;font-weight:700;color:#4d5159")}>{s.where}</span>
<span style={toStyle("flex:1;min-width:0;font-size:14px;line-height:20px;color:#868b94;text-wrap:pretty")}>{s.what}</span>
<span style={toStyle("font-size:14px;line-height:19px;font-weight:700;color:#212124;font-variant-numeric:tabular-nums;white-space:nowrap")}>{s.n}</span>
</div>
<div style={toStyle("height:1px;background:#eaebee")}></div>
</div>

</React.Fragment>
))}
</div>
<span style={toStyle("font-size:14px;line-height:21px;color:#4d5159;text-wrap:pretty")}>{"이미지 자리는 비율을 먼저 잡아두고 사진을 채웁니다. 로딩 뒤 카드 높이가 바뀌지 않아야 합니다. 뼈대는 목록당 3개까지만 그리고 그 아래는 비워둡니다. 스피너는 사용자를 기다리게 하는 처리에만 쓰고 목록 로딩에는 쓰지 않습니다. 1초 안에 끝나는 로딩에는 뼈대를 띄우지 않습니다."}</span>
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"이미지 규격"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94")}>{"실제 사진 교체 시 이 값만 지키면 레이아웃이 흔들리지 않아요"}</span>
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:2px")}>
{Array.from((imageSpecs) ?? []).map((i, __index10) => (
<React.Fragment key={__index10}>

<div>
<div style={toStyle("display:flex;align-items:center;gap:12px;min-height:52px;padding:10px 0")}>
<span style={toStyle("flex:1;min-width:0;font-size:16px;line-height:22px;color:#4d5159")}>{i.where}</span>
<span style={toStyle("font-size:16px;line-height:22px;font-weight:700;color:#212124;font-variant-numeric:tabular-nums;white-space:nowrap")}>{i.spec}</span>
</div>
<div style={toStyle("height:1px;background:#eaebee")}></div>
</div>

</React.Fragment>
))}
</div>
<span style={toStyle("font-size:14px;line-height:21px;color:#4d5159;text-wrap:pretty")}>{"crop은 중앙 기준 cover. 인물 얼굴이 잘리는 사진은 업체 제공이어도 쓰지 않고 다음 순위 이미지로 넘어갑니다. 사진 위에 글자를 얹는 곳은 히어로와 취향 카드 두 곳뿐이고, 두 곳 모두 하단 어둠 그라데이션을 깔아 대비 4.5:1을 확보합니다."}</span>
</div>
<div style={toStyle("width:420px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px")}>
<div style={toStyle("display:flex;flex-direction:column;gap:4px")}>
<span style={toStyle("font-size:18px;line-height:24px;font-weight:700;color:#212124")}>{"실 제보 표기 포맷"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94")}>{"검색 · 업체상세 · 비교 · 홈 동일"}</span>
</div>
<div style={toStyle("width:342px;border-radius:10px;background:#f7f8fa;padding:20px;display:flex;flex-direction:column;gap:6px")}>
<span style={toStyle("font-size:24px;line-height:32px;font-weight:700;color:#212124;font-variant-numeric:tabular-nums")}>{"152~184만원"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94;font-variant-numeric:tabular-nums")}>{"실 제보 12건 · 최근 12개월 · 기준금액 168만원"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94")}>{"기준금액은 실 제보의 중앙값이에요"}</span>
</div>
<div style={toStyle("width:342px;border-radius:10px;background:#f7f8fa;padding:20px;display:flex;flex-direction:column;gap:6px")}>
<span style={toStyle("font-size:24px;line-height:32px;font-weight:700;color:#868b94")}>{"수집 중"}</span>
<span style={toStyle("font-size:14px;line-height:19px;color:#868b94")}>{"실 제보 2건 · 아직 정보가 적어요"}</span>
</div>
<span style={toStyle("font-size:14px;line-height:19px;color:#4d5159;text-wrap:pretty")}>{"0~2건 수집 중 · 3~4건 구간 + 정보 부족 안내 · 5~9건 일반 구간 · 10건 이상 기준금액까지."}</span>
</div>
</div>
</div>
<div style={toStyle("display:flex;flex-direction:column;gap:20px")}>
<div style={toStyle("display:flex;align-items:baseline;gap:12px")}>
<span style={toStyle("font-size:14px;line-height:19px;font-weight:700;color:#868b94;font-variant-numeric:tabular-nums")}>{"06"}</span>
<span style={toStyle("font-size:24px;line-height:32px;font-weight:700;color:#212124")}>{"검수 체크리스트"}</span>
</div>
<div style={toStyle("width:860px;background:#fff;border:1px solid #eaebee;border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:20px")}>
<span style={toStyle("font-size:24px;line-height:32px;font-weight:700;color:#212124;text-wrap:pretty")}>{"이 화면만 봐도 웨딩픽이 먼저 골라주고, 사용자는 비교해서 Pick하는 서비스라는 것이 이해되는가?"}</span>
<div style={toStyle("height:1px;background:rgba(0,27,55,.06)")}></div>
<div style={toStyle("display:grid;grid-template-columns:1fr 1fr;gap:10px 32px")}>
{Array.from((checks) ?? []).map((c, __index11) => (
<React.Fragment key={__index11}>

<div style={toStyle("display:flex;align-items:flex-start;gap:10px;padding:4px 0")}>
<span style={toStyle("width:18px;height:18px;flex:0 0 18px;margin-top:2px;border-radius:5px;border:1.5px solid #dcdee3")}></span>
<span style={toStyle("font-size:16px;line-height:22px;color:#393a40")}>{c}</span>
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
