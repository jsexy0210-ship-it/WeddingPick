import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { ReactNode } from 'react';

import { Border, FontSize, Layout, LineHeight, Radius, Spacing, ThemedText, Toast, useTheme } from '@weddingpick/ui';
import { createInquiry } from '@/api/client';
import { CheckCircle } from '@/features/onboarding/check-circle';
import { useDepthBack } from '@/features/navigation/depth-back';
import { showResultToast } from '@/features/navigation/result-toast';
import { Dock, Hero, NoteBox, Section, SubScreen } from '@/features/settings/my-kit';

/**
 * RN 정본 WP-VEND-008 「정보 오류 제보」 — `docs/design/React_Native/search.jsx` frame-011 ·
 * `search.js` `rptTypes` · `rptPh` · `ctaFull2`. 문구는 정본 그대로다.
 */
const S = {
  title: '정보 오류 제보',
  itemGroup: '무엇이 틀렸나요?',
  correct: '올바른 정보',
  correctPlaceholder: '정확한 정보를 적어주세요',
  evidence: '근거 링크 · 선택',
  evidencePlaceholder: '공식 홈페이지, SNS 등',
  evidenceInvalid: '주소 전체를 적어주세요 · https://로 시작해요',
  cta: '제출하기',
  sending: '보내는 중…',
  failed: '보내지 못했어요',
} as const;

/**
 * 무엇이 틀렸는지 — 정본 `rptTypes` 넷 그대로다. 접수 분류는 넷 다 `data_correction`이고
 * 고른 줄의 이름은 본문 첫 줄로만 들어간다(아래 submit) — 서버 분류와 묶여 있지 않다.
 *
 * `needsValue`가 true인 셋은 올바른 값을 받아야 고칠 수 있고, «영업 종료 · 폐업»은 상태를
 * 알리는 제보라 값이 없다.
 */
const ITEMS = [
  { key: 'price', label: '가격 · 요금 정보', needsValue: true },
  { key: 'contact', label: '영업시간 · 연락처', needsValue: true },
  { key: 'address', label: '주소 · 위치', needsValue: true },
  { key: 'closed', label: '영업 종료 · 폐업', needsValue: false },
] as const;

type ItemKey = (typeof ITEMS)[number]['key'];

/**
 * 정보 오류 제보 · WP-VEND-008(RN 정본 frame-011). 「무엇이 틀렸나요?」 라디오 4 → 「올바른
 * 정보」 → 「근거 링크 · 선택」 → CTA «제출하기». 2026-09-24 RN 정본 대조로 정본에 없던 머리
 * 두 줄(«어떤 정보가 틀렸나요?»)과 안내 상자(«확인하고 알려드려요»)를 걷어내고 항목을 정본
 * 넷으로 바꿨다 — 항목 이름은 접수 본문 첫 줄일 뿐 분류에 걸려 있지 않았다.
 *
 * 업체 상세 「정보」 탭(WP-VEND-004)의 «정보가 틀렸나요? 제보하기»가 여기로 온다. 그전에는
 * 범용 문의 화면(`/my/contact`)이 항목만 채워진 채 열려서, 무엇이 틀렸는지 사용자가 문장으로
 * 적어야 했다.
 *
 * 접수는 이미 있는 창구를 쓴다 — `POST /v1/inquiries`의 `data_correction`(업체 정보 정정)이고
 * `subject`로 이 업체를 가리킨다. 새 라우트도 새 표도 만들지 않았다.
 *
 * **시안의 «지금 정보 · 오전 10시~오후 8시»는 적지 않는다.** 주소는 이제 상세가 내려주지만,
 * 영업시간 · 연락처는 `vendorDetailSchema`에 없다. 없는 값을 «지금 정보»라고 적을 수는 없으므로,
 * 그 자리는 서버가 실제 영업시간·연락처를 내려주기 시작하면 채운다.
 */
