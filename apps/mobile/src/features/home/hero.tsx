import type { AppBootstrapResponse, CurrentUser } from '@weddingpick/api-contract';
import { formatCount, manwon } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Border,
  Layout,
  LetterSpacing,
  LineHeight,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';

/**
 * 홈 코랄 D-day 히어로.
 *
 * 정본 `docs/design/React_Native/home.jsx` frame-012 WP-HOME-001 · frame-013
 * WP-HOME-002 · frame-014 WP-HOME-003의 `hero`(값은 `home.js` `hero*` · `dday` ·
 * `couple*` · `av1`/`av2`). 홈에서 예산은 별도 「예산현황」으로 내려갔기 때문에 이
 * 카드에는 D-day · 예식 정보 · 함께 준비하는 사람만 남긴다.
 *
 * 예식 정보 줄(`heroDate`)은 정본 세 상태를 그대로 따른다.
 * - 웨딩홀 계약 완료(001): 「2027년 1월 15일 (금) · 서울 그랜드 워커힐」 + 「계약 완료」 배지
 * - 장소 미정 · 진행 있음(003): 「2027년 1월 15일 (금) · 장소는 아직이에요」
 * - 장소 미정 · 아무것도 안 정함(002): 「예식일만 정했어요 · 장소는 아직이에요」
 */
export type HeroProps = {
  me: CurrentUser | null;
  daysLeft: number | null;
  venueName: string | null;
  /** 내 웨딩 준비 4칸이 모두 미정인가(WP-HOME-002). */
  nothingDecided?: boolean;
  budget: AppBootstrapResponse['budget'];
  bracketAnswered: boolean;
  partnerInvitePending: boolean;
  /** 이전 호출부 호환용. 최신 홈에서는 false다. */
  showBudget?: boolean;
  onPressDate: () => void;
  onPressVenue: () => void;
  onPressBudget: () => void;
  onPressPartner: () => void;
};

/* home.js `hero*` — 코랄 면 위의 흰 글자 · 흰 면은 투명도로만 단계를 준다. */
const ON_TINT_KICKER = 'rgba(255,255,255,0.55)';
const ON_TINT_DATE = 'rgba(255,255,255,0.70)';
const ON_TINT_BADGE_TEXT = 'rgba(255,255,255,0.85)';
const ON_TINT_BADGE = 'rgba(255,255,255,0.16)';
const ON_TINT_MORE = 'rgba(255,255,255,0.15)';
const ON_TINT_DECOR = 'rgba(255,255,255,0.08)';
const ON_TINT_AVATAR_BORDER = 'rgba(255,255,255,0.5)';
/* home.js `av1` · `av2` — 두 사람 아바타의 면과 글자. 스킨과 무관하게 고정이다. */
const AVATAR_ME = { background: '#f7d2c4', text: '#513b37' };
const AVATAR_PARTNER = { background: '#c9daec', text: '#31475d' };

export function Hero({
  me,
  daysLeft,
  venueName,
  nothingDecided = false,
  partnerInvitePending,
  onPressDate,
  onPressVenue,
  onPressPartner,
}: HeroProps) {
  const theme = useTheme();
  const date = me?.weddingDate ?? null;
  const partner = me?.spouseLinked ? (me.partnerDisplayName ?? '배우자') : null;
  const meName = me?.displayName ?? '우리';

  return (
    <View style={[styles.hero, { backgroundColor: theme.tint }]}>
      <View style={styles.decor} />

      <View style={[styles.top, partner === null && styles.topKickerOnly]}>
        <ThemedText type="f9" style={styles.kicker}>
          두근두근
        </ThemedText>
        {/* 정본 세 상태 중 `heroMore`는 두 사람이 함께 준비 중인 WP-HOME-001에만 있다. */}
        {partner !== null ? (
          <View style={styles.more}>
            <SeedIcon name="moreHorizRegular" size={Layout.iconSmall} color={theme.onTint} />
          </View>
        ) : null}
      </View>

      {daysLeft === null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="예식일 정하기"
          onPress={onPressDate}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="f24" themeColor="onTint" style={styles.bold}>
            예식일을 정해볼까요?
          </ThemedText>
        </Pressable>
      ) : (
        <ThemedText type="f46" numeric themeColor="onTint" style={styles.dday}>
          {daysLeft === 0 ? 'D-DAY' : `D${daysLeft > 0 ? '-' : '+'}${formatCount(Math.abs(daysLeft))}`}
        </ThemedText>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={venueName === null ? '웨딩홀 정하기' : '예식 정보'}
        onPress={venueName === null ? onPressVenue : onPressDate}
        style={({ pressed }) => [styles.ceremony, pressed && styles.pressed]}>
        <ThemedText type="f12" numberOfLines={1} style={styles.ceremonyText}>
          {ceremonyLine(date, venueName, nothingDecided)}
        </ThemedText>
        {venueName !== null && date !== null ? (
          <View style={styles.venueBadge}>
            <ThemedText type="f10" style={styles.venueBadgeText}>계약 완료</ThemedText>
          </View>
        ) : null}
      </Pressable>

      {/*
        `coupleRow`는 WP-HOME-001(함께 준비 중)에만 있고 WP-HOME-002 · 003에는 없다 — 연결 전
        「초대해보세요」 줄은 정본에 없는 진입점이라 그리지 않는다(초대는 웨딩노트 · MY에서 한다).
      */}
      {partner !== null ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="함께 준비하기"
        disabled
        onPress={onPressPartner}
        style={({ pressed }) => [styles.people, pressed && styles.pressed]}>
        <View style={styles.avatars}>
          <View style={[styles.avatar, { backgroundColor: AVATAR_ME.background }]}>
            <ThemedText type="f7" style={[styles.avatarText, { color: AVATAR_ME.text }]}>
              {meName.slice(0, 1)}
            </ThemedText>
          </View>
          <View style={[styles.avatar, styles.avatarSecond, { backgroundColor: AVATAR_PARTNER.background }]}>
            <ThemedText type="f7" style={[styles.avatarText, { color: AVATAR_PARTNER.text }]}>
              {(partner ?? '함').slice(0, 1)}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="f10" numberOfLines={1} style={styles.peopleText}>
          {`${meName} · ${partner} · 함께 준비 중`}
        </ThemedText>
      </Pressable>
      ) : null}
    </View>
  );
}

