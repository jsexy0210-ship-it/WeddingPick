import type { CurrentUser, RegionWeather } from '@weddingpick/api-contract';
import { formatDday, lifecycle } from '@weddingpick/domain';
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
import { HOME_PAGE_X } from '@/features/home/home-layout';
import { WeatherIcon } from '@/features/home/weather-icon';
import { HERO_WEATHER_PALETTE, heroWeatherTone, observedHourLabel } from '@/features/home/hero-weather';
import { HeroWeatherBackground } from '@/features/home/hero-weather-motion';
import strings from '../../../../../spec/strings.ko.json';

const S = strings.home;

/**
 * 홈 코랄 D-day 히어로.
 *
 * 정본 `docs/design/React_Native/home.jsx` frame-012 WP-HOME-001 · frame-013
 * WP-HOME-002 · frame-014 WP-HOME-003의 `hero`(값은 `home.js` `hero*` · `dday` ·
 * `couple*` · `av1`/`av2`). 홈에서 예산은 별도 「예산현황」으로 내려갔기 때문에 이
 * 카드에는 D-day · 예식일 · 배우자 연결 · 날씨만 남긴다.
 *
 * 2026-09-26 대표 지시 셋이 정본 위에 얹혀 있다(정본에 없는 자리 — DESIGN_UNRESOLVED):
 * 1. 「웨딩홀 정보 삭제 / 배우자 초대 현황에 대한 정보로 대체한다」 — `heroDate`의 예식장 이름 ·
 *    「장소는 아직이에요」 · 「계약 완료」 배지를 지우고 예식일만 남긴다. 연결 현황은 정본
 *    `coupleRow`(WP-HOME-001) 모양으로 세 상태 모두 그린다: 연결됨(두 사람 이름) · 초대 보냄 ·
 *    아직 초대 안 함. 누르면 연결관리(`/wedding/partner?from=home`)로 간다.
 * 2. 「히어로 카드 영역 우측 빈 영역에 날씨 정보를 넣는다」 + 「날씨 반응형 홈 히어로」 명세 —
 *    D-day 줄 오른쪽에 아이콘 · 기온 · 「지역 · 날씨」 · 「14시 기준」(관측 시각). 값이 있으면 카드
 *    면이 날씨 팔레트(`hero-weather.ts`)로 서서히 바뀌고 비 · 맑은 낮에는 은은한 모션이 돈다
 *    (`hero-weather-motion.tsx`). 값이 없으면(키 없음 · 지역 없음 · 「그 외」 · 수집 전 · 조회
 *    실패) 날씨 자리를 그리지 않고 정본 코랄 히어로 그대로다. 코랄은 날씨 면에서 배경이 아니라
 *    날씨 아이콘 포인트로만 쓴다(명세 「버튼·아이콘의 포인트 색으로」).
 * 3. 「두근두근 영역 기존 라이프 사이클 정보로 변경한다」 — `heroKicker`는 정본 예시 「두근두근」
 *    대신 도메인 `lifecycle()`의 남은 기간별 문구(설레는 시작 · 영차영차 · 마지막 준비 …)다.
 *    6906ad2c 이전 홈 히어로가 쓰던 것 그대로이고, 20be467f가 「두근두근」 고정으로 바꿨다.
 */
export type HeroProps = {
  me: CurrentUser | null;
  daysLeft: number | null;
  partnerInvitePending: boolean;
  /** 사용자 지역 오늘 날씨. null이면 날씨 자리를 그리지 않는다. */
  weather?: RegionWeather | null;
  onPressDate: () => void;
  onPressPartner: () => void;
};

/* home.js `hero*` — 코랄 면 위의 흰 글자 · 흰 면은 투명도로만 단계를 준다. */
const ON_TINT_KICKER = 'rgba(255,255,255,0.55)';
const ON_TINT_DATE = 'rgba(255,255,255,0.70)';
const ON_TINT_MORE = 'rgba(255,255,255,0.15)';
const ON_TINT_DECOR = 'rgba(255,255,255,0.08)';
const ON_TINT_AVATAR_BORDER = 'rgba(255,255,255,0.5)';
/* home.js `av1` · `av2` — 두 사람 아바타의 면과 글자. 스킨과 무관하게 고정이다. */
const AVATAR_ME = { background: '#f7d2c4', text: '#513b37' };
const AVATAR_PARTNER = { background: '#c9daec', text: '#31475d' };

