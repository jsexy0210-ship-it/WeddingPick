import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * 옛 라운지 주소 `/community`(`?tab=review|feed|expo`)를 보존한다.
 *
 * 정본 my.jsx frame-008 · 010 · 012는 세그먼트 없는 하위 화면 셋이라 주소도 셋으로
 * 갈랐다(`/community/review` · `/community/feed` · `/community/expo`). 저장된 링크와
 * 공유 주소는 여기서 해당 화면으로 넘긴다. `tab`이 없거나 모르는 값이면 리얼후기다.
 */
export default function LegacyLoungeRedirect() {
  const params = useLocalSearchParams<{
    tab?: string | string[];
    from?: string | string[];
    write?: string | string[];
    vendorId?: string | string[];
  }>();
  const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
  const tab = first(params.tab);
  const kind = tab === 'feed' || tab === 'expo' ? tab : 'review';
  const carried: [string, string | undefined][] = [['from', first(params.from)]];
  if (kind === 'review') {
    carried.push(['write', first(params.write)], ['vendorId', first(params.vendorId)]);
  }
  const search = carried
    .filter((pair): pair is [string, string] => Boolean(pair[1]))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return <Redirect href={`/community/${kind}${search ? `?${search}` : ''}` as never} />;
}
