import type { CurrentUser, WeddingInvite } from '@weddingpick/api-contract';
import { TERMS, inviteShareMessage } from '@weddingpick/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import {
  createWeddingInvite,
  ensureWedding,
  getCurrentUser,
  getWeddingInvite,
  revokeWeddingInvite,
  unlinkPartner,
} from '@/api/client';
import { isServerConfigured } from '@/api/config';
import strings from '../../../../../../spec/strings.ko.json';
import { shareOrCopy } from '@/components/share-or-copy';
import { formatDateTimeDot } from '@/features/common/format-date';
import { ErrorView, Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import {
  Badge,
  Dock,
  DockButton,
  Hero,
  ListRow,
  NavBar,
  NoteCard,
  Screen,
  Section,
} from '@/features/wedding/screen-kit';

/** `spec/strings.ko.json` `couple.*` · 시안 14-couple #1 · #6. */
const S = {
  inviteNav: '배우자 초대',
  linkedNav: '배우자 연결',
  unlinkNav: '연결 해제',
  inviteTitle: '둘이 같이 보면 결정이 빨라져요',
  inviteSub: `${TERMS.picked} · 일정 · 지출이 함께 보여요`,
  inviteCode: '초대 코드',
  sharedLabel: '연결하면 같이 보여요',
  ownLabel: '각자 남아요',
  noteTitle: strings.journey.partnerShareTitle,
  noteBody: strings.journey.partnerShareBody,
  copy: '코드 복사',
  copied: '복사했어요',
  send: '링크 보내기',
  make: '초대 코드 만들기',
  remake: '새 코드 만들기',
  revoke: '초대 취소',
  haveCode: '코드 받았어요',
  unlink: '연결 끊기',
  keep: '그대로 둘게요',
} as const;

/** 연결하면 같이 보이는 것 4 — SPEC 4.1 · 시안 문구. */
const SHARED: { title: string; sub: string }[] = [
  { title: TERMS.picked, sub: '둘 다 고른 곳이 위로 올라와요' },
  { title: '일정', sub: '한 명이 넣으면 둘 다 알림을 받아요' },
  { title: '지출', sub: '누가 얼마 냈는지 같이 보여요' },
  { title: '메모', sub: '업체마다 의견을 남길 수 있어요' },
];
/** 연결해도 각자에게 남아요 2 — SPEC 4.1. */
const OWN = ['검색 기록', '알림 설정'] as const;
/** 끊으면 각자에게 남아요 3 — SPEC 4.3. */
const REMAINS: { title: string; sub: string }[] = [
  { title: `내가 고른 곳`, sub: '내 목록에 그대로 남아요' },
  { title: '내가 등록한 일정과 지출', sub: '내 기록으로 남아요' },
  { title: '함께 쓴 메모', sub: '각자 사본으로 남아요' },
];

/**
 * 배우자 초대 · 연결 · 해제. WP-CPL-001 · WP-CPL-006 · 핸드오프 14-couple #1 · #6 · SPEC 4.
 *
 *   혼자    hero · 초대 코드 카드(brand · 32) · 공유 4행 «공유» · 각자 2행 «각자» · note · dock
 *          dock — 코드 있음: «코드 복사» + «링크 보내기» / 보낸 초대만: «초대 취소» + «새 코드 만들기» /
 *                 없음: «코드 받았어요» + «초대 코드 만들기»
 *   함께    hero «{배우자}님과 함께 준비하고 있어요» · 공유 4행 · dock «연결 끊기»
 *   해제    hero «{배우자}님과 연결을 끊을까요?» · 멈추는 것 4행 «공유 종료» · 각자에게 남아요 3행 · note · dock danger
 *
 * 연결은 양쪽이 각각 동의해야 이뤄진다 — 이 화면은 초대하는 쪽이다. 코드는 만들 때 한 번만
 * 내려오고 서버는 해시만 들고 있어 다시 보여줄 수 없다. 혼자인 상태를 결핍으로 적지 않는다.
 */
export default function PartnerScreen() {
  const theme = useTheme();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [invite, setInvite] = useState<WeddingInvite | null>(null);
  /** 방금 만든 코드. 이 화면을 떠나면 사라진다. */
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!isServerConfigured) return;

    try {
      const id = await ensureWedding();
      const [user, current] = await Promise.all([getCurrentUser(), getWeddingInvite(id)]);

      setWeddingId(id);
      setMe(user);
      setInvite(current.invite);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, []);

  // 초대를 받아들이고 돌아왔을 수도 있다. 화면이 다시 보일 때마다 확인한다.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function makeInvite() {
    if (busy || !weddingId) return;
    setBusy(true);
    setError(null);

    try {
      const created = await createWeddingInvite(weddingId);

      setCode(created.code);
      setInvite({ inviteId: created.inviteId, expiresAt: created.expiresAt, createdAt: new Date().toISOString() });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!code) return;

    setError(null);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      } else {
        const result = await shareOrCopy(code);
        // 시스템 공유는 복사가 아니다. 취소한 경우에도 복사 완료를 표시하지 않는다.
        if (!result.copied) return;
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(strings.error['general.title']);
    }
  }

  async function share() {
    if (!code) return;

    const result = await shareOrCopy(inviteShareMessage(code));

    if (result.copied) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  async function revoke() {
    if (busy || !weddingId || !invite) return;
    setBusy(true);

    try {
      await revokeWeddingInvite(weddingId, invite.inviteId);
      setInvite(null);
      setCode(null);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    if (busy || !weddingId) return;
    setBusy(true);

    try {
      await unlinkPartner(weddingId);
      setConfirmingUnlink(false);
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!isServerConfigured) {
    return (
      <ErrorView
        title={S.inviteNav}
        message="이 빌드는 서버에 붙어 있지 않아 연결할 수 없어요."
        onBack={() => router.back()} onRetry={load} />
    );
  }

  if (!me || !weddingId) {
    if (error) return <ErrorView message={error} onBack={() => router.back()} onRetry={load} />;

    return <DelayedLoadingView />;
  }

  const partner = me.partnerDisplayName ?? TERMS.spouse;
  const errorLine = error ? (
    <ThemedText type="t7" themeColor="negative" style={styles.error}>
      {error}
    </ThemedText>
  ) : null;

  /* ---------------------------------------------------------- 연결 해제 · WP-CPL-006 */
  if (me.spouseLinked && confirmingUnlink) {
    return (
      <Screen>
        <NavBar title={S.unlinkNav} onBack={() => setConfirmingUnlink(false)} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Hero title={`${partner}님과 연결을 끊을까요?`} sub="공유가 멈추고 지금까지 쌓인 기록은 각자에게 남아요" />
          <Section label="멈추는 것">
            {SHARED.map((item) => (
              <ListRow key={item.title} title={`${item.title} 공유`} right={<Badge label="공유 종료" tone="no" />} />
            ))}
          </Section>
          <Section label="각자에게 남아요">
            {REMAINS.map((item) => (
              <ListRow key={item.title} title={item.title} sub={item.sub} subLines={1} />
            ))}
          </Section>
          {errorLine}
          <View style={styles.noteWrap}>
            <NoteCard title={`${partner}님에게 알림이 가요`} body="다시 연결하려면 초대 코드를 새로 보내야 해요." />
          </View>
        </ScrollView>
        <Dock>
          <DockButton label={S.keep} onPress={() => setConfirmingUnlink(false)} />
          <DockButton variant="danger" label={busy ? '끊는 중…' : S.unlink} disabled={busy} onPress={() => void unlink()} />
        </Dock>
      </Screen>
    );
  }

  /* ---------------------------------------------------------- 연결됨 */
  if (me.spouseLinked) {
    return (
      <Screen>
        <NavBar title={S.linkedNav} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Hero title={`${partner}님과 함께 준비하고 있어요`} sub={`${S.inviteSub} · 메모도 함께 써요`} />
          <Section label="같이 보고 있어요">
            {SHARED.map((item) => (
              <ListRow key={item.title} title={item.title} sub={item.sub} subLines={1} right={<Badge label="공유" tone="ok" />} />
            ))}
          </Section>
          <Section label={S.ownLabel}>
            {OWN.map((item) => (
              <ListRow key={item} title={item} right={<Badge label="각자" tone="none" />} />
            ))}
          </Section>
          {errorLine}
          <View style={styles.noteWrap}>
            <NoteCard title={S.noteTitle} body={S.noteBody} />
          </View>
        </ScrollView>
        <Dock>
          <DockButton label={S.unlink} onPress={() => setConfirmingUnlink(true)} />
        </Dock>
      </Screen>
    );
  }

  /* ---------------------------------------------------------- 혼자 · 초대 · WP-CPL-001 */
  const codeLine = code
    ? invite
      ? `${formatDateTimeDot(invite.expiresAt)}까지 쓸 수 있어요`
      : '지금 보내주세요'
    : invite
      ? `보낸 초대가 있어요 · ${formatDateTimeDot(invite.expiresAt)}까지`
      : '아직 만들지 않았어요';

  return (
    <Screen>
      <NavBar title={S.inviteNav} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero title={S.inviteTitle} sub={S.inviteSub} />

        {/* 초대 코드 카드 — brand 배경 · coral 테두리 · 코드 32/43. */}
        <View style={styles.block}>
          <View style={[styles.codeCard, { backgroundColor: theme.tintSurface, borderColor: theme.tintBorder }]}>
            <ThemedText type="t7" themeColor="tint" style={styles.bold}>
              {S.inviteCode}
            </ThemedText>
            <ThemedText type="amount" themeColor={code ? 'text' : 'textDisabled'} numeric numberOfLines={1}>
              {code ?? (invite ? '••••••' : '—')}
            </ThemedText>
            <ThemedText type="t7" themeColor={copied ? 'tint' : 'textAssistive'} numeric>
              {copied ? S.copied : codeLine}
            </ThemedText>
          </View>
        </View>

        <Section label={S.sharedLabel}>
          {SHARED.map((item) => (
            <ListRow key={item.title} title={item.title} sub={item.sub} subLines={1} right={<Badge label="공유" tone="ok" />} />
          ))}
        </Section>

        <Section label={S.ownLabel}>
          {OWN.map((item) => (
            <ListRow key={item} title={item} right={<Badge label="각자" tone="none" />} />
          ))}
        </Section>

        {errorLine}

        <View style={styles.noteWrap}>
          <NoteCard title={S.noteTitle} body={S.noteBody} />
        </View>
      </ScrollView>

      {code ? (
        <Dock>
          <DockButton label={S.copy} onPress={() => void copyCode()} />
          <DockButton variant="primary" label={S.send} onPress={() => void share()} />
        </Dock>
      ) : invite ? (
        <Dock note="코드는 다시 보여드릴 수 없어요. 잃어버렸으면 새로 만들어주세요.">
          <DockButton label={S.revoke} disabled={busy} onPress={() => void revoke()} />
          <DockButton variant="primary" label={busy ? '만드는 중…' : S.remake} disabled={busy} onPress={() => void makeInvite()} />
        </Dock>
      ) : (
        <Dock>
          <DockButton label={S.haveCode} onPress={() => router.push('/wedding/join')} />
          <DockButton variant="primary" label={busy ? '만드는 중…' : S.make} disabled={busy} onPress={() => void makeInvite()} />
        </Dock>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  block: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four },
  /* 코드 카드 — radius 10 · padding 20 · gap 6 · 테두리 1. */
  codeCard: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    padding: Layout.cardPadding,
    gap: Spacing.one + Spacing.half,
  },
  noteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
  error: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.three },
  bold: { fontWeight: 700 },
});
