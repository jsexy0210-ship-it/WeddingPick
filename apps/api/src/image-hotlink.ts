/**
 * 핫링킹을 막는 이미지 호스트.
 *
 * 어떤 CDN은 Referer가 자기네 도메인이 아니면 이미지를 안 준다(403). 그런 주소를
 * 우리 응답에 담으면 화면은 그것을 `<img src>`로 걸고, 브라우저는 요청을 보내고,
 * 콘솔에 403이 쌓인다. 화면의 onError fallback으로는 이것을 못 막는다 — onError는
 * 요청이 **실패한 뒤에** 도는 것이라 요청 자체는 이미 나갔다.
 *
 * 그래서 서버가 애초에 안 내려보낸다. 여기가 그 판단이 사는 유일한 곳이다.
 *
 * 목록에 넣는 기준은 «실제로 403을 확인했는가»다. 막을 것 같다는 짐작으로 넣지
 * 않는다 — 잘못 넣으면 멀쩡히 뜨던 이미지가 조용히 사라지고, 사라진 이유를
 * 아무도 못 찾는다. 넣을 때는 왜 막혔는지 한 줄을 같이 남긴다.
 */
export const HOTLINK_BLOCKED_IMAGE_HOSTS: readonly { readonly suffix: string; readonly reason: string }[] = [
  {
    suffix: 'pstatic.net',
    reason:
      '네이버 이미지 CDN(postfiles·blogfiles·search 등 서브도메인 전부). Referer가 네이버가 아니면 403. 2026-09-14 운영 화면 콘솔에서 확인.',
  },
];

/** 정규식에서 뜻을 갖는 글자를 막는다. 호스트에 실제로 나올 수 있는 것은 `.` 정도다. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const BLOCKED_HOST_ALTERNATION = HOTLINK_BLOCKED_IMAGE_HOSTS.map((host) => escapeRegex(host.suffix)).join('|');

/**
 * 이 URL이 핫링킹 차단 호스트인가.
 *
 * 서브도메인까지 본다 — `postfiles.pstatic.net`도 `pstatic.net`이다. 다만 `.`을
 * 경계로 삼는다. `evilpstatic.net`은 `pstatic.net`이 아니다.
 */
export function isHotlinkBlockedImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  return HOTLINK_BLOCKED_IMAGE_HOSTS.some(
    ({ suffix }) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

/**
 * 화면에 걸어도 되는 외부 이미지 주소인가.
 *
 * http(s)가 아니면 브라우저가 못 읽고, 차단 호스트면 403이 난다. 둘 다 «요청을
 * 보내봐야 실패하는» 주소라 내려보내지 않는다.
 */
export function isDisplayableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  return !isHotlinkBlockedImageUrl(url);
}

/**
 * 같은 판단의 SQL 판. 컬럼 이름을 넣으면 조건식을 돌려준다.
 *
 * 왜 SQL에도 필요한가 — 업체에 이미지가 여럿일 때, 고를 때부터 걸러야 «차단된
 * 이미지가 대표라서 멀쩡한 두 번째 이미지까지 못 보는» 일이 없다. 읽어온 뒤에
 * 버리면 그 업체는 이미지가 있는데도 빈칸이 된다.
 *
 * 호스트 목록은 코드 상수라 값이 밖에서 들어올 여지가 없다.
 */
export function displayableImageUrlSql(column: string): string {
  return (
    `${column} ~* '^https?://'` +
    ` AND ${column} !~* '^https?://([^/?#@]*@)?([^/?#:]*\\.)?(${BLOCKED_HOST_ALTERNATION})([:/?#]|$)'`
  );
}