/** home.js WP-HOME-001~003 `heroDate` 문구. */
export function ceremonyLine(
  weddingDate: string | null,
  venueName: string | null,
  nothingDecided = false,
): string {
  if (weddingDate === null) return '예식일 · 예식장 미정';
  if (venueName !== null) return `${formatWeddingDate(weddingDate)} · ${venueName}`;
  if (nothingDecided) return '예식일만 정했어요 · 장소는 아직이에요';
  return `${formatWeddingDate(weddingDate)} · 장소는 아직이에요`;
}

/** 정본 히어로 날짜 표기 「2027년 1월 15일 (금)」. 저장된 달력 날짜 자체로 요일을 계산한다. */
function formatWeddingDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

export function budgetLine(
  budget: AppBootstrapResponse['budget'],
  bracketAnswered: boolean
): string {
  if (budget === null) return bracketAnswered ? '예산 금액을 정하면 여기에 보여요' : '예산을 정해볼까요?';
  const used = budget.total === 0 ? 0 : Math.round((budget.spent / budget.total) * 100);
  if (budget.remaining < 0) return `예산을 넘었어요 · ${formatCount(used)}% 사용`;
  return `남은 예산 ${manwon(budget.remaining)} · ${formatCount(used)}% 사용`;
}

export function partnerLine(me: CurrentUser | null, invitePending: boolean): string {
  if (me?.spouseLinked === true) return '함께 준비 중';
  if (invitePending) return '초대 수락을 기다리고 있어요';
  return '함께 준비할 사람을 초대해보세요';
}

/* home.js `hero` 계열 값 그대로. 주석의 이름은 정본 스타일 키다. */
const styles = StyleSheet.create({
  /* `heroWrap` 아래 24 · `hero` radius 14 · padding 18. 좌우 여백은 홈 공통 24(아래 PR 설명 참고). */
  hero: {
    marginHorizontal: Layout.gutter,
    marginBottom: 24,
    borderRadius: 14,
    padding: 18,
    overflow: 'hidden',
  },
  /* `heroBlob1` — 150 원 · 오른쪽 위 -40 · 흰색 8%. */
  decor: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: Radius.pill,
    backgroundColor: ON_TINT_DECOR,
  },
  /* `heroTop` — 아래 8. */
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  /* 「…」 단추가 없는 상태(WP-HOME-002 · 003)는 줄이 `heroKicker` 줄 높이 13뿐이다. */
  topKickerOnly: { height: 13 },
  /* `heroKicker` — 9 · 자간 .2em · 흰색 55%. 줄높이 13은 토큰이 없어 f9의 14를 쓴다. */
  kicker: { letterSpacing: LetterSpacing.p18, color: ON_TINT_KICKER },
  /* `heroMore` — 24 원 · 흰색 15% · 아이콘 흰색 14. */
  more: {
    width: Layout.heroMore,
    height: Layout.heroMore,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ON_TINT_MORE,
  },
  /* `dday` — 46/46 · 700 · 자간 -.03em. */
  dday: { fontWeight: 700, letterSpacing: LetterSpacing.n138 },
  bold: { fontWeight: 700 },
  /* `heroDate` — 위 4 · 12/17 · 흰색 70% · 배지와 6. */
  ceremony: {
    marginTop: Spacing.one,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ceremonyText: { flexShrink: 1, lineHeight: LineHeight.lh17, color: ON_TINT_DATE },
  /*
   * `heroVenueBadge` — 높이 18 · 좌우 6 · radius 4 · 흰색 16% · 글자 10/600 흰색 85%.
   * 세로는 못박지 않고 최소 높이로 둔다(badge-box.test — 줄 15 < 18이라 그림은 같다).
   */
  venueBadge: {
    minHeight: 18,
    paddingHorizontal: 6,
    borderRadius: 4,
    justifyContent: 'center',
    backgroundColor: ON_TINT_BADGE,
  },
  venueBadgeText: { fontWeight: 600, color: ON_TINT_BADGE_TEXT },
  /* `coupleRow` — 위 12 · gap 6. */
  people: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Layout.inlineGap,
  },
  avatars: {
    width: Layout.avatarMini * 2 - 4,
    height: Layout.avatarMini,
    flexDirection: 'row',
    alignItems: 'center',
  },
  /* `av1` · `av2` — 16 원 · 흰색 50% 선 1 · 글자 7/700 · 둘째는 왼쪽 -4. */
  avatar: {
    width: Layout.avatarMini,
    height: Layout.avatarMini,
    borderRadius: Radius.pill,
    borderWidth: Border.hairline,
    borderColor: ON_TINT_AVATAR_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSecond: { marginLeft: -4 },
  avatarText: { fontWeight: 700 },
  /* `coupleText` — 10/14 · 흰색 55%. */
  peopleText: { flex: 1, lineHeight: LineHeight.lh14, color: ON_TINT_KICKER },
  pressed: { opacity: 0.8 },
});
