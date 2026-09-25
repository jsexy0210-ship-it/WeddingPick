import type { WithdrawalNotice } from '@weddingpick/api-contract';
import {
  WITHDRAWAL_CONSENT,
  WITHDRAWAL_DELETED_GROUP,
  WITHDRAWAL_DONE_BODY,
  WITHDRAWAL_DONE_GROUP,
  WITHDRAWAL_DONE_TITLE,
  WITHDRAWAL_HEADLINE_LINES,
  WITHDRAWAL_SEPARATED_EMPTY,
  WITHDRAWAL_SEPARATED_GROUP,
  WITHDRAWAL_SEPARATED_NOTE,
  WITHDRAWAL_SHEET_BODY,
  WITHDRAWAL_SHEET_TITLE,
  WITHDRAWAL_SUBMIT,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Border, Layout, ProductSymbol, Radius, Spacing, ThemedText, Toast, useTheme } from '@weddingpick/ui';
import { getWithdrawalNotice, withdraw } from '@/api/client';
import { wipeDevice } from '@/api/session';
import { ConfirmSheet } from '@/features/common/confirm-sheet';
import { showResultToast } from '@/features/navigation/result-toast';
import {
  Dock,
  EmptyBox,
  Hero,
  NoteBox,
  Row,
  Rows,
  Section,
  SubScreen,
} from '@/features/settings/my-kit';

/** `spec/strings.ko.json` `withdraw.*` · 정본 WP-MY-012(docs/design/React_Native/my.jsx frame-014). */
const S = {
  /* 시안(WP-MY-012) navTitle — 「회원탈퇴」 4글자는 붙여 쓴다(전체 공통 규칙). */
  title: '회원탈퇴',
  sheetCancel: '취소',
  done: '로그인으로 돌아가기',
  supportTitle: '문의가 필요하면',
  supportBody: '웨딩픽 웹사이트 고객지원으로 연락해 주세요. 처리 내역을 확인해 드려요.',
  loadFail: '탈퇴 안내를 불러오지 못했어요',
  fail: '탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요',
} as const;

/**
 * 회원탈퇴 · WP-MY-012(docs/design/React_Native/my.jsx frame-014). **지워지는 것과 분리되는 것을 나눠 적는다.** 탈퇴는 개인정보 삭제이지
 * 서비스 정보 삭제가 아니고, 그 차이를 누르기 전에 말하지 않으면 동의가 아니라 오해다.
 *
 * **개수를 화면이 짐작하지 않는다.** 줄은 서버가 세어 보낸다 — 이용약관 제12조 · 개인정보처리방침과
 * 같은 말을 해야 하는데 화면마다 조립하면 갈라진다. 통합 보존기간(30일 등) 숫자는 쓰지 않는다.
 *
 * 완료 화면에 성공 모션을 넣지 않는다. 축하할 일이 아니다.
 */
