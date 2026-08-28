# WeddingPick 문서

| 문서 | 성격 | 원본 |
|---|---|---|
| [01-business-plan.md](01-business-plan.md) | 대외/투자용 — 서비스 정의·전략 | Drive `WeddingPick_사업계획서_v1.0.md` |
| [02-service-policy.md](02-service-policy.md) | 내부 운영 기준 — 실제 운영 방식 | Drive `WeddingPick_서비스정책서_v1.0.md` |
| [03-terms-of-service-draft.md](03-terms-of-service-draft.md) | 대외/법적 — 이용자와의 계약 (초안, 자문 전 게시 금지) | Drive `WeddingPick_이용약관_초안_v1.md` |
| [04-legal-review-checklist.md](04-legal-review-checklist.md) | 내부 관리용 — 자문 필요 항목 추적 | Drive `WeddingPick_법률검토_체크리스트_v1.md` |
| [05-product-spec.md](05-product-spec.md) | 개발용 — Phase 1 범위·화면·데이터 모델·기술 스택 | 01~04에서 파생 (신규) |
| [01a-business-plan-v3.md](01a-business-plan-v3.md) | 대외/투자용 — **v3 올인원 전환** | 2026-08-28 전달 |
| [05a-screen-data-spec.md](05a-screen-data-spec.md) | 개발용 — 화면·데이터 구조 스펙 | 2026-08-28 전달 |
| [06-v3-transition-analysis.md](06-v3-transition-analysis.md) | 내부 — v3와 지금 코드의 차이·충돌 | 05a 9번 요청에 대한 답 |

01~04는 Drive 원본을 옮긴 것으로 내용 변경이 없다(마크다운 이스케이프와 깨진 이모지만 정리). 05는 이 문서들에서 파생한 개발 문서이며, 원본에 없는 내용은 `제안` / `결정 필요`로 표시했다.

Drive의 `WeddingPick_통합본_v1.0.md`는 01~04를 이어붙인 문서라 중복 관리를 피하려고 옮기지 않았다. 이 표가 같은 역할을 한다.

## 기준 문서 우선순위

내용이 충돌할 경우: **사업계획서 > 서비스정책서 > 제품·기술 명세**. 05가 앞 문서와 어긋나면 05를 고친다.

## v3 전환 (2026-08-28)

01a가 범위를 결정사 단일에서 **올인원 플랫폼**으로 넓혔고, 계약서 원본 업로드를
P1에서 제외했다(비밀유지 조항 위약벌 — 04의 🔴 항목).

**01과 01a, 05와 05a가 아직 병합되지 않았다.** 05a는 스스로 "이전 버전" 기준으로
쓰여 있어 01a와 범위가 어긋나고, 그 어긋남이 이용점수 설계를 가른다 — 06의 0번이
그 질문이다. **정해지기 전에는 05a를 05보다 위로 두지 않는다.**