export default function FixReportScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const depthBack = useDepthBack();
  const theme = useTheme();

  const [item, setItem] = useState<ItemKey | null>(null);
  const [value, setValue] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const chosen = ITEMS.find((one) => one.key === item) ?? null;
  const evidenceUrl = evidence.trim();
  const evidenceBad = evidenceUrl.length > 0 && !/^https?:\/\/\S+$/.test(evidenceUrl);
  const ready =
    chosen !== null && !evidenceBad && (!chosen.needsValue || value.trim().length > 0);

  async function submit() {
    if (!ready || busy || chosen === null) return;

    setBusy(true);
    try {
      /* 무엇이 틀렸는지 · 무엇이 맞는지를 한 줄씩. 접수한 사람이 그대로 읽는다. */
      const body = [chosen.label, value.trim() ? `${S.correct}: ${value.trim()}` : null]
        .filter((line): line is string => line !== null)
        .join('\n');

      const received = await createInquiry({
        category: 'data_correction',
        body,
        subject: { kind: 'vendor', id: vendorId },
        ...(evidenceUrl.length > 0 && { evidenceUrl }),
      });

      setDone(received.acknowledgement);
      showResultToast('정보 수정 요청을 보냈어요');
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : S.failed);
    } finally {
      setBusy(false);
    }
  }

  /* 접수 완료(states «제출 완료»). 접수 문구는 서버가 만든 것을 그대로 보여준다. */
  if (done !== null) {
    return (
      <SubScreen
        title={S.title}
        dock={<Dock primary={{ label: '확인', onPress: depthBack }} />}>
        <Hero lines={['제보를 받았어요', '확인하고 알려드릴게요']} />
        <Section>
          <NoteBox title={done} />
        </Section>
      </SubScreen>
    );
  }

  return (
    <SubScreen
      title={S.title}
      dock={
        <Dock
          primary={{
            label: busy ? S.sending : S.cta,
            disabled: !ready || busy,
            onPress: () => void submit(),
          }}
        />
      }>
      {/*
        정본 WP-VEND-008(frame-011): `sec`(안쪽 20 · 사이 12 · 제목 17/700) 셋 — 고르는 줄(`rptRow` 최소 52 ·
        좌우 16 · 사이 12 · 아래 선 1 · 원 22 · 15 잉크) → 넓은 입력(`rptArea` 최소 100 · radius 8 · 회색 면 ·
        안쪽 14) → 한 줄 입력(`rptInput` 48 · radius 8 · 회색 면 · 좌우 14). 자리 표시 글자 14 보조색.
      */}
      {/* 정본은 고르는 줄이 `sec`의 바로 아래 자식이다 — 줄 사이에도 사이 12가 든다. */}
      <FixSection title={S.itemGroup}>
        {ITEMS.map((one) => (
          <Pressable
            key={one.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: item === one.key }}
            accessibilityLabel={one.label}
            onPress={() => setItem(one.key)}
            style={[styles.rptRow, { borderBottomColor: theme.border }]}>
            <CheckCircle size={RPT_MARK} checked={item === one.key} outline />
            <ThemedText type="f15" style={styles.rptLabel}>
              {one.label}
            </ThemedText>
          </Pressable>
        ))}
      </FixSection>

      <FixSection title={S.correct}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={S.correctPlaceholder}
          placeholderTextColor={theme.textAssistive}
          accessibilityLabel={S.correct}
          multiline
          textAlignVertical="top"
          editable={chosen === null || chosen.needsValue}
          style={[styles.rptArea, { backgroundColor: theme.backgroundSelected, color: theme.text }]}
        />
      </FixSection>

      <FixSection title={S.evidence}>
        <TextInput
          value={evidence}
          onChangeText={setEvidence}
          placeholder={S.evidencePlaceholder}
          placeholderTextColor={theme.textAssistive}
          accessibilityLabel={S.evidence}
          autoCapitalize="none"
          keyboardType="url"
          style={[styles.rptInput, { backgroundColor: theme.backgroundSelected, color: theme.text }]}
        />
        {evidenceBad ? (
          <ThemedText type="f13" themeColor="negative">
            {S.evidenceInvalid}
          </ThemedText>
        ) : null}
      </FixSection>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </SubScreen>
  );
}

/** 정본 `sec` — 안쪽 20(좌우는 전역 거터 24) · 사이 12 · 제목 17/700. */
function FixSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.sec}>
      <ThemedText type="f17" style={styles.bold}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

/** 정본 `rpt` 원 22 · `rptArea` 최소 높이 100(콘텐츠) + 위아래 14 = 128(RN minHeight는 안쪽 여백을 포함한다). */
const RPT_MARK = 22;
const RPT_AREA_MIN = 128;

const styles = StyleSheet.create({
  sec: {
    paddingHorizontal: Layout.pageX,
    paddingVertical: Layout.cardPadding,
    gap: Layout.inlineGap,
  },
  bold: { fontWeight: 700 },
  rptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    minHeight: Layout.controlXLarge,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: Border.hairline,
  },
  rptLabel: { flex: 1 },
  rptArea: {
    minHeight: RPT_AREA_MIN,
    borderRadius: Radius.picker,
    padding: Layout.fieldPaddingX,
    fontSize: FontSize.f14,
    lineHeight: LineHeight.lh20,
  },
  rptInput: {
    height: Layout.searchField,
    borderRadius: Radius.picker,
    paddingHorizontal: Layout.fieldPaddingX,
    fontSize: FontSize.f14,
  },
});
