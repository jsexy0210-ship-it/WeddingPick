import { REWARDS, type MissionKey } from '@weddingpick/domain';
import { router } from 'expo-router';

import { ErrorView } from '@weddingpick/ui';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import {
  MISSION_REWARD,
  countWord,
  missionCount,
  missionRows,
  useBenefitData,
} from '@/features/membership/use-benefit-data';
import {
  CheckDot,
  Hero,
  NoteBox,
  Row,
  Rows,
  Section,
  StatBox,
  SubScreen,
} from '@/features/settings/my-kit';

/** `spec/strings.ko.json` `benefit.mission*` · 시안 15-events WP-EVT-002. */
const S = {
  title: '미션',
  eyebrow: (done: number, total: number) => `${done} / ${total} 완료`,
  hero: (remaining: number) => `${countWord(remaining)} 남았어요`,
  heroDone: '네 개를 다 채웠어요',
  statNote: `네 개를 다 하면 Npay로 드려요 · 선착순 ${REWARDS.mission.monthlyCap}커플`,
  go: '하기',
  noteTitle: '준비 순서대로 하나씩 채워져요',
  noteBody: '네 개를 다 채우면 Npay로 바로 보내드려요.',
} as const;

/** 미션마다 하러 가는 곳. 서버가 경로를 정하지 않는다 — 화면 이름이 바뀌면 여기만 고친다. */
const MISSION_ROUTE: Record<MissionKey, string> = {
  setup: '/setup',
  first_pick: '/search',
  partner: '/wedding/partner',
  payment_proof: '/capture',
};

/**
 * 미션 4개 · WP-EVT-002. 네 번째가 Pick 인증이다 — 앱 안에서 끝나는 미션만 두면 5천원을 주고
 * 실 제보를 하나도 못 얻는다(CHANGELOG v3.22).
 *
 * 완료한 미션은 회색으로 내린다. 완료 날짜는 응답에 없어 적지 않는다.
 */
export default function MissionsScreen() {
  const { me, loading, error, reload } = useBenefitData();

  if (error) return <ErrorView message={error} onRetry={reload} />;
  if (!me) return loading ? <DelayedLoadingView /> : <ErrorView message="정보를 불러오지 못했어요" onRetry={reload} />;

  const count = missionCount(me);
  const rows = missionRows(me);

  return (
    <SubScreen title={S.title}>
      <Hero
        eyebrow={S.eyebrow(count.done, count.total)}
        lines={[count.remaining === 0 ? S.heroDone : S.hero(count.remaining)]}
      />

      <Section gap="events">
        <StatBox value={MISSION_REWARD} note={S.statNote} progress={count.done / count.total} />
      </Section>

      <Section gap="events">
        <Rows>
          {rows.map((mission) => (
            <Row
              key={mission.key}
              lead={<CheckDot on={mission.done} />}
              name={mission.title}
              meta={mission.done ? undefined : mission.description}
              off={mission.done}
              tail={mission.done ? undefined : S.go}
              tailDim
              onPress={mission.done ? undefined : () => router.push(MISSION_ROUTE[mission.key] as never)}
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
