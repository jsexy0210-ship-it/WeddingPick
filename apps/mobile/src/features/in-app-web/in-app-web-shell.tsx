import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import {
  ActionButton,
  Layout,
  ProductSymbol,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';

import { FRAME_READY_TIMEOUT_MS } from './our-site';
import {
  closeInAppWeb,
  getInAppWeb,
  noticeInAppWeb,
  subscribeInAppWeb,
  type InAppWebNotice,
} from './shell-store';

/**
 * `spec/strings.ko.json` `inAppBrowser.shell*`의 확정 카피.
 *
 * 머리에 적는 이름은 부르는 쪽이 준다(`openExternal(url, { title })`) — 주소의
 * 호스트를 쓰면 `210.109.82.212`이 사용자 화면에 뜬다.
 */
const S = {
  close: '닫기',
  newWindow: '새 창에서 열려요',
  stuck: '불러오지 못했어요',
  openNewWindow: '새 창에서 열기',
} as const;

const NOTICE_TEXT: Record<InAppWebNotice, string> = { newWindow: S.newWindow };

/**
 * 웹 빌드에서 바깥 주소를 앱 «안»에 띄우는 껍데기.
 *
 * 뿌리(`app/_layout.tsx`)에 한 장만 붙는다 — 화면마다 달면 탭바나 헤더 아래에
 * 갇혀서 «앱을 덮는» 모양이 안 나온다. 상태는 `shell-store.ts`에 있다.
 *
 * 여기로 들어오는 것은 **우리 사이트뿐이다**(`our-site.ts`). 닫기는 우리가
 * 그린다 — iframe 안에는 뒤로 갈 곳도 닫을 곳도 없다.
 *
 * **네이티브에서는 아무것도 그리지 않는다.** 거기서는 `expo-web-browser`의
 * 시스템 시트가 앱 위에 뜬다(`open-external.ts`).
 */
export function InAppWebShell() {
  const { request, notice } = useSyncExternalStore(subscribeInAppWeb, getInAppWeb, getInAppWeb);
  const theme = useTheme();
  /**
   * `load`를 못 받은 주소. 참·거짓이 아니라 «어느 주소»인지를 쥔다 — 다음 주소를
   * 열 때 저절로 풀린다. 열 때마다 effect에서 되돌리면 그 한 번이 화면을 두 번
   * 그린다.
   */
  const [stuckAt, setStuckAt] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const url = request?.url ?? null;
  const stuck = url !== null && stuckAt === url;

  const clearTimer = useCallback(() => {
    if (timer.current === null) return;

    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || url === null) return;

    timer.current = setTimeout(() => setStuckAt(url), FRAME_READY_TIMEOUT_MS);

    return clearTimer;
  }, [url, clearTimer]);

  /**
   * 사람이 「새 창에서 열기」를 눌렀다. **누른 그 순간**이라 팝업 차단에 걸리지
   * 않는다 — 시계가 저 혼자 열려고 하면 막힌다.
   */
  const openInNewTab = useCallback(
    (target: string) => {
      clearTimer();
      window.open(target, '_blank', 'noopener,noreferrer');
      closeInAppWeb();
      noticeInAppWeb('newWindow');
    },
    [clearTimer]
  );

  if (Platform.OS !== 'web') return null;

  return (
    <>
      {request === null ? null : (
        <View style={[styles.overlay, { backgroundColor: theme.background }]}>
          <ThemedView style={[styles.bar, { borderBottomColor: theme.border }]}>
            <ThemedText type="t6" numberOfLines={1} style={styles.title}>
              {request.title}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={S.close}
              hitSlop={Spacing.three}
              onPress={closeInAppWeb}>
              <ProductSymbol name="close" size={Layout.iconInline} color={theme.text} />
            </Pressable>
          </ThemedView>

          {stuck ? (
            <View style={styles.stuck}>
              <ThemedText type="t6" themeColor="textSecondary" style={styles.stuckText}>
                {S.stuck}
              </ThemedText>
              <ActionButton
                variant="primary"
                label={S.openNewWindow}
                onPress={() => openInNewTab(request.url)}
              />
            </View>
          ) : (
            /*
             * `<iframe>`은 리액트 네이티브 부품이 아니라 DOM 요소다 — 위
             * `Platform.OS` 검사 덕분에 웹에서만 그려진다. 네이티브 번들에도
             * 이 줄이 실려 가지만 그려지지 않으므로 아무 일도 하지 않는다.
             */
            <iframe
              src={request.url}
              title={request.title}
              onLoad={clearTimer}
              style={FRAME_STYLE}
            />
          )}
        </View>
      )}
      <Toast
        message={notice === null ? null : NOTICE_TEXT[notice]}
        onHidden={() => noticeInAppWeb(null)}
      />
    </>
  );
}

/** DOM 요소라 스타일도 DOM 값이다 — 머리 줄 아래를 전부 채운다. */
const FRAME_STYLE = {
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 0,
  minHeight: 0,
  width: '100%',
  border: 'none',
} as const;

const styles = StyleSheet.create({
  /** 앱을 덮는다 — 껍데기 밖으로 손이 닿으면 앱을 떠난 것과 같아진다. */
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1 },
  stuck: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Layout.gutter,
  },
  stuckText: { textAlign: 'center' },
});
