import { WEDDING_STYLES, WEDDING_STYLE_LABEL, type WeddingStyle } from '@weddingpick/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, Layout } from '@weddingpick/ui';
import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';
import { STYLE_DESCRIPTION } from '@/features/onboarding/flow';
import { OptionRow } from '@/features/onboarding/option-row';

/**
 * 스타일 선택 시트 — 내 웨딩설정(WP-MY-003)의 스타일 행.
 *
 *   ━━
 *   스타일 선택                     ✕     공용 SheetHeader(타이틀 + 우측 X)
 *   [ 도시적인   모던하고 세련된 …  ✓ ]   온보딩 5/5와 같은 OptionRow 넷(checkbox)
 *   [ 자연스러운 …                  ○ ]   사이 10
 *   …
 *   [            확인            ]        Primary CTA 하나 — 하나도 안 고르면 잠긴다
 *
 * **휠이 아니다.** 2026-09-26 대표 지시 「개수제한 없다」 — 스타일은 최소 1개, 넷까지 고른다.
 * 1열 휠은 한 번에 하나만 가리켜 여럿을 고를 수 없으므로, 같은 공용 바텀시트 안에 정본의
 * 다중 선택 보기(`home.js:724~731` WP-AUTH-006 `styleBtnWrap` gap 10 · `styleBtn`)를 그대로
 * 둔다. 정본에는 이 화면의 시트 그림이 없다 — 모양 자체가 `DESIGN_UNRESOLVED`다.
 *
 * 개수 한도는 여기서 걸지 않는다(도메인 `style.ts`의 한도 변경은 온보딩 담당 브랜치가 한다).
 * 저장 순서는 고른 순서다(`style.ts` 「순서는 고른 순서를 지킨다」). 「확인」을 눌러야 저장된다 —
 * 고르다 닫으면 그대로다.
 */
export function StylePickSheet({
  visible,
  title,
  value,
  onConfirm,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  value: readonly WeddingStyle[];
  onConfirm: (styles: WeddingStyle[]) => void;
  onDismiss: () => void;
}) {
  return (
    <BottomSheet visible={visible} onRequestClose={onDismiss}>
      <Body title={title} value={value} onConfirm={onConfirm} onDismiss={onDismiss} />
    </BottomSheet>
  );
}

function Body({
  title,
  value,
  onConfirm,
  onDismiss,
}: {
  title: string;
  value: readonly WeddingStyle[];
  onConfirm: (styles: WeddingStyle[]) => void;
  onDismiss: () => void;
}) {
  const [chosen, setChosen] = useState<readonly WeddingStyle[]>(value);

  return (
    <SheetPanel style={styles.sheet}>
      <SheetHeader title={title} onClose={onDismiss} />

      <View style={styles.options}>
        {WEDDING_STYLES.map((style) => (
          <OptionRow
            key={style}
            role="checkbox"
            label={WEDDING_STYLE_LABEL[style]}
            description={STYLE_DESCRIPTION[style]}
            selected={chosen.includes(style)}
            onPress={() => setChosen((now) => toggleStyleFreely(now, style))}
          />
        ))}
      </View>

      <View style={styles.cta}>
        <ActionButton
          variant="primary"
          size="sheet"
          label={S.confirm}
          disabled={chosen.length === 0}
          onPress={() => onConfirm([...chosen])}
        />
      </View>
    </SheetPanel>
  );
}

/** 누르면 넣고, 다시 누르면 뺀다 — 한도가 없다(2026-09-26). 최소 1개는 「확인」이 잠겨서 지킨다. */
export function toggleStyleFreely(chosen: readonly WeddingStyle[], style: WeddingStyle): WeddingStyle[] {
  return chosen.includes(style) ? chosen.filter((item) => item !== style) : [...chosen, style];
}

const S = { confirm: '확인' } as const;

const styles = StyleSheet.create({
  /* 정본 wheelSheet와 같은 요소 간격 14 — 패딩/그래버는 SheetPanel. */
  sheet: { gap: Layout.sectionHeadGap },
  /* 정본 styleBtnWrap gap 10(좌우 24는 SheetPanel이 준다). */
  options: { gap: Layout.iconTextGap },
  cta: { width: '100%', flexGrow: 0, flexShrink: 0 },
});
