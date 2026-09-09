import { REFERRAL_CODE_LENGTH } from '@weddingpick/domain';
import { useState } from 'react';
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
import { redeemReferral } from '@/api/client';
import { shareOrCopy } from '@/components/share-or-copy';
import { BottomSheet, SHEET_PANEL } from '@/features/common/bottom-sheet';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import {
  REFERRAL_REWARD,
  grantsOf,
  paidSum,
  useBenefitData,
  won,
} from '@/features/membership/use-benefit-data';
import {
  Dock,
  EmptyBox,
  Hero,
  NoteBox,
  Row,
  Rows,
  Section,
  StatBox,
  SubScreen,
} from '@/features/settings/my-kit';

/** `spec/strings.ko.json` `referral.*` · 시안 15-events WP-EVT-003. */
const S = {
  title: '친구 초대',
  hero: `친구가 시작하면\n${REFERRAL_REWARD}을 받아요`,
  sub: '친구의 첫 Pick 인증이 확인되면 지급돼요',
  statNote: (n: number) => (n > 0 ? `${n}명 받음` : '아직 받은 리워드가 없어요'),
  statsSection: '초대 현황',
  qualified: 'Pick 인증을 마친 친구',
  waiting: 'Pick 인증 전인 친구',
  unit: (n: number) => `${n}명`,
  paidBadge: '지급 대상',
  waitBadge: '대기',
  'empty.title': '아직 초대한 친구가 없어요',
  'empty.body': '코드를 공유하면 이곳에 현황이 나와요',
  redeemRow: '받은 초대 코드 넣기',
  redeemMeta: '친구가 보내준 코드가 있다면',
  noteTitle: '내 초대 코드',
  noteBody: (code: string) => `${code} · 초대 링크에 코드가 함께 담겨요.`,
  'cta.copy': '코드 복사',
  'cta.share': '초대 링크 보내기',
  shareText: (code: string) => `웨딩픽에서 제보 금액을 확인하고 Pick해보세요. 초대 코드: ${code}`,
  codeCopied: '코드를 복사했어요',
  sheetTitle: '받은 초대 코드를 넣어주세요',
  sheetPlaceholder: 'ABC234',
  sheetCancel: '취소',
  sheetSubmit: '코드 넣기',
  redeemed: '초대 코드를 넣었어요',
  redeemFail: '넣지 못했어요',
} as const;

/**
 * 친구 초대 · WP-EVT-003. 내 코드와 지금까지 받은 것을 먼저 보여주고, 초대한 친구의 상태를
 * 단계로 나눈다.
 *
 * 초대받은 사람이 누구인지는 응답에 없다 — 이름 대신 수만 적는다. 「남은 자리 31/50건」도
 * 응답에 없어 적지 않는다.
 */
export default function ReferralScreen() {
  const theme = useTheme();
  const { rewards, loading, error, reload } = useBenefitData();
  const [toast, setToast] = useState<string | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);

  if (error) return <ErrorView message={error} onRetry={reload} />;
  if (!rewards) return loading ? <DelayedLoadingView /> : <ErrorView message="초대 현황을 불러오지 못했어요" onRetry={reload} />;

  const referralGrants = grantsOf(rewards, 'referral');
  const paidCount = referralGrants.filter((grant) => grant.status === 'paid').length;
  const waitingCount = Math.max(0, rewards.invitedCount - rewards.qualifiedCount);

  async function share() {
    /* 공유되는 건 코드와 안내뿐이다. 내 견적·계약 정보는 들어가지 않는다. */
    const result = await shareOrCopy(S.shareText(rewards!.referralCode));
    if (result.copied) setToast(S.codeCopied);
  }

  async function copy() {
    const result = await shareOrCopy(rewards!.referralCode);
    if (result.copied || result.shared) setToast(S.codeCopied);
  }

  async function redeem() {
    setSending(true);
    try {
      await redeemReferral(code.trim().toUpperCase());
      setCode('');
      setRedeemOpen(false);
      setToast(S.redeemed);
      reload();
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : S.redeemFail);
    } finally {
      setSending(false);
    }
  }

  return (
    <SubScreen
      title={S.title}
      dock={
        <Dock
          secondary={{ label: S['cta.copy'], onPress: () => void copy() }}
          primary={{ label: S['cta.share'], onPress: () => void share() }}
        />
      }>
      <Hero lines={S.hero.split('\n')} sub={S.sub} />

      <Section gap="events">
        <StatBox value={won(paidSum(referralGrants))} note={S.statNote(paidCount)} />
      </Section>

      <Section gap="events" title={S.statsSection}>
        {rewards.invitedCount === 0 ? (
          <EmptyBox>{`${S['empty.title']}. ${S['empty.body']}`}</EmptyBox>
        ) : (
          <Rows>
            <Row
              name={S.qualified}
              meta={S.unit(rewards.qualifiedCount)}
              tail={S.paidBadge}
              tailBadge="ok"
            />
            <Row name={S.waiting} meta={S.unit(waitingCount)} tail={S.waitBadge} tailBadge="wait" />
          </Rows>
        )}
        <Rows>
          <Row name={S.redeemRow} meta={S.redeemMeta} chevron onPress={() => setRedeemOpen(true)} />
        </Rows>
      </Section>

      <Section gap="events">
        <NoteBox title={S.noteTitle} body={S.noteBody(rewards.referralCode)} />
      </Section>

      <BottomSheet dismissible={false} visible={redeemOpen} onRequestClose={() => setRedeemOpen(false)}>
        <ThemedView style={[SHEET_PANEL, styles.sheet]}>
          <ThemedText type="t3">{S.sheetTitle}</ThemedText>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder={S.sheetPlaceholder}
            placeholderTextColor={theme.textAssistive}
            autoCapitalize="characters"
            maxLength={REFERRAL_CODE_LENGTH}
            accessibilityLabel={S.redeemRow}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.fieldBorder, backgroundColor: theme.background },
            ]}
          />
          <View style={styles.sheetActions}>
            <View style={styles.sheetGhost}>
              <ActionButton size="xlarge" label={S.sheetCancel} onPress={() => setRedeemOpen(false)} />
            </View>
            <View style={styles.sheetPrimary}>
              <ActionButton
                variant="primary"
                size="xlarge"
                label={S.sheetSubmit}
                disabled={sending || code.trim().length !== REFERRAL_CODE_LENGTH}
                onPress={() => void redeem()}
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
  sheet: {
    padding: Layout.gutter,
    paddingBottom: Layout.sectionGap,
    gap: Spacing.three,
  },
  /* 입력 필드 52 · radius 6 · 1 테두리 — spec/tokens.json size.field. */
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
