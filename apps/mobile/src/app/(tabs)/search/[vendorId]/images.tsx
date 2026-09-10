import type { VendorPhoto } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
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
import { formatDateDot } from '@/features/common/format-date';
import {
  Colors,
  EmptyView,
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
  SkeletonView,
} from '@weddingpick/ui';

/**
 * WP-VEND-002 업체 이미지 전체보기. 진입은 업체 상세의 대표 이미지 탭.
 *
 * 핸드오프는 "업체 제공" · "제보 사진" 2탭을 그렸지만, 지금 DB에는 그 둘을 가를
 * 축이 없다 — `vendor_images`가 승인해 내려주는 것은 저작권 근거(copyright_basis)
 * 뿐이고, 그건 "누가 올렸는가"를 말하지 않는다. 없는 축으로 탭을 나누면 둘 중
 * 하나는 지어낸 값이 된다. 그래서 여기는 대표 이미지가 맨 앞에 오는 단일
 * 목록이다 — 제보 사진을 가릴 데이터원이 생기면 그때 탭을 나눈다.
 *
 * 이미지가 0장이면 이 화면에 올 이유가 없다 — 진입 지점(업체 상세)이 그 경우
 * 버튼 자체를 보여주지 않는다. 그래도 직접 링크로 들어온 경우를 대비해 빈
 * 상태 안내는 둔다.
 */
export default function VendorImagesScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();

  const [photos, setPhotos] = useState<VendorPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

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
        onBack={() => router.back()}
      />
    );
  }

  if (!photos) {
    return <SkeletonView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="돌아가기"
            onPress={() => router.back()}
            style={styles.backBtn}>
            <ThemedText type="t6">돌아가기</ThemedText>
          </Pressable>
          <ThemedText type="t5">사진 {photos.length}장</ThemedText>
          <View style={styles.backBtn} />
        </View>

        {photos.length === 0 ? (
          <EmptyView title="아직 등록된 사진이 없어요" />
        ) : (
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {photos.map((photo, index) => (
              <PhotoThumb
                key={photo.id}
                photo={photo}
                onPress={() => setViewerIndex(index)}
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      {viewerIndex !== null ? (
        <PhotoViewer
          photos={photos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </ThemedView>
  );
}

/** 그리드 한 칸. 마우스 hover·키보드 focus에서도 눌리는 자리라는 것을 보여준다. */
function PhotoThumb({ photo, onPress }: { photo: VendorPhoto; onPress: () => void }) {
  const theme = useTheme();
  const [highlighted, setHighlighted] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={photo.isRepresentative ? '대표 사진 크게 보기' : '사진 크게 보기'}
      onHoverIn={() => setHighlighted(true)}
      onHoverOut={() => setHighlighted(false)}
      onFocus={() => setHighlighted(true)}
      onBlur={() => setHighlighted(false)}
      onPress={onPress}
      style={[
        styles.thumbWrap,
        { borderColor: highlighted ? theme.tint : 'transparent' },
      ]}>
      <Image
        source={{ uri: photo.url }}
        style={styles.thumbImage}
        resizeMode={photo.useContain ? 'contain' : 'cover'}
      />
      {photo.isRepresentative ? (
        <View style={[styles.repBadge, { backgroundColor: theme.scrim }]}>
          <ThemedText type="badge" style={styles.repBadgeText}>
            대표
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * 전체화면 뷰어. 다크 배경 고정 — 스킨·시스템 모드와 무관하게 사진에 집중하는
 * 자리다(핸드오프 WP-VEND-002).
 *
 * 배경 스크롤을 막는다. 웹에서 Modal 뒤 body가 같이 스크롤되면 뷰어를 닫았을 때
 * 목록이 엉뚱한 위치에 가 있다.
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

  function goTo(next: number) {
    setIndex(next);
    mainScrollRef.current?.scrollTo({ x: next * width, animated: true });
  }

  function onMainScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex(Math.min(photos.length - 1, Math.max(0, next)));
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.viewerRoot}>
        {/* close nav + 페이지 인디케이터 */}
        <View style={styles.viewerHeader}>
          <CloseButton onPress={onClose} />
          {/* 시안 t18w — 뷰어 제목은 18/24 흰 700이다(09b-vendor-sub.dc.html L56·L279). */}
          <ThemedText type="t5" style={styles.viewerIndicator} numeric>
            {index + 1}/{photos.length}
          </ThemedText>
        </View>

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
      </View>
    </Modal>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const [highlighted, setHighlighted] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="닫기"
      onHoverIn={() => setHighlighted(true)}
      onHoverOut={() => setHighlighted(false)}
      onFocus={() => setHighlighted(true)}
      onBlur={() => setHighlighted(false)}
      onPress={onPress}
      style={[styles.viewerCloseBtn, highlighted && styles.viewerCloseBtnHighlighted]}>
      <ThemedText type="t6" style={styles.viewerCloseBtnText}>
        닫기
      </ThemedText>
    </Pressable>
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.two,
    minHeight: Layout.rowMinHeight,
  },
  backBtn: {
    minHeight: Layout.touchTarget,
    minWidth: Layout.touchTarget,
    justifyContent: 'center',
  },

  // ── 그리드 ──
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  thumbWrap: {
    width: `${100 / 3 - 2}%`,
    aspectRatio: 1,
    borderRadius: Radius.medium,
    borderWidth: 2,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  repBadge: {
    position: 'absolute',
    left: Spacing.one,
    top: Spacing.one,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
  },
  repBadgeText: {
    color: Colors.light.onTint,
  },

  // ── 전체화면 뷰어. 스킨·시스템 모드와 무관하게 고정 다크. ──
  viewerRoot: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundInk,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  viewerCloseBtn: {
    minHeight: Layout.touchTarget,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.backgroundSelected,
  },
  viewerCloseBtnHighlighted: {
    backgroundColor: Colors.dark.border,
  },
  viewerCloseBtnText: {
    color: Colors.dark.text,
  },
  viewerIndicator: {
    color: Colors.dark.textSecondary,
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