export type PartnerStatus = 'linked' | 'invited' | 'none';

export function partnerStatus(me: CurrentUser | null, invitePending: boolean): PartnerStatus {
  if (me?.spouseLinked === true) return 'linked';
  return invitePending ? 'invited' : 'none';
}

/** 연결 현황 한 줄. 연결됨은 정본 `coupleText` 「지윤 · 준혁 · 함께 준비 중」 꼴이다. */
export function partnerLine(me: CurrentUser | null, invitePending: boolean): string {
  const status = partnerStatus(me, invitePending);
  if (status === 'linked') {
    return S['hero.partnerLinked']
      .replace('{a}', me?.displayName ?? S['hero.partnerDefault'])
      .replace('{b}', me?.partnerDisplayName ?? S['hero.partnerDefault']);
  }
  return status === 'invited' ? S['hero.partnerInvited'] : S['hero.partnerNone'];
}

/** 「18°」 · 「서울 · 맑음」 · 「14시 기준」 — 마지막 줄은 관측 시각이다(예보가 아니다). */
export function weatherLines(weather: RegionWeather): { temperature: string; line: string; observed: string | null } {
  const hour = observedHourLabel(weather.observedAt);
  return {
    temperature: S['weather.temperature'].replace('{n}', String(weather.temperature)),
    line: S['weather.line']
      .replace('{region}', weather.region)
      .replace('{condition}', S[`weather.${weather.condition}`]),
    observed: hour === null ? null : S['weather.observed'].replace('{hour}', hour),
  };
}

