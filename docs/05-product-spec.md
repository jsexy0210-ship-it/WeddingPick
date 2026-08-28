# WeddingPick 제품·기술 명세 (Phase 1 기준) — 초안

> 이 문서는 Drive 원본 문서(01~04)에서 **파생**된 개발용 문서다.
> 원본에 없던 내용은 모두 `제안` 또는 `결정 필요`로 표시했다. 확정 전까지 사업계획서·서비스정책서가 상위 기준이다.

---

## 1. Phase 1 범위 (Verify)

사업계획서 37번 Phase 표의 1단계만 구현 대상으로 잡는다. North Star Metric이 "월간 인증 견적·계약 분석 건수"이므로, **촬영 → 분석 → 결과 확인 → 인증** 단선 퍼널을 끝까지 동작시키는 것이 Phase 1의 완료 조건이다.

**포함**
- 문서 입력: 카메라 촬영 / 사진 선택 / PDF 선택
- AI 문서 분석 (문서분류 · OCR/문서이해 · 항목 추출 · 개인정보 탐지)
- 저신뢰 항목 사용자 확인 단계
- 실제 가격 비교 (중앙값 기준, 표본 수·기준기간 표시)
- 내 웨딩 저장 (견적/가계약/계약 이력)
- 검증 등급 L0~L2 부여 및 배지 표시
- 원본 문서 보관·자동삭제 파이프라인

**제외 (Phase 2 이후)**
- 업체 비교(최대 3곳), 플래너 비교 → Phase 2
- 배우자 연결, 우리 웨딩 공동 의사결정 → Phase 3
- 박람회, 외부 캘린더/지도, 주차, 방문 브리핑 → Phase 4
- 광고, Lead, B2B Data → Phase 6

**Cold Start 대응**: 사업계획서 32번 기준으로 인증자료 100건 전까지는 시장 중앙값을 **표시하지 않는다**(제품 원칙 2 — AI가 시장 데이터를 만들어내지 않는다). 그 구간에서 사용자에게 제공되는 가치는 "내 견적의 구조화 + 계약조건 체크리스트 + 추가비용 후보 목록"이다. `결정 필요`: 업체·상품 단위로 최소 표본 몇 건부터 중앙값을 노출할지.

---

## 2. 화면 목록 (Phase 1)

사업계획서 31번 IA 기준. Bottom Navigation: 홈 | 검색 | [촬영] | 내 웨딩 | MY

| # | 화면 | 내용 | Phase |
|---|---|---|---|
| A-01 ✅ | 온보딩 | 서비스 소개 3스텝, 카메라·사진 권한 안내 | 1 |
| A-02 | 로그인/가입 | `결정 필요`: 소셜 로그인 제공자 (Apple 필수, Kakao/Google 검토) | 1 |
| A-03 | 홈 | 촬영 CTA 중심. 최근 분석 결과, 진행 중 웨딩 요약 | 1 |
| A-04 | 촬영 | 카메라 / 사진 불러오기 / PDF 불러오기 | 1 |
| A-05 | 문서 확인 | 촬영본 미리보기, 재촬영, 여러 장 추가 | 1 |
| A-06 | 분석 중 | 진행 상태. 실패 시 재시도 경로 | 1 |
| A-07 | 확인 단계 | 저신뢰 핵심 필드만 질문 ("계약금액 3,280,000원이 맞나요?") | 1 |
| A-08 | 분석 결과 | 상단 고정 고지 + 구조화 결과 + 확인 필요 배지 + 검증 등급 배지 | 1 |
| A-09 | 가격 비교 | 내 견적 vs 실제 계약 중앙값, 표본 수·기준기간, 판단 표현 4단계 | 1 |
| A-10 | 계약조건 체크 | 포함/별도 항목, 추가비용 후보, 취소·환불조건 | 1 |
| A-11 | 내 웨딩 | 후보·견적·가계약·계약·비용 목록 | 1 |
| A-12 | 견적 상세 | 저장된 분석 결과 재열람, 원본 삭제 예정일 표시 | 1 |
| A-13 | 인증 신청 | L1/L2 인증 자료 제출 및 상태 | 1 |
| A-14 | MY | 내 활동, 앱 공유, 설정 | 1 |
| A-15 ✅ | 정책 | 이용약관, 개인정보처리방침, AI 안내 | 1 |
| A-16 | 검색 | 업체·플래너 탐색 | 2 |
| A-17 | 업체 상세 / 업체 비교 | 최대 3곳 비교 | 2 |
| A-18 | 배우자 초대/연결 | 초대 링크, 양측 동의 | 3 |

