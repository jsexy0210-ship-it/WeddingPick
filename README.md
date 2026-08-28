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
apps/mobile/   Expo(React Native) 앱 — Primary Product
docs/          기획·정책·법률 기준 문서와 제품 명세
```

## 시작하기

```bash
npm install
npm run mobile    # Expo 개발 서버
```

자세한 내용은 [apps/mobile/README.md](apps/mobile/README.md).

## 현재 상태

[개발 순서](docs/05-product-spec.md#6-개발-순서-제안) 1단계(레포 구조·스캐폴드·CI) 완료, 3단계 진행 중. 홈(A-03), 촬영·문서 확인(A-04·A-05), 내 웨딩(A-11), 견적 상세(A-12), 인증 등급(A-13), MY(A-14), 정책(A-15)이 동작한다. 찍은 문서는 기기에 저장돼 앱을 껐다 켜도 남는다. 문서는 아직 기기 안에만 있고, 서버 업로드와 AI 분석은 원본 문서 처리에 대한 법률 검토 이후다. 검색(A-16)은 Phase 2 화면이라 자리만 있다.

백엔드·호스팅·인증 제공자는 아직 미확정이다 — [제품·기술 명세 5번](docs/05-product-spec.md#5-기술-스택).
