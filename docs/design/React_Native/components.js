import { DesignModel } from "../runtime/designRuntime.js";

class Component extends DesignModel {
  static ICONS = {
    home: ['M3.6 10.4 12 3.8l8.4 6.6V19a1.6 1.6 0 0 1-1.6 1.6H5.2A1.6 1.6 0 0 1 3.6 19z', 'M9.6 20.6v-6.2h4.8v6.2', ''],
    search: ['M11 4.2a6.9 6.9 0 1 0 0 13.8 6.9 6.9 0 0 0 0-13.8z', 'M16.2 16.2 20.8 20.8', ''],
    pick: ['M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z', 'M9.4 11.9l1.7 1.7 3.4-3.4', ''],
    couple: ['M5.2 5.6h13.6a1.8 1.8 0 0 1 1.8 1.8v11.2a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8V7.4a1.8 1.8 0 0 1 1.8-1.8z', 'M3.4 10.4h17.2M8.4 3.4v4M15.6 3.4v4', ''],
    my: ['M12 11.6a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.8 20.6v-.6a6 6 0 0 1 6-6h2.4a6 6 0 0 1 6 6v.6', '']
  };

  tab(label, icon, active) {
    const c = active ? '#212124' : '#868b94';
    const d = Component.ICONS[icon];
    return {
      label, d1: d[0], d2: d[1], d3: d[2], stroke: c,
      style: 'flex:1;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:12px;line-height:16px;font-weight:' + (active ? 700 : 600) + ';color:' + c,
      iconWrap: 'width:24px;height:24px;display:flex;align-items:center;justify-content:center;position:relative',
      badge: icon === 'pick'
        ? 'position:absolute;top:-1px;right:-1px;width:7px;height:7px;border-radius:999px;background:var(--wp-pick,#ff6f61);border:1.5px solid #fff'
        : 'display:none'
    };
  }

