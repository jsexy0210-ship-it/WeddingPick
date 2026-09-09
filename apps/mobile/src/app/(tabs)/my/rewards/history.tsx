import { REWARD_PAYOUT_COPY, REWARD_PAYOUT_NOTICE, formatDateDot } from '@weddingpick/domain';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ErrorView, Layout } from '@weddingpick/ui';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { grantBadgeKind, paidSum, useBenefitData, won } from '@/features/membership/use-benefit-data';
import {
  EmptyBox,
  NoteBox,
  Row,
  Rows,
  Section,
  StatBox,
  SubScreen,
} from '@/features/settings/my-kit';

/** 시안 15-events WP-EVT-007. */
const S = {
  title: '참여 내역',
  statNote: '받은 리워드 합계',
  statSince: (date: string) => `받은 리워드 합계 · ${date}부터`,
  list: '내역',
  empty: '아직 받은 리워드가 없어요',
  noteTitle: REWARD_PAYOUT_NOTICE,
  noteBody: '한 번 더 확인이 필요한 건은 이유를 함께 적어드려요.',
  payouts: 'Npay 수령',
  retry: REWARD_PAYOUT_COPY.ctaRetry,
} as const;

/**
 * 참여 · 지급 내역 · WP-EVT-007. 지급된 것과 그렇지 않은 것을 같은 목록에 두고,
 * 지급하지 않기로 한 건에는 사유를 붙인다.
 *
 * 합계는 `paid`만 더한다 — 조건만 찬 건(`earned`)은 아직 아무도 돈을 보내지 않았다.
 */
export default function RewardHistoryScreen() {
  const { rewards, payout, loading, error, reload } = useBenefitData();

  if (error) return <ErrorView message={error} onBack={reload} />;
  if (!rewards) return loading ? <DelayedLoadingView /> : <ErrorView message="내역을 불러오지 못했어요" onBack={reload} />;

  const grants = [...rewards.grants].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const paid = grants.filter((grant) => grant.status === 'paid');
  const firstPaid = paid.length > 0 ? paid[paid.length - 1] : undefined;

  return (
    <SubScreen title={S.title}>
      <Section gap="events" style={styles.top}>
        <StatBox
          value={won(paidSum(grants))}
          note={firstPaid ? S.statSince(formatDateDot(firstPaid.createdAt.slice(0, 10))) : S.statNote}
        />
      </Section>

      <Section gap="events" title={S.list}>
        {grants.length === 0 ? (
          <EmptyBox>{S.empty}</EmptyBox>
        ) : (
          <Rows>
            {grants.map((grant) => (
              <Row
                key={grant.id}
                name={grant.kindLabel}
                meta={
                  grant.status === 'paid'
                    ? formatDateDot(grant.createdAt.slice(0, 10))
                    : grant.status === 'blocked' && grant.decisionNote
                      ? grant.decisionNote
                      : grant.statusNote
                }
                tail={grant.status === 'paid' ? won(grant.amountKrw) : grant.statusLabel}
                tailBadge={grant.status === 'paid' ? undefined : grantBadgeKind(grant.status)}
              />
            ))}
          </Rows>
        )}
      </Section>

      {payout && (payout.open || payout.history.length > 0) ? (
        <Section gap="events" title={S.payouts}>
          <Rows>
            {[...(payout.open ? [payout.open] : []), ...payout.history].map((item) => (
              <Row
                key={item.id}
                name={won(item.amountKrw)}
                meta={
                  item.status === 'failed'
                    ? (item.failureReason ?? item.statusNote)
                    : item.settledAt
                      ? formatDateDot(item.settledAt.slice(0, 10))
                      : item.statusNote
                }
                tail={item.status === 'failed' && payout.receivableKrw > 0 ? S.retry : item.statusLabel}
                tailBadge={item.status === 'sent' ? 'ok' : item.status === 'failed' ? (payout.receivableKrw > 0 ? 'brand' : 'no') : 'wait'}
                onPress={item.status === 'failed' && payout.receivableKrw > 0 ? () => router.push('/my/rewards/npay' as never) : undefined}
                chevron={item.status === 'failed' && payout.receivableKrw > 0}
              />
            ))}
          </Rows>
        </Section>
      ) : null}

      <Section gap="events">
        <NoteBox title={S.noteTitle} body={S.noteBody} />
      </Section>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  /* 히어로가 없는 화면 — 합계 박스가 nav 바로 아래 12에서 시작한다(padHero의 위 여백). */
  top: { paddingTop: Layout.rowPaddingY },
});