export function Hero({
  me,
  daysLeft,
  partnerInvitePending,
  weather = null,
  onPressDate,
  onPressPartner,
}: HeroProps) {
  const theme = useTheme();
  const date = me?.weddingDate ?? null;
  const status = partnerStatus(me, partnerInvitePending);
  const meName = me?.displayName ?? '';
  const weatherText = weather === null ? null : weatherLines(weather);
  const tone = heroWeatherTone(weather);
  const palette = tone === null ? null : HERO_WEATHER_PALETTE[tone];
  /* 날씨 면이면 명세 팔레트, 아니면 정본 코랄 면의 흰 글자(`hero*`). */
  const bigText = { color: palette?.text ?? theme.onTint };
  const subText = (fallback: string) => ({ color: palette?.sub ?? fallback });

  return (
    <View style={[styles.hero, { backgroundColor: theme.tint }]}>
      {tone === null ? <View style={styles.decor} /> : <HeroWeatherBackground tone={tone} />}

      <View style={[styles.top, status !== 'linked' && styles.topKickerOnly]}>
        <ThemedText type="f9" style={[styles.kicker, subText(ON_TINT_KICKER)]}>
          {lifecycle(date).mood}
        </ThemedText>
        {/* 정본 세 상태 중 `heroMore`는 두 사람이 함께 준비 중인 WP-HOME-001에만 있다. */}
        {status === 'linked' ? (
          <View style={[styles.more, palette !== null && { backgroundColor: palette.chip }]}>
            <SeedIcon name="moreHorizRegular" size={Layout.iconSmall} color={bigText.color} />
          </View>
        ) : null}
      </View>

      <View style={styles.main}>
        <View style={styles.mainText}>
          {daysLeft === null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="예식일 정하기"
              onPress={onPressDate}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="f24" style={[styles.bold, bigText]}>
                예식일을 정해볼까요?
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText type="f46" numeric style={[styles.dday, bigText]}>
              {formatDday(daysLeft)}
            </ThemedText>
          )}

          {date !== null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="예식일"
              onPress={onPressDate}
              style={({ pressed }) => [styles.ceremony, pressed && styles.pressed]}>
              <ThemedText type="f12" numberOfLines={1} style={[styles.ceremonyText, subText(ON_TINT_DATE)]}>
                {formatWeddingDate(date)}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {weather !== null && weatherText !== null ? (
          <View
            style={styles.weather}
            accessible
            accessibilityLabel={[weatherText.line, weatherText.temperature, weatherText.observed].filter(Boolean).join(' ')}>
            <View style={styles.weatherTop}>
              <WeatherIcon
                condition={weather.condition}
                night={tone === 'clearNight'}
                size={Layout.iconRow}
                color={theme.tint}
              />
              <ThemedText type="f20" numeric style={[styles.bold, bigText]}>
                {weatherText.temperature}
              </ThemedText>
            </View>
            <ThemedText type="f10" numberOfLines={1} style={[styles.weatherLine, subText(ON_TINT_DATE)]}>
              {weatherText.line}
            </ThemedText>
            {weatherText.observed !== null ? (
              <ThemedText type="f10" numberOfLines={1} style={[styles.weatherLine, subText(ON_TINT_DATE)]}>
                {weatherText.observed}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </View>

      {/*
        배우자 연결 현황 — 정본 `coupleRow`(WP-HOME-001) 모양. 연결 전 두 상태(초대 보냄 · 아직
        초대 안 함)는 2026-09-26 대표 지시로 더한 자리라 정본 문구가 없어, 앱에 이미 있던 문구를
        쓴다(`spec/strings.ko.json` `home.hero.partner*`). 둘째 아바타는 연결됐을 때만 선다.
        로그인 전(회원 정보 없음)에는 그리지 않는다.
      */}
      {me !== null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={S['hero.partnerLabel']}
          onPress={onPressPartner}
          style={({ pressed }) => [styles.people, pressed && styles.pressed]}>
          <View style={[styles.avatars, status !== 'linked' && styles.avatarsSolo]}>
            <View style={[styles.avatar, { backgroundColor: AVATAR_ME.background }]}>
              <ThemedText type="f7" style={[styles.avatarText, { color: AVATAR_ME.text }]}>
                {meName.slice(0, 1)}
              </ThemedText>
            </View>
            {status === 'linked' ? (
              <View style={[styles.avatar, styles.avatarSecond, { backgroundColor: AVATAR_PARTNER.background }]}>
                <ThemedText type="f7" style={[styles.avatarText, { color: AVATAR_PARTNER.text }]}>
                  {(me.partnerDisplayName ?? S['hero.partnerDefault']).slice(0, 1)}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText type="f10" numberOfLines={1} style={[styles.peopleText, subText(ON_TINT_KICKER)]}>
            {partnerLine(me, partnerInvitePending)}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 정본 히어로 날짜 표기 「2027년 1월 15일 (금)」. 저장된 달력 날짜 자체로 요일을 계산한다. */
export function formatWeddingDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

/* home.js `hero` 계열 값 그대로. 주석의 이름은 정본 스타일 키다. */
const styles = StyleSheet.create({
  /* `heroWrap` 좌우 20 · 아래 24 · `hero` radius 14 · padding 18. 좌우는 홈 전용 여백(home-layout). */
  hero: {
    marginHorizontal: HOME_PAGE_X,
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
  /* D-day · 예식일(왼쪽)과 날씨(오른쪽 빈 자리). 날씨가 없으면 왼쪽이 전부다. */
  main: { flexDirection: 'row', alignItems: 'center', gap: Layout.inlineGap },
  mainText: { flex: 1, minWidth: 0 },
  /* 날씨 — 정본 밖(DESIGN_UNRESOLVED). 오른쪽 정렬 · 아이콘 20 + 기온 20/700 · 아래 10/14 흰색 70%. */
  weather: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  weatherTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  weatherLine: { lineHeight: LineHeight.lh14, color: ON_TINT_DATE },
  /* `heroDate` — 위 4 · 12/17 · 흰색 70%. */
  ceremony: {
    marginTop: Spacing.one,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ceremonyText: { flexShrink: 1, lineHeight: LineHeight.lh17, color: ON_TINT_DATE },
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
  /* 연결 전에는 아바타가 하나다. */
  avatarsSolo: { width: Layout.avatarMini },
  avatarText: { fontWeight: 700 },
  /* `coupleText` — 10/14 · 흰색 55%. */
  peopleText: { flex: 1, lineHeight: LineHeight.lh14, color: ON_TINT_KICKER },
  pressed: { opacity: 0.8 },
});
