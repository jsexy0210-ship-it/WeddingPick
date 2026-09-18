# Legal API live verification — 2026-09-18

This status-only file triggers the read-only public legal API probe after the KakaoCloud API catch-up deployment succeeds.

- targets: `/v1/legal/terms`, `/v1/legal/privacy`
- expected: HTTP 200 with published version/effective date/sections
- no database writes
- no production configuration writes
