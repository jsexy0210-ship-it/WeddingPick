import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

type BizItem = {
  title: string;
  description: string;
  route: string;
};

const IDENTITY_ITEMS: BizItem[] = [
  {
    title: '소속 확인 요청',
    description: '업체 관계자임을 인증하고 후기 반론 권한을 얻어요.',
    route: '/my/biz/claim',
  },
  {
    title: '내 인증 내역',
    description: '제출한 소속 확인 요청과 처리 상태를 확인해요.',
    route: '/my/vendor-claims',
  },
];

const DATA_ITEMS: BizItem[] = [
  {
    title: '자료 제공',
    description: '업체 정보를 추가하거나 잘못된 내용을 알려주세요.',
    route: '/my/biz/data',
  },
];

const PROMO_ITEMS: BizItem[] = [
  {
    title: '혜택 등록',
    description: '웨딩픽 사용자를 위한 할인·혜택을 등록해요.',
    route: '/my/biz/benefit',
  },
  {
    title: '광고 문의',
    description: '검색 결과 상단 노출 및 광고 게재를 문의해요.',
    route: '/my/biz/ad',
  },
];

const REBUTTAL_ITEMS: BizItem[] = [
  {
    title: '후기 반론',
    description: '업체 관계자로 확인된 경우 후기에 반론을 낼 수 있어요.',
    route: '/my/rebuttals',
  },
];

function Section({ title, items }: { title: string; items: BizItem[] }) {
  return (
    <ThemedView style={styles.section}>
      <ThemedText type="t7" themeColor="textAssistive">
        {title}
      </ThemedText>
      {items.map((item) => (
        <ThemedView
          key={item.route}
          type="backgroundElement"
          style={styles.card}
        >
          <ThemedView style={styles.cardBody}>
            <ThemedText type="t5">{item.title}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {item.description}
            </ThemedText>
          </ThemedView>
          <ActionButton
            variant="ghost"
            label="이동"
            onPress={() => router.push(item.route as never)}
          />
        </ThemedView>
      ))}
    </ThemedView>
  );
}

/**
 * WP-BIZ-001: 업체 관계자 허브.
 *
 * 업체 관계자가 쓸 수 있는 기능을 한곳에 모아 보여준다 — 소속 확인,
 * 자료 제공, 혜택 등록, 광고 문의, 후기 반론.
 */
export default function BizHomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t2">업체 관계자</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              업체 관계자를 위한 기능이에요. 소속 확인 후 더 많은 기능을 쓸 수
              있어요.
            </ThemedText>
          </ThemedView>

          <Section title="소속 확인" items={IDENTITY_ITEMS} />
          <Section title="자료" items={DATA_ITEMS} />
          <Section title="혜택·광고" items={PROMO_ITEMS} />
          <Section title="반론" items={REBUTTAL_ITEMS} />

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardBody: {
    gap: Spacing.one,
  },
});
