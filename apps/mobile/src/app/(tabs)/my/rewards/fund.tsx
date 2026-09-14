import { MONTHLY_DRAW_NOTICE } from '@weddingpick/domain';

import { ErrorView } from '@weddingpick/ui';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { drawBadgeKind, useBenefitData, won } from '@/features/membership/use-benefit-data';
import {
  CampaignCard,
  CardList,
  CheckDot,
  Hero,
  NoteBox,
  Row,
  Rows,
  Section,
  SubScreen,
} from '@/features/settings/my-kit';

/** 시안 15-events WP-EVT-005. */
const S = {
  title: '웨딩지원금',
  /*
   * 시안(15-events WP-EVT-005)의 eyebrow는 «이번 회차 · 진행 중»이고, 그 아래 카드
   * 배지는 «응모 완료»다 — **회차의 상태**와 **내 응모 상태**로 서로 다른 값이다.
   * 코드는 둘 다 `draw.statusLabel`(내 응모 상태)을 넣어서 같은 말이 위아래로 두 번
   * 나왔다. 2026-09-11 대표 지시(MY 중첩)에 해당한다.
   *
   * 회차 상태는 서버가 주지 않는다 — 없는 값을 「진행 중」으로 지어내지 않는다.
   * 상태는 카드 배지 한 곳에만 두고 eyebrow에서는 뺀다.
   */
  eyebrow: '이번 회차',
  hero: (amount: string, winners: number) => `웨딩지원금\n${amount} · ${winners}커플`,
  thisRound: '이번 회차',
  conditions: '응모 조건',
  done: '완료',
  todo: '필요',
  noteTitle: '조건을 채우면 자동으로 응모돼요',
  noteBody: '새 회차가 열리면 알려드려요.',
} as const;

/**
 * 월간 웨딩지원금 · WP-EVT-005. 회차와 조건만 담는다.
 *
 * 마감일 · 발표일 · 당첨 확률처럼 운영이 바뀌면 틀리는 숫자는 화면에 적지 않는다(SPEC §11.3).
 * 지난 회차 결과는 응답에 없어 카드를 두지 않는다.
 */
export default function FundScreen() {
  const { draw, loading, error, reload } = useBenefitData();

  if (error) return <ErrorView message={error} onRetry={reload} />;
  if (!draw) return loading ? <DelayedLoadingView /> : <ErrorView message={MONTHLY_DRAW_NOTICE} onRetry={reload} />;

  return (
    <SubScreen title={S.title}>
      <Hero
        eyebrow={S.eyebrow}
        lines={S.hero(won(draw.amountKrw), draw.winnersPerMonth).split('\n')}
      />

      <Section gap="events">
        <CardList>
          <CampaignCard
            badge={draw.statusLabel}
            badgeKind={drawBadgeKind(draw.status)}
            title={S.thisRound}
            body={draw.statusNote}
          />
        </CardList>
      </Section>

      <Section gap="events" title={S.conditions}>
        <Rows>
          {draw.conditions.map((condition) => (
            <Row
              key={condition.key}
              lead={<CheckDot on={condition.done} />}
              name={condition.label}
              tail={condition.done ? S.done : S.todo}
              tailBadge={condition.done ? 'ok' : 'wait'}
            />
          ))}
        </Rows>
      </Section>

      <Section gap="events">
        <NoteBox title={S.noteTitle} body={S.noteBody} />
      </Section>
    </SubScreen>
  );
}
