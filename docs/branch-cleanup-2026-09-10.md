# 브랜치 정리 기록 — 2026-09-10

「최신 3건만 유지 · 오래되거나 불필요한 것은 흡수 후 정리」(2026-09-10 사용자 오더)에 따라
원격 브랜치를 세었다. 이 파일은 **되돌리기 위한 기록**이다.

> ## 정정 (2026-09-10, 보존 3건 세션)
>
> **아래 27개는 지워지지 않았다.** 원격 브랜치는 여전히 112개다(`git ls-remote --heads origin | wc -l`).
> 컨테이너에서 `git push --delete`가 403으로 막히는데 그 실패가 「지웠다」로 적혔다.
>
> **그리고 27개 중 16개는 차이가 0이 아니었다.** 이 조사를 돌린 클론이 얕아서
> (`git rev-parse --is-shallow-repository` → `true`) 브랜치와 `main`에 공통 조상이 없었고,
> `git diff origin/main...<브랜치>`가 `no merge base`로 죽으면서 출력이 비었다.
> 빈 출력을 「차이 없음」으로 읽은 것이다.
>
> `git fetch --unshallow` 뒤 전체 클론에서 다시 세니 이렇다.
>
> | | 수 |
> |---|---|
> | 진짜 차이 0 (지워도 된다) | **11** — 아래 표에서 차이 0으로 다시 확인된 것 |
> | 차이가 남아 있다 (지우면 안 된다) | **16** |
>
> 가장 큰 것이 `claude/front-dev-start-nrr0jh` 72파일 · `claude/backend-gaps-9xrh1d` 45파일 ·
> `claude/information-gathering-sy6e01` 25파일이다. 전부 2026-09-01~03이고 대부분은 `main`이
> 그 파일을 이후에 다시 썼지만, **「차이 0이라 잃을 것이 없다」는 근거는 성립하지 않는다.**
>
> 아래 SHA 27개는 전부 실제 팁과 일치한다 — 되살리는 데는 문제가 없다.
>
> `.github/workflows/branch-cleanup.yml`은 `fetch-depth: 0`으로 받으므로 이 함정에 걸리지
> 않는다. 그래도 나중에 그 값이 바뀌면 조용히 틀려지므로 얕은 클론이면 세지 않고 먼저
> 실패하는 단계를 넣었다. 지우는 것은 **그 워크플로로 한다** — 돌 때마다 다시 세므로
> 아래 목록보다 그쪽이 맞다.
>
> 판단 근거와 브랜치별 상태는 [unmerged-branches.md](unmerged-branches.md)에 있다.

브랜치를 지우면 이름은 사라지지만 커밋은 SHA로 남는다. 아래 SHA가 있으면 언제든 되살린다.

```
git push origin <SHA>:refs/heads/<브랜치 이름>
```

## 세는 방법 — `--no-merged`를 믿지 않는다

이 저장소는 스쿼시 머지를 쓴다. 스쿼시는 새 커밋 하나를 만들므로 원본 브랜치의 커밋 SHA가
main에 없고, 그래서 `git branch -r --no-merged`가 **내용이 이미 들어간 브랜치까지 「머지 안 됨」**
으로 센다. 실제로 그 수는 102였지만 진짜 남은 것은 81이었다.

대신 `git diff --name-only origin/main...origin/<브랜치>`로 **파일 차이가 0인지**를 본다.
0이면 그 브랜치가 하려던 일이 main에 다 있다는 뜻이다.

## 지우려던 27개 — 실제로는 지워지지 않았고, 16개는 차이가 있다

아래는 얕은 클론에서 「차이 0」으로 세어진 목록이다. 위 정정을 함께 읽는다.
SHA는 되살리는 데 쓴다.