**구현 현황** (2026-08-28): A-01 온보딩, A-03 홈, A-04 촬영, A-05 문서 확인, A-06 분석 중, A-07 확인 단계, A-08 분석 결과, A-09 가격 비교, A-10 계약조건 체크, A-11 내 웨딩, A-12 견적 상세, A-13 인증 등급, A-14 MY, A-15 정책이 동작한다. A-07~A-10은 분석 결과 화면 안에 함께 있다. 그 밖에 샘플 미리보기와 안내(촬영 요령·AI 안내) 화면이 있다 — 명세에 없던 화면이며, 서버 없이도 앱이 무엇을 해주는지 보여주고 법률검토의 "AI 안내 정책" 항목을 채운다. A-02 로그인만 남았다 — Apple·Kakao 클라이언트 ID 발급 후.

**정책이 UI를 구속하는 지점** (서비스정책서 1·2번):
- A-08 상단에 *"AI 분석 결과이며 법적 효력이 없습니다. 원본 문서를 기준으로 판단하세요."* 고정 노출
- 저신뢰 항목을 숨기지 않고 "확인 필요" 배지로 노출
- 계약금액·계약일·환불조건은 A-07을 통과해야만 저장·비교에 반영
- 검증 등급 배지는 등급별 아이콘/색상 고정

---

## 3. 데이터 모델

원본 문서 28번 원칙("원본·개인정보·구조화 데이터·통계 데이터는 분리 관리")을 스키마 레벨에서 강제한다. 아래는 논리 모델이며 `결정 필요`: 실제 DB 선정 후 물리 스키마 확정.

**타입과 계산 규칙은 [`packages/domain`](../packages/domain)에, PostgreSQL 스키마는 [`packages/db`](../packages/db)에 코드로 있다** (2026-08-28). 둘 다 호스팅·프레임워크에 기대지 않으므로 백엔드를 무엇으로 정하든 그대로 쓴다. 아래 표기와 코드가 어긋나면 코드가 맞다.

DB에서는 세 영역을 스키마로 나눴다 — `originals` / `structured` / `stats`. 분리를 권한 단위로 만들 수 있다.

### 3.1 원본 영역 (분리 저장, 자동삭제 대상)
```
RawDocument
  id, ownerUserId, storageKey, mimeType, pageCount
  uploadedAt, retentionUntil, deletedAt, deleteAttempts
  status: uploaded | analyzed | scheduled_delete | deleted | delete_failed
```
- 저장소는 구조화 데이터와 **물리적으로 분리**된 버킷
- `retentionUntil` 경과 시 자동삭제. 실패 시 `delete_failed`로 남기고 운영 알림 (서비스정책서 4번)
- `결정 필요`: 보관 기간 일수 (서비스정책서 미확정 항목)

### 3.2 구조화 영역 (마스킹 후)
```
Quote                      // 견적/가계약/계약 공통 문서 분석 결과
  id, weddingId, rawDocumentId(nullable — 삭제 후 null)
  docType: official_price | quote | pre_contract | revised_quote | contract | final_payment
  vendorId, plannerId, productName
  totalAmount, discountAmount, contractDate, servicePeriod
  verificationLevel: L0 | L1 | L2 | L3 | L4
  source: user_input | ai_extraction | vendor_official | public_data
  createdAt, confirmedAt

QuoteLineItem
  id, quoteId, kind: included | excluded | additional_candidate
  label, amount, note

ContractTerm
  id, quoteId, category: cancellation | refund | penalty | schedule | other
  text, riskFlag

ExtractionField           // AI 추출 원자 단위 + 신뢰도 (확인 단계의 근거)
  id, quoteId, fieldPath, value, confidence
  needsConfirmation, confirmedByUser, userCorrectedValue

Vendor
  id, category: wedding_info_company | hall | sdm | planner_agency | snap | goods | etc
  name, region, officialInfo(jsonb), sourceType, lastVerifiedAt

Planner
  id, vendorId(nullable), name, regions[], affiliations[]

Wedding                   // Phase 3에서 배우자 연결 시 members 2인으로 확장
  id, ownerUserId, partnerUserId(nullable), weddingDate(nullable)

User
  id, authProvider, createdAt, deletedAt
```

