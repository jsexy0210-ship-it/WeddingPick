# WeddingPickl

**WeddingPick | 웨딩픽** — 찍으면, 진짜 가격이 보인다.

결혼 준비의 불투명한 가격과 복잡한 계약조건을 사용자가 직접 비교·검증할 수 있게 돕는 AI 기반 웨딩 견적·계약 검증 모바일 앱.

```
사용자는 찍는다 → AI는 읽는다 → 시스템은 검증한다 → 데이터는 비교한다 → 부부는 결정한다
```

## 문서

기획·정책·법률 기준 문서와 개발용 제품 명세는 [`docs/`](docs/)에 있다. 시작점은 [docs/README.md](docs/README.md).

- 서비스 정의와 전략 → [사업계획서](docs/01-business-plan.md)
- 실제 운영 기준 → [서비스정책서](docs/02-service-policy.md)
- 개발 범위·화면·데이터 모델 → [제품·기술 명세](docs/05-product-spec.md)

## 구조

```
apps/mobile/       Expo(React Native) 앱 — Primary Product
apps/api/          Fastify + PostgreSQL 서버, AI 분석 워커
apps/web/          웹 랜딩 — 정적 HTML 한 장
packages/domain/   앱·서버·랜딩이 함께 쓰는 도메인 타입·계산 규칙·안내 문구
packages/db/       PostgreSQL 스키마와 마이그레이션
packages/api-contract/  앱과 서버가 주고받는 것의 정의 (타입 + 런타임 검증)
docs/              기획·정책·법률 기준 문서와 제품 명세
```

## 시작하기

```bash
npm install
npm run mobile                                # Expo 개발 서버
npm run build --workspace @weddingpick/web    # 랜딩 → apps/web/dist/index.html
```

자세한 내용은 [apps/mobile/README.md](apps/mobile/README.md).

## 현재 상태

**Phase 1 화면(A-01~A-15)이 모두 동작한다.** 촬영 → 분석 → 업체 연결 → 확인 → 실제 계약 중앙값과 비교 → 자료 확인 신청까지 이어지고, 찍은 문서는 기기에 저장돼 앱을 껐다 켜도 남는다. 웹 랜딩도 있다. 검색(A-16)과 업체 비교(A-17)는 Phase 2 화면이라 자리만 있다.

남은 것은 코드가 아니라 바깥에서 와야 하는 값이다:

- **원본 문서 보관 일수** — 정해지기 전에는 자동삭제가 돌지 않는다. 임의의 숫자로 남의 계약서를 지우거나 무기한 보관하는 쪽을 조용히 고르지 않으려는 것이다. **실제 사용자 문서를 서버로 보내는 것은 원본 처리에 대한 법률 자문 이후다.**
- **Apple·Kakao 클라이언트 ID** — 나오기 전까지 로그인 화면은 서버가 켜둔 개발용 경로만 보여주고, 그것이 실제 제공자 로그인이 아니라고 화면에 밝힌다.
- **이용약관·개인정보처리방침 확정본** — 없어서 본문을 싣지 않고 상태만 적는다.
- **문의처와 도메인** — 랜딩이 비워둔 채로 나간다.

자세한 것은 [제품·기술 명세 11번 열린 질문](docs/05-product-spec.md).
