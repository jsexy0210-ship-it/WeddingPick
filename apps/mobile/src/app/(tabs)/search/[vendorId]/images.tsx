import type { VendorPhoto } from '@weddingpick/api-contract';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listVendorPhotos } from '@/api/client';
import { DepthHeader } from '@/components/depth-header';
import { formatDateDot } from '@/features/common/format-date';
import { useDepthBack } from '@/features/navigation/depth-back';
import {
  Colors,
  EmptyView,
  ErrorView,
  Layout,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

/**
 * WP-VEND-006 업체 이미지 전체보기. 업체 상세의 대표 이미지를 누르면 **바로 이 화면이
 * 열린다**(v3.29 대메뉴_검색.dc.html WP-VEND-006 — 「대표 이미지를 누르면 열립니다」).
 * 카드 목록을 한 단계 더 거치지 않는다 — `depth-back-rules.ts`도 「전체보기 → 업체 상세」
 * 한 칸으로 못박아 뒀다.
 *
 * 헤더는 공통 풀팝업 규격이다 — 56px · 좌측 36px 회색 원형 X(16px 아이콘) · 중앙에
 * 몇 장 중 몇 번째인지만(설명·좋아요 없음) · 우측 36px 빈칸으로 중앙 정렬을 맞춘다.
 *
 * `?index=` 로 시작 위치를 받는다 — 카드마다 다른 사진에서 열었을 때 그 사진부터 보여준다.
 *
 * 핸드오프는 "업체 제공" · "제보 사진" 2탭을 그렸지만, 지금 DB에는 그 둘을 가를
 * 축이 없다 — `vendor_images`가 승인해 내려주는 것은 저작권 근거(copyright_basis)
 * 뿐이고, 그건 "누가 올렸는가"를 말하지 않는다. 없는 축으로 탭을 나누면 둘 중
 * 하나는 지어낸 값이 된다. 그래서 대표 이미지가 맨 앞에 오는 단일 목록이다 —
 * 제보 사진을 가릴 데이터원이 생기면 그때 탭을 나눈다.
 */
export default function VendorImagesScreen() {
  const depthBack = useDepthBack();
  const { vendorId, index } = useLocalSearchParams<{ vendorId: string; index?: string }>();

  const [photos, setPhotos] = useState<VendorPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listVendorPhotos(vendorId)
      .then((res) => setPhotos(res.photos))
      .catch((caught: Error) => setError(caught.message));
  }, [vendorId]);

  if (error) {
    return (
      <ErrorView
        title="사진을 불러오지 못했어요"
        message={error}
        onBack={depthBack}
      />
    );
  }

  /*
   * 로딩·빈 상태는 canon(WP-VEND-006)이 그리지 않는 방어 상태다 — 다크 고정 팝업
   * 껍데기 대신 앱 공통 테마의 `DepthHeader`(닫기 variant)를 그대로 쓴다. 사진이
   * 실제로 있을 때만 다크 뷰어(`GalleryHeader`)로 들어간다.
   */
  if (!photos) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <DepthHeader title="사진" onBack={depthBack} variant="close" />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (photos.length === 0) {
    /*
     * 진입 지점(업체 상세)이 사진 0장이면 버튼 자체를 보여주지 않는다. 그래도 직접
     * 링크로 들어온 경우를 대비해 빈 상태 안내는 둔다.
     */
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <DepthHeader title="사진" onBack={depthBack} variant="close" />
          <EmptyView scope="section" title="아직 등록된 사진이 없어요" />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const startIndex = clampIndex(Number(index ?? 0), photos.length);

  return <PhotoViewer photos={photos} initialIndex={startIndex} onClose={depthBack} />;
}

function clampIndex(value: number, length: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), length - 1);
}

/**
 * 공통 풀팝업 헤더 — 좌측 36px 회색 원형 X(16px 아이콘) · 중앙 타이틀 · 우측 36px 빈칸.
 * 갤러리는 스킨·시스템 모드와 무관하게 다크 고정이라(WP-VEND-006 배경 `#17181c`) 원형은
 * 늘 밝은 회색, 아이콘은 늘 어두운 잉크다 — 시안 `galClose`·`icoXw` 그대로.
 */
function GalleryHeader({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <View style={styles.viewerHeader}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onClose}
        style={styles.galleryClose}>
        <ProductSymbol name="close" size={Layout.iconField} color={Colors.light.text} />
      </Pressable>
      <ThemedText type="t6" numeric style={[styles.viewerIndicator, { color: Colors.dark.text }]}>
        {label}
      </ThemedText>
      <View style={styles.galleryHeaderPad} />
    </View>
  );
}

/**
 * 전체화면 뷰어. 다크 배경 고정 — 스킨·시스템 모드와 무관하게 사진에 집중하는
 * 자리다(핸드오프 WP-VEND-006). `images.tsx` 자체가 이 화면이다 — 모달로 얹지 않는다.
 */
