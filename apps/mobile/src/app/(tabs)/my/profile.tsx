import type { CurrentUser } from '@weddingpick/api-contract';
import { DISPLAY_NAME_HINT, MAX_DISPLAY_NAME_LENGTH, checkDisplayName, formatCount } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import {
  ActionButton,
  ErrorView,
  FontSize,
  Layout,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';
import { getCurrentUser, listMyReports, setDisplayName } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import { useSession } from '@/features/auth/use-session';
import { BottomSheet, SHEET_PANEL } from '@/features/common/bottom-sheet';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { Avatar, NoteBox, Row, Rows, Section, SubScreen } from '@/features/settings/my-kit';

/** 시안 `docs/design/figma-export/07-lounge-my.dc.html` 4-5 · screens.json WP-MY-002. */
const S = {
  title: '프로필',
  basic: '기본',
  name: '이름',
  nameEmpty: '정하기',
  settings: '설정',
  notification: '알림 설정',
  display: '화면 설정',
  account: '계정',
  social: '소셜 로그인',
  connected: '연결됨',
  pick: 'Pick 인증',
  pickMeta: (n: number) => `실 제보 ${formatCount(n)}건`,
  verified: '인증됨',
  notYet: '인증 전',
  logout: '로그아웃',
  withdraw: '회원 탈퇴',
  logoutTitle: '로그아웃할까요',
  logoutBody: '기기에 저장된 문서는 그대로 남아요',
  stay: '그만두기',
  logoutFail: '로그아웃하지 못했어요',
  noteTitle: '이름은 배우자와 후기에만 보여요',
  noteBody: '다른 사용자에게는 김OO처럼 일부만 보여드려요.',
  sheetTitle: '어떻게 불러드릴까요?',
  placeholder: '비워두면 이름 없이 인사해요',
  cancel: '취소',
  save: '저장',
  saving: '저장하는 중…',
  saveFail: '이름을 바꾸지 못했어요',
} as const;

/**
 * 프로필 · WP-MY-002 · 시안 4-5. MY 상단 프로필 카드를 누르면 들어온다.
 *
 * **MY의 설정 섹션을 흡수했다**(시안 「설정 섹션을 흡수해 이름 · 알림 · 계정을 한 화면에서
 * 다룹니다. 로그아웃과 탈퇴가 맨 아래입니다」). 알림은 스위치가 여럿이라 한 행으로 두고
 * 알림 설정 화면으로 보낸다 — 시안의 스위치 셋 중 둘(마케팅 · 야간)이 그 화면에 있다. 화면
 * 설정은 시안에 없지만 스킨 화면의 유일한 진입이라 같은 묶음에 둔다.
 *
 * 이름만 바꾼다. 사진 바꾸기 · 제공자별 연결 계정 · 배우자에게 보이는 이름은 계약이 없어
 * 두지 않는다 — 이름은 배우자에게도 그대로 보인다.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const { signOut } = useSession();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [proofCount, setProofCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    void getCurrentUser()
      .then((response) => {
        setLoadError(null);
        setMe(response);
      })
      .catch((caught: Error) => setLoadError(caught.message ?? '프로필을 불러오지 못했어요'));
    void listMyReports()
      .then((response) =>
        setProofCount(response.reports.filter((report) => report.kind === 'payment_proof' && report.inUse).length)
      )
      .catch(() => setProofCount(null));
  }, []);

  useEffect(load, [load]);

  const nameCheck = checkDisplayName(nameDraft);
  /* 비우는 것도 허용한다. 한 번 적었다고 영영 못 지우게 할 이유가 없다. */
  const nameReady = nameDraft.trim() === '' || nameCheck.ok;

  async function saveName() {
    if (!nameReady || !me) return;
    setSaving(true);
    try {
      const next = nameDraft.trim() === '' ? null : nameDraft.trim();
      const saved = await setDisplayName(next);
      setMe({ ...me, displayName: saved.displayName });
      setNameOpen(false);
    } catch {
      setToast(S.saveFail);
    } finally {
      setSaving(false);
    }
  }

  function confirmSignOut() {
    confirmAlert(S.logoutTitle, S.logoutBody, [
      { text: S.stay, style: 'cancel' },
      {
        text: S.logout,
        style: 'destructive',
        onPress: () => {
          void signOut()
            .then(() => router.replace('/login'))
            .catch(() => setToast(S.logoutFail));
        },
      },
    ]);
  }

  if (loadError) return <ErrorView message={loadError} onRetry={load} />;
  if (!me) return <DelayedLoadingView />;

  return (
    <SubScreen title={S.title}>
      {/* 아바타 88 — 시안 avatarBig. */}
      <View style={styles.avatarWrap}>
        <Avatar initial={me.displayName?.slice(0, 1) ?? '나'} size={Layout.avatarLarge} />
      </View>

      <Section title={S.basic}>
        <Rows>
          <Row
            name={S.name}
            tail={me.displayName ?? S.nameEmpty}
            tailDim={!me.displayName}
            chevron
            onPress={() => {
              setNameDraft(me.displayName ?? '');
              setNameOpen(true);
            }}
          />
        </Rows>
      </Section>

      <Section>
        <NoteBox title={S.noteTitle} body={S.noteBody} />
      </Section>

      <Section title={S.settings}>
        <Rows>
          <Row name={S.notification} chevron onPress={() => router.push('/my/notification-settings' as never)} />
          <Row name={S.display} chevron onPress={() => router.push('/my/display' as never)} />
        </Rows>
      </Section>

      {/* 시안 「계정」 — 연결된 로그인 · 로그아웃 · 회원 탈퇴(맨 아래 · 회색 · 강조하지 않는다). */}
      <Section title={S.account}>
        <Rows>
          <Row name={S.social} tail={S.connected} tailBadge="ok" />
          <Row
            name={S.pick}
            meta={proofCount !== null && proofCount > 0 ? S.pickMeta(proofCount) : undefined}
            tail={me.hasPaymentProof ? S.verified : S.notYet}
            tailBadge={me.hasPaymentProof ? 'ok' : 'none'}
          />
          <Row name={S.logout} chevron onPress={confirmSignOut} />
          <Row name={S.withdraw} off chevron onPress={() => router.push('/my/withdrawal' as never)} />
        </Rows>
      </Section>

      <BottomSheet dismissible={false} visible={nameOpen} onRequestClose={() => setNameOpen(false)}>
        <ThemedView style={[SHEET_PANEL, styles.sheet]}>
          <ThemedText type="t3">{S.sheetTitle}</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
            value={nameDraft}
            onChangeText={setNameDraft}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            placeholder={S.placeholder}
            placeholderTextColor={theme.textAssistive}
            accessibilityLabel={S.name}
          />
          <ThemedText type="t7" themeColor={nameReady ? 'textAssistive' : 'negative'}>
            {nameReady ? DISPLAY_NAME_HINT : nameCheck.ok ? DISPLAY_NAME_HINT : nameCheck.reason}
          </ThemedText>
          <View style={styles.sheetActions}>
            <View style={styles.sheetGhost}>
              <ActionButton size="xlarge" label={S.cancel} onPress={() => setNameOpen(false)} />
            </View>
            <View style={styles.sheetPrimary}>
              <ActionButton
                variant="primary"
                size="xlarge"
                label={saving ? S.saving : S.save}
                disabled={!nameReady || saving}
                onPress={() => void saveName()}
              />
            </View>
          </View>
        </ThemedView>
      </BottomSheet>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  /* 시안 profile: padding 20 24 28 · 가운데 */
  avatarWrap: {
    alignItems: 'center',
    paddingTop: Layout.cardPadding,
    paddingBottom: Layout.sectionGap,
  },
  sheet: { padding: Layout.gutter, paddingBottom: Layout.sectionGap, gap: Spacing.three },
  input: {
    height: Layout.field,
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: Layout.fieldPaddingX,
    fontSize: FontSize.t6,
  },
  sheetActions: { flexDirection: 'row', gap: Spacing.two },
  sheetGhost: { flex: 1 },
  sheetPrimary: { flex: 1.4 },
});
