import type { CurrentUser, WeddingInvite } from '@weddingpick/api-contract';
import { INVITE_CODE_LENGTH, TERMS, inviteShareUrl } from '@weddingpick/domain';
import { router, useFocusEffect, useLocalSearchParams, usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  createWeddingInvite,
  ensureWedding,
  getCurrentUser,
  getWeddingInvite,
  unlinkPartner,
} from '@/api/client';
import { isServerConfigured } from '@/api/config';
import strings from '../../../../../../spec/strings.ko.json';
import { shareOrCopy } from '@/components/share-or-copy';
import { formatDateTimeDot } from '@/features/common/format-date';
import { APP_WEB_ORIGIN } from '@/features/social-meta';
import { useDepthBack } from '@/features/navigation/depth-back';
import { partnerJoinHref } from '@/features/partner/routes';
import { ActionButton, Border, ErrorView, Layout, Radius, SocialColors, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { usePullRefresh } from '@/features/refresh/use-pull-refresh';
import { Badge, Dock, Hero, ListRow, NavBar, NoteCard, Screen, Section } from '@/features/wedding/screen-kit';

/**
 * `spec/strings.ko.json` `couple.*` · 정본 `docs/design/React_Native/my.jsx`
 * WP-CPL-001(배우자 초대 · frame-017) · WP-CPL-006(연결 해제 · frame-020). 「연결됨」(이미
 * 연결된 사람이 보는 관리 화면)은 WP-MY-005(연결관리 · frame-005)다 — 정본의 공유 토글은
 * 서버에 공유 범위 설정이 없어 아직 그리지 않는다(`DESIGN_UNRESOLVED`).
 */
const S = {
  inviteNav: '배우자 초대',
  linkedNav: '연결관리',
  unlinkNav: '연결 해제',
  qTitle: '같이 준비할\n사람을 초대해요',
  inviteCode: '초대 코드',
  copy: '코드 복사',
  copied: '복사했어요',
  remake: '코드 다시 받기',
  make: '초대 코드 만들기',
  kakao: '카카오로 초대하기',
  sharedLabel: '연결하면 같이 봐요',
  scopeNote: '검색 기록과 알림 설정은 각자 봐요.',
  haveCode: '코드 받았어요',
  unlinkQTitle: '해제하면\n이렇게 돼요',
  cutLabel: '끝나요',
  keepLabel: '그대로예요',
  unlinkNote: '다시 초대하면 같이 볼 수 있어요.',
  unlink: '연결 해제하기',
} as const;

/** WP-CPL-001 scopeRows(연결하면 같이 봐요) — 4행, 코랄 점 + 라벨만(배지 없음). */
const SHARE_SCOPE = ['고른 곳 · Pick', '일정', '지출', '메모'];

/** WP-CPL-006 cutRows(끝나요) — 3행, 회색 점 + 라벨만. */
const CUT_ROWS = ['일정 · 지출 공유', 'Pick 비교 같이 보기', '변경 알림'];

/** WP-CPL-006 keepRows(그대로예요) — 3행, 라벨 + 「그대로 남아요」. */
const KEEP_ROWS = ['내가 쓴 일정 · 지출', '내 Pick', 'Pick 인증내역'];

/** 정본 listCard 행 — 코랄/회색 점 + 라벨. WP-CPL-001·002·006이 함께 쓰는 모양이다. */
function DotList({ items, tone }: { items: string[]; tone: 'brand' | 'muted' }) {
  const theme = useTheme();
  return (
    <View style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.background }]}>
      {items.map((label, index) => (
        <View
          key={label}
          style={[
            styles.scopeRow,
            index < items.length - 1 && { borderBottomWidth: Border.hairline, borderBottomColor: theme.border },
          ]}>
          <View style={[styles.scopeDot, { backgroundColor: tone === 'brand' ? theme.tint : theme.textDisabled }]} />
          <ThemedText type="f15" numberOfLines={1} style={styles.scopeLabel}>
            {label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** 정본 doneRows/keepRows 행 — 라벨 + 보조문 두 줄, 점·배지 없음. */
function InfoList({ items }: { items: { label: string; sub: string }[] }) {
  const theme = useTheme();
  return (
    <View style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.background }]}>
      {items.map((row, index) => (
        <View
          key={row.label}
          style={[
            styles.infoRow,
            index < items.length - 1 && { borderBottomWidth: Border.hairline, borderBottomColor: theme.border },
          ]}>
          <ThemedText type="f15">{row.label}</ThemedText>
          <ThemedText type="f12" themeColor="textAssistive">
            {row.sub}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/**
 * 배우자 초대 · 연결 · 해제. WP-CPL-001 · WP-CPL-006.
 *
 * 연결은 양쪽이 각각 동의해야 이뤄진다 — 이 화면은 초대하는 쪽이다. 코드는 만들 때 한 번만
 * 내려오고 서버는 해시만 들고 있어 다시 보여줄 수 없다(기존 구현 그대로). 그래서 정본의
 * 「코드가 항상 보인다」는 목업 한 장을 문자 그대로 옮기지 못한다 — 코드를 아직 모르는 상태
 * (보낸 초대는 있는데 이 화면을 나갔다 돌아온 경우)에는 마스킹값을 보여주고 "코드 다시 받기"
 * 하나만 남긴다. 혼자인 상태를 결핍으로 적지 않는다.
 *
 * DESIGN_UNRESOLVED — 정본 dockSingle의 «카카오로 초대하기»는 카카오톡 공유 SDK 전용
 * 버튼이다. 이 저장소에는 콘텐츠 공유용 카카오 SDK가 없고(로그인만 카카오를 쓴다),
 * 새로 붙이는 것은 이번 디자인 대조 범위를 넘는 인프라 작업이라 기존 `shareOrCopy`
 * (OS 공유 시트 — 카카오톡을 포함해 고를 수 있다)를 그대로 연결한다. 버튼 라벨·색은
 * 정본 그대로(`SocialColors.kakao`) 쓰되, 실제로 카카오톡으로 강제 전달하지는 않는다.
 */
export default function PartnerScreen() {
  const depthBack = useDepthBack();
  /* 초대 수락으로 넘어가도 이 화면의 출처(MY · 알림 · 홈)를 이어 준다 — 돌아온 뒤 Back이 그리로 간다. */
  const { from } = useLocalSearchParams<{ from?: string | string[] }>();
  /*
   * 이 화면은 스택 셋에 별칭으로 있다(`features/partner/routes.ts`) — 초대 수락도 **지금 스택 안**으로
   * 연다. `/my/partner` → `/my/partner/join`처럼 계층이 이어져 Back이 이 화면으로 돌아온다.
   */
  const pathname = usePathname();
  const joinHref = partnerJoinHref(pathname, (Array.isArray(from) ? from[0] : from) ?? null);
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
  /** ref다 — 자동 생성은 한 번만 시도하면 되는 신호일 뿐 화면에 그릴 상태가 아니다. */
  const autoTried = useRef(false);

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
  /* 당겨서 새로 고침 — 배우자가 초대를 받았는지 다시 본다. 실패는 원래처럼 화면 안 오류 줄이 말한다. */
  const pull = usePullRefresh(load);

  const makeInvite = useCallback(async () => {
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
  }, [busy, weddingId]);

  // 정본(WP-CPL-001)은 코드 카드가 항상 채워져 있다 — 초대를 아직 만든 적이 없으면 화면
  // 진입과 함께 한 번 만들어 그 모양에 맞춘다. 이미 보낸 초대가 있으면(코드는 몰라도)
  // 새로 만들지 않는다.
  useEffect(() => {
    if (autoTried.current || !weddingId || !me || me.spouseLinked || invite || code) return;
    autoTried.current = true;
    void makeInvite();
  }, [weddingId, me, invite, code, makeInvite]);

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

  /*
   * 카카오로 초대하기 — 초대 안내 주소 하나만 보낸다(2026-09-25 대표 지시 「카카오로
   * 초대하기 시 OG카드로 보낸다. 초대코드 내용은 담지 않는다」). 카카오톡은 주소의
   * 카드(관리자 「링크 미리보기 · 초대용」)를 그린다. 코드는 초대한 사람이 따로 알려준다.
   */
  async function share() {
    if (!code) return;

    const result = await shareOrCopy(inviteShareUrl(APP_WEB_ORIGIN));

    if (result.copied) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
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
        onBack={depthBack} onRetry={load} />
    );
  }

  if (!me || !weddingId) {
    if (error) return <ErrorView message={error} onBack={depthBack} onRetry={load} />;

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
          <View style={styles.qBlock}>
            <ThemedText type="t2">{S.unlinkQTitle}</ThemedText>
          </View>

          <View style={styles.sec}>
            <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
              {S.cutLabel}
            </ThemedText>
            <DotList items={CUT_ROWS} tone="muted" />
          </View>

          <View style={styles.sec}>
            <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
              {S.keepLabel}
            </ThemedText>
            <InfoList items={KEEP_ROWS.map((label) => ({ label, sub: '그대로 남아요' }))} />
            <ThemedText type="f13" themeColor="textAssistive">
              {S.unlinkNote}
            </ThemedText>
          </View>

          {errorLine}
        </ScrollView>
        <Dock>
          <ActionButton
            variant="danger"
            size="sheet"
            label={busy ? '끊는 중…' : S.unlink}
            disabled={busy}
            onPress={() => void unlink()}
          />
        </Dock>
      </Screen>
    );
  }

  /* ---------------------------------------------------------- 연결됨 · WP-MY-005(my.jsx frame-005) — 토글은 서버 없음, DESIGN_UNRESOLVED */
  if (me.spouseLinked) {
    return (
      <Screen>
        <NavBar title={S.linkedNav} />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={pull.refreshControl}>
          <Hero title={`${partner}님과 함께 준비하고 있어요`} sub={`${TERMS.picked} · 일정 · 지출이 함께 보여요 · 메모도 함께 써요`} />
          <Section label="같이 보고 있어요">
            {SHARE_SCOPE.map((item) => (
              <ListRow key={item} title={item} right={<Badge label="공유" tone="ok" />} />
            ))}
          </Section>
          <Section label="각자 남아요">
            {['검색 기록', '알림 설정'].map((item) => (
              <ListRow key={item} title={item} right={<Badge label="각자" tone="none" />} />
            ))}
          </Section>
          {errorLine}
          <View style={styles.noteWrap}>
            <NoteCard title={strings.journey.partnerShareTitle} body={strings.journey.partnerShareBody} />
          </View>
        </ScrollView>
        <Dock>
          <ActionButton variant="secondary" size="sheet" label="연결 끊기" onPress={() => setConfirmingUnlink(true)} />
        </Dock>
      </Screen>
    );
  }

  /* ---------------------------------------------------------- 혼자 · 초대 · WP-CPL-001 */
  const codeMeta = code
    ? (copied ? S.copied : `${formatDateTimeDot(invite?.expiresAt ?? '')}까지 쓸 수 있어요`)
    : invite
      ? `보낸 초대가 있어요 · ${formatDateTimeDot(invite.expiresAt)}까지`
      : '만드는 중…';

  return (
    <Screen>
      <NavBar title={S.inviteNav} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={pull.refreshControl}>
        <View style={styles.qBlock}>
          <ThemedText type="t2">{S.qTitle}</ThemedText>
        </View>

        <View style={styles.sec}>
          <View style={[styles.codeCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="f13" themeColor="textAssistive">
              {S.inviteCode}
            </ThemedText>
            <ThemedText type="f32" themeColor={code ? 'text' : 'textDisabled'} numeric numberOfLines={1} style={styles.bold}>
              {code ?? (invite ? '•'.repeat(INVITE_CODE_LENGTH) : '—')}
            </ThemedText>
            <ThemedText type="f13" themeColor={copied ? 'tint' : 'textAssistive'} numeric>
              {codeMeta}
            </ThemedText>
          </View>

          {invite ? (
            <View style={styles.btnRow}>
              {code ? (
                <View style={styles.btnRowItem}>
                  <ActionButton variant="ghost" size="large" label={S.copy} onPress={() => void copyCode()} />
                </View>
              ) : null}
              <View style={styles.btnRowItem}>
                <ActionButton
                  variant="ghost"
                  size="large"
                  label={busy ? '만드는 중…' : S.remake}
                  disabled={busy}
                  onPress={() => void makeInvite()}
                />
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.sec}>
          <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
            {S.sharedLabel}
          </ThemedText>
          <DotList items={SHARE_SCOPE} tone="brand" />
          <ThemedText type="f13" themeColor="textAssistive">
            {S.scopeNote}
          </ThemedText>
        </View>

        {errorLine}

        {/*
         * 정본(WP-CPL-001)에는 없는 보조 진입점이다 — 내가 초대를 만드는 화면과 별개로,
         * 상대에게 받은 코드를 입력하는 길(WP-CPL-002)이 따로 있어야 한다. 헤더가 아니라
         * 화면 맨 아래 작은 밑줄 텍스트로 둬 Primary CTA(카카오로 초대하기)와 겹치지
         * 않게 한다.
         *
         * **가운데 · 더 잘 보이게**(2026-09-26 대표 지시 「텍스트는 중앙에 배치하고 조금 더 눈에
         * 띄게 변경한다」). 정본에 이 링크가 없어 기준은 my.js:279 `logout`(13 · DIM · 밑줄 · 왼쪽)
         * 이었다 — 그보다 강조한 것은 전부 대표 지시다: 가로 가운데 · f15(14→15) · 700 · 본문색
         * `text`(gray900 · 흰 바탕 16.9:1 — 이전 textAssistive gray600은 3.4:1로 4.5:1 미달) ·
         * 터치 영역 최소 44(`Layout.touchTarget`). 밑줄은 링크 표시로 그대로 둔다. Primary CTA는
         * 여전히 Dock의 「카카오로 초대하기」 하나다.
         */}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={S.haveCode}
          onPress={() => router.push(joinHref as never)}
          style={({ pressed }) => [styles.haveCodeLink, pressed && styles.haveCodePressed]}>
          <ThemedText type="f15" themeColor="text" style={styles.haveCodeText}>
            {S.haveCode}
          </ThemedText>
        </Pressable>
      </ScrollView>

      <Dock>
        <ActionButton
          variant="primary"
          size="sheet"
          tone={code ? { background: SocialColors.kakao.background, text: SocialColors.kakao.text } : undefined}
          label={code ? S.kakao : busy ? '만드는 중…' : S.make}
          disabled={busy && !code}
          onPress={() => (code ? void share() : void makeInvite())}
        />
      </Dock>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  error: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.three },
  bold: { fontWeight: 700 },
  noteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },

  /* qBlock — 바깥 좌우 24px. */
  qBlock: { paddingHorizontal: Layout.gutter, paddingTop: Layout.rowPaddingY + 4, paddingBottom: Spacing.four },
  sec: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four, gap: Layout.rowPaddingY },

  /* codeCard — radius 10 · 배경 회색(코랄 아님) · padding 20 · gap 6 · 가운데 정렬. */
  codeCard: { borderRadius: Radius.medium, padding: Layout.cardPadding, alignItems: 'center', gap: Spacing.two },
  btnRow: { flexDirection: 'row', gap: Layout.rowPaddingY, marginTop: Layout.rowPaddingY },
  btnRowItem: { flex: 1 },

  listCard: { borderRadius: Radius.medium, borderWidth: Border.hairline, overflow: 'hidden' },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: Layout.rowPaddingY, minHeight: 52, paddingHorizontal: Layout.rowPaddingY + 4 },
  scopeDot: { width: 5, height: 5, borderRadius: Radius.pill },
  scopeLabel: { flex: 1, minWidth: 0 },
  infoRow: { justifyContent: 'center', gap: 3, minHeight: 64, paddingHorizontal: Layout.rowPaddingY + 4 },

  haveCodeLink: {
    alignSelf: 'center',
    minHeight: Layout.touchTarget,
    paddingHorizontal: Layout.gutter,
    justifyContent: 'center',
  },
  haveCodeText: { fontWeight: '700', textAlign: 'center', textDecorationLine: 'underline' },
  haveCodePressed: { opacity: 0.6 },
});