### 3.3 통계 영역 (별도 저장, 재계산 대상)
```
PriceStat
  vendorId, productKey, docType, periodStart, periodEnd
  sampleCount, median, p25, p75, p90
  minVerificationLevel                 // L2 이상만 집계
  recomputedAt
```
p90은 가격 판단 4단계의 마지막 경계라 함께 저장한다 (`packages/domain/src/pricing.ts`).
- 사업계획서 27번 원칙에 따라 **중앙값·분포·판단은 전부 서버 계산**. AI 출력은 여기 직접 들어가지 않는다. `computePriceStat`이 그 계산이다.
- 판단 표현 4단계(낮은 편 / 비슷한 수준 / 다소 높은 편 / 높은 편)는 사분위 기준으로 구현했다. 임계값은 여전히 `결정 필요`이며 `packages/domain/src/policy.ts` 한 곳에 모여 있다.
- `sampleCount`와 `periodStart~periodEnd`는 노출 시 **항상 동반 표시** (사업계획서 9번). `PriceStat` 타입이 이 셋을 한 덩어리로 묶어 떼어놓기 어렵게 했다.
- 표본이 `minimumSampleCount`에 못 미치면 `computePriceStat`은 통계 대신 `null`을 준다 — 데이터가 부족하면 시장가격을 만들지 않는다(제품 원칙 2).

---

## 4. 문서 분석 파이프라인 (제안)

```
① 업로드          앱 → 서명 URL → 원본 버킷 (RawDocument.uploaded)
② 문서 분류        AI: 견적서 / 가계약서 / 계약서 / 기타
③ 개인정보 탐지     AI: 이름·연락처·주민번호 일부·서명 위치 탐지
④ 마스킹          구조화 데이터 생성 전 마스킹 적용
⑤ 항목 추출        AI: 업체·플래너·상품·가격·할인·계약일·포함/별도·추가비용 후보·취소환불
⑥ 업체 매칭        AI 후보 제시 → 서버가 Vendor 확정
⑦ 신뢰도 판정      필드별 confidence → needsConfirmation 플래그
⑧ 사용자 확인      A-07. 핵심 필드는 예외 없이 통과 필요
⑨ 저장/집계        Quote 확정 → PriceStat 재계산 큐
⑩ 보관/삭제        retentionUntil 도달 시 원본 자동삭제
```

**원칙 준수 체크**
- ③④는 오픈 초기 사람 재검토 1단계 유지 (서비스정책서 4번)
- ⑨의 집계는 `verificationLevel >= L2`만 반영 (서비스정책서 2번)
- AI 호출 비용은 문서 단위로 기록 — 사업계획서 35번 "AI 비용관리" 자동화 대상

---

## 5. 기술 스택

1인 운영·90~95% 자동처리(사업계획서 35번) 목표를 전제로, 운영 부담이 가장 적은 조합을 고른다.
**모바일 앱만 확정(2026-08-28, Expo SDK 57로 스캐폴드 완료)**. 나머지는 제안 상태다.

| 영역 | 제안 | 근거 |
|---|---|---|
| 모바일 앱 ✅ | React Native + Expo SDK 57 (TypeScript, expo-router) | 카메라·파일 선택·푸시가 표준 모듈로 해결됨. iOS/Android 동시 대응. OTA 업데이트로 1인 운영 부담 감소 |
| 웹 | Next.js 정적 랜딩 | 웹 역할은 소개·다운로드·정책 게시로 한정 (서비스정책서 9번). 앱 기능 재현 금지 |
| 백엔드 ✅ | Fastify (TypeScript) + PostgreSQL, 상시 구동 | 스키마·타입 공유. 중앙값·분위수 집계에 관계형이 맞고, 1인 운영에 관리 요소가 적다 |
| DB | PostgreSQL | 중앙값·분위수 집계와 jsonb를 동시에 요구하므로 관계형이 적합 |
| 원본 저장소 | 객체 스토리지 (구조화 DB와 분리된 버킷, 수명주기 정책으로 자동삭제) | 28번 분리 관리 원칙 + 자동삭제 요건 |
| 문서 AI | Claude (문서 이해 + 구조화 출력) | 문서분류·항목추출·계약조건 파악을 한 번에. 출력은 스키마 고정 |
| 배치/큐 | 통계 재계산, 원본 삭제, 인증 1차판정 | 사업계획서 35번 자동화 목록 |

확정 (2026-08-28):
- [x] 상시 구동 서버 — 서버리스가 아니라 컨테이너/PaaS
- [x] 인증 제공자 — Apple + Kakao (OIDC id_token 검증)
- [x] 리전 — 국내 (계약서 원본을 다룸). S3 호환이라 제공자는 환경변수로 바꾼다

`결정 필요` 항목:
- [ ] 실제 호스팅 제공자와 스토리지 버킷
- [ ] 푸시 발송 채널
- [x] ~~모바일 프레임워크~~ → Expo로 확정. `apps/mobile`

---

## 6. 개발 순서 (제안)

