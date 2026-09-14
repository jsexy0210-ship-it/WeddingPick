/**
 * 업체 사진을 화면에 내보내도 되는 조건.
 *
 * 검증 두 가지는 **서로 다른 것을 묻는다**(migrations/0050_vendor_images.sql).
 *
 *   copyright_basis    이 그림을 써도 되는가
 *   match_confidence   이 그림이 **정말 그 업체 것인가**
 *
 * 지금까지 화면 질의는 앞의 것만 봤다(`copyright_basis <> 'unknown'`). 그래서 운영에
 * 들어 있는 720장이 안 나가고 있었는데, 그것은 **우연이었다** — 저작권 값만 배치로
 * 바꾸면 그대로 나간다. 그 720장은 업체 이름 없이 「서울 웨딩홀」 같은 업종 검색 결과를
 * 업체마다 세 장씩 잘라 붙인 것이고, `match_confidence`가 전부 0으로 그 사실을 정확히
 * 적어두고 있다(2026-09-10 실측). 남의 사진을 그 업체 사진으로 보여주는 일은
 * 저작권보다 먼저 막아야 한다.
 *
 * 그래서 조건을 한 곳에 모으고 매칭도 함께 본다.
 */

/**
 * 이 값 미만이면 화면에 내보내지 않는다.
 *
 * 0을 막는 것이 목적이라 문턱은 0보다 크기만 하면 된다. 0.5로 잡은 이유는 「이름만
 * 같아서 찾은 것」과 「업체가 직접 준 것(1.0)」 사이에 선을 긋기 위해서다 — 이름만
 * 일치하는 검색 결과는 0050 주석이 「낮은 값을 받는다」고 정한 쪽이다.
 */
export const MIN_IMAGE_MATCH_CONFIDENCE = 0.5;

/**
 * 검수 모드 — 판정 전 사진을 **운영자에게만** 내보낸다.
 *
 * 2026-09-11 대표 지시 「일단 이미지 넣어 보고 판단한다」. 720장이 위 두 조건에
 * 걸려 한 장도 안 나가는 상태라, 화면이 사진 있는 모습으로 어떻게 보이는지 볼
 * 자리가 없었다.
 *
 * **값을 바꿔서 여는 것이 아니다.** `copyright_basis`를 배치로 고치면 판정했다는
 * 기록만 남고 판정은 없던 일이 되며, 되돌릴 근거도 사라진다. 여기서는 값을 그대로
 * 두고 **누가 보느냐로** 가른다 — 운영자로 로그인한 사람에게만 열리고, 로그인하지
 * 않은 사람과 일반 회원에게는 지금과 똑같이 한 장도 안 나간다.
 *
 * **폐기로 넘긴 것은 검수 모드에서도 막는다.** 사람이 이미 보고 내린 판정이라,
 * 다시 꺼내 보는 것이 이 모드의 목적이 아니다.
 *
 * 막을 것을 세지 않고 **낼 것을 센다.** `image_status`의 폐기 상태는 하나가 아니라
 * 넷이고(`rights_rejected` · `match_rejected` · `quality_rejected` · `crop_failed`,
 * 0050), 앞으로 더 늘 수 있다. 「폐기가 아닌 것」으로 적으면 새 폐기 상태가 생기는
 * 날 그것이 조용히 화면으로 샌다 — 아무도 이 파일을 고칠 생각을 못 한 채로.
 */
export const PREVIEWABLE_IMAGE_STATUSES = ['pending', 'approved'] as const;
export type ImageConditionOptions = {
  /** 참이면 저작권·매칭 판정을 미룬 채 본다. 운영자 조회에서만 참이 된다. */
  preview?: boolean;
};

/** 화면에 내보낼 사진을 고르는 SQL 조건. 질의마다 다시 적지 않는다 — 한 곳만 고치면 된다. */
export function displayableImageCondition(
  alias: string,
  options: ImageConditionOptions = {}
): string {
  if (options.preview) {
    const allowed = PREVIEWABLE_IMAGE_STATUSES.map((status) => `'${status}'`).join(', ');

    return `${alias}.status IN (${allowed})`;
  }

  return `${alias}.status = 'approved'
     AND ${alias}.copyright_basis <> 'unknown'
     AND ${alias}.match_confidence >= ${MIN_IMAGE_MATCH_CONFIDENCE}`;
}

/** 같은 판정을 값으로 한다. 서버 밖(관리자 화면·테스트)에서 쓴다. */
export function isDisplayableImage(
  image: {
    status: string;
    copyrightBasis: string;
    matchConfidence: number | null;
  },
  options: ImageConditionOptions = {}
): boolean {
  if (options.preview) {
    return (PREVIEWABLE_IMAGE_STATUSES as readonly string[]).includes(image.status);
  }

  return (
    image.status === 'approved' &&
    image.copyrightBasis !== 'unknown' &&
    (image.matchConfidence ?? 0) >= MIN_IMAGE_MATCH_CONFIDENCE
  );
}

