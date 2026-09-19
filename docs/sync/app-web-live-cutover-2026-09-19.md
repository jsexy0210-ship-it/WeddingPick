# App-web live cutover · 2026-09-19

- staged static release: `cbaf5922c95aae2b3af5aeeccea2d0e61327236c`
- staging run: CI / Deploy #1056 (`35360798709`) — SUCCESS
- KakaoCloud API + worker revision: `cbaf5922c95aae2b3af5aeeccea2d0e61327236c`
- main validation after PR Validation workflow merge: CI / Deploy #1057 (`35363208954`) — SUCCESS
- requested action: cut over the newest staged app-web candidate to HTTPS 443
- API redeploy is intentionally skipped for this trigger.
- DB schema, production env, Secrets: no change requested.
