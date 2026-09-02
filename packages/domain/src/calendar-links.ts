/**
 * 외부 캘린더 등록 링크. WP-SHT-012 · WP-EXPO-005.
 *
 * **Apple 캘린더는 없다.** Google·Outlook은 URL 하나로 웹에서 바로 열리지만,
 * Apple은 `.ics` 파일을 만들어 공유 시트로 넘기는 길뿐이다. 그 길은 파일
 * 생성·임시 저장·공유 시트까지 새로 들여야 하는데, 지금 이 기능이 필요한
 * 자리(박람회 상세)는 그 정도 비용을 들일 만큼 핵심 흐름이 아니다. 없는 것을
 * 있는 척 링크만 걸어두지 않는다 — 버튼이 아예 없는 편이 눌러도 안 열리는
 * 버튼보다 낫다.
 *
 * `URL`·`URLSearchParams`를 쓰지 않는다. 이 패키지는 DOM lib 없이 컴파일된다
 * (`partner-link.ts`의 `inviteLink`가 이미 그렇게 하고 있다) — 쿼리스트링을
 * 직접 이어붙인다.
 */

type CalendarLinkInput = {
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  details?: string;
};

/** "20260912T090000Z" 꼴. 두 서비스 모두 UTC를 이 형식으로 받는다. */
function toUtcStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function query(pairs: [string, string | undefined][]): string {
  return pairs
    .filter((pair): pair is [string, string] => pair[1] !== undefined && pair[1].length > 0)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
}

export function googleCalendarLink(input: CalendarLinkInput): string {
  const q = query([
    ['action', 'TEMPLATE'],
    ['text', input.title],
    ['dates', `${toUtcStamp(input.startsAt)}/${toUtcStamp(input.endsAt)}`],
    ['location', input.location],
    ['details', input.details],
  ]);

  return `https://calendar.google.com/calendar/render?${q}`;
}

export function outlookCalendarLink(input: CalendarLinkInput): string {
  const q = query([
    ['path', '/calendar/action/compose'],
    ['rru', 'addevent'],
    ['subject', input.title],
    ['startdt', new Date(input.startsAt).toISOString()],
    ['enddt', new Date(input.endsAt).toISOString()],
    ['location', input.location],
    ['body', input.details],
  ]);

  return `https://outlook.live.com/calendar/0/deeplink/compose?${q}`;
}
