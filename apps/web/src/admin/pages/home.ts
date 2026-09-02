import type { Pool } from 'pg';

import { renderPage } from '../html';

/**
 * WP-ADM-001 관리자 홈.
 *
 * 핸드오프가 정한 다섯 항목(① AI 운영현황 ② 진짜 확인 필요 ③ 비용·수익
 * ④ AI 행동·변경 요약 ⑤ 긴급 중지) 중 이번 1차 구현은 읽기 전용인 ①②까지다.
 * ③(비용·수익 대시보드)·④(변경 요약)·⑤(Kill Switch)는 각각 더 넓은 집계
 * 작업과 파괴적 동작이 필요해 다음 단계로 미룬다 — `docs/AI_HANDOFF.md` 참조.
 */
export async function renderHomePage(pool: Pool): Promise<string> {
  const { rows } = await pool.query<{ open: string; last24h: string }>(
    `SELECT
       (SELECT count(*) FROM structured.open_decisions)::text AS open,
       (SELECT count(*) FROM structured.decisions WHERE created_at >= now() - interval '1 day')::text AS last24h
    `
  );

  const summary = rows[0]!;
  const openCount = Number(summary.open);

  const body = `
    <h1>관리자 홈</h1>
    <p class="subtitle">지금 이 서버는 읽기 전용이다 — 값을 바꾸거나 지우는 동작은 없다.</p>

    <div class="card-row">
      <div class="card">
        <div class="label">사람 손이 필요한 것</div>
        <div class="value">${summary.open}${openCount > 0 ? ' <span class="badge warn">확인</span>' : ''}</div>
      </div>
      <div class="card"><div class="label">최근 24시간 결정</div><div class="value">${summary.last24h}</div></div>
    </div>

    <section>
      <h2>바로가기</h2>
      <table>
        <tbody>
          <tr><td><a href="/briefing">일일 브리핑</a></td><td>최근 24시간 자동화 요약과 AI 비용</td></tr>
          <tr><td><a href="/automation">자동화 상태</a></td><td>사람 손이 필요한 것만 모은 큐</td></tr>
          <tr><td><a href="/audit-log">감사 로그</a></td><td>사건별 결정 이력, 사건 id로 검색</td></tr>
          <tr><td><a href="/users">사용자</a></td><td>가입·활성·탈퇴 현황</td></tr>
          <tr><td><a href="/data-import">데이터 처리 현황</a></td><td>공개 데이터 임포트 실행·오류</td></tr>
          <tr><td><a href="/price-stats">가격통계</a></td><td>공개된 통계, 데이터 수, 마지막 계산 시각</td></tr>
          <tr><td><a href="/vendors">업체 관리</a></td><td>영업상태 전환, 데이터 변경 이력</td></tr>
          <tr><td><a href="/images">이미지 자동수급</a></td><td>저작권·매칭·품질 검증 현황</td></tr>
          <tr><td><a href="/voc">VOC</a></td><td>문의 처리 대기·이력</td></tr>
          <tr><td><a href="/reviews">후기·반론</a></td><td>후기 신고, 업체 반론 심사 이력</td></tr>
          <tr><td><a href="/vendor-inquiries">업체 문의 큐</a></td><td>관계자 인증, 정보 정정 요청</td></tr>
          <tr><td><a href="/rewards">캠페인·보상</a></td><td>미션·친구초대·홍보인증·추첨 지급 현황</td></tr>
          <tr><td><a href="/ai-cost">AI 사용량·비용</a></td><td>모델별 호출·비용·성공률</td></tr>
        </tbody>
      </table>
    </section>
  `;

  return renderPage({ title: '관리자 홈', activePath: '/', body });
}
