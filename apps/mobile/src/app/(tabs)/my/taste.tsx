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
import { confirmAlert } from '@/components/confirm-alert';
import { STEP_TITLE_LINES } from '@/features/onboarding/flow';
import { InlineToast, useInlineToast } from '@/features/onboarding/inline-toast';
import { OptionRow } from '@/features/onboarding/option-row';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { useDepthBack } from '@/features/navigation/depth-back';
import { Hero, NavAction, NoteBox, Section, SubScreen } from '@/features/settings/my-kit';
import { ErrorView, Layout } from '@weddingpick/ui';

/** `spec/strings.ko.json` `my.item.taste` · `my.setting.note*` · 시안 13-my-sub WP-MY-004. */
const S = {
  title: '스타일',
  save: '저장',
  saving: '저장 중…',
  sub: (n: number) => `지금은 ${n}개를 골랐어요`,
  noteTitle: '바꾸면 추천이 다시 계산돼요',
  noteBody: 'Pick한 곳과 지출 기록은 그대로 남아요.',
  savedTitle: '스타일 저장 완료',
  savedBody: '고른 스타일로 홈 추천이 새로 만들어져요.',
  ok: '확인',
  loadError: '지금 고른 스타일을 불러오지 못했어요.',
  saveError: '저장하지 못했어요.',
} as const;

type Loaded = {
  weddingDate: string | null;
  region: string | null;
  chosen: readonly WeddingStyle[];
};

/**
 * 스타일 다시 고르기 · WP-MY-004. 지금 고른 것을 먼저 보여주고 바꾸게 한다. 저장은 헤더 오른쪽
 * «저장»이다(시안 navRight). 규칙은 온보딩 3/3과 같다 — 최소 1 · 최대 2 · 3번째는 토스트.
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
      confirmAlert(S.savedTitle, S.savedBody, [{ text: S.ok, onPress: depthBack }]);
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
      right={
        <NavAction
          brand
          label={saving ? S.saving : S.save}
          disabled={saving || count < STYLE_PICK_MIN}
          onPress={() => void handleSave()}
        />
      }>
      <Hero lines={STEP_TITLE_LINES.style} sub={S.sub(count)} />

      <View style={styles.options}>
        {WEDDING_STYLES.map((style) => (
          <OptionRow
            key={style}
            role="checkbox"
            label={WEDDING_STYLE_LABEL[style]}
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

      <Section>
        <NoteBox title={S.noteTitle} body={S.noteBody} />
      </Section>

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
