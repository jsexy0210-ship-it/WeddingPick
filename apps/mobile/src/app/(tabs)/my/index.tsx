import type { CandidateListResponse, CurrentUser, VisitNoteListResponse } from '@weddingpick/api-contract';
import {
  MISSIONS,
  MISSION_COMPLETE_BODY,
  MISSION_COMPLETE_TAGS,
  MISSION_COMPLETE_TITLE,
  WEDDING_PHASE_LABEL,
  allMissionsDone,
  formatWeddingDate,
  isMissionDone,
  weddingPhase,
  type MembershipFacts,
  type MissionKey,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { getCurrentUser, getDataUnlock, listCandidates, listVisitNotes } from '@/api/client';
import { useSession } from '@/features/auth/use-session';
import {
  hasSeenMissionComplete,
  markMissionCompleteSeen,
} from '@/features/membership/mission-seen';

/** 공유되는 건 앱 자체뿐이다. 견적·계약 정보는 포함하지 않는다 — 사업계획서 12번. */
const SHARE_MESSAGE =
  '웨딩픽 — 같은 업체도, 결제 금액은 달라요. 실제 결제 사례와 나란히 놓고 가격 차이를 확인해보세요.';

/** 로그인하지 않은 사람의 사실. 게스트도 MY를 본다. */
const GUEST_FACTS: MembershipFacts = {
  loggedIn: false,
  spouseLinked: false,
  hasPaymentProof: false,
};

type MyData = {
  me: CurrentUser | null;
  paymentProofCount: number;
  candidates: CandidateListResponse | null;
  visitNotes: VisitNoteListResponse | null;
};

const EMPTY: MyData = { me: null, paymentProofCount: 0, candidates: null, visitNotes: null };

/**
 * MY. 디자인 핸드오프 17번.
 *
 * **등급은 막는 장치가 아니라 보여주는 장치다.** 여기서 등급을 이유로 잠그는 것은
 * 없다 — 등급 배지는 어디까지 왔는지를 말하고, 미션 행은 다음에 무엇을 해볼 수
 * 있는지를 말한다. 실제로 잠기는 것은 실제 결제 구간 하나뿐이고, 그건 이 화면이
 * 아니라 업체 화면에서 걸린다.
 */
export default function MyScreen() {
  const theme = useTheme();
  const { state, signOut } = useSession();
  const [data, setData] = useState<MyData>(EMPTY);
  const [celebrate, setCelebrate] = useState(false);

  const load = useCallback(() => {
    /*
     * 하나가 실패해도 나머지는 보여준다. 로그인 안 한 사람은 다 실패하는데, 그때도
     * MY는 떠야 한다 — 안내와 정책이 여기 있고, 그건 게스트에게 더 필요하다.
     */
    void getCurrentUser()
      .then(async (me) => {
        setData((current) => ({ ...current, me }));

        const [unlock, candidates, visitNotes] = await Promise.all([
          getDataUnlock().catch(() => null),
          me.weddingId ? listCandidates(me.weddingId).catch(() => null) : null,
          me.weddingId ? listVisitNotes(me.weddingId).catch(() => null) : null,
        ]);

        setData((current) => ({
          ...current,
          paymentProofCount: unlock?.paymentProofCount ?? 0,
          candidates,
          visitNotes,
        }));
      })
      .catch(() => setData(EMPTY));
  }, []);

  useEffect(load, [load]);

  const facts: MembershipFacts = data.me
    ? {
        loggedIn: true,
        spouseLinked: data.me.spouseLinked,
        hasPaymentProof: data.me.hasPaymentProof,
      }
    : GUEST_FACTS;

  const everythingDone = allMissionsDone(facts);
  const phase = weddingPhase(data.me?.weddingDate ?? null);

  /*
   * 미션 완료 모달은 최초 1회다(핸드오프 18번). 여기서 봤는지 물어보고, 축하할
   * 때가 아니면 저장소를 건드리지 않는다 — 완료하기 전에 "봤음"으로 찍어두면
   * 정작 완료했을 때 축하가 사라진다.
   */
  useEffect(() => {
    if (!everythingDone) return;

    void hasSeenMissionComplete().then((seen) => {
      if (!seen) setCelebrate(true);
    });
  }, [everythingDone]);

  async function closeCelebration() {
    setCelebrate(false);
    await markMissionCompleteSeen();
  }

  async function leave() {
    try {
      await signOut();
    } catch {
      Alert.alert('로그아웃 실패', '다시 시도해주세요.');
    }
  }

  async function shareApp() {
    try {
      // 스토어 링크는 앱을 올린 뒤 여기에 함께 넣는다.
      await Share.share({ message: SHARE_MESSAGE });
    } catch {
      // 사용자가 공유 시트를 닫은 경우가 대부분이라 따로 알리지 않는다.
    }
  }

  function goMission(key: MissionKey) {
    switch (key) {
      case 'explore':
        router.push('/search');
        return;
      case 'organize':
        router.push('/wedding');
        return;
      case 'together':
        router.push('/wedding/partner');
        return;
      case 'payment':
        router.push('/capture/payment/consent');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* 프로필 — 아바타 / 이름 + 등급 배지 / 예식일·배우자 상태 */}
          <ThemedView style={styles.profile}>
            <View style={[styles.avatar, { backgroundColor: theme.tintSubtle }]}>
              <ThemedText type="t4" themeColor="tint">
                {data.me?.displayName?.slice(0, 1) ?? '픽'}
              </ThemedText>
            </View>

            <ThemedView style={styles.grow}>
              <ThemedView style={styles.nameRow}>
                <ThemedText type="t4">{data.me?.displayName ?? '게스트'}</ThemedText>
                <TierBadge label={data.me?.tierLabel ?? '게스트'} />
              </ThemedView>
              <ThemedText type="t7" themeColor="textSecondary">
                {data.me?.weddingDate ? formatWeddingDate(data.me.weddingDate) : '예식일 미등록'}
                {facts.spouseLinked ? ' · 배우자 연결됨' : ''}
                {/* 예식이 끝났으면 그렇다고 적는다. v2.0 D-4 · 원문 34번. */}
                {phase === 'completed' ? ` · ${WEDDING_PHASE_LABEL.completed}` : ''}
              </ThemedText>
            </ThemedView>
          </ThemedView>

          {/*
            예식일 미등록 배너. 예식이 끝난 사람에게는 뜨지 않는다 — 등록하라고
            권할 이유가 이미 지났다.
          */}
          {data.me && !data.me.weddingDate ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/setup')}
              style={[styles.banner, { backgroundColor: theme.tintSubtle }]}>
              <ThemedText type="t6" themeColor="tint">
                예식일을 등록하면 남은 날짜와 일정을 챙겨드려요
              </ThemedText>
            </Pressable>
          ) : null}

          {/* 통계 3개 — 각각 해당 화면으로 */}
          <ThemedView style={styles.statRow}>
            <Stat
              label="결제인증"
              value={data.paymentProofCount}
              onPress={() => router.push('/capture/payment/consent')}
            />
            <Stat
              label="관심업체"
              value={data.candidates?.total ?? 0}
              onPress={() => goWedding(data.me, 'candidates')}
            />
            <Stat
              label="방문노트"
              value={data.visitNotes?.notes.length ?? 0}
              onPress={() => goWedding(data.me, 'visit-notes')}
            />
          </ThemedView>

          {/* 나의 웨딩 미션 */}
          <ThemedView type="backgroundElement" style={styles.missionBlock}>
            <ThemedView type="backgroundElement" style={styles.missionHead}>
              <ThemedText type="t4">나의 웨딩 미션</ThemedText>
              {/* 핸드오프가 배지를 여기에도 뒀다. 미션과 등급이 같은 이야기라서다. */}
              <TierBadge label={data.me?.tierLabel ?? '게스트'} />
            </ThemedView>

            {MISSIONS.map((mission) => {
              const done = isMissionDone(mission.key, facts);

              return (
                <Pressable
                  key={mission.key}
                  accessibilityRole="button"
                  accessibilityState={{ checked: done }}
                  onPress={() => goMission(mission.key)}
                  style={styles.missionRow}>
                  <ThemedText type="t5" themeColor={done ? 'tint' : 'track'}>
                    ✓
                  </ThemedText>
                  <View style={styles.grow}>
                    <ThemedText type="t6" themeColor={done ? 'text' : 'textAssistive'}>
                      {mission.title}
                    </ThemedText>
                    <ThemedText type="t7" themeColor="textSecondary">
                      {mission.description}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </ThemedView>

          {/* 메뉴 */}
          <ThemedView style={styles.section}>
            <ThemedText type="t7" themeColor="textSecondary">
              계정
            </ThemedText>
            <ActionButton
              label="배우자 연결 관리"
              onPress={() =>
                data.me ? router.push('/wedding/partner') : router.push('/login')
              }
            />
            {state.status === 'offline' ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="t7" themeColor="textSecondary">
                  이 빌드는 서버에 붙어 있지 않습니다. 촬영과 기기 저장까지 됩니다.
                </ThemedText>
              </ThemedView>
            ) : state.status === 'signedIn' ? (
              <ActionButton
                label="로그아웃"
                hint="기기에 저장된 문서는 지워지지 않습니다"
                onPress={leave}
              />
            ) : state.status === 'signedOut' ? (
              <ActionButton
                variant="primary"
                label="로그인"
                hint="우리웨딩과 결제내역 등록에 필요합니다"
                onPress={() => router.push('/login')}
              />
            ) : null}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t7" themeColor="textSecondary">
              데이터
            </ThemedText>
            <ActionButton
              label="내 제보 내역"
              hint="낸 자료가 어디에 쓰이는지 함께 보여드려요"
              onPress={() => (data.me ? router.push('/my/reports') : router.push('/login'))}
            />
            <ActionButton
              label="업체 반론"
              hint="등록한 반론과 확인 상태를 볼 수 있어요"
              onPress={() => (data.me ? router.push('/my/rebuttals') : router.push('/login'))}
            />
            <ActionButton
              label="업체 관계자 인증"
              hint="관계자로 확인되면 우리 업체 후기에 반론을 낼 수 있어요"
              onPress={() =>
                data.me ? router.push('/my/vendor-claims') : router.push('/login')
              }
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t7" themeColor="textSecondary">
              안내
            </ThemedText>
            <ActionButton label="촬영 방법과 분석 안내" onPress={() => router.push('/my/guide')} />
            <ActionButton
              label="문의하기"
              hint="잘못된 정보, 분석 결과 이의, 개인정보 요청을 받습니다"
              onPress={() => router.push('/my/contact')}
            />
            <ActionButton
              label="웨딩픽 공유하기"
              hint="앱만 공유합니다. 내 견적·계약 정보는 포함되지 않습니다"
              onPress={shareApp}
            />
            <ActionButton
              label="이용약관 · 개인정보 처리방침"
              onPress={() => router.push('/my/policies')}
            />
            <ActionButton
              label="설정"
              hint="알림, 예식일, 결제인증 동의"
              onPress={() => router.push('/my/settings')}
            />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>

      {/* 미션 완료 — 최초 1회. 핸드오프 18번. */}
      <Modal visible={celebrate} transparent animationType="fade" onRequestClose={closeCelebration}>
        <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
          <View style={[styles.dialog, { backgroundColor: theme.tint }]}>
            <View style={[styles.dialogMark, { backgroundColor: theme.onTint }]}>
              <ThemedText type="t2" themeColor="tint">
                ✓
              </ThemedText>
            </View>

            <ThemedText type="t4" style={styles.onTint}>
              {MISSION_COMPLETE_TITLE}
            </ThemedText>
            <ThemedText type="t6" style={styles.onTint}>
              {MISSION_COMPLETE_BODY}
            </ThemedText>

            <View style={styles.tagRow}>
              {MISSION_COMPLETE_TAGS.map((tag) => (
                <View key={tag} style={[styles.tag, { borderColor: theme.onTint }]}>
                  <ThemedText type="badge" style={styles.onTint}>
                    {tag}
                  </ThemedText>
                </View>
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={closeCelebration}
              style={[styles.dialogButton, { backgroundColor: theme.onTint }]}>
              <ThemedText type="t5" themeColor="tint">
                확인
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

function TierBadge({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.badge, { backgroundColor: theme.tintSubtle }]}>
      <ThemedText type="badge" themeColor="tint">
        {label}
      </ThemedText>
    </View>
  );
}

function Stat({ label, value, onPress }: { label: string; value: number; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.stat}>
      {/* 0도 자리를 지킨다. 빈 상태에서 레이아웃을 바꾸지 않는다. */}
      <ThemedText type="t4" numeric>
        {value}
      </ThemedText>
      <ThemedText type="t7" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** 웨딩이 없으면 우리웨딩 탭으로 보낸다 — 거기서 만들어준다. */
function goWedding(me: CurrentUser | null, section: 'candidates' | 'visit-notes') {
  if (!me?.weddingId) {
    router.push('/wedding');
    return;
  }

  router.push(`/wedding/${me.weddingId}/${section}`);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  grow: {
    flex: 1,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  badge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  banner: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  statRow: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: Layout.touchTarget,
    justifyContent: 'center',
  },
  missionBlock: {
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  missionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    minHeight: Layout.touchTarget,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Layout.gutter,
  },
  dialog: {
    width: '100%',
    maxWidth: 320,
    borderRadius: Radius.card,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  dialogMark: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.one,
    marginVertical: Spacing.two,
  },
  tag: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  dialogButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: Radius.input,
    paddingVertical: Spacing.three,
  },
  onTint: {
    color: '#ffffff',
    textAlign: 'center',
  },
});
