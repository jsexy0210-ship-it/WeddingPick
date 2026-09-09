import { checkPromotionUrl } from '@weddingpick/domain';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ErrorView, FontSize, Layout, Radius, Spacing, ThemedText, Toast, useTheme } from '@weddingpick/ui';
import { submitPromotion } from '@/api/client';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { PROMOTION_REWARD, grantBadgeKind, grantsOf, useBenefitData } from '@/features/membership/use-benefit-data';
import {
  Badge,
  CheckDot,
  Dock,
  Hero,
  NoteBox,
  Row,
  Rows,
  Section,
  SectionTitle,
  SubScreen,
} from '@/features/settings/my-kit';

/** 시안 15-events WP-EVT-004. */
const S = {
  title: '홍보 인증',
  hero: '올린 글 주소만\n남겨주세요',
  sub: `1인 1회 · ${PROMOTION_REWARD}`,
  howTitle: '이렇게 올려주세요',
  how: [
    { name: '블로그 · 인스타그램 · 카페', meta: '공개 게시물이어야 해요' },
    { name: '웨딩픽을 써본 이야기', meta: '두 문장 이상' },
    { name: '앱 화면 캡처 한 장', meta: '어느 화면이든 괜찮아요' },
  ],
  urlLabel: '게시물 주소',
  urlPlaceholder: '올린 글 주소를 붙여주세요',
  noteTitle: '확인 후 알려드려요',
  noteBody: '보완할 게 있으면 어떤 부분인지 알려드릴게요.',
  cta: '인증 신청',
  sent: '글 주소를 보냈어요. 확인 후 알려드려요',
  fail: '보내지 못했어요',
  doneTitle: '신청한 글',
} as const;

/**
 * 홍보 인증 · WP-EVT-004. 어디에 어떻게 올려야 하는지를 먼저 알려주고, 주소 한 칸만 받는다.
 * 1인 1회 — 이미 냈으면 그 상태를 보여주고 입력 칸은 두지 않는다.
 *
 * 글을 열어보지 않는다. 주소의 꼴만 여기서 보고, 글이 실제로 있는지는 사람이 본다.
 */
export default function PromotionScreen() {
  const theme = useTheme();
  const { rewards, loading, error, reload } = useBenefitData();
  const [url, setUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (error) return <ErrorView message={error} onBack={reload} />;
  if (!rewards) return loading ? <DelayedLoadingView /> : <ErrorView message="정보를 불러오지 못했어요" onBack={reload} />;

  const submitted = grantsOf(rewards, 'promotion')[0];
  const check = checkPromotionUrl(url);

  async function send() {
    if (!check.ok) {
      setToast(check.message);
      return;
    }
    setSending(true);
    try {
      await submitPromotion(url.trim());
      setUrl('');
      setToast(S.sent);
      reload();
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : S.fail);
    } finally {
      setSending(false);
    }
  }

  return (
    <SubScreen
      title={S.title}
      dock={
        submitted ? undefined : (
          <Dock
            primary={{
              label: S.cta,
              disabled: sending || url.trim().length === 0,
              onPress: () => void send(),
            }}
          />
        )
      }>
      <Hero lines={S.hero.split('\n')} sub={S.sub} />

      <Section gap="events" title={S.howTitle}>
        <Rows>
          {S.how.map((step) => (
            <Row key={step.name} lead={<CheckDot on />} name={step.name} meta={step.meta} />
          ))}
          {submitted ? (
            <Row
              lead={<CheckDot on />}
              name={S.urlLabel}
              meta={submitted.statusNote}
              tail={submitted.statusLabel}
              tailBadge={grantBadgeKind(submitted.status)}
            />
          ) : null}
        </Rows>
      </Section>

      {submitted ? null : (
        <Section gap="events">
          <SectionTitle>{S.urlLabel}</SectionTitle>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder={S.urlPlaceholder}
            placeholderTextColor={theme.textAssistive}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            maxLength={500}
            accessibilityLabel={S.urlLabel}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.fieldBorder, backgroundColor: theme.background },
            ]}
          />
        </Section>
      )}

      {submitted?.status === 'blocked' && submitted.decisionNote ? (
        <Section gap="events">
          <View style={styles.decision}>
            <Badge kind="no">{submitted.statusLabel}</Badge>
            <ThemedText type="body" themeColor="textSecondary">
              {submitted.decisionNote}
            </ThemedText>
          </View>
        </Section>
      ) : null}

      <Section gap="events">
        <NoteBox title={S.noteTitle} body={S.noteBody} />
      </Section>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  /* 입력 필드 52 · radius 6 · 1 테두리 — spec/tokens.json size.field. 글자는 본문 16. */
  input: {
    height: Layout.field,
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
    fontSize: FontSize.t6,
  },
  decision: { gap: Spacing.two },
});
