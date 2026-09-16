import {
  FAQ_RELATED,
  FAQ_UNRESOLVED_CATEGORY,
  faqItem,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, Layout, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { useFaq } from '@/features/faq/use-faq';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { Hero, Row, Rows, Section, SubScreen } from '@/features/settings/my-kit';

/**
 * WP-FAQ-003 질문 답변 상세.
 *
 *   본문 · 관련 질문 · 「도움됐어요」 / 「해결되지 않았어요」 두 버튼
 *
 * **없던 화면이다**(Release Audit 1차 「실질 미구현 4건」). 목록(WP-FAQ-001)에서
 * 질문을 누르면 `/my/guide`의 아코디언으로만 갔다 — 답을 읽고 나서 할 수 있는
 * 일이 없었다.
 *
 * **「해결되지 않았어요」는 문의 유형을 자동으로 고른다**(시안 rule). 답이 도움이
 * 안 됐으면 그 질문이 무엇에 관한 것이었는지 우리가 이미 안다 — 유형을 다시
 * 고르게 하는 것은 같은 말을 두 번 시키는 일이다. 짝은 도메인에 적어 두었다.
 *
 * **「도움됐어요」는 서버에 보내지 않는다.** 집계를 받을 자리가 없다 — 받는 곳
 * 없이 보내면 눌린 것이 아무 데도 남지 않으면서 보낸 척만 하게 된다. 지금은
 * 눌렸다는 것을 화면에서만 인정하고, 집계 경로가 생기면 그때 잇는다.
 */
export default function FaqDetailScreen() {
  const { faqKey } = useLocalSearchParams<{ faqKey: string }>();
  /*
   * 질문은 서버에서 온다(2026-09-16 대표 지시 — 운영자가 직접 고치고 지운다).
   * 받아오기 «전»에 「찾는 질문이 없어요」를 그리면 멀쩡한 질문이 없어진 것으로
   * 보인다. 그래서 다 받은 뒤에 없을 때만 그 말을 한다.
   */
  const faq = useFaq();
  const item = faqItem(faq.items, faqKey);
  const [thanked, setThanked] = useState(false);

  if (!item) {
    return (
      <SubScreen title="질문">
        {faq.loading ? (
          <DelayedLoader size={40} />
        ) : (
          <Hero
            lines={[faq.failed ? '질문을 불러오지 못했어요' : '찾는 질문이 없어요']}
            sub={faq.failed ? '잠시 뒤에 다시 열어주세요' : '목록에서 다시 골라주세요'}
          />
        )}
      </SubScreen>
    );
  }

  /*
   * 관련 질문 짝짓기는 코드에 남는다 — 글이 아니라 화면의 분기다. 운영자가 새로
   * 등록한 항목은 여기에 없어 이 칸이 비고, 비면 그리지 않는다.
   *
   * 지워졌거나 비공개로 내린 질문은 받아온 목록에 없으므로 여기서 함께 걸러진다.
   */
  const related = (FAQ_RELATED[item.key] ?? [])
    .map((key) => faqItem(faq.items, key))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

  return (
    <SubScreen title="질문">
      <Hero lines={[item.question]} />

      <View style={styles.answer}>
        <ThemedText type="body" themeColor="textStrong">
          {item.answer}
        </ThemedText>
      </View>

      {related.length > 0 ? (
        <Section title="관련 질문" big>
          <Rows>
            {related.map((entry) => (
              <Row
                key={entry.key}
                name={entry.question}
                chevron
                /* `replace` — 관련 질문을 타고 다녀도 뒤로가기가 목록으로 한 번에 돌아간다. */
                onPress={() => router.replace(`/my/faq/${entry.key}` as never)}
              />
            ))}
          </Rows>
        </Section>
      ) : null}

      <Section title="이 답이 도움이 됐나요" big>
        {thanked ? (
          <ThemedView type="backgroundElement" style={styles.thanks}>
            <ThemedText type="t6">알려주셔서 고마워요</ThemedText>
          </ThemedView>
        ) : (
          /* 시안 L104 — `display:flex;gap:8px` 안에 고스트 버튼 둘. 목록 행은 「더 볼 것」으로 읽혀 답이 아니다. */
          <View style={styles.helpful}>
            <View style={styles.helpfulBtn}>
              <ActionButton label="도움이 됐어요" variant="ghost" size="large" onPress={() => setThanked(true)} />
            </View>
            <View style={styles.helpfulBtn}>
              <ActionButton
                label="해결되지 않았어요"
                variant="ghost"
                size="large"
                onPress={() =>
                  router.push({
                    pathname: '/my/contact',
                    params: { category: FAQ_UNRESOLVED_CATEGORY[item.key] ?? 'other' },
                  } as never)
                }
              />
            </View>
          </View>
        )}
      </Section>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  answer: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
  /* 시안 L104 — 버튼 둘이 나란히, 사이 8. */
  helpful: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Layout.gutter },
  helpfulBtn: { flex: 1 },
  thanks: {
    marginHorizontal: Layout.gutter,
    borderRadius: Layout.cardGap,
    padding: Spacing.three,
  },
});
