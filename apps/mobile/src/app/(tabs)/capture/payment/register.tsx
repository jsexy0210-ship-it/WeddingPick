import {
  PAYMENT_PROOF_RETENTION_HOURS,
  PAYMENT_PROOF_FIELD_LABEL,
  manwon,
  withObject,
  type PaymentProofField,
} from '@weddingpick/domain';
import type { RegisterPaymentProofResponse } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { registerPaymentProof } from '@/api/client';
import {
  PermissionDeniedError,
  createPage,
  photoPermissionState,
  pickFromLibrary,
  type PhotoPermissionState,
} from '@/features/capture/pickers';
import { PermissionSheet } from '@/features/permissions/permission-sheet';
import type { CapturedPage } from '@/features/capture/types';
import { uploadPaymentProof } from '@/features/capture/upload';
import {
  Layout,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';
import strings from '../../../../../../../spec/strings.ko.json';
import {
  CheckBox,
  Dock,
  DockButton,
  Hero,
  InfoCard,
  ListRow,
  NavBar,
  Screen,
  Section,
} from '@/features/wedding/screen-kit';

/**
 * 문구는 `spec/strings.ko.json` `report.*`에서 온다 — 시안 11-report-review #12a · #12c.
 *
 * 줄바꿈(`\n`)은 시안이 정한 자리라 그대로 둔다. 완료 화면 문구는 아직 키가 없어
 * 여기 적고, 키가 생기면 이 자리도 옮긴다.
 */
const R = strings.report;

const S = {
  nav: R.title,
  pickTitle: R['upload.hero'],
  pickSub: R['upload.sub'],
  shoot: R['upload.camera'],
  album: R['upload.gallery'],
  remove: '고른 사진 빼기',
  hint1: R['upload.note1'],
  hint2: R['upload.note2'],
  hint3: R['upload.note3'],
  /** 사진 한 장이 전부다(v3.24). 시안의 «{n}장으로 계속하기»에서 n은 늘 1이다. */
  submit: R['upload.cta'].replace('{n}', '1'),
  sending: '보내는 중…',
  doneTitle: '제보 접수됐어요',
  doneSub: '확인이 끝나면 알려드려요',
  doneNext: '다음',
  doneNextValue: '확인이 끝나면 알림으로 알려드려요',
  doneSpend: '내 지출',
  doneOriginal: '원본',
  doneOriginalValue: `올려주신 자료는 ${PAYMENT_PROOF_RETENTION_HOURS}시간 뒤 삭제돼요`,
  doneChecking: R['state.checking'],
  doneCta: '확인',
} as const;

/** 2열 격자 타일 — (390−48−11)/2 = 165.5 → 시안 166. */
const TILE_GAP = Layout.gap2col;

/** 검수를 기다리는 칸을 한 줄로. 값을 지어내지 않고 무엇을 보고 있는지만 말한다. */
function checkingValue(fields: PaymentProofField[]): string {
  if (fields.length === 0) return '올려주신 자료를 확인하고 있어요';

  // 조사는 앞 글자 받침으로 갈린다. «금액을» · «낸 날를»이 되지 않게 도메인이 고른다.
  const names = fields.map((field) => PAYMENT_PROOF_FIELD_LABEL[field]).join(' · ');

  return `${withObject(names)} 확인하고 있어요`;
}

/**
 * Pick 인증 — 자료 선택(WP-RPT-002) → 제출 완료(WP-RPT-007).
 * 핸드오프 11-report-review #12a · #12c · CHANGELOG v3.24.
 *
 *   선택   hero · 2열 격자(촬영하기 · 앨범에서 고르기 · 고른 사진) · 안내 3줄 체크 · dock «1장으로 계속하기»
 *   완료   체크 원 72 · «제보 접수됐어요» · 카드(다음 · 내 지출 또는 확인 중 · 원본) · dock «확인»
 *
 * **사용자 행동은 사진 한 장, 끝이다**(v3.24). 확인 화면(WP-RPT-004) · 업체 확인
 * (WP-RPT-005) · 분할 묶기(WP-RPT-006) · 증빙 없는 수동 입력(WP-RPT-010)이 전부
 * 폐기됐다. 금액·업체·날짜를 적을 칸이 이 화면에 없고, 보낼 자리도 계약에 없다 —
 * 읽는 것은 서버가 하고, 못 읽으면 접수는 성립하되 검수를 기다린다.
 *
 * **재입력 경로는 다시 찍기/올리기뿐이다.** 읽지 못한 값을 사용자가 고쳐 넣는 길을
 * 두면 그 값에는 증빙이 없고, 증빙 없는 금액은 금액 구간에 들어갈 수 없다.
 */
export default function RegisterPaymentProofScreen() {
  const theme = useTheme();
  /** 촬영 화면이 찍은 사진을 이 파라미터로 되돌려준다(`/capture/camera?purpose=payment`). */
  const shot = useLocalSearchParams<{ photoUri?: string; photoMime?: string }>();

  const [picture, setPicture] = useState<CapturedPage | null>(() =>
    shot.photoUri ? createPage('camera', { uri: shot.photoUri, mimeType: shot.photoMime ?? 'image/jpeg' }) : null
  );
  /** 사진 권한 설명 시트(WP-SHT-016). null이면 닫혀 있다. */
  const [permission, setPermission] = useState<Exclude<PhotoPermissionState, 'granted'> | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RegisterPaymentProofResponse | null>(null);

  /*
   * 앨범을 열기 전에 왜 사진이 필요한지 먼저 말한다(WP-SHT-016). 이미 허용돼 있으면
   * 설명 없이 바로 연다 — 허락한 사람에게 같은 설명을 다시 읽히지 않는다.
   */
  async function openAlbum() {
    if (sending) return;

    const state = await photoPermissionState().catch<PhotoPermissionState>(() => 'ask');

    if (state === 'granted') void chooseFromLibrary();
    else setPermission(state);
  }

  async function chooseFromLibrary() {
    if (sending) return;
    setError(null);

    try {
      const pages = await pickFromLibrary();

      if (pages.length > 0) setPicture(pages[0] ?? null);
    } catch (caught) {
      setError(
        caught instanceof PermissionDeniedError || caught instanceof Error
          ? caught.message
          : '사진을 불러오지 못했어요. 다시 골라주세요.'
      );
    }
  }

  /**
   * 사진 한 장을 올리고 그대로 접수한다.
   *
   * 올리기와 접수를 한 번에 묶는다. 갈라두면 올라간 원본만 남고 제보는 없는 상태가
   * 생기고, 그 원본은 무엇에 쓰려던 것인지 아무도 모른 채 24시간을 기다린다.
   */
  async function submit() {
    if (!picture || sending) return;
    setSending(true);
    setError(null);

    try {
      const rawDocumentId = await uploadPaymentProof([picture]);

      setDone(await registerPaymentProof({ rawDocumentId }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '보내지 못했어요. 다시 시도해주세요.');
    } finally {
      setSending(false);
    }
  }

  /* ---------------------------------------------------------- 제출 완료 · WP-RPT-007 */
  if (done) {
    const held = done.status === 'pending_review';

    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.doneHero}>
            <View style={[styles.ring, { backgroundColor: theme.tint }]}>
              <ProductSymbol name="check" size={36} color={theme.onTint} />
            </View>
            <View style={styles.doneText}>
              <ThemedText type="t2">{S.doneTitle}</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                {done.reviewNote ?? done.unmatchedNote ?? S.doneSub}
              </ThemedText>
            </View>
          </View>
          <View style={styles.cards}>
            <InfoCard label={S.doneNext} value={S.doneNextValue} />
            {/*
              읽은 금액이 있을 때만 지출에 더해졌다고 말한다. 검수를 기다리는 제보는
              아직 어느 지출에도 들어가지 않았고(0150), 「더해졌어요」는 거짓이 된다.
            */}
            {held || done.paidAmount === null ? (
              <InfoCard label={S.doneChecking} value={checkingValue(done.pendingFields)} />
            ) : (
              <InfoCard label={S.doneSpend} value={`준비 현황 지출에 ${manwon(done.paidAmount)}이 더해졌어요`} />
            )}
            <InfoCard label={S.doneOriginal} value={S.doneOriginalValue} />
          </View>
        </ScrollView>
        <Dock>
          <DockButton variant="primary" label={S.doneCta} onPress={() => router.replace('/wedding' as never)} />
        </Dock>
      </Screen>
    );
  }

  /* ---------------------------------------------------------- 자료 선택 · WP-RPT-002 */
  return (
    <Screen>
      <NavBar title={S.nav} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero title={S.pickTitle} sub={S.pickSub} />

        {/* 2열 격자 — 촬영 · 앨범 · 고른 사진. 시안 11-report-review #12a. */}
        <View style={styles.grid}>
          <Tile label={S.shoot} disabled={sending} onPress={() => router.push('/capture/camera?purpose=payment')} />
          <Tile label={S.album} disabled={sending} onPress={() => void openAlbum()} />
          {picture ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={S.remove}
              disabled={sending}
              onPress={() => setPicture(null)}
              style={({ pressed }) => [styles.pickedTile, (pressed || sending) && styles.pressed]}>
              <Image source={{ uri: picture.uri }} style={styles.picked} accessibilityLabel="고른 자료" />
              <View style={[styles.removeDot, { backgroundColor: theme.text }]}>
                <ProductSymbol name="close" size={12} color={theme.onTint} />
              </View>
            </Pressable>
          ) : null}
        </View>

        <Section>
          {[S.hint1, S.hint2, S.hint3].map((line) => (
            <ListRow key={line} left={<CheckBox checked />} title={line} titleLines={2} divider={false} />
          ))}
        </Section>

        {error ? (
          <ThemedText type="t7" themeColor="negative" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>

      <Dock>
        <DockButton
          variant="primary"
          label={sending ? S.sending : S.submit}
          disabled={picture === null || sending}
          onPress={() => void submit()}
        />
      </Dock>

      {/* 권한 요청 설명 · WP-SHT-016. 기기 창을 띄우기 전에 왜 필요한지 먼저 말한다. */}
      <PermissionSheet
        visible={permission !== null}
        purpose="photo"
        blocked={permission === 'blocked'}
        onAllow={() => {
          setPermission(null);
          void chooseFromLibrary();
        }}
        onLater={() => setPermission(null)}
      />
    </Screen>
  );
}

/** 2열 격자 타일 166 — 테두리 1 · radius 10 · 라벨 14/19 700. */
function Tile({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { borderColor: theme.track, backgroundColor: theme.background },
        (pressed || disabled) && styles.pressed,
      ]}>
      <ThemedText type="t7" themeColor="textSecondary" style={styles.bold}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const TILE_SIDE = (390 - Layout.gutter * 2 - TILE_GAP) / 2;

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  /* 2열 격자 — padding 0 24 · gap 11 · 타일 166. */
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP, paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four },
  tile: {
    width: TILE_SIDE,
    aspectRatio: 1,
    borderRadius: Radius.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  /* 고른 사진 타일 — 시안의 «선택된 사진» 자리. 오른쪽 위 × 24로 뺀다. */
  pickedTile: { width: TILE_SIDE, aspectRatio: 1, borderRadius: Radius.medium, overflow: 'hidden' },
  picked: { width: '100%', height: '100%' },
  removeDot: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: Layout.iconInline + Spacing.one + Spacing.half,
    height: Layout.iconInline + Spacing.one + Spacing.half,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.three },
  /* 제출 완료 — component.doneHero «padding:64px 24px 40px · gap 24 · 원 72»(11-report-review). */
  doneHero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.doneHeroPaddingTop,
    paddingBottom: Layout.doneHeroPaddingBottom,
    gap: Spacing.four,
    alignItems: 'center',
  },
  ring: {
    width: Layout.doneHeroRing,
    height: Layout.doneHeroRing,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { gap: Spacing.two, alignItems: 'center' },
  cards: { paddingHorizontal: Layout.gutter, gap: Layout.rowPaddingY },
  bold: { fontWeight: 700 },
  pressed: { opacity: 0.7 },
});