/**
 * 핫링킹을 막는 이미지 호스트.
 *
 * 위의 두 조건과 **다른 것을 묻는다**. 저작권과 매칭은 「이 사진을 써도 되는가」를
 * 묻고, 이것은 「그 주소가 뜨기는 하는가」를 묻는다. 써도 되는 사진이어도 주소가
 * 안 열리면 화면에는 깨진 그림만 남는다.
 *
 * 어떤 CDN은 Referer가 자기네 도메인이 아니면 이미지를 안 준다(403). 그런 주소를
 * 응답에 담으면 화면은 그것을 `<img src>`로 걸고, 브라우저는 요청을 보내고, 콘솔에
 * 403이 쌓인다. 화면의 onError fallback으로는 못 막는다 — onError는 요청이
 * **실패한 뒤에** 도는 것이라 요청 자체는 이미 나갔다. 그래서 서버가 애초에 안
 * 내려보낸다.
 *
 * 목록에 넣는 기준은 「실제로 403을 확인했는가」다. 막을 것 같다는 짐작으로 넣지
 * 않는다 — 잘못 넣으면 멀쩡히 뜨던 사진이 조용히 사라지고, 사라진 이유를 아무도
 * 못 찾는다. 넣을 때는 왜 막혔는지 한 줄을 같이 남긴다.
 */
export const HOTLINK_BLOCKED_IMAGE_HOSTS: readonly {
  readonly suffix: string;
  readonly reason: string;
}[] = [
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

const BLOCKED_HOST_ALTERNATION = HOTLINK_BLOCKED_IMAGE_HOSTS.map((host) =>
  escapeRegex(host.suffix)
).join('|');

/**
 * 주소에서 호스트만 떼어낸다. http(s)가 아니거나 모양이 아니면 `null`이다.
 *
 * `URL`을 쓰지 않는다 — 이 묶음은 서버와 앱이 같이 쓰는 곳이라 브라우저·Node의
 * 전역에 기대지 않는다. 그리고 여기서 쓰는 잘라내기 규칙이 아래 SQL 정규식과
 * 같은 모양이어야, 두 곳의 판정이 어긋나지 않는다.
 */
const IMAGE_URL_HOST = /^https?:\/\/(?:[^/?#@]*@)?([^/?#:]*)/i;

function imageUrlHost(url: string): string | null {
  const matched = IMAGE_URL_HOST.exec(url);
  const host = matched?.[1]?.toLowerCase();

  return host ? host : null;
}

/**
 * 이 주소가 핫링킹 차단 호스트인가.
 *
 * 서브도메인까지 본다 — `postfiles.pstatic.net`도 `pstatic.net`이다. 다만 `.`을
 * 경계로 삼는다. `evilpstatic.net`은 `pstatic.net`이 아니다.
 */
export function isHotlinkBlockedImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  const host = imageUrlHost(url);

  if (host === null) return false;

  return HOTLINK_BLOCKED_IMAGE_HOSTS.some(
    ({ suffix }) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

/**
 * 화면에 걸어도 되는 외부 이미지 주소인가.
 *
 * http(s)가 아니면 브라우저가 못 읽고, 차단 호스트면 403이 난다. 둘 다 「요청을
 * 보내봐야 실패하는」 주소라 내려보내지 않는다.
 */
export function isDisplayableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (imageUrlHost(url) === null) return false;

  return !isHotlinkBlockedImageUrl(url);
}

/**
 * 차단 호스트를 가리키는 주소인가 — SQL 판.
 *
 * 이미 들어와 있는 것을 **세는 데** 쓴다(`scripts/db-inventory.ts`). 못 뜨는 주소
 * 전체가 아니라 「핫링킹 때문에 못 뜨는 것」만 따로 세야, 지울지 표시만 할지를
 * 숫자를 보고 정할 수 있다.
 *
 * 호스트 목록은 코드 상수라 값이 밖에서 들어올 여지가 없다.
 */
export function hotlinkBlockedUrlCondition(column: string): string {
  return `${column} ~* '^https?://([^/?#@]*@)?([^/?#:]*\\.)?(${BLOCKED_HOST_ALTERNATION})([:/?#]|$)'`;
}

/**
 * 화면에 걸어도 되는 주소인가 — SQL 판. NULL도 함께 걸러진다.
 *
 * 왜 SQL에도 필요한가 — 업체에 사진이 여럿일 때 **고를 때부터** 걸러야 「차단된
 * 사진이 대표라서 멀쩡한 두 번째 사진까지 못 보는」 일이 없다. 읽어온 뒤에 버리면
 * 그 업체는 사진이 있는데도 빈칸이 된다.
 *
 * `displayableImageCondition`과 합치지 않는다. 저장소에 원본을 받아둔 사진
 * (`storage_key`)은 원본 주소가 차단 호스트여도 우리 주소로 잘 뜨기 때문이다.
 * 합쳐두면 그런 사진까지 같이 막힌다.
 */
export function displayableImageUrlCondition(column: string): string {
  return (
    /* 앞은 `imageUrlHost`와 같은 잘라내기다 — 호스트가 비면 뜰 수 없는 주소다. */
    `${column} ~* '^https?://([^/?#@]*@)?[^/?#:@]'` +
    ` AND NOT (${hotlinkBlockedUrlCondition(column)})`
  );
}
