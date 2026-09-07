import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
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

/**
 * 개인정보처리방침 뷰어.
 * 법률 자문 후 확정본을 채운다. 지금은 섹션 뼈대와 상태만 둔다.
 * 각 섹션은 탭으로 펼치고 접을 수 있다.
 */

/** 마지막 업데이트 — 확정본 게시 전까지 미확정 상태 */
const LAST_UPDATED = '확정 전';

type Section = {
  id: string;
  title: string;
  body: string;
};

const SECTIONS: Section[] = [
  {
    id: '1',
    title: '1. 수집하는 개인정보 항목',
    body: '서비스 가입 시 이메일 주소, 닉네임을 수집해요. 웨딩 준비 정보 등록 시 웨딩 일정, 예산, 지역 정보를 수집할 수 있어요. 확정 전 내용으로, 법률 자문 후 최종본으로 교체해요.',
  },
  {
    id: '2',
    title: '2. 개인정보 수집 및 이용 목적',
    body: '회원 식별, 서비스 제공, 개인화 추천에 사용해요. 마케팅 동의 시 이벤트·혜택 안내에도 쓰여요. 확정 전 내용으로, 법률 자문 후 최종본으로 교체해요.',
  },
  {
    id: '3',
    title: '3. 개인정보 보유 및 이용 기간',
    body: '회원 탈퇴 시 계정·프로필 등 개인정보를 즉시 삭제해요. 비식별화된 후기·정보는 작성자 정보를 제거한 뒤 서비스 개선 목적으로 유지할 수 있어요. 법령상 보존 의무가 있는 항목은 해당 기간 동안 별도 보관해요.',
  },
  {
    id: '4',
    title: '4. 개인정보 제3자 제공',
    body: '원칙적으로 외부에 제공하지 않아요. 법령에 따른 수사기관 요청 등 예외 사항은 별도 안내해요. 확정 전 내용으로, 법률 자문 후 최종본으로 교체해요.',
  },
  {
    id: '5',
    title: '5. 개인정보 처리 위탁',
    body: '서비스 운영을 위해 일부 업무를 외부에 위탁할 수 있어요. 위탁 업체 및 업무 내용은 확정 후 이 항목에 명시해요.',
  },
  {
    id: '6',
    title: '6. 정보주체의 권리·의무',
    body: '언제든지 개인정보 열람, 수정, 삭제, 처리 정지를 요청할 수 있어요. 요청은 앱 내 고객문의 또는 이메일로 접수해요.',
  },
  {
    id: '7',
    title: '7. 개인정보 보호책임자',
    body: '개인정보 처리와 관련한 문의는 고객문의 채널로 접수해주세요. 담당자 정보는 서비스 오픈 전 확정해요.',
  },
];

function SectionRow({ section }: { section: Section }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <ThemedView type="backgroundElement" style={styles.sectionCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? `${section.title} 접기` : `${section.title} 펼치기`}
        onPress={() => setExpanded((v) => !v)}
        style={styles.sectionHeader}
      >
        <ThemedText type="t6" style={styles.sectionTitle} numberOfLines={expanded ? undefined : 2}>
          {section.title}
        </ThemedText>
        <ThemedText type="t7" themeColor="textAssistive">
          {expanded ? '접기' : '보기'}
        </ThemedText>
      </Pressable>
      {expanded && (
        <ThemedText type="t7" themeColor="textSecondary" style={styles.sectionBody}>
          {section.body}
        </ThemedText>
      )}
    </ThemedView>
  );
}

export default function PrivacyScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* 헤더 */}
          <ThemedView style={styles.header}>
            <ThemedText type="t2">개인정보처리방침</ThemedText>
            <ThemedText type="t7" themeColor="textAssistive">
              마지막 업데이트 {LAST_UPDATED}
            </ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              이 방침은 법률 자문 후 확정본으로 교체해요. 지금은 준비 중이에요.
            </ThemedText>
          </ThemedView>

          {/* 섹션 아코디언 */}
          {SECTIONS.map((section) => (
            <SectionRow key={section.id} section={section} />
          ))}

          {/* 문의 */}
          <ThemedView type="backgroundElement" style={styles.contactCard}>
            <ThemedText type="t6" style={styles.contactTitle}>
              개인정보 관련 문의
            </ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              개인정보 처리에 관한 문의나 열람·삭제 요청은 앱 내 고객문의로 보내주세요.
            </ThemedText>
          </ThemedView>

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  header: { gap: Spacing.one, marginBottom: Spacing.one },
  sectionCard: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: Layout.touchTarget,
  },
  sectionTitle: { flex: 1, fontWeight: '700' },
  sectionBody: { marginTop: Spacing.one },
  contactCard: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  contactTitle: { fontWeight: '700' },
});
