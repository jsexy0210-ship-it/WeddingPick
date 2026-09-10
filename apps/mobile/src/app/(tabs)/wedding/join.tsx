import type { InvitePreviewResponse } from '@weddingpick/api-contract';
import { TERMS, inviteCodeFromLink } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { acceptWeddingInvite, previewWeddingInvite } from '@/api/client';
import { Layout, ProductSymbol, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import {
  Avatar,
  Badge,
  Dock,
  DockButton,
  Field,
  Hero,
  InfoCard,
  ListRow,
  NavBar,
  NoteCard,
  Screen,
  Section,
} from '@/features/wedding/screen-kit';

/** `spec/strings.ko.json` `couple.*` · 시안 14-couple #2 · #3. */
const S = {
  nav: '초대 받음',
  codeTitle: '초대 코드를 넣어주세요',
  codeSub: '배우자에게 받은 코드나 링크를 그대로 붙여도 돼요',
  codeField: '초대 코드',
  check: '확인하기',
  acceptTitle: '함께 준비하자고 해요',
  acceptSub: 'Pick한 곳 · 일정 · 지출이 함께 보여요',
  sharedLabel: '수락하면 같이 보게 돼요',
  notSharedLabel: '각자 남아요',
  noteTitle: '내 검색 기록은 보이지 않아요',
  noteBody: '알림 설정과 검색 기록은 각자의 것으로 남아요.',
  later: '나중에',
  accept: '수락하기',
  doneTitle: '연결됐어요',
  doneSub: '이제 Pick한 곳과 일정이 둘 다에게 보여요',
  goWedding: `${TERMS.ourWedding} 보기`,
} as const;

/** 체크 링 72 — 연결 완료. `motion.checkPop`은 RN Animated 없이 정지 상태로 그린다. */
const RING = 72;

/**
 * 초대 수락. WP-CPL-002 → WP-CPL-003 · 핸드오프 14-couple #2 · #3.
 *
 *   코드 전     hero «초대 코드를 넣어주세요» + 필드 52 + dock «확인하기»
 *   미리보기     아바타 2 겹침 44 · «함께 준비하자고 해요» 26/35 · 공유 4행 + «공유» 배지 · note · dock «나중에» + «수락하기»
 *   연결 완료    체크 링 72 · «연결됐어요» · 반영 카드 3 · dock «웨딩일정 보기»
 *
 * **받아들이기 전에 무엇에 동의하는지 먼저 보여준다** — 동의는 무엇에 동의하는지 알 때만
 * 동의다. 링크로 들어와도(weddingpick://join?code=…) 코드만 채우고 자동으로 연결하지는 않는다.
 * 초대한 사람의 이름 · 예식일은 서버가 주지 않아(개인정보) 미리보기에 적지 않는다.
 */
export default function JoinScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  const [typed, setTyped] = useState<string | null>(null);
  const code = typed ?? params.code?.trim() ?? '';
  const [preview, setPreview] = useState<InvitePreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  async function check() {
    if (busy || code.trim().length === 0) return;
    setBusy(true);
    setError(null);

    try {
      setPreview(await previewWeddingInvite(code.trim()));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      await acceptWeddingInvite(code.trim());
      setJoined(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (joined) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.doneHero}>
            <View style={[styles.ring, { backgroundColor: theme.tint }]}>
              <ProductSymbol name="check" size={36} color={theme.onTint} />
            </View>
            <View style={styles.doneText}>
              <ThemedText type="t2">{S.doneTitle}</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                {S.doneSub}
              </ThemedText>
            </View>
          </View>
          <View style={styles.cards}>
            <InfoCard label={TERMS.picked} value="둘 다 고른 곳이 위로 올라가요" />
            <InfoCard label="일정" value="한 명이 넣으면 둘 다 알림을 받아요" />
            <InfoCard label="지출" value="누가 얼마 냈는지 같이 보여요" />
          </View>
        </ScrollView>
        <Dock>
          <DockButton variant="primary" label={S.goWedding} onPress={() => router.replace('/wedding' as never)} />
        </Dock>
      </Screen>
    );
  }

  const usable = preview?.usable === true ? preview : null;

  return (
    <Screen>
      <NavBar title={S.nav} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {usable ? (
          <>
            {/* 아바타 2 겹침 44 — 초대한 사람은 서버가 이름을 주지 않아 «?»로 둔다. */}
            <View style={styles.acceptHero}>
              <View style={styles.avatars}>
                <Avatar initial="?" tone="unknown" size={44} />
                <View style={styles.avatarOverlap}>
                  <Avatar initial="나" tone="me" size={44} />
                </View>
              </View>
              <ThemedText type="t2">{S.acceptTitle}</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                {S.acceptSub}
              </ThemedText>
            </View>

            <Section label={S.sharedLabel}>
              {usable.shared.map((item) => (
                <ListRow key={item} title={item} right={<Badge label="공유" tone="ok" />} />
              ))}
            </Section>

            <Section label={S.notSharedLabel}>
              {usable.notShared.map((item) => (
                <ListRow key={item} title={item} right={<Badge label="각자" tone="none" />} />
              ))}
            </Section>

            <View style={styles.noteWrap}>
              <NoteCard title={S.noteTitle} body={S.noteBody} />
            </View>
          </>
        ) : (
          <>
            <Hero title={S.codeTitle} sub={S.codeSub} />
            <View style={styles.fields}>
              <Field
                label={S.codeField}
                value={code}
                onChangeText={(text) => {
                  // 링크를 통째로 붙여넣는 사람이 많다. 코드가 아니라고 되돌려주는 대신 코드를 꺼내 쓴다.
                  setTyped(inviteCodeFromLink(text.trim()) ?? text);
                  setPreview(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="WPK-0000"
                hint={preview && !preview.usable ? preview.message : null}
                hintColor="negative"
              />
            </View>
          </>
        )}

        {error ? (
          <ThemedText type="t7" themeColor="negative" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>

      {usable ? (
        <Dock>
          <DockButton label={S.later} onPress={() => router.back()} />
          <DockButton variant="primary" label={busy ? '연결 중…' : S.accept} disabled={busy} onPress={() => void join()} />
        </Dock>
      ) : (
        <Dock>
          <DockButton
            variant="primary"
            label={busy ? '확인 중…' : S.check}
            disabled={busy || code.trim().length === 0}
            onPress={() => void check()}
          />
        </Dock>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  fields: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four },
  /* 수락 히어로 — padding 32 24 28 · gap 14. */
  /* 시안 acceptHero — 가운데 정렬(14-couple.dc.html L116 `align-items:center;text-align:center`). */
  acceptHero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Layout.sectionGap,
    gap: Layout.sectionHeadGap,
    alignItems: 'center',
  },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarOverlap: { marginLeft: -Layout.rowPaddingY },
  noteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
  error: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.three },
  /* 연결 완료 — padding 72 24 40 · gap 24. */
  doneHero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.tabBar,
    paddingBottom: Spacing.four + Spacing.three,
    gap: Spacing.four,
    alignItems: 'center',
  },
  ring: { width: RING, height: RING, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  doneText: { gap: Spacing.two, alignItems: 'center' },
  cards: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap, gap: Layout.rowPaddingY },
});
