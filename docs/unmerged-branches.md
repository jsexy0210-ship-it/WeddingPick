# 머지되지 않은 브랜치 — 2026-09-10 기준

세션을 정리하면서 남긴 목록이다. **세션을 보관해도 브랜치는 지워지지 않는다.** 잃을 위험은 브랜치가 있다는 사실을 잊는 것이므로 여기 적어 둔다.

`git branch -r --no-merged origin/main`으로 다시 셀 수 있다. 흡수했거나 버리기로 한 것은 이 표에서 지우고 이유를 적는다.

## 흡수 완료

| 브랜치 | 내용 | 어디로 |
|---|---|---|
| `claude/weddingpick-admin-uiux` | 서버 없는 단추 22개 잠금 · 색 토큰화 · 안내 상자 토큰 | `eea14bb` |
| `claude/weddingpick-vendor-monitor` | 수집 변경 감지 · 폐업 정리 · `0101` | `aa82565` (0098 → 0101 재번호) |

두 브랜치의 PR(#162 포함)은 내용이 이미 들어갔으므로 닫는다.

## 남아 있는 것 — 검토 필요

| 브랜치 | 커밋 | 내용 | 판단 |
|---|---|---|---|
| `release/public-data-sbiz-key-guard` | +2 | 수집이 0건이어도 초록으로 끝나던 것 차단 · `SBIZ_API_KEY` 없으면 실패 | **가져올 값어치 있음.** 조용한 실패를 막는 종류다 |
| `fe/copy-gate-reads-glossary` | +5 | 카피 게이트가 `glossary.json`을 읽게 · 「둘러보기」→「검색」 | 금지어 검사 강화. 현재 `lint-copy.js`와 겹치는지 확인 필요 |
| `fe/docs-report-path-and-g13-price-line` | +3 | 웹 금액 한 줄을 도메인 `priceLine`으로 통일 | 규칙과 같은 방향. 지금 웹 코드와 대조 필요 |
| `be/defect-list-update` | +4 | 문서만 — 미지 마이그레이션 3개의 정체 · N01 범위 | 미지 마이그레이션(`0052` · `0059` · `0060`) 조사 기록이라 값어치 있음 |
| `claude/alimtalk-channel` | +4 | 알림톡 채널 | 알림톡은 아직 착수 전이라 보류 |
| `claude/ci-marketing-preview-path` | +2 | CI 마케팅 미리보기 경로 | 확인 필요 |
| `release/*` 나머지 | +1씩 | 안드로이드 권한 정리 · Play 제출 · 체크리스트 | 출시 준비. 릴리즈 시점에 함께 본다 |
| `claude/weddingpick-data-collection-q72atr` | +14 | 수집 초기 작업 | PR #161에 흡수됐을 가능성이 높다. 대조 필요 |
| `fe/web-price-line-sweep` · `fe/*` 기타 | +1씩 | | 확인 필요 |

## 규칙

- 흡수할 때 **마이그레이션 번호가 겹치는지 먼저 본다.** `vendor-monitor`가 `0098`을, 마스터가 `0098`을 각자 집어 충돌했다. 그대로 두면 하나가 조용히 빠진다
- 브랜치가 오래됐을수록 `main`과 벌어져 있다. `git diff origin/main...<브랜치>`로 **실제 차이**를 보고 판단한다 — 커밋 수는 스쿼시 머지 때문에 부풀어 보인다