| 순번 | 내용 | 완료 기준 |
|---|---|---|
| 1 ✅ | 레포 구조 + 앱 스캐폴드 + CI | 5개 탭이 뜨는 빈 앱. typecheck·lint·web 번들이 CI에서 통과 |
| 2 ✅ | 인증 + Wedding 생성 | 로그인 후 내 웨딩 진입<br>Apple·Kakao OIDC 검증과 세션 발급, 웨딩 생성까지 서버 구현 완료. 실제 제공자 토큰 검증은 클라이언트 ID 발급 후 |
| 3 🚧 | 촬영·업로드 + 원본 저장소 분리 | 원본이 분리 버킷에 저장, retentionUntil 기록<br>촬영·사진·PDF 입력, 문서 확인, 기기 저장까지 완료. 서버 업로드와 보관기간 기록은 법률 검토 후 |
| 4 🚧 | AI 분석 (분류·추출·신뢰도) | 실제 견적서 샘플에서 핵심 필드 추출<br>워커와 정확도 측정 하네스 완료. 실제 업체 견적서로 돌려보는 것만 남았다 |
| 5 ✅ | 확인 단계 + 결과 화면 | 핵심 필드 확인 없이 저장 불가<br>API·DB 트리거·화면까지 완료 |
| 6 🚧 | 개인정보 탐지·마스킹 + 자동삭제 배치 | 보관기간 경과 원본이 실제로 삭제, 실패 시 알림<br>탐지(종류 기록)와 삭제 작업 완료. 보관 일수가 정해져야 실제로 돈다 |
| 7 🚧 | 검증 등급 + 인증 신청 | L0~L2 부여 및 배지 표시<br>등급 체계·배지·안내 화면(A-13)은 완료. 등급 판정은 증빙 재검토가 필요해 서버 몫 |
| 8 ✅ | PriceStat 집계 + 가격 비교 화면 | 표본 부족 시 중앙값 미노출 동작 확인<br>API·화면 완료. 표본이 모자라면 이유를 보여준다 |
| 9 🚧 | 정책 화면 + 웹 랜딩 | 약관·개인정보처리방침·AI 안내 게시<br>앱 정책 화면(A-15)은 자리와 상태만. 확정본이 없어 본문은 싣지 않았다 |

6번(마스킹·자동삭제)은 법률검토 체크리스트에서 최우선 자문 대상이므로, **자문 결과가 나오기 전에는 실제 사용자 문서를 수집하지 않는다.**

---

## 8. API 계약

[`packages/api-contract`](../packages/api-contract)에 코드로 있다. 서버는 이대로 구현하고 앱은 이대로 부른다.

```
POST /v1/documents/uploads          서명된 URL 받기 → 파일은 스토리지로 바로
POST /v1/documents/{id}/complete    분석 시작
GET  /v1/analyses/{id}              A-06 진행 상태
GET  /v1/quotes/{id}                A-08 분석 결과
POST /v1/quotes/{id}/confirmations  A-07 핵심 필드 확인
GET  /v1/quotes/{id}/comparison     A-09 실제 가격 비교
POST /v1/quotes/{id}/verification-requests   A-13 인증 신청
```

응답 모양이 정책을 강제하는 지점: 가격은 표본 수·기준 기간과 한 객체로만 나가고, 비교 불가 응답에는 이유가 반드시 붙으며, 인증 접수 응답에는 승인 상태가 존재하지 않는다.

`결정 필요`: 토큰 발급 경로 — 인증 제공자가 정해져야 확정된다.

---

## 7. 열린 질문 (원본 문서의 미확정 항목 + 개발 관점 추가)

원본 문서에서 넘어온 것:
- [ ] 원본 문서 보관 기간 (일수)
- [ ] 반론 접수 후 처리 영업일
- [ ] 개인정보 탐지 정확도 목표치 및 수동 검토 전환 기준
- [ ] 리워드 등급별 금액

개발 착수를 위해 추가로 필요한 것:
- [ ] 백엔드·호스팅·인증 확정 (5번 — 모바일은 확정됨)
- [ ] 중앙값 노출 최소 표본 수 — **잠정 5건**으로 구현됨
- [ ] 가격 판단 4단계 임계값 — **잠정 p25 / p75 / p90**으로 구현됨

잠정값 둘은 `packages/domain/src/policy.ts` 한 파일에 모여 있다. 확정되면 그 파일만 고치면
되고, 테스트가 정책 상수를 참조하므로 값을 바꿔도 테스트는 그대로 돈다.
- [ ] 상품 동일성 판단 기준 — **잠정 규칙(업체 + 정규화한 상품명)으로 구현됨** (`packages/domain/src/product.ts`). 옵션 조합까지 봐야 하는지는 실제 견적서를 모아본 뒤 정한다
- [ ] 초기 타겟 지역/카테고리 — 표본을 모으려면 범위를 좁혀야 함 (제안: 웨딩홀 또는 스드메 1개 카테고리 + 수도권)
