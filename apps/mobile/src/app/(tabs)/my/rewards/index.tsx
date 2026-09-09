import { MISSION_COMPLETE_REWARD_NOTIFICATION, REWARDS, REWARD_PAYOUT_COPY } from '@weddingpick/domain';
import { router } from 'expo-router';

import { ErrorView } from '@weddingpick/ui';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import {
  MISSION_REWARD,
  PROMOTION_REWARD,
  REFERRAL_REWARD,
  drawBadgeKind,
  grantBadgeKind,
  grantsOf,
  missionCount,
  useBenefitData,
  won,
} from '@/features/membership/use-benefit-data';
import {
  CampaignCard,
  CardList,
  Hero,
  NavAction,
  NoteBox,
  Section,
  SubScreen,
} from '@/features/settings/my-kit';

/** `spec/strings.ko.json` `benefit.*` · 시안 15-events WP-EVT-001. */
const S = {
  title: '혜택',
  history: '참여 내역',
  hero: (n: number, amount: string) => `${n}개를 더 하면\n${amount}을 받아요`,
  heroDone: MISSION_COMPLETE_REWARD_NOTIFICATION.title,
  sub: `커플당 한 번 · 선착순 ${REWARDS.mission.monthlyCap}커플`,
  mission: '미션 4개 완주',
  missionDesc: '업체 검색 · 준비 관리 · 배우자 연결 · Pick 인증',
  missionBadge: (done: number, total: number) => `진행 중 ${done}/${total}`,
  missionBadgeDone: '완주',
  missionCta: '이어서 하기',
  missionCtaDone: '지급 대상',
  invite: '친구 초대',
  inviteDesc: '친구가 첫 Pick 인증을 하면 받아요',
  inviteCta: '초대 링크 보내기',
  promo: '홍보 인증',
  promoDesc: '블로그나 SNS에 올린 글 주소를 남겨주세요',
  promoCta: '인증하기',
  promoCtaDone: '신청 완료',
  fund: '웨딩지원금',
  fundPast: '지난 웨딩지원금',
  fundCta: '응모 조건 보기',
  fundCtaPast: '응모 내역 보기',
  noteTitle: '준비하면서 자연스럽게 받아요',
  noteBody: '준비하다 보면 하나씩 채워져요.',
  /** Npay 수령(WP-EVT-006) — 받을 수 있는 금액이 있을 때만 맨 위 카드. */
  payoutTitle: '리워드 받기',
  payoutBody: REWARD_PAYOUT_COPY.sub,
  payoutOpenBody: REWARD_PAYOUT_COPY.requested,
  payoutCta: (amount: string) => REWARD_PAYOUT_COPY.cta(amount),
  payoutCtaOpen: '확인 중',
} as const;

/**
 * 혜택 모아보기 · WP-EVT-001. Root 탭이 아니라 MY와 홈 하단 한 줄에서만 들어온다.
 *
 * 참여할 수 있는 것을 위로, 끝난 캠페인은 회색으로 내린다. **날짜와 기간을 적지 않는다** —
 * 운영이 바뀌면 전부 틀린다(SPEC §11.3). 응답에 없는 숫자(«27/40커플 남음»)도 적지 않는다.
 */
export default function BenefitsScreen() {
  const { me, rewards, draw, payout, loading, error, reload } = useBenefitData();

  if (error) return <ErrorView message={error} onBack={reload} />;
  if (loading && !me && !rewards && !draw) return <DelayedLoadingView />;

  const missions = me ? missionCount(me) : null;
  const missionsDone = missions !== null && missions.remaining === 0;
  const promotion = grantsOf(rewards, 'promotion')[0];
  const fundPast = draw?.status === 'not_won';

  return (
    <SubScreen
      title={S.title}
      right={<NavAction label={S.history} onPress={() => router.push('/my/rewards/history' as never)} />}>
      {missions ? (
        <Hero
          lines={missionsDone ? [S.heroDone] : S.hero(missions.remaining, MISSION_REWARD).split('\n')}
          sub={S.sub}
        />
      ) : null}

      <Section gap="events">
        <CardList>
          {payout && (payout.receivableKrw > 0 || payout.open) ? (
            <CampaignCard
              brand={!payout.open}
              badge={payout.open ? payout.open.statusLabel : won(payout.receivableKrw)}
              badgeKind={payout.open ? 'wait' : 'brand'}
              title={S.payoutTitle}
              body={payout.open ? payout.open.statusNote : S.payoutBody}
              cta={payout.open ? S.payoutCtaOpen : S.payoutCta(won(payout.receivableKrw))}
              ctaOff={Boolean(payout.open)}
              onPress={() => router.push('/my/rewards/npay' as never)}
            />
          ) : null}
          {missions ? (
            <CampaignCard
              brand={!missionsDone}
              badge={missionsDone ? S.missionBadgeDone : S.missionBadge(missions.done, missions.total)}
              badgeKind={missionsDone ? 'ok' : 'brand'}
              title={S.mission}
              body={S.missionDesc}
              progress={missions.done / missions.total}
              cta={missionsDone ? S.missionCtaDone : S.missionCta}
              ctaOff={missionsDone}
              onPress={() => router.push('/my/rewards/missions' as never)}
            />
          ) : null}

          <CampaignCard
            badge={REFERRAL_REWARD}
            title={S.invite}
            body={S.inviteDesc}
            cta={S.inviteCta}
            onPress={() => router.push('/my/referral' as never)}
          />

          <CampaignCard
            badge={promotion ? promotion.statusLabel : PROMOTION_REWARD}
            badgeKind={promotion ? grantBadgeKind(promotion.status) : 'none'}
            title={S.promo}
            body={S.promoDesc}
            cta={promotion ? S.promoCtaDone : S.promoCta}
            ctaOff={Boolean(promotion)}
            onPress={() => router.push('/my/rewards/promotion' as never)}
          />

          {draw ? (
            <CampaignCard
              badge={fundPast ? draw.statusLabel : won(draw.amountKrw)}
              badgeKind={fundPast ? 'none' : drawBadgeKind(draw.status)}
              title={fundPast ? S.fundPast : S.fund}
              body={draw.statusNote}
              cta={fundPast ? S.fundCtaPast : S.fundCta}
              ctaOff={fundPast}
              onPress={() => router.push('/my/rewards/fund' as never)}
            />
          ) : null}
        </CardList>
      </Section>

      <Section gap="events">
        <NoteBox title={S.noteTitle} body={S.noteBody} />
      </Section>
    </SubScreen>
  );
}
