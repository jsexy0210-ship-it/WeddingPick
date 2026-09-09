import { STYLE_PICK_LIMIT_TOAST, STYLE_PICK_MIN, type WeddingStyle } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { ApiError, completeSetup, getCurrentUser } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import { STEP_TITLE_LINES } from '@/features/onboarding/flow';
import { InlineToast, useInlineToast } from '@/features/onboarding/inline-toast';
import { StyleGrid } from '@/features/onboarding/style-grid';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { Hero, NavAction, NoteBox, Section, SubScreen } from '@/features/settings/my-kit';
import { ErrorView } from '@weddingpick/ui';

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
 * «저장»이다(시안 navRight). 규칙은 온보딩 5/5와 같다 — 최소 1 · 최대 2 · 3번째는 토스트.
 *
 * «중요하게 보는 것» 순위 4행은 계약이 없어 두지 않는다.
 * 저장은 `completeSetup` — 예식일 · 지역은 읽어 둔 값을 그대로 돌려보내고(지우지 않는다),
 * 준비 현황 · 예산은 키를 보내지 않아 서버가 건드리지 않는다.
 */
export default function StyleScreen() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
      confirmAlert(S.savedTitle, S.savedBody, [{ text: S.ok, onPress: () => router.back() }]);
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
    return error ? <ErrorView message={error} onBack={() => router.back()} /> : <DelayedLoadingView />;
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

      <StyleGrid
        chosen={loaded.chosen}
        onChange={(next) => setLoaded({ ...loaded, chosen: next })}
        onLimited={() => limitToast.show(STYLE_PICK_LIMIT_TOAST)}
      />

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