| 브랜치 | 마지막 커밋 | SHA |
| --- | --- | --- |
| `claude/home-c1` | 2026-09-01 | `b719c880f65e7c6ce1c45d87b43619cbe6150f6d` |
| `flyio-new-files` | 2026-09-01 | `71b271754d89afcd56b8f0f456586e18a6c383c0` |
| `claude/backend-gaps-9xrh1d` | 2026-09-02 | `6d4b85484711e93cded8f9eef8d2f491dca3434a` |
| `claude/backend-gaps-olvj3m` | 2026-09-02 | `fd144c7f3d06df97331c1a4954a65bf95afb37cb` |
| `claude/daily-progress-briefing-3k7lez` | 2026-09-02 | `a3ead320469e7413e5d1ca18c9033635b8c765ed` |
| `claude/fe-screens-expo` | 2026-09-02 | `2080438ecd8d5905d22e7e8dbe45d90acd0cad23` |
| `claude/fix-db-migration-0061` | 2026-09-02 | `856c37b3807c5b60c061d6d6b48a79f5f432c96d` |
| `claude/fix-migration-numbering-collision-260902` | 2026-09-02 | `83ba6d368f323092b9351aced4d4fb1fe4122537` |
| `claude/front-dev-start-nrr0jh` | 2026-09-02 | `ed124d8a1caf4e463daba3c6d1ef1400d9e21eb0` |
| `claude/frontend-development-i1j2aa` | 2026-09-02 | `91db3f13d4fd197b56faae202d7266ddbd6f6149` |
| `claude/information-gathering-sy6e01` | 2026-09-02 | `52ec4c8c2f4282e3eeeb183ab4c5775c3a9f10f2` |
| `claude/lifecycle-policy-scope` | 2026-09-02 | `288691d2d6adf51258d50ecadefe944fecf96553` |
| `claude/payment-proof-count-fix` | 2026-09-02 | `08fce7449a13938baa15cf25b9881fe87a10ea73` |
| `claude/wedding-events-map-view-260902` | 2026-09-02 | `f3f3ed75b99dc8db2f90531c0a0f5b01f0ee5fc0` |
| `claude/withdrawal-copy-alignment-15037` | 2026-09-02 | `bcbdab8e13c724e369c0d9e8e989ae4daef9d1a2` |
| `docs/session-handoff-staging-green` | 2026-09-02 | `ec0b7768c2bd8965a4166846686692aa59fb9cb6` |
| `fix/lint-set-state-in-effect` | 2026-09-02 | `d4fd2a7023502ce3f3b92d31c8fb45c09a54194b` |
| `fix/monthly-draw-migration-collision` | 2026-09-02 | `0ea99ffb3bc9dcfe1364a91624d15d1f72c44961` |
| `fix/stale-policy-status-tests` | 2026-09-02 | `553a79e92b0d27891b4aab9f8519bc61eef518b6` |
| `claude/fe-screens-admin-p0` | 2026-09-03 | `e8a1540d7816e727af27c5f278080f0cb25f7a76` |
| `claude/fe-screens-common-states` | 2026-09-03 | `4740cb749d248f7298fb14f64ddd3d71e1679164` |
| `claude/fe-screens-cpl-biz-sht-2nd` | 2026-09-03 | `68ed89006552d2bbc2c3b5bd8e0e0b14699ccf17` |
| `claude/fe-screens-our-my-home` | 2026-09-03 | `5133b9b8dea44f88877595a88836f20786646c7d` |
| `codex/social-login-completion` | 2026-09-03 | `2bf2186b4f07b6ad8c406b90d0390a0256ffa85e` |
| `claude/wedding-pick-android-apk-tjo2gg` | 2026-09-04 | `512e6b08cb73f150ece87d006032fcbeea1174bd` |
| `codex/web-open-graph` | 2026-09-04 | `7bcb57dea77411e6a766b7ee696809602b8f0e27` |
| `codex/web-copy-responsive` | 2026-09-08 | `0961539895e1cee391e4b42cc038f9b5f3b1cc14` |

## 차이가 남아 있는 81개 (얕은 클론 기준. 전체 클론에서는 94개)

파일 차이가 남아 있어 **흡수 여부를 확인한 뒤에** 판단한다. 크다고 살아 있는 것은 아니다 —
`home/fe-p0-gaps`는 90파일이 다르지만 그 시절 화면이 이후에 갈아엎어졌을 수 있다. 반대로
1파일짜리가 아직 유일한 개선일 수도 있다. 세어보지 않고 지우지 않는다.

### 지우지 않는다 — 보호 목록

| 브랜치 | 이유 |
| --- | --- |
| `main` | 본선 |
| `claude/weddingpick-master-bootstrap-6j1c7o` | MASTER 세션 |
| `claude/admin-console` | 관리자 콘솔 전담 · 진행 중 |
| `claude/webview-design` | 웹뷰 디자인 전담 · 진행 중 |
| `claude/inapp-browser` | 인앱 브라우저 탈출 전담 · 진행 중 |
| `claude/admin-accounts` | 관리자 계정·권한 전담 · 진행 중 |
| `claude/admin-split` | 관리자 사이트 분리 전담 · 진행 중 |
| `claude/badge-clipping` | 배지 잘림 전수 검수 전담 · 진행 중 |
| `claude/retention-3` | 보존 3건 정리 전담 · 진행 중 |
| `release/public-data-sbiz-key-guard` | 0건 수집을 조용히 초록으로 넘기는 것을 막는다. 아직 흡수되지 않았다 |

