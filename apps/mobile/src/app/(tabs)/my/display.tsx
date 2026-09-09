import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ActionButton,
  Border,
  DEFAULT_SKIN,
  Layout,
  Radius,
  Skins,
  Spacing,
  ThemedText,
  useTheme,
  type SkinId,
} from '@weddingpick/ui';
import { Hero, NoteBox, Row, Rows, Section, SubScreen } from '@/features/settings/my-kit';
import { loadSkin, saveSkin } from '@/features/settings/skin-preference';

/** 시안 13-my-sub #6 «화면 설정 · WP-MY-005» · `spec/strings.ko.json` `my.display.*`. */
const S = {
  title: '화면 설정',
  hero: ['어떤 색이', '마음에 드세요'],
  sub: '고른 색은 버튼과 선택 표시에만 쓰여요',
  preview: '미리보기',
  previewLine: '이번 주엔 드레스를 정할 차례예요',
  previewCta: '3곳 비교',
  dark: '어두운 화면',
  darkMeta: '기기 설정을 따라가요',
  fontSize: '글자 크기',
  fontSizeMeta: '기기 설정을 따라가요',
  motion: '애니메이션 줄이기',
  motionMeta: '기기의 「움직임 줄이기」를 따라가요',
  follows: '기기 설정',
  noteTitle: '앱 아이콘은 바뀌지 않아요',
  noteBody: '아이콘과 첫 화면은 웨딩픽 코랄로 고정이에요.',
} as const;

/** 스와치에 붙는 이름 — `spec/tokens.json` `color.skin.options[].label`. */
const SKIN_LABEL: Record<SkinId, string> = {
  coral: '코랄',
  red: '레드',
  yellow: '옐로',
  green: '그린',
  blue: '블루',
  darkGray: '다크그레이',
};

const SKIN_ORDER: readonly SkinId[] = ['coral', 'red', 'yellow', 'green', 'blue', 'darkGray'];

/**
 * 화면 설정 · WP-MY-005. 시안 13-my-sub #6 — 히어로 → 스와치 6(52 원) → 미리보기 brand 카드 →
 * 어두운 화면 · 글자 크기 · 애니메이션 3행 → note «앱 아이콘은 고정».
 *
 * ## 고른 색이 지금 어디까지 가는가
 *
 * **기기에 저장되고, 미리보기 카드에 적용된다. 앱 전체 색은 아직 바뀌지 않는다.**
 *
 * `@weddingpick/ui`의 `useTheme()`이 `Colors.light` · `Colors.dark` 상수를 그대로 돌려주는
 * 구조라(스킨을 읽는 곳이 없다) 전역에 적용하려면 테마를 Provider로 바꾸고 화면 100여 곳이
 * 쓰는 `theme.tint`의 출처를 옮겨야 한다. 그건 이 화면 하나가 감당할 변경이 아니라 따로 할
 * 일이다(CLAUDE.md «억지로 전역 테마를 갈아엎지 않는다»).
 *
 * 그때가 오면 고칠 곳은 둘뿐이다 — `features/settings/skin-preference.ts`가 읽어주는 값을
 * 테마 Provider가 받고, `pickTintFor(skin)`(Dark Gray면 Pick만 코랄)을 그대로 쓴다.
 *
 * ## 아래 3행
 *
 * 어두운 화면 · 글자 크기 · 「움직임 줄이기」는 셋 다 **기기 설정을 그대로 따라간다**
 * (`use-color-scheme` · RN 글자 배율 · `AccessibilityInfo.isReduceMotionEnabled`). 앱에 따로
 * 저장하는 값이 없어서 시안의 셀렉트 · 스위치 대신 지금 무엇을 따라가는지만 적는다 —
 * 눌러도 아무 일이 없는 컨트롤을 두지 않는다.
 */