export default function WithdrawalScreen() {
  const theme = useTheme();
  const [notice, setNotice] = useState<WithdrawalNotice | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    void getWithdrawalNotice()
      .then(setNotice)
      .catch(() => setToast(S.loadFail));
  }, []);

  useEffect(load, [load]);

  async function submit() {
    setSending(true);
    await withdraw()
      .then(async (result) => {
        /* 서버가 계정·세션을 지운 그 자리에서 기기도 비운다 — 다음에 열면 로그인부터 다시다. */
        await wipeDevice();
        setConfirming(false);
        setDone(result.done);
        showResultToast('탈퇴를 마쳤어요');
      })
      .catch(() => setToast(S.fail))
      .finally(() => setSending(false));
  }

  if (done) {
    return (
      <SubScreen
        title={S.title}
        onBack={() => router.replace('/login')}
        dock={<Dock primary={{ label: S.done, onPress: () => router.replace('/login') }} />}>
        {/* 시안 21d — 위 64 띄우고 제목 · 본문. */}
        <View style={styles.doneHero}>
          <Hero lines={[WITHDRAWAL_DONE_TITLE]} sub={WITHDRAWAL_DONE_BODY} />
        </View>
        <Section title={WITHDRAWAL_DONE_GROUP}>
          <Rows>
            {done.map((line) => (
              <View key={line}>
                <View style={styles.doneRow}>
                  <ProductSymbol name="check" size={Layout.iconInline} color={theme.textAssistive} />
                  <ThemedText type="body" themeColor="textSecondary" style={styles.grow}>
                    {line}
                  </ThemedText>
                </View>
                <View style={[styles.hr, { backgroundColor: theme.border }]} />
              </View>
            ))}
          </Rows>
        </Section>
        <Section>
          <NoteBox title={S.supportTitle} body={S.supportBody} />
        </Section>
      </SubScreen>
    );
  }

  return (
    <SubScreen
      title={S.title}
      dock={
        /* 시안(WP-MY-012)은 dockSingle이다 — 취소는 헤더 뒤로가기가 맡고 하단은 실행 버튼 하나뿐. */
        <Dock
          primary={{
            label: WITHDRAWAL_SUBMIT,
            danger: true,
            disabled: !agreed || !notice || sending,
            onPress: () => setConfirming(true),
          }}
        />
      }>
      {/* 정본 qBlock — 제목 두 줄뿐이다. 되돌릴 수 없다는 말은 확인 시트가 한 번 더 한다. */}
      <Hero lines={[...WITHDRAWAL_HEADLINE_LINES]} />

      {/* 정본 delNow — listCard 안 52 행 · 회색 점 5 + 라벨 15. */}
      <Section title={WITHDRAWAL_DELETED_GROUP}>
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Rows>
            {(notice?.deleted ?? []).map((row) => (
              <Row
                key={row.label}
                inset
                lead={<View style={[styles.dot, { backgroundColor: theme.textDisabled }]} />}
                name={row.label}
                off={row.empty}
              />
            ))}
          </Rows>
        </View>
      </Section>

      {/* 정본 delKeep — listCard 안 64 행(라벨 15 · 설명 12) + 카드 아래 note 13/20. */}
      <Section title={WITHDRAWAL_SEPARATED_GROUP}>
        {notice && notice.separated.length === 0 ? (
          <EmptyBox>{WITHDRAWAL_SEPARATED_EMPTY}</EmptyBox>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Rows>
                {(notice?.separated ?? []).map((row) => (
                  <Row key={row.label} inset tall={64} name={row.label} meta={row.note} />
                ))}
              </Rows>
            </View>
            <ThemedText type="f13" themeColor="textAssistive">
              {WITHDRAWAL_SEPARATED_NOTE}
            </ThemedText>
          </>
        )}
      </Section>

      {/* 정본 chkRow — 최소 44 · gap 10 · 네모 22(radius 4) · 15. 동의 없이는 누를 수 없다. */}
      <Section>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          onPress={() => setAgreed((was) => !was)}
          style={styles.consent}>
          {agreed ? (
            <View style={[styles.box, { backgroundColor: theme.tint }]}>
              <ProductSymbol name="check" size={14} color={theme.onTint} />
            </View>
          ) : (
            <View style={[styles.box, styles.boxOff, { borderColor: theme.track }]} />
          )}
          <ThemedText type="f15" style={styles.grow}>
            {WITHDRAWAL_CONSENT}
          </ThemedText>
        </Pressable>
      </Section>

      <ConfirmSheet
        visible={confirming}
        title={WITHDRAWAL_SHEET_TITLE}
        message={WITHDRAWAL_SHEET_BODY}
        confirmLabel={WITHDRAWAL_SUBMIT}
        cancelLabel={S.sheetCancel}
        busy={sending}
        onConfirm={() => void submit()}
        onCancel={() => setConfirming(false)}
      />

      <Toast message={toast} onHidden={() => setToast(null)} />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: Border.hairline, borderRadius: Radius.medium, overflow: 'hidden' },
  /* 정본 delDot 5. */
  dot: { width: 5, height: 5, borderRadius: Radius.pill },
  /* 정본 chkRow — 최소 44 · gap 10 · 가운데 정렬. */
  consent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.cardGap,
    minHeight: Layout.touchTarget,
  },
  /* 정본 chkOn 22 · radius 4 · 흰 체크 14. */
  box: {
    width: 22,
    height: 22,
    borderRadius: Radius.badge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOff: { borderWidth: 1.5 },
  grow: { flex: 1 },
  /* 시안 21d: 완료 제목은 위 64에서 시작 — Hero의 12에 52를 더한다. */
  doneHero: { paddingTop: Layout.controlXLarge },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.cardGap,
    minHeight: Layout.controlXLarge,
    paddingVertical: Layout.rowPaddingY,
  },
  hr: { height: 1, marginTop: Spacing.half },
});