### 남은 81개 · 마지막 커밋 순

| 마지막 커밋 | 차이 | 브랜치 | SHA |
| --- | --- | --- | --- |
| 2026-09-10 | 8파일 | `fix/legal-responsive-review` | `ea2a28db1e8f36cf196775c670ac9be955c80005` |
| 2026-09-10 | 7파일 | `claude/inapp-browser` | `3a6fff99a4a47402aa7da8a2046f75bf818e7680` |
| 2026-09-10 | 5파일 | `claude/admin-split` | `485cbcbd4003d6ce6ef339fd0d7b9ca9facb330f` |
| 2026-09-10 | 33파일 | `claude/weddingpick-admin-uiux` | `c6d14c844ec95d2f05fb34aca08efda5ba47bb8a` |
| 2026-09-10 | 32파일 | `claude/weddingpick-vendor-monitor` | `6a994238ce58c7e69293e2fa9b56331b95ca253e` |
| 2026-09-10 | 1파일 | `claude/weddingpick-master-bootstrap-6j1c7o` | `6e35f90f1dba707af8092848cd85b20f759da4f4` |
| 2026-09-10 | 18파일 | `claude/admin-console` | `485c7b47f59ae60f3ff3e32a8e479b368e71a742` |
| 2026-09-10 | 12파일 | `claude/webview-design` | `c8791a13b8f9a16d30a07d5c3ff5d68a55e57f92` |
| 2026-09-09 | 9파일 | `be/kill-switches-wired` | `e2eb15e9fd297cd3e83b8b1cf8ce07172202f9f8` |
| 2026-09-09 | 8파일 | `claude/data-collect-refine-d1d3` | `38845d40358e78b58dfbbd84516d2461b4833f15` |
| 2026-09-09 | 5파일 | `fe/docs-report-path-and-g13-price-line` | `4ae2109071bbdf0c47d659c447d3101358425127` |
| 2026-09-09 | 5파일 | `be/collection-guards` | `f70a8ba6e14b047ca26d5f222aeb8f7fe34c19d9` |
| 2026-09-09 | 3파일 | `fe/web-price-line-sweep` | `a13241ea469a9b2c70e30f35e552b3eee281332e` |
| 2026-09-09 | 2파일 | `release/enable-google-play-submit` | `fee8f019213108c7f1e39bdf119e11ef54817516` |
| 2026-09-09 | 2파일 | `claude/weddingpick-session-routine-cleanup-w48c3t` | `597ba36e1f5fd3170adfc4c1bc0f51ad01c68d66` |
| 2026-09-09 | 2파일 | `be/defect-list-update` | `75d51927a40e5669483f8ea4ceebf4e973c970f7` |
| 2026-09-09 | 1파일 | `release/public-data-sbiz-key-guard` | `aa14306a78583bf038796876b7ce3c1fc09f59f3` |
| 2026-09-09 | 1파일 | `release/public-data-apply-in-chunks` | `2ecd91d343113477516d9c764e036d2f310e1fb1` |
| 2026-09-09 | 1파일 | `release/play-first-release-checklist` | `6f73f50e0e0aab674bb60007d817a9da748c3a40` |
| 2026-09-09 | 1파일 | `release/drop-unused-android-permissions` | `8f436aefe4d9fc13f2927feaf1a4b6433e2c2e61` |
| 2026-09-09 | 1파일 | `release/block-system-alert-window` | `79341cddd58b3576ba9621d653ad9fd80a2e6278` |
| 2026-09-09 | 1파일 | `claude/release-audit` | `dd090e9f456079c8db668e7c3099d834631c8b26` |
| 2026-09-09 | 1파일 | `claude/marketing-banned-terms` | `fc1d14c44d8f8cf4a66916da45940ed4d0977a77` |
| 2026-09-09 | 1파일 | `claude/ci-marketing-preview-path` | `a8fcbd21f0b7e7898c783bb7fadffbdda17ade82` |
| 2026-09-09 | 1파일 | `be/prod-db-url-note` | `20d0140dbbc0ce92a2b346f72ae3b419e5dc557e` |
| 2026-09-09 | 1파일 | `be/env-split-1to3` | `9a20ec3081760e6ba0b7a8e13d5c26343b65cc9c` |
| 2026-09-09 | 1파일 | `be/cors-origins` | `5e21bc615849439b8cfabbdb17bc0e043b927570` |
| 2026-09-09 | 13파일 | `claude/alimtalk-channel` | `f7e677d9678f5a9da51c3b5f901225b264e5482d` |
| 2026-09-09 | 11파일 | `claude/weddingpick-data-collection-q72atr` | `6ccbbbd2a9d32e2c23232205b9a5aa81267f8275` |
| 2026-09-09 | 10파일 | `fe/copy-gate-reads-glossary` | `e97df59cfb22701df00687f80ac0d78b507855a3` |
| 2026-09-07 | 7파일 | `claude/stabilize-p0` | `cbd410efe63652e04575e56f35d59be38a9ec901` |
| 2026-09-07 | 6파일 | `claude/p0-cors-and-smoke` | `45a7ab68ca39661e26215f12b0f98fac08e6a075` |
| 2026-09-07 | 6파일 | `claude/fix-auth-popup-splash` | `4af56a55f983bd7f12f33fd9326dfe20e960420a` |
| 2026-09-07 | 5파일 | `feat/render-env-automation` | `64febb4aaca191bcadb7585189aac3ad07b85f3b` |
| 2026-09-07 | 5파일 | `codex/github-audit-handoff-20260907` | `7bc5540e844f715a04d4caa04ddadd949be5ebd0` |
| 2026-09-07 | 5파일 | `claude/onboarding-absorb-signup` | `f15b04f89c29b469a2a6e4852d1b2ebc347eda87` |
| 2026-09-07 | 4파일 | `feat/landing-fixed-vendors` | `d5fee8c95400a6594dff8244a3d1c46fa3cca92c` |
| 2026-09-07 | 3파일 | `claude/fix-popup-regression` | `c798a88eebd1f5a2f9ee21c4ffed5671d24ae0ab` |
| 2026-09-07 | 2파일 | `claude/render-manual-deploy` | `32c0984ab948bba446651fe2d99b932669c2b2e5` |
| 2026-09-07 | 2파일 | `claude/check-render-deploy-status` | `0015d5424d7eab1b997d6b900995870ba18a142d` |
| 2026-09-07 | 1파일 | `fix/render-sync-inputs-context` | `eca08d4eed63acf570839215cc9a539e581c9b42` |
| 2026-09-07 | 1파일 | `claude/weddingpick-handoff-link-fix` | `6fb28ccf211a75fffd80a70ede16bcc7fcdd4c9e` |
| 2026-09-07 | 1파일 | `claude/point-api-to-migrated-db` | `34fa1d7379f9084b9e5261fb4d5ac44934e0d01b` |
| 2026-09-07 | 1파일 | `claude/audit-review-2026-09-07` | `5539da9de43557f248903c65a5f39c01ef6780a3` |
| 2026-09-07 | 16파일 | `fix/canonical-pick-mark` | `ec0fa7e9e5552044e9359b3c0e5c5db4559b5ec5` |
| 2026-09-07 | 12파일 | `claude/weddingpick-repo-cleanup-7n9pzr` | `2ed58844ae075ca5394b5de5b9bc98121569a8ff` |
| 2026-09-07 | 10파일 | `claude/onboarding-restore` | `3bc42b85faac6520aca5773f57479dd82736ff01` |
| 2026-09-06 | 70파일 | `feat/auth-v3.11` | `b9946c82983f71fad2baafc0eb55fefbc77c377b` |
| 2026-09-06 | 54파일 | `feat/email-login` | `35208b056f0a2f17545c26494f6bb06fd0f8546b` |
| 2026-09-06 | 4파일 | `fix/public-data-workflow-secrets-if` | `00988235dce84c75b13f89ee111a77036aa09ba2` |
| 2026-09-06 | 2파일 | `fix/web-autofill-input` | `68b679915a45659eb65cef82911d7a48e2e5a773` |
| 2026-09-06 | 2파일 | `fix/oauth-web-redirect` | `f3ef9d76d13a74fea6af1eff998c6e9ade37ac74` |
| 2026-09-06 | 1파일 | `fix/render-blueprint-sync-nonblocking` | `5635a17456375849f1e2e15b09ac327b7d248032` |
| 2026-09-06 | 14파일 | `fix/vendor-category-and-login-visuals` | `1185de342f0f1f165c444edec50fd0e5568ac9ef` |
| 2026-09-06 | 12파일 | `fix/kakao-authorization-code-flow` | `5244ead66e2aa71cd869bb6d4bcf8196e95beb95` |
| 2026-09-05 | 9파일 | `feat/login-other-page` | `2d83237c8c60f07b6b973dfe3d9a9b32b0679689` |
| 2026-09-05 | 2파일 | `docs/consolidate-policy-main` | `aa6801d213b38b477911bf77530b3c80af613cd4` |
| 2026-09-05 | 11파일 | `claude/session-a4bq31` | `7f94e3f3e67c0ae6aeae4d0aba1bf7eb489befdb` |
| 2026-09-04 | 9파일 | `hybrid/shell-poc` | `033e072b39a60054a170d48864b5bba98453c684` |
| 2026-09-04 | 8파일 | `docs/hybrid-web-qa-checklist` | `dab045be30059666ba071b4b501351533b9dec5e` |
| 2026-09-04 | 6파일 | `hybrid/qa-pick` | `5123f258013920b186596ba42155ffc6a64f60ed` |
| 2026-09-04 | 6파일 | `hybrid/guest-removal` | `3990446d3620436766c6547edbe482633c0e5b35` |
| 2026-09-04 | 4파일 | `hybrid/qa-home-entry-shared` | `6f4a92ed84f28c6f6ceff87448c085508314d83c` |
| 2026-09-04 | 2파일 | `docs/hybrid-web-policy` | `4024951af30f0204439bcca3f43088772b1e075e` |
| 2026-09-04 | 24파일 | `design/search-vendor-clean` | `460b1bb8e0698a955ec713c073541dc6aa78b773` |
| 2026-09-04 | 22파일 | `codex/wedding-public-data-pipeline` | `8218ac0a696983fd0a2c6c283b4e88a086430a55` |
| 2026-09-04 | 19파일 | `hybrid/qa-search-vendor` | `1e52bef63cd40759508d8edf296d578e54b4b94e` |
| 2026-09-04 | 19파일 | `hybrid/qa-my-events` | `8e0ea0bae5601041c3e98b4f964667268f34ec3c` |
| 2026-09-04 | 18파일 | `hybrid/wedding-followups` | `6baad508600583aaa304ac7631f1e0efeebeeeb4` |
| 2026-09-04 | 16파일 | `design/search-vendor` | `7d3cb4029519296cbd0b305f41623b0d7369f3ba` |
| 2026-09-04 | 13파일 | `design/wedding-my` | `c44c92abda058ffcf843f3d51b621d8c49b9535a` |
| 2026-09-04 | 13파일 | `design/home-screen` | `14e4b1e5cbcb1ecdcceda074e7fbd8f56cce3aa6` |
| 2026-09-04 | 12파일 | `design/pick-screen` | `607706e2b6b1051a5f156254b8459da4624fa090` |
| 2026-09-03 | 90파일 | `home/fe-p0-gaps` | `8a8ba871cfe1de570a779391cebcc8d87da8b5d9` |
| 2026-09-03 | 7파일 | `claude/render-migration` | `9abe1cd42d96697ec6f3305afa39671debfdcf25` |
| 2026-09-03 | 5파일 | `home/fe-expo-screens` | `6d3afb1c9bd770fb1c894d8403a6c5fae7400a6b` |
| 2026-09-03 | 5파일 | `copilot/analyze-code-and-identify-issues` | `9f79046c977b4ea1df070364aae975bfea57a9bb` |
| 2026-09-03 | 2파일 | `codex/sync-kakao-p0-handoff` | `9469c62ec00f47aa9c79fea91eb1514cbb903321` |
| 2026-09-03 | 2파일 | `claude/fe-design-pixel-match` | `1e25338d803a292c666846cab95dcafa6c1b3610` |
| 2026-09-03 | 12파일 | `claude/web-front-office` | `c70f1d43aa0088c3eccdffced12da2ab18ca0efd` |
| 2026-09-02 | 1파일 | `claude/fix-db-migration-0062` | `94feee79aee07f953cee901e74e6d94f6967b6ab` |
