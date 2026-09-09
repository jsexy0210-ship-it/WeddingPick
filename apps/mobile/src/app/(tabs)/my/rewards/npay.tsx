import {
  RECIPIENT_NAME_MAX,
  REWARD_PAYOUT_COPY as C,
  REWARD_PAYOUT_METHOD_LABEL,
  formatDateDot,
  formatMobilePhoneInput,
  normalizeMobilePhone,
} from '@weddingpick/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ErrorView, NpayLogo, Spacing, TextField, ThemedText, Toast } from '@weddingpick/ui';
import { requestRewardPayout } from '@/api/client';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { useBenefitData, won } from '@/features/membership/use-benefit-data';
import {
  Badge,
  CheckDot,
  Dock,
  Hero,
  KeyValueRow,
  NoteBox,
  Row,
  Rows,
  Section,
  SubScreen,
  type BadgeKind,
} from '@/features/settings/my-kit';

/**
 * Npay 리워드 수령 · WP-EVT-006 (시안 15-events #6).
 *
 *   Hero «5,000원을 / 받을 수 있어요» · «받는 분 정보만 확인하면 끝나요»
 *   받는 분 · 휴대폰 번호 · 받는 방법 Npay · 개인정보 제공 동의(필수)
 *   note «리워드를 보내는 데만 써요 / 보내드린 뒤 지워요.»
 *   CTA «5,000원 받기»
 *
 * 상태는 서버가 정한다 — 열린 요청이 있으면 폼 대신 «확인 중»을, 지난 요청은 «지급 완료 ·
 * 지급 실패»를 보여주고, 실패했으면 다시 받을 수 있다(«다시 받기»). 마감일 · 지급 예정일은
 * 적지 않는다(SPEC §11.3).
 */
export default function NpayPayoutScreen() {
  const { payout, loading, error, reload } = useBenefitData();
  /* 받는 분 — 고치기 전에는 부를 이름(서버 기본값)을 그대로 보인다. effect 없이 파생한다. */
  const [nameEdited, setNameEdited] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (error) return <ErrorView message={error} onBack={reload} />;
  if (!payout) return loading ? <DelayedLoadingView /> : <ErrorView message="정보를 불러오지 못했어요" onBack={reload} />;

  const name = nameEdited ?? payout.recipientNameDefault ?? '';
  const amount = won(payout.receivableKrw);
  const open = payout.open;
  const last = payout.history[0];
  const phoneNormalized = normalizeMobilePhone(phone);
  const phoneError = phone.length >= 12 && phoneNormalized === null ? '휴대폰 번호를 확인해주세요' : undefined;
  const canSend =
    !sending && payout.receivableKrw > 0 && name.trim().length > 0 && phoneNormalized !== null && consent;

  async function send() {
    if (phoneNormalized === null) {
      setToast('휴대폰 번호를 확인해주세요');
      return;
    }
    setSending(true);
    try {
      await requestRewardPayout({ recipientName: name.trim(), phone: phoneNormalized, consent: true });
      setToast(C.requested);
      setPhone('');
      setConsent(false);
      reload();
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : '요청하지 못했어요');
    } finally {
      setSending(false);
    }
  }

  /* 열린 요청 — 폼 대신 상태. 번호는 가린 꼴로만 보인다. */
  if (open) {
    return (
      <SubScreen title={C.title} fallback="/my/rewards">
        <Hero eyebrow={open.statusLabel} lines={[`${won(open.amountKrw)}을`, '보내드릴게요']} sub={open.statusNote.split('. ')[0]} />
        <Section gap="events">
          <Rows>
            <KeyValueRow label={C.recipient} value={open.recipientName} />
            <KeyValueRow label={C.phone} value={open.phoneMasked ?? '***'} />
            <KeyValueRow label={C.method} value={REWARD_PAYOUT_METHOD_LABEL} />
          </Rows>
        </Section>
        <Section gap="events">
          <NoteBox title={C.noteTitle} body={C.noteBody} />
        </Section>
        {payout.history.length > 0 ? <History history={payout.history} /> : null}
      </SubScreen>
    );
  }

  const failed = last?.status === 'failed';

  return (
    <SubScreen
      title={C.title}
      fallback="/my/rewards"
      dock={
        payout.receivableKrw > 0 ? (
          <Dock primary={{ label: failed ? C.ctaRetry : C.cta(amount), disabled: !canSend, onPress: () => void send() }} />
        ) : undefined
      }>
      {payout.receivableKrw > 0 ? (
        <Hero lines={C.hero(amount).split('\n')} sub={C.sub} />
      ) : (
        <Hero lines={[C.nothing]} sub={C.nothingBody} />
      )}

      {failed && last ? (
        <Section gap="events">
          <View style={styles.failure}>
            <Badge kind="no">{last.statusLabel}</Badge>
            <ThemedText type="body" themeColor="textSecondary">
              {last.failureReason ?? last.statusNote}
            </ThemedText>
          </View>
        </Section>
      ) : null}

      {payout.receivableKrw > 0 ? (
        <Section gap="events">
          <View style={styles.form}>
            <TextField
              label={C.recipient}
              value={name}
              onChangeText={setNameEdited}
              maxLength={RECIPIENT_NAME_MAX}
              autoCorrect={false}
              accessibilityLabel={C.recipient}
            />
            <TextField
              label={C.phone}
              value={phone}
              onChangeText={(text) => setPhone(formatMobilePhoneInput(text))}
              placeholder="010-0000-0000"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              maxLength={13}
              error={phoneError}
              accessibilityLabel={C.phone}
            />
            <Rows>
              <Row name={C.method} right={<NpayLogo />} />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
                accessibilityLabel={`${C.consent} · ${C.consentRequired}`}
                onPress={() => setConsent((value) => !value)}>
                <Row lead={<CheckDot on={consent} />} name={C.consent} meta={C.consentBody} tail={C.consentRequired} tailDim />
              </Pressable>
            </Rows>
          </View>
        </Section>
      ) : null}

      <Section gap="events">
        <NoteBox title={C.noteTitle} body={C.noteBody} />
      </Section>

      {payout.history.length > 0 ? <History history={payout.history} /> : null}

      <Toast message={toast} onHidden={() => setToast(null)} />
    </SubScreen>
  );
}

/** 지난 요청 — 지급 완료 · 지급 실패. 번호는 이미 지워져 보이지 않는다. */
function History({ history }: { history: NonNullable<ReturnType<typeof useBenefitData>['payout']>['history'] }) {
  return (
    <Section gap="events" title="지난 요청">
      <Rows>
        {history.map((item) => (
          <Row
            key={item.id}
            name={won(item.amountKrw)}
            meta={item.settledAt ? formatDateDot(item.settledAt.slice(0, 10)) : item.statusNote}
            tail={item.statusLabel}
            tailBadge={badgeKindOf(item.status)}
          />
        ))}
      </Rows>
    </Section>
  );
}

function badgeKindOf(status: 'requested' | 'sent' | 'failed'): BadgeKind {
  switch (status) {
    case 'sent':
      return 'ok';
    case 'failed':
      return 'no';
    default:
      return 'wait';
  }
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
  failure: { gap: Spacing.two },
});