function PhotoViewer({
  photos,
  initialIndex,
  onClose,
}: {
  photos: VendorPhoto[];
  initialIndex: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const mainScrollRef = useRef<ScrollView>(null);
  const stripScrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(initialIndex);

  const current = photos[index] ?? photos[0]!;
  const stripItemWidth = STRIP_THUMB_SIZE + Spacing.two;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    stripScrollRef.current?.scrollTo({
      x: Math.max(0, index * stripItemWidth - width / 2 + stripItemWidth / 2),
      animated: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function onMainScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex(Math.min(photos.length - 1, Math.max(0, next)));
  }

  function goTo(next: number) {
    setIndex(next);
    mainScrollRef.current?.scrollTo({ x: next * width, animated: true });
  }

  return (
    <View style={styles.viewerRoot}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <GalleryHeader label={`${index + 1} / ${photos.length}`} onClose={onClose} />

        {/* 본 이미지 — 좌우 스와이프로 넘긴다 */}
        <ScrollView
          ref={mainScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * width, y: 0 }}
          onMomentumScrollEnd={onMainScrollEnd}
          style={styles.viewerPager}>
          {photos.map((photo) => (
            <Pressable
              key={photo.id}
              accessibilityRole="button"
              accessibilityLabel="닫기"
              style={[styles.viewerPage, { width, height: height - VIEWER_CHROME_HEIGHT }]}
              onPress={onClose}>
              <Image
                source={{ uri: photo.url }}
                style={styles.viewerImage}
                resizeMode={photo.useContain ? 'contain' : 'cover'}
              />
            </Pressable>
          ))}
        </ScrollView>

        {/* 출처 + 확인일 */}
        {current.sourceNote || current.verifiedAt ? (
          <View style={styles.viewerCaption}>
            {current.sourceNote ? (
              <ThemedText type="t7" style={styles.viewerCaptionText}>
                {current.sourceNote}
              </ThemedText>
            ) : null}
            {current.verifiedAt ? (
              <ThemedText type="t7" style={styles.viewerCaptionMuted}>
                확인일 {formatDateDot(current.verifiedAt)}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {/* 썸네일 스트립 */}
        {photos.length > 1 ? (
          <ScrollView
            ref={stripScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.viewerStrip}
            contentContainerStyle={styles.viewerStripContent}>
            {photos.map((photo, i) => (
              <StripThumb
                key={photo.id}
                photo={photo}
                active={i === index}
                onPress={() => goTo(i)}
              />
            ))}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

function StripThumb({
  photo,
  active,
  onPress,
}: {
  photo: VendorPhoto;
  active: boolean;
  onPress: () => void;
}) {
  const [highlighted, setHighlighted] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="이 사진 보기"
      accessibilityState={{ selected: active }}
      onHoverIn={() => setHighlighted(true)}
      onHoverOut={() => setHighlighted(false)}
      onFocus={() => setHighlighted(true)}
      onBlur={() => setHighlighted(false)}
      onPress={onPress}
      style={[
        styles.stripThumbWrap,
        {
          borderColor: active
            ? Colors.dark.tint
            : highlighted
              ? Colors.dark.textSecondary
              : 'transparent',
        },
      ]}>
      <Image
        source={{ uri: photo.url }}
        style={styles.stripThumbImage}
        resizeMode={photo.useContain ? 'contain' : 'cover'}
      />
    </Pressable>
  );
}

// ─── 레이아웃 상수 ──────────────────────────────────────────────────────────

const STRIP_THUMB_SIZE = 52;
/** 헤더 + 캡션 + 스트립이 대략 차지하는 높이. 본 이미지 자리를 그만큼 남긴다. */
const VIEWER_CHROME_HEIGHT = 160;

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  // ── 전체화면 뷰어. 스킨·시스템 모드와 무관하게 고정 다크. ──
  viewerRoot: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundInk,
  },
  /* 시안 galNav — 56px · 좌측 36px 회색 원형 X · 중앙 타이틀 · 우측 36px 빈칸. */
  viewerHeader: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.navGap,
    paddingHorizontal: Layout.gutter,
  },
  galleryClose: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundSelected,
  },
  galleryHeaderPad: { width: 36 },
  viewerIndicator: {
    flex: 1,
    textAlign: 'center',
  },
  viewerPager: {
    flexGrow: 0,
  },
  viewerPage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerCaption: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.two,
    gap: 2,
  },
  viewerCaptionText: {
    color: Colors.dark.textSecondary,
  },
  viewerCaptionMuted: {
    color: Colors.dark.textAssistive,
  },
  viewerStrip: {
    flexGrow: 0,
    marginTop: Spacing.two,
  },
  viewerStripContent: {
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  stripThumbWrap: {
    width: STRIP_THUMB_SIZE,
    height: STRIP_THUMB_SIZE,
    borderRadius: Radius.small,
    borderWidth: 2,
    overflow: 'hidden',
  },
  stripThumbImage: {
    width: '100%',
    height: '100%',
  },
});
