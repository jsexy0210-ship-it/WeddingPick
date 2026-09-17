/**
 * 주소에서 받은 id가 UUID 꼴인가.
 *
 * **DB에 넣기 전에 본다.** PostgreSQL의 `uuid` 칸에 꼴이 안 맞는 값을 주면 `22P02`로
 * 던지고, 그것이 500이 되어 올라간다. 운영에서 실제로 났다(2026-09-17 01:49 KST) —
 * `invalid input syntax for type uuid: ""`가 `loadVendorDetail`에서 터졌다.
 *
 * **없는 업체와 꼴이 틀린 업체는 사용자에게 같은 일이다.** 둘 다 「그 업체는 없다」이고,
 * 하나는 404인데 하나는 500이면 고칠 곳을 찾는 사람이 서버가 고장 난 줄 안다. 그래서
 * 부르는 쪽에서 이 검사를 통과하지 못하면 `notFound`를 던진다.
 *
 * 같은 정규식이 저장소에 이미 넷 있다(`vendor-admin.ts` · `faq-admin.ts` ·
 * `data-pipeline-admin.ts` · `routes/admin.ts`). 그쪽은 관리자 경로라 이번에 손대지
 * 않았다 — 옮겨 붙일 때 이 파일을 쓴다.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}
