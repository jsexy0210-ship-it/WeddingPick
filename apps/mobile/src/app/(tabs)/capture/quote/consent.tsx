import { DOCUMENT_CONSENT_POINTS, DOCUMENT_RETENTION_NOTICE } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getSettings, grantDocumentConsent } from '@/api/client';
import { Layout, Spacing, ThemedText } from '@weddingpick/ui';
import { CheckBox, Dock, DockButton, Hero, ListRow, NavBar, NoteCard, Screen, Section } from '@/features/wedding/screen-kit';
import { useCaptureDraft } from '@/features/capture/capture-draft';

/**
 * 견적서 정리 — 동의(최초 1회).
 *
 * **이 화면이 없었다**(Release Audit 1차 P0-5, 2026-09-09). 견적서 원본도 결제
 * 증빙과 똑같이 외부 서비스로 나가는데 묻지도 기록하지도 않았다. 같은 앱의 결제
 * 증빙 경로(`capture/payment/consent.tsx`)에는 둘 다 있었으므로 정책이 아니라
 * 누락이다. 그 화면과 같은 모양으로 맞췄다.
 *
 * 포괄 동의는 동의가 아니다. 무엇을 가져가고 어디에 쓰는지 항목으로 나누고,
 * 문구는 도메인에서 가져온다 — 동의받은 내용과 실제로 하는 일이 갈라지지 않게
 * 한 곳에만 적는다.
 *
 * 이미 동의한 사람은 이 화면을 지나지 않는다 — 매번 같은 안내를 읽게 하면 관문이 된다.
 */
export default function QuoteConsentScreen() {
  const { pages } = useCaptureDraft();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean[]>(DOCUMENT_CONSENT_POINTS.map(() => false));

  const allChecked = checked.every(Boolean);
  /** 동의를 마치면 찍던 것을 이어서 한다. 처음이면 촬영부터다. */
  const next = pages.length > 0 ? '/capture/review' : '/capture/camera';

  useEffect(() => {
    void getSettings()
      .then((settings) => {
        if (settings.documentConsent) router.replace(next);
      })
      // 못 물어보면 그냥 보여준다. 동의 화면을 한 번 더 보는 것이 최악은 아니다.
      .catch(() => undefined);
  }, [next]);

  function toggle(index: number) {
    setChecked((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }

  function toggleAll() {
    setChecked(DOCUMENT_CONSENT_POINTS.map(() => !allChecked));
  }

  async function agree() {
    if (!allChecked) return;
    setSending(true);
    setError(null);

    try {
      /* 동의를 서버에 남긴 뒤에 넘어간다. 화면만 지나가게 두면 «동의했다»는 사실이 어디에도 없다. */
      await grantDocumentConsent();
      router.replace(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '동의를 저장하지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <NavBar title="견적서 정리" /> {/* pick-language: 받는 서류 이름 */}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero title="자료를 올리기 전에" sub="서류 전체가 아니라 금액을 확인할 수 있는 자료만 받아요" />

        <Section label="동의">
          <ListRow
            left={<CheckBox checked={allChecked} />}
            title="전체 동의"
            titleBold
            accessibilityLabel={`전체 동의 ${allChecked ? '켬' : '끔'}`}
            onPress={toggleAll}
          />
          {DOCUMENT_CONSENT_POINTS.map((point, index) => (
            <ListRow
              key={point}
              left={<CheckBox checked={checked[index] ?? false} />}
              title={point}
              titleLines={4}
              accessibilityLabel={`${point} ${checked[index] ? '켬' : '끔'}`}
              onPress={() => toggle(index)}
            />
          ))}
        </Section>

        {error ? (
          <ThemedText type="t7" themeColor="negative" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}

        <View style={styles.noteWrap}>
          <NoteCard title="원본은 정리가 끝나면 지워요" body={DOCUMENT_RETENTION_NOTICE} />
        </View>
      </ScrollView>

      <Dock>
        <DockButton
          variant="primary"
          label={sending ? '저장 중…' : '동의하고 계속'}
          disabled={!allChecked || sending}
          onPress={() => void agree()}
        />
      </Dock>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  error: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.three },
  noteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
});
