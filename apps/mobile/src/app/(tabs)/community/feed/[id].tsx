/**
 * 라운지 웨딩피드 상세.
 *
 * 홈과 라운지가 같은 공개 웨딩피드 상세 계약/시각 정본을 사용한다. 라운지에서 연
 * 글은 이 route를 써서 Back history가 라운지의 현재 탭/필터 상태를 그대로 복원한다.
 * 직접 진입처럼 history가 없을 때는 depth-back 예외가 /community?tab=feed로 보낸다.
 */
export { default } from '../../(home)/feed/[id]';