  renderVals() {
    const skin = this.props.accent ?? '#FF6F61';
    const pickHex = String(skin).toLowerCase() === '#212124' ? '#FF6F61' : skin;
    const sw = hex => 'width:36px;height:36px;flex:0 0 36px;border-radius:10px;background:' + hex + ';box-shadow:inset 0 0 0 1px #eaebee';
    const t = (size, lh, weight) => 'font-size:' + size + 'px;line-height:' + lh + ';font-weight:' + weight + ';color:#212124;font-variant-numeric:tabular-nums';
    return {
      rootStyle: 'display:flex;flex-direction:column;gap:56px;padding:64px;width:1868px;box-sizing:border-box;--wp-accent:' + skin + ';--wp-pick:' + pickHex,
      skins: [
        { name: 'Coral · 기본 Primary', hex: '#FF6F61', chip: sw('#FF6F61') },
        { name: 'Red', hex: '#FF4D4D', chip: sw('#FF4D4D') },
        { name: 'Yellow', hex: '#FFC041', chip: sw('#FFC041') },
        { name: 'Green', hex: '#34C759', chip: sw('#34C759') },
        { name: 'Blue', hex: '#3182F6', chip: sw('#3182F6') },
        { name: 'Dark Gray', hex: '#212124', chip: sw('#212124') }
      ],
      fixed: [
        { name: '본문 텍스트 · gray-900', hex: '#212124', chip: sw('#212124') },
        { name: '강한 보조 · gray-800', hex: '#393A40', chip: sw('#393A40') },
        { name: '보조 텍스트 · gray-700', hex: '#4D5159', chip: sw('#4D5159') },
        { name: '비활성 · 캡션 · gray-600', hex: '#868B94', chip: sw('#868B94') },
        { name: '아이콘 보조 · gray-500', hex: '#ADB1BA', chip: sw('#ADB1BA') },
        { name: '테두리 · gray-300', hex: '#DCDEE3', chip: sw('#DCDEE3') },
        { name: '구분선 · gray-200', hex: '#EAEBEE', chip: sw('#EAEBEE') },
        { name: '섹션 밴드 · gray-100', hex: '#F2F3F6', chip: sw('#F2F3F6') },
        { name: '약한 배경 · gray-50', hex: '#F7F8FA', chip: sw('#F7F8FA') },
        { name: '배경 · gray-00', hex: '#FFFFFF', chip: sw('#FFFFFF') },
        { name: '성공 · 인증완료', hex: '#1AA174', chip: sw('#1AA174') },
        { name: '경고 · 확인필요', hex: '#FFC041', chip: sw('#FFC041') },
        { name: '오류 · 반려', hex: '#FF4D4D', chip: sw('#FF4D4D') }
      ],
      type: [
        { role: 'Display · h3', text: '2,140만원', spec: 'SEED h3 · 32 / 135% · bold', sample: t(32, '135%', 700) },
        { role: 'Hero Title · h4', text: '스튜디오를 정할 차례예요', spec: 'SEED h4 · 26 / 135% · bold · 2줄', sample: t(26, '135%', 700) },
        { role: 'Amount · title1', text: '152~184만원', spec: 'SEED title1 · 24 / 135% · bold', sample: t(24, '135%', 700) },
        { role: 'Section Title · title2', text: '웨딩픽 TOP 3', spec: 'SEED title2 · 20 / 135% · bold', sample: t(20, '135%', 700) },
        { role: 'Card Title · title3', text: '강남 A 스튜디오', spec: 'SEED title3 · 18 / 135% · bold', sample: t(18, '135%', 700) },
        { role: 'Body · subtitle1', text: '원본 전체 · 보정 20장', spec: 'SEED subtitle1 · 16 / 135% · regular · bold', sample: t(16, '135%', 400) },
        { role: 'Long Body · body-l1', text: '두 분 조건에 맞는 스튜디오를 모아봤어요', spec: 'SEED body-l1 · 16 / 150% · regular', sample: t(16, '150%', 400) },
        { role: 'Data · subtitle2', text: '실 제보 12건 · 최근 12개월', spec: 'SEED subtitle2 · 14 / 135% · regular · bold', sample: t(14, '135%', 400) },
        { role: 'Caption · caption1', text: '2026년 8월 28일 확인', spec: 'SEED caption1 · 13 / 150% · regular', sample: t(13, '150%', 400) },
        { role: 'Tab Label · caption2', text: '웨딩일정', spec: 'SEED caption2 · 12 / 135% · bold', sample: t(12, '135%', 700) }
      ],
      grid: [
        { name: '좌우 Gutter · SEED 기본 16에서 상향', value: '24' },
        { name: '섹션 간 간격', value: '28' },
        { name: '섹션 밴드 높이', value: '16' },
        { name: '섹션 제목 → 콘텐츠', value: '14' },
        { name: '카드 내부 패딩', value: '20' },
        { name: '리스트 Row 최소 높이', value: '56' },
        { name: 'Primary CTA 높이', value: '56' },
        { name: 'Header 높이', value: '56' },
        { name: 'Tab Bar 높이', value: '72' },
        { name: '2열 카드 Gap', value: '11' },
        { name: '2열 카드 이미지 비율', value: '16:11' },
        { name: '2열 카드 텍스트 영역', value: '92' }
      ],
      spacing: ['2', '4', '6', '8', '10', '12', '14', '16', '20', '24', '28'],
      radii: [
        { label: '4 체크·배지', box: 'width:56px;height:56px;border-radius:4px;background:#f2f3f6' },
        { label: '6 버튼·입력·썸네일', box: 'width:56px;height:56px;border-radius:6px;background:#f2f3f6' },
        { label: '10 카드·이미지', box: 'width:56px;height:56px;border-radius:10px;background:#f2f3f6' },
        { label: '16 다이얼로그', box: 'width:56px;height:56px;border-radius:10px;background:#f2f3f6' },
        { label: '20 시트 상단', box: 'width:56px;height:56px;border-radius:20px;background:#f2f3f6' },
        { label: 'full 칩·아바타', box: 'width:56px;height:56px;border-radius:999px;background:#f2f3f6' }
      ],
      tabs: [
        this.tab('홈', 'home', true),
        this.tab('검색', 'search', false),
        this.tab('Pick', 'pick', false),
        this.tab('웨딩일정', 'couple', false),
        this.tab('MY', 'my', false)
      ],
      terms: [
        { concept: '업체 찾기', use: '검색', avoid: '탐색, 둘러보기' },
        { concept: '후보 선택', use: 'Pick', avoid: '찜, 선택, 좋아요' },
        { concept: '저장된 후보', use: 'Pick한 곳', avoid: '찜한 곳, 관심목록' },
        { concept: '실 제보 건수', use: '실 제보 12건', avoid: '결제인증 12건, 데이터 12건' },
        { concept: '검증된 정보 전체', use: '실 제보', avoid: '실 제보, 가격 데이터' },
        { concept: '가격 범위', use: '제보 금액 152~184만원', avoid: '평균 가격, 진짜 가격' },
        { concept: '중앙값', use: '기준금액 168만원', avoid: '중앙값, 평균가, 대표가격' },
        { concept: '집계 기간', use: '최근 12개월', avoid: '최근 1년치' },
        { concept: '추가비용', use: '별도로 확인할 비용', avoid: '숨은 비용' },
        { concept: '업체 제공 내용', use: '업체 안내', avoid: '업체 주장' },
        { concept: '정보 체계 · 상위 개념', use: '실 제보', avoid: '확인된 제보, 확인된 정보, 가격 데이터, 표본' },
        { concept: '정보 체계 · 금액', use: '제보 금액', avoid: '실제로 낸 금액, 제보 금액, 실 제보' },
        { concept: '정보 체계 · 제공 행동', use: 'Pick 인증', avoid: '결제인증, 자료 제출' },
        { concept: '많이 확인된 업체', use: '많이 확인된 곳', avoid: '데이터가 많은 곳' },
        { concept: '사용자 평가영역', use: '이용한 사람들의 경험', avoid: '평점, 별점' },
        { concept: '사용자 글', use: '후기', avoid: '리뷰' },
        { concept: '자료 제출', use: '제보', avoid: '등록, 제출' },
        { concept: '금액 인증', use: 'Pick 인증', avoid: '결제인증, 결제 확인' },
        { concept: '금액 · 날짜 라벨', use: '낸 금액 · 낸 날짜 · 상태', avoid: '결제금액, 결제일, 결제상태' },
        { concept: '분할 묶기', use: '같이 묶을까요? · 등록한 내역', avoid: '같은 거래, 거래 내역, 트랜잭션' },
        { concept: '추천 이유 문장', use: '고른 사진이랑 가장 비슷해요 · 원하는 날에 가능해요 · 생각한 예산 안에 들어와요 · 둘 다 고른 곳이에요 · 원본을 전부 받을 수 있어요 · 제보 금액은 여기부터 시작해요 · 찾던 조건이 가장 많이 맞아요', avoid: '가장 유사한 스타일이에요, 예산 범위 내에 포함되는, 조건을 가장 많이 충족해요, 취향이 가장 많이 일치해요' },
        { concept: '금액 자료 제출', use: 'Pick 인증', avoid: '결제내역 제보, 결제인증 등록' },
        { concept: '내가 제출한 것', use: '내 제보 내역', avoid: '내가 등록한 내역' },
        { concept: '직접 가격 제공', use: '가격 제보', avoid: '가격 직접입력' },
        { concept: '커플 공간', use: '웨딩일정', avoid: '커플공간' },
        { concept: '파트너', use: '배우자', avoid: '파트너, 동반자' },
        { concept: '프로모션', use: '현재 혜택·이벤트', avoid: '딜, 특가존' },
        { concept: '선택 주체', use: '직접 고르는 · 내 기준으로 골라요', avoid: '웨딩픽이 골랐어요, 웨딩픽이 골라드려요, 웨딩픽 TOP3, AI 추천' },
        { concept: '금액 근거', use: '실 제보 N건 · 조건별 분포', avoid: 'AI 분석 결과, 추천 이유' },
        { concept: '자체 콘텐츠', use: '웨딩픽 콘텐츠', avoid: 'AI 웨딩 콘텐츠, AI가 작성한 글' },
        { concept: '정보 부족', use: '아직 정보가 적어요', avoid: '표본 부족, 데이터 부족' },
        { concept: '불확실한 상태', use: '확정 · 미확정 · 검증 전 · 확인 필요 · 조건부 · 측정값 · 추정값', avoid: '거의, 아마, 대략, 어느 정도, 가능성이 높음, ~일 것으로 보임, 근거 없는 약·정도' },
        { concept: '로그인 방법', use: '소셜 로그인 4종 · 카카오 · 네이버 · 구글 · 애플', avoid: '이메일 로그인, 비밀번호, 비회원, 게스트, 둘러보기' },
        { concept: '회원 구분', use: '회원 · Pick 인증 회원', avoid: '비회원, 게스트, 일반회원' },
        { concept: '신뢰 상태', use: '결제 확인', avoid: '회원등급' }
      ],
      skeletonSpecs: [
        { where: '홈', what: 'Hero 2줄 · 현황판 4칸 · 웨딩픽 추천 이미지 16:9 + 3줄 · 콘텐츠 1:1 2장', n: '4블록' },
        { where: '검색', what: '결과 카드 2:1 + 제목 · 금액 · 건수 3줄', n: '3장' },
        { where: '업체 상세', what: '히어로 3:2 · 업체명 2줄 · 실 제보 박스 · 후기 2건', n: '4블록' },
        { where: 'Pick', what: '카테고리 행 4개 · 후보 카드 107×96 + 2줄', n: '4행' },
        { where: '웨딩일정', what: '일정 2건 · 지출 금액 1줄 + 막대 · 준비현황 4행', n: '3블록' },
        { where: 'MY', what: '프로필 56 원형 + 2줄 · 목록 3행', n: '2블록' },
        { where: '이미지 자리', what: '비율만 먼저 잡고 회색 채움 · 로딩 후 높이 변화 없음', n: '전 화면' },
        { where: '움직임', what: '1.4초 밝기 왕복 · 좌우 흐름 효과 없음', n: '공통' }
      ],
      imageSpecs: [
        { where: '업체 상세 히어로', spec: '390×260 · 3:2' },
        { where: '홈 웨딩픽 추천 대형', spec: '342×196 · 16:9' },
        { where: '검색 결과 카드', spec: '342×168 · 2:1' },
        { where: '2열 피드 카드', spec: '16:11' },
        { where: '취향 이미지 카드', spec: '1:1' },
        { where: '3열 후보 썸네일', spec: '107×96' },
        { where: '리스트 썸네일', spec: '52×52 · radius 6' }
      ],
      checks: [
        '좌우 24px 기준선에 Hero · 섹션 제목 · 카드가 모두 맞는가',
        '7단계 밖의 글자 크기를 쓰지 않았는가',
        'Hero Title 2줄, Sub 1줄을 지켰는가',
        '한 화면에 Primary CTA가 하나인가',
        '이미지 있음 / 없음 두 경우를 모두 그렸는가',
        '정보 충분 / 부족 두 경우를 모두 그렸는가',
        '긴 업체명이 한 줄로 잘리는가',
        '혜택 없음 상태가 있는가',
        '로그인 전 / 후를 모두 그렸는가',
        'Pick 전 / 후를 모두 그렸는가',
        '빈 상태에 다음 행동이 있는가',
        '스킨 6종에서 모두 읽히는가',
        '용어사전에 없는 표현을 새로 만들지 않았는가',
        '실 제보 표기 포맷을 그대로 따랐는가',
        '사용자 화면에서 «데이터»라는 말을 쓰지 않았는가',
        '안내 · 제공 · 지급 · 검증 · 반려 · 처리 · 수집 같은 운영자 용어를 사용자 화면에 쓰지 않았는가',
        '기능 설명 대신 사용자가 얻는 결과를 먼저 말했는가',
        '웹은 가명 업체와 샘플 이미지, 앱은 실제 데이터를 썼는가',
        '애매모호 표현 대신 상태를 직접 적었는가',
        '사용자 화면에 «AI»라는 말이 남아 있지 않은가',
        'Skeleton 크기가 실제 컴포넌트와 같은가',
        '같은 행 카드의 CTA 하단선이 정확히 일치하는가',
        '제목 · 금액 · 건수 · 설명의 최대 줄 수를 지정했는가'
      ]
    };
  }
}


export default Component;
