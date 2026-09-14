# 브랜치 정리로 지운 것 — 되살릴 때 쓰는 SHA

**2026-09-14 22:03 KST(13:03 UTC), 대표님이 직접 돌리셨다**
([run 34846911158](https://github.com/jsexy0210-ship-it/WeddingPick/actions/runs/34846911158)).
`include_unmerged: true`로 121개를 지웠고 남은 것은 27개다.

## 왜 여기 적어 두나

**지운 SHA가 Actions 로그에만 있었다.** 로그는 90일쯤 지나면 사라지고, 그 뒤에는
브랜치 이름조차 남지 않는다. 내용이 main에 없는 브랜치는 **SHA 말고는 되살릴
방법이 없다** — 워크플로 주석이 그 사실을 적어 두고도 목록은 로그에만 남겼다.

되살리는 법:

    git fetch origin <SHA>
    git branch <이름> <SHA>

**지운 직후에는 된다.** GitHub이 도달 불가 객체를 언제 정리하는지는 우리가 정하지
않으므로, 필요하다고 판단되면 미루지 않는다.

## 확인한 것 — `claude/admin-overhaul`은 잃은 것이 없다

감시 9주기가 「#211 이후 추가 작업이 있었는지 확인이 필요하다」고 올린 건이다.
SHA `0a741399`로 직접 가져와 대조했다.

브랜치가 건드린 34개 파일 중 main과 내용이 다른 것은 **다섯**이고, 다섯 **전부
main 쪽이 더 최신**이다.

| 파일 | 어느 쪽이 앞서나 |
| --- | --- |
| `apps/api/src/routes/admin.ts` | main에 광고 관문 라우트 61줄이 있고 브랜치엔 없다 |
| `apps/mobile/src/app/admin/ads-gate.tsx` | main이 291줄 더 많다. 브랜치는 옛 뼈대다 |
| `scripts/og-probe.py` | main은 싱가포르 주소, 브랜치는 옛 Ohio 주소다 |
| `render.yaml` | 브랜치가 옛 판이다 |
| `docs/sync/master-status.json` | 인계 기록이라 내용 비교 대상이 아니다 |

**3-dot diff(`main...SHA`)로 보면 34파일 +1,942줄이라 「안 들어간 것이 많다」로
읽힌다. 그것이 함정이다** — 이 저장소는 스쿼시 머지를 써서 브랜치 커밋 SHA가
main에 남지 않고, 그래서 내용이 다 들어간 브랜치도 3-dot에서는 미병합으로 보인다.
**파일 내용을 직접 비교해야 한다.**

## 지운 121개

| 브랜치 | SHA |
| --- | --- |
| `be/collection-guards` | `f70a8ba6e14b047ca26d5f222aeb8f7fe34c19d9` |
| `be/cors-origins` | `5e21bc615849439b8cfabbdb17bc0e043b927570` |
| `be/defect-list-update` | `75d51927a40e5669483f8ea4ceebf4e973c970f7` |
| `be/env-split-1to3` | `9a20ec3081760e6ba0b7a8e13d5c26343b65cc9c` |
| `be/kill-switches-wired` | `e2eb15e9fd297cd3e83b8b1cf8ce07172202f9f8` |
| `be/prod-db-url-note` | `20d0140dbbc0ce92a2b346f72ae3b419e5dc557e` |
| `claude/admin-accounts` | `af26a32a72be463543265689e694037031e50b7b` |
| `claude/admin-console` | `5c94f994d0231169cf92fda2d2c2df6a3e0a94f2` |
| `claude/admin-guard-audit` | `5d612c975fff04e05ab2dc74a0233c388798baaa` |
| `claude/admin-overhaul` | `0a741399e8f99c5d5dc8a1ef389125c4ec674af5` |
| `claude/admin-screen-review-v327` | `aabe8bf2d89c5dee6aeb00b0aa87839230c21f45` |
| `claude/admin-split` | `58f8bd93ed2f54d7ae644a46d7e1345e706d7f7e` |
| `claude/ads-admin-control` | `fab8d628fadc2f5bee574d381abee483744a965a` |
| `claude/age-gate-14` | `111e4534f2f310afecc0f70cb1498bb878a8908b` |
| `claude/audit-review-2026-09-07` | `5539da9de43557f248903c65a5f39c01ef6780a3` |
| `claude/backend-gaps-9xrh1d` | `6d4b85484711e93cded8f9eef8d2f491dca3434a` |
| `claude/backend-gaps-olvj3m` | `fd144c7f3d06df97331c1a4954a65bf95afb37cb` |
| `claude/badge-clipping` | `e4260ba51963007b0a5b475c7b072dce3eb08e37` |
| `claude/capture-contract` | `0915abcced89a2377aac754313425a1c1681e131` |
| `claude/check-render-deploy-status` | `0015d5424d7eab1b997d6b900995870ba18a142d` |
| `claude/ci-marketing-preview-path` | `a8fcbd21f0b7e7898c783bb7fadffbdda17ade82` |
| `claude/date-picker-wheel` | `542e940322a2310e99b5c4c96aa95ff87eed95a0` |
| `claude/fe-design-pixel-match` | `1e25338d803a292c666846cab95dcafa6c1b3610` |
| `claude/fe-screens-admin-p0` | `e8a1540d7816e727af27c5f278080f0cb25f7a76` |
| `claude/fe-screens-common-states` | `4740cb749d248f7298fb14f64ddd3d71e1679164` |
| `claude/fe-screens-cpl-biz-sht-2nd` | `68ed89006552d2bbc2c3b5bd8e0e0b14699ccf17` |
| `claude/fe-screens-expo` | `2080438ecd8d5905d22e7e8dbe45d90acd0cad23` |
| `claude/fe-screens-our-my-home` | `5133b9b8dea44f88877595a88836f20786646c7d` |
| `claude/fix-auth-popup-splash` | `4af56a55f983bd7f12f33fd9326dfe20e960420a` |
| `claude/fix-db-migration-0061` | `856c37b3807c5b60c061d6d6b48a79f5f432c96d` |
| `claude/fix-db-migration-0062` | `94feee79aee07f953cee901e74e6d94f6967b6ab` |
| `claude/fix-migration-numbering-collision-260902` | `83ba6d368f323092b9351aced4d4fb1fe4122537` |
| `claude/fix-popup-regression` | `c798a88eebd1f5a2f9ee21c4ffed5671d24ae0ab` |
| `claude/front-dev-start-nrr0jh` | `ed124d8a1caf4e463daba3c6d1ef1400d9e21eb0` |
| `claude/frontend-development-i1j2aa` | `91db3f13d4fd197b56faae202d7266ddbd6f6149` |
| `claude/inapp-browser` | `eb53d5952dfda20249ec70b79a1ec6900df439fa` |
| `claude/information-gathering-sy6e01` | `52ec4c8c2f4282e3eeeb183ab4c5775c3a9f10f2` |
| `claude/journey-naming-back` | `0ca09d1830a01d8a0ad6a17c98beba3ff5aae413` |
| `claude/lifecycle-policy-scope` | `288691d2d6adf51258d50ecadefe944fecf96553` |
| `claude/marketing-banned-terms` | `fc1d14c44d8f8cf4a66916da45940ed4d0977a77` |
| `claude/mockup-parity` | `8218a6c741e40c316eb0ea39505603f2649dc3d5` |
| `claude/mockup-parity-admin-v327` | `87e6258f8f7e862f7c1d4b6226d2aa69e0e101d3` |
| `claude/notification-settings` | `49f4887251fa8011f92b1a902d86222706198eb3` |
| `claude/onboarding-absorb-signup` | `f15b04f89c29b469a2a6e4852d1b2ebc347eda87` |
| `claude/onboarding-restore` | `3bc42b85faac6520aca5773f57479dd82736ff01` |
| `claude/owner-orders-5` | `0991a7aa77a839daafc9af14dcb34957ce8e8557` |
| `claude/p0-cors-and-smoke` | `45a7ab68ca39661e26215f12b0f98fac08e6a075` |
| `claude/payment-proof-count-fix` | `08fce7449a13938baa15cf25b9881fe87a10ea73` |
| `claude/point-api-to-migrated-db` | `34fa1d7379f9084b9e5261fb4d5ac44934e0d01b` |
| `claude/region-legal` | `e175e2399373e9c979549487494adbef6be55c3e` |
| `claude/release-audit` | `dd090e9f456079c8db668e7c3099d834631c8b26` |
| `claude/render-manual-deploy` | `32c0984ab948bba446651fe2d99b932669c2b2e5` |
| `claude/render-migration` | `9abe1cd42d96697ec6f3305afa39671debfdcf25` |
| `claude/retention-3` | `76e41f455317b2d63a97975ae8df95dc4db48a98` |
| `claude/screen-capture` | `3a960c4a852575cef86ce39fffaabc7cc68547a0` |
| `claude/search-category-meta` | `06f11f6fc4ddae0aaa3675f6c9c885aba67046e3` |
| `claude/search-design-fix` | `8c2071d0384d31a0231be17cea025cb95878f8b8` |
| `claude/search-no-home` | `ae29ae427ae810259b564d94573517c990758c83` |
| `claude/search-ux` | `fe48ff6b8e876472d30cb716e64d9718bd0a0b54` |
| `claude/session-a4bq31` | `7f94e3f3e67c0ae6aeae4d0aba1bf7eb489befdb` |
| `claude/stabilize-p0` | `cbd410efe63652e04575e56f35d59be38a9ec901` |
| `claude/web-front-office` | `c70f1d43aa0088c3eccdffced12da2ab18ca0efd` |
| `claude/webview-design` | `c8791a13b8f9a16d30a07d5c3ff5d68a55e57f92` |
| `claude/wedding-events-map-view-260902` | `f3f3ed75b99dc8db2f90531c0a0f5b01f0ee5fc0` |
| `claude/weddingpick-admin-uiux` | `c6d14c844ec95d2f05fb34aca08efda5ba47bb8a` |
| `claude/weddingpick-handoff-link-fix` | `6fb28ccf211a75fffd80a70ede16bcc7fcdd4c9e` |
| `claude/weddingpick-repo-cleanup-7n9pzr` | `2ed58844ae075ca5394b5de5b9bc98121569a8ff` |
| `claude/weddingpick-session-routine-cleanup-w48c3t` | `597ba36e1f5fd3170adfc4c1bc0f51ad01c68d66` |
| `claude/weddingpick-vendor-monitor` | `6a994238ce58c7e69293e2fa9b56331b95ca253e` |
| `codex/github-audit-handoff-20260907` | `7bc5540e844f715a04d4caa04ddadd949be5ebd0` |
| `codex/release-ads-review-20260913` | `6737ac280a56a9050f14e8eae68d5db1224eaf37` |
| `codex/release-data-20260913` | `35b4502a1bc01c75c741274816ca96640ca85f55` |
| `codex/release-web-api-20260913` | `5fc3b585cd9cce794d836102d9c17772a8691b9d` |
| `codex/repository-cleanup-20260910` | `2919642fb95faede609060a6c11f6651d359972e` |
| `codex/sync-kakao-p0-handoff` | `9469c62ec00f47aa9c79fea91eb1514cbb903321` |
| `codex/wedding-public-data-pipeline` | `8218ac0a696983fd0a2c6c283b4e88a086430a55` |
| `copilot/analyze-code-and-identify-issues` | `9f79046c977b4ea1df070364aae975bfea57a9bb` |
| `deploy_no_6341` | `1f74843971a6d18f9f64f6b0df4a8cfbacd2fd18` |
| `design/home-screen` | `14e4b1e5cbcb1ecdcceda074e7fbd8f56cce3aa6` |
| `design/pick-screen` | `607706e2b6b1051a5f156254b8459da4624fa090` |
| `design/search-vendor` | `7d3cb4029519296cbd0b305f41623b0d7369f3ba` |
| `design/search-vendor-clean` | `460b1bb8e0698a955ec713c073541dc6aa78b773` |
| `design/wedding-my` | `c44c92abda058ffcf843f3d51b621d8c49b9535a` |
| `docs/consolidate-policy-main` | `aa6801d213b38b477911bf77530b3c80af613cd4` |
| `docs/hybrid-web-policy` | `4024951af30f0204439bcca3f43088772b1e075e` |
| `docs/hybrid-web-qa-checklist` | `dab045be30059666ba071b4b501351533b9dec5e` |
| `docs/session-handoff-staging-green` | `ec0b7768c2bd8965a4166846686692aa59fb9cb6` |
| `fe/copy-gate-reads-glossary` | `e97df59cfb22701df00687f80ac0d78b507855a3` |
| `fe/docs-report-path-and-g13-price-line` | `4ae2109071bbdf0c47d659c447d3101358425127` |
| `fe/web-price-line-sweep` | `a13241ea469a9b2c70e30f35e552b3eee281332e` |
| `feat/auth-v3.11` | `b9946c82983f71fad2baafc0eb55fefbc77c377b` |
| `feat/email-login` | `35208b056f0a2f17545c26494f6bb06fd0f8546b` |
| `feat/landing-fixed-vendors` | `d5fee8c95400a6594dff8244a3d1c46fa3cca92c` |
| `feat/login-other-page` | `2d83237c8c60f07b6b973dfe3d9a9b32b0679689` |
| `feat/render-env-automation` | `64febb4aaca191bcadb7585189aac3ad07b85f3b` |
| `fix/canonical-pick-mark` | `ec0fa7e9e5552044e9359b3c0e5c5db4559b5ec5` |
| `fix/kakao-authorization-code-flow` | `5244ead66e2aa71cd869bb6d4bcf8196e95beb95` |
| `fix/legal-responsive-review` | `ea2a28db1e8f36cf196775c670ac9be955c80005` |
| `fix/lint-set-state-in-effect` | `d4fd2a7023502ce3f3b92d31c8fb45c09a54194b` |
| `fix/oauth-web-redirect` | `f3ef9d76d13a74fea6af1eff998c6e9ade37ac74` |
| `fix/public-data-workflow-secrets-if` | `00988235dce84c75b13f89ee111a77036aa09ba2` |
| `fix/render-blueprint-sync-nonblocking` | `5635a17456375849f1e2e15b09ac327b7d248032` |
| `fix/render-sync-inputs-context` | `eca08d4eed63acf570839215cc9a539e581c9b42` |
| `fix/stale-policy-status-tests` | `553a79e92b0d27891b4aab9f8519bc61eef518b6` |
| `fix/vendor-category-and-login-visuals` | `1185de342f0f1f165c444edec50fd0e5568ac9ef` |
| `fix/web-autofill-input` | `68b679915a45659eb65cef82911d7a48e2e5a773` |
| `flyio-new-files` | `71b271754d89afcd56b8f0f456586e18a6c383c0` |
| `home/fe-expo-screens` | `6d3afb1c9bd770fb1c894d8403a6c5fae7400a6b` |
| `home/fe-p0-gaps` | `8a8ba871cfe1de570a779391cebcc8d87da8b5d9` |
| `hybrid/guest-removal` | `3990446d3620436766c6547edbe482633c0e5b35` |
| `hybrid/qa-home-entry-shared` | `6f4a92ed84f28c6f6ceff87448c085508314d83c` |
| `hybrid/qa-my-events` | `8e0ea0bae5601041c3e98b4f964667268f34ec3c` |
| `hybrid/qa-pick` | `5123f258013920b186596ba42155ffc6a64f60ed` |
| `hybrid/qa-search-vendor` | `1e52bef63cd40759508d8edf296d578e54b4b94e` |
| `hybrid/shell-poc` | `033e072b39a60054a170d48864b5bba98453c684` |
| `hybrid/wedding-followups` | `6baad508600583aaa304ac7631f1e0efeebeeeb4` |
| `release/block-system-alert-window` | `79341cddd58b3576ba9621d653ad9fd80a2e6278` |
| `release/drop-unused-android-permissions` | `8f436aefe4d9fc13f2927feaf1a4b6433e2c2e61` |
| `release/enable-google-play-submit` | `fee8f019213108c7f1e39bdf119e11ef54817516` |
| `release/play-first-release-checklist` | `6f73f50e0e0aab674bb60007d817a9da748c3a40` |
| `release/public-data-apply-in-chunks` | `2ecd91d343113477516d9c764e036d2f310e1fb1` |
