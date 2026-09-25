import {
  STYLE_PICK_LIMIT_TOAST,
  STYLE_PICK_MIN,
  WEDDING_STYLES,
  WEDDING_STYLE_LABEL,
  toggleStyle,
  type WeddingStyle,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, completeSetup, getCurrentUser } from '@/api/client';
import { STEP_DESCRIPTION, STEP_TITLE_LINES, STYLE_DESCRIPTION } from '@/features/onboarding/flow';
import { InlineToast, useInlineToast } from '@/features/onboarding/inline-toast';
import { OptionRow } from '@/features/onboarding/option-row';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { useDepthBack } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { Dock, Hero, NoteBox, Section, SubScreen } from '@/features/settings/my-kit';
import { ErrorView, Layout } from '@weddingpick/ui';

/** `spec/strings.ko.json` `my.item.taste` · 정본 WP-MY-014(docs/design/React_Native/my.jsx frame-016). */
const S = {
  title: '스타일',
  save: '저장하기',
  saving: '저장 중…',
  savedTitle: '스타일을 저장했어요',
  loadError: '지금 고른 스타일을 불러오지 못했어요.',
  saveError: '스타일을 저장하지 못했어요',
} as const;

type Loaded = {
  weddingDate: string | null;
  region: string | null;
  chosen: readonly WeddingStyle[];
};

/**
 * 스타일 다시 고르기 · WP-MY-014. 지금 고른 것을 먼저 보여주고 바꾸게 한다. 저장은 하단 고정
 * «저장하기» 한 개다(시안 dockSingle). 규칙은 온보딩 3/3과 같다 — 최소 1개, 최대 2개.
 *
 * **보기는 온보딩 3/3과 같은 `OptionRow` 넷이다**(2026-09-15 대표 지시 「타일로 하지마
 * 버튼으로 통일한다」). 사진 2×2 타일을 쓰던 자리다 — 피그마 규격서에 타일이 없고,
 * 같은 선택이 온보딩과 MY에서 다르게 보이던 자리다.
 *
 * **`features/onboarding/style-grid.tsx`와 `assets/images/style/*.png` 4장은 지웠다**
 * (2026-09-15 · MASTER). 사진 타일을 버리면서 아무도 쓰지 않게 된 파일들이다.
 *
 * «중요하게 보는 것» 순위 4행은 계약이 없어 두지 않는다.
 * 저장은 `completeSetup` — 예식일 · 지역은 읽어 둔 값을 그대로 돌려보내고(지우지 않는다),
 * 준비 현황 · 예산은 키를 보내지 않아 서버가 건드리지 않는다.
 */
export default function StyleScreen() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // 저장 완료·불러오기 실패에서 나가는 길은 Depth Back이다 — 딥링크로 들어와도 MY로 간다.
  const depthBack = useDepthBack();
  const limitToast = useInlineToast();

  useEffect(() => {
    void getCurrentUser()
      .then((me) => setLoaded({ weddingDate: me.weddingDate, region: me.region, chosen: me.styleTags }))
      .catch((caught) => setError(caught instanceof Error ? caught.message : S.loadError));
  }, []);

  async function handleSave() {
    if (!loaded || loaded.chosen.length < STYLE_PICK_MIN || saving) return;
    setSaving(true);
    setError(null);
    try {
      await completeSetup({
        weddingDate: loaded.weddingDate,
        region: loaded.region,
        styleTags: [...loaded.chosen],
      });
      showResultToast(S.savedTitle);
      depthBack();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login');
        return;
      }
      setError(caught instanceof Error ? caught.message : S.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return error ? <ErrorView message={error} onBack={depthBack} /> : <DelayedLoadingView />;
  }

  const count = loaded.chosen.length;

  return (
    <SubScreen
      title={S.title}
      dock={
        /* 시안(WP-MY-014)은 헤더 오른쪽이 아니라 하단 고정 «저장하기» 한 개다. */
        <Dock
          primary={{
            label: saving ? S.saving : S.save,
            disabled: saving || count < STYLE_PICK_MIN,
            onPress: () => void handleSave(),
          }}
        />
      }>
      <Hero lines={STEP_TITLE_LINES.style} sub={STEP_DESCRIPTION.style} />

      <View style={styles.options}>
        {WEDDING_STYLES.map((style) => (
          <OptionRow
            key={style}
            role="checkbox"
            label={WEDDING_STYLE_LABEL[style]}
            description={STYLE_DESCRIPTION[style]}
            selected={loaded.chosen.includes(style)}
            onPress={() => {
              const { next, limited } = toggleStyle(loaded.chosen, style);

              if (limited) limitToast.show(STYLE_PICK_LIMIT_TOAST);
              else setLoaded({ ...loaded, chosen: next });
            }}
          />
        ))}
      </View>

      {error ? (
        <Section>
          <NoteBox title={error} />
        </Section>
      ) : null}

      <InlineToast toast={limitToast.toast} onHidden={limitToast.hide} />

    </SubScreen>
  );
}

const styles = StyleSheet.create({
  /* 온보딩 3/3의 `options`와 같은 자리 — 규격서 «줄 사이 mar 0 0 12 0». 좌우는 화면 여백. */
  options: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Layout.inlineGap,
  },
});