export default function DisplayScreen() {
  const theme = useTheme();
  const [skin, setSkin] = useState<SkinId>(DEFAULT_SKIN);

  useEffect(() => {
    void loadSkin().then(setSkin);
  }, []);

  function choose(next: SkinId) {
    setSkin(next);
    void saveSkin(next);
  }

  const accent = Skins[skin];

  return (
    <SubScreen title={S.title}>
      <Hero lines={S.hero} sub={S.sub} />

      {/* 스와치 6 — 52 원 · 사이 12 · 고른 것은 안쪽 흰 테와 바깥 같은 색 테. */}
      <View style={styles.swatches}>
        {SKIN_ORDER.map((id) => (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected: skin === id }}
            accessibilityLabel={SKIN_LABEL[id]}
            onPress={() => choose(id)}
            style={[
              styles.swatchRing,
              skin === id ? { borderColor: Skins[id] } : styles.swatchRingOff,
            ]}>
            <View
              style={[
                styles.swatch,
                { backgroundColor: Skins[id] },
                skin === id ? { borderColor: theme.background } : null,
              ]}
            />
          </Pressable>
        ))}
      </View>

      {/* 미리보기 brand 카드 — 고른 색이 어디에 쓰이는지 그대로 보여준다. */}
      <Section>
        <View
          style={[
            styles.preview,
            { backgroundColor: mix(accent, TINT_MIX, theme.background), borderColor: mix(accent, BORDER_MIX, theme.background) },
          ]}>
          <ThemedText type="t7" style={[styles.bold, { color: accent }]}>
            {S.preview}
          </ThemedText>
          <ThemedText type="t5">{S.previewLine}</ThemedText>
          {/* 눌리지 않는다 — 여기 있는 버튼은 색을 보여주려고 그린 그림이다. */}
          <ActionButton
            label={S.previewCta}
            size="large"
            tone={{ background: accent, text: ON_ACCENT }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
      </Section>

      <Section>
        <Rows>
          <Row name={S.dark} meta={S.darkMeta} tail={S.follows} tailDim />
          <Row name={S.fontSize} meta={S.fontSizeMeta} tail={S.follows} tailDim />
          <Row name={S.motion} meta={S.motionMeta} tail={S.follows} tailDim />
        </Rows>
      </Section>

      <Section>
        <NoteBox title={S.noteTitle} body={S.noteBody} />
      </Section>
    </SubScreen>
  );
}

/**
 * 스킨 색을 바탕색에 섞는다. 코랄에 넣으면 토큰 값이 그대로 나온다 —
 * 12%는 `color.brand.primaryTint`(#FFE8E4), 26%는 `color.brand.primaryBorder`(#FFD9D4)다.
 * 다른 다섯 스킨은 토큰에 고정값이 없어 같은 비율로 만든다.
 */
const TINT_MIX = 0.12;
const BORDER_MIX = 0.26;
/** 스킨 색 위의 글자. `color.brand.onPrimary` — 다크 테마에서도 반전하지 않는다. */
const ON_ACCENT = '#ffffff';

function mix(hex: string, ratio: number, base: string): string {
  const a = rgb(hex);
  const b = rgb(base);
  const blend = (i: number) => Math.round(a[i] * ratio + b[i] * (1 - ratio));

  return `rgb(${blend(0)}, ${blend(1)}, ${blend(2)})`;
}

function rgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((one) => one + one)
          .join('')
      : value;

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** 스와치 두 겹 링의 두께. 시안 3px에 가장 가까운 토큰 — `border.focus`(2). */
const RING = Border.focus;

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },

  /* 스와치 줄 — 시안 padding 0 24 24 · gap 12 · wrap. */
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.rowPaddingY,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.four,
  },
  /* 고른 것 — 바깥에 같은 색 테. 안쪽 흰 테와 합쳐 시안의 두 겹 링이 된다. */
  swatchRing: {
    borderRadius: Radius.pill,
    borderWidth: RING,
    padding: 0,
  },
  swatchRingOff: { borderColor: 'transparent' },
  swatch: {
    width: Layout.thumbList,
    height: Layout.thumbList,
    borderRadius: Radius.pill,
    borderWidth: RING,
    borderColor: 'transparent',
  },

  /* 미리보기 — 시안 previewBox: radius 10 · 1px 테두리 · padding 20 · gap 10. */
  preview: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    padding: Layout.cardPadding,
    gap: Layout.cardGap,
  },
});

