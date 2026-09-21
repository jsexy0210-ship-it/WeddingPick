# 2026-09-20 전달 원본

ZIP 2개는 사용자 전달본의 증빙으로 수정 없이 보존한다. 파일명·크기·원본 SHA-256은 [canonical-manifest.json](../../canonical-manifest.json)의 `archives`에 기록되어 있다.

구현은 [현재 디자인 기준](../../README.md)을 따른다. `handoff/`·`figma-export/`의 활성 MD는 2026-09-21 사용자 요청으로 과거·중복 내용을 정리했으므로 ZIP의 MD와 일부 다르다. 변경·삭제 근거와 원본/현행 해시는 같은 manifest의 `documentationMaintenance`·`activeSources`로 구분한다.

원본 ZIP을 다시 풀어 현재 명세를 덮어쓰지 않는다. HTML·PNG·JSON·에셋은 이번 MD 정리에서 변경하지 않았다. `npm run test:design-canonical`로 원본과 활성 파일의 무결성을 검증한다.
