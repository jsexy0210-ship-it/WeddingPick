import {
  APP_PERMISSION_ITEMS,
  APP_PERMISSION_NOTE,
  CONSENT_AGREEMENT_ITEMS,
  OPTIONAL_AGREEMENT_ITEMS,
  REQUIRED_AGREEMENT_ITEMS,
  acceptedSignupItems,
  signupConsentsFor,
  type AppPermissionItem,
  type ConsentAgreementItem,
  type ConsentAgreementKey,
} from '@weddingpick/domain';
import { router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionButton,
  CanonGray,
  ErrorView,
  Layout,
  LineHeight,
  MaxContentWidth,
  ProductSymbol,
  ProductSymbolName,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { ApiError, completeSignup, getSignupState } from '@/api/client';
import { loadToken } from '@/api/session';
import { clearSignupPending, hasFreshSignupPending, noteSignupActivated } from '@/features/auth/sign-in-handoff';
import { SigningInOverlay, SigningInView } from '@/features/auth/signing-in-view';
import { TermsDetailModal } from '@/features/auth/terms-detail-modal';
import { beginAuthProgress } from '@/features/loading/auth-progress';
import { dismissToOrReplace } from '@/features/navigation/depth-back';

/**
 * 약관 동의 · 권한 안내 — WP-AUTH-010. v3.29 신규 화면.
 *
 * `docs/design/React_Native/home.jsx` 4번 화면. 카카오 로그인 직후,
 * 초기 설정(`/setup`) 전에 한 번 뜬다(README.md 「진입 흐름」). 필수 5개를 모두 체크해야
 * 하단 CTA가 켜진다. 필수 · 선택 · 앱 접근 권한 3구획, 권한은 아이콘 4칸으로만 보여준다.
 *
 * **체크한 칸은 전부 서버에 보낸다**(2026-09-26 대표 감사 8). 전에는 서버가 아는
 * `terms` · `privacy` · `marketing` 셋만 추려 보내서 나머지 다섯(만 14세 · Pick 인증 ·
 * 상담 녹음 · 연락처 제공 · 야간 알림)은 어디에도 남지 않았다. 이제 여덟 모두
 * `user_consents`에 항목 · 판 · 필수 여부 · 시각으로 남는다(`signupConsentsFor`).
 * 다만 **서버가 아는 항목만** 보낸다 — 가입 상태 응답이 알려 준 항목(`acceptedSignupItems`)
 * 밖의 키가 섞이면 옛 서버가 요청 전체를 거절한다.
 *
 * **로그인 직후에는 로더 없이 바로 선다**(2026-09-26 대표 감사 4). 로그인이 이미
 * «가입 전»을 확인했으면(`sign-in-handoff` `noteSignupPending`) 폼을 곧바로 그리고,
 * 가입 상태는 뒤에서 다시 묻는다 — 전에는 «로그인하는 중이에요» 뒤에 이 화면의
 * 로더가 한 번 더 섰다.
 */
export default function ConsentScreen() {
  const insets = useSafeAreaInsets();
  /** 로그인이 방금 «가입 전»을 확인했는가 — 그러면 로더 없이 폼부터 그린다. 첫 렌더에서 한 번만 읽는다. */
  const [hinted] = useState(() => hasFreshSignupPending());
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(hinted ? 'ready' : 'loading');
  /** 서버가 아는 동의 항목. 가입 상태를 아직 못 읽었으면 null — 그때는 체크한 칸을 전부 보낸다. */
  const [accepted, setAccepted] = useState<ReadonlySet<string> | null>(null);
  /**
   * 가입 상태를 몇 번째로 묻는가. «다시 시도»가 이 값을 올려 아래 effect를 다시 돌린다.
   * 전에는 `setStatus('loading')`만 해서 effect가 다시 돌지 않았고, 로더만 영영
   * 떠 있었다(2026-09-26 대표 감사 5).
   */
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState<ReadonlySet<ConsentAgreementKey>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState<ConsentAgreementKey | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    let alive = true;
    /*
     * 기다린 뒤 옮기기 전에 **이 화면이 아직 앞에 있는지** 본다. 웹 JS 스택은 갈아끼워진 카드를
     * 전환이 끝날 때까지 그려 두므로(언마운트가 늦다) `alive`만으로는 못 막는다 — 온보딩을 마친
     * 사용자가 옛 주소로 `/login/consent`를 열면 루트가 홈으로 갈아끼우는 사이 이 확인이 끝나
     * `/setup`으로 되돌려 보냈다(2026-09-26 검수 반례).
     */
    const current = () => alive && navigation.isFocused();

    /* 깃발은 한 번 쓰고 버린다 — «다시 시도» · 재방문은 서버 답을 기다린다. */
    clearSignupPending();

    void (async () => {
      const token = await loadToken();
      if (!token) {
        if (current()) router.replace('/login');
        return;
      }

      try {
        const state = await getSignupState();
        if (!alive) return;

        if (state.activated) {
          // 이미 동의를 마친 계정(다시 들어온 경우) — 초기 설정으로 바로 넘긴다.
          if (current()) dismissToOrReplace('/setup');
          return;
        }

        setAccepted(acceptedSignupItems(state));
        setStatus('ready');
      } catch {
        /*
         * 로그인 직후라 폼을 이미 그렸으면 거두지 않는다 — 동의를 누르면 제출이 서버에
         * 다시 닿고, 거기서 실패하면 폼 아래에 오류가 선다. 그 밖에는 오류 + «다시 시도».
         */
        if (alive && !(hinted && attempt === 0)) setStatus('error');
      }
    })();

    return () => { alive = false; };
  }, [attempt, hinted, navigation]);

  const allRequiredChecked = REQUIRED_AGREEMENT_ITEMS.every((item) => checked.has(item.key));
  const allChecked = CONSENT_AGREEMENT_ITEMS.every((item) => checked.has(item.key));

  function toggle(key: ConsentAgreementKey) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(CONSENT_AGREEMENT_ITEMS.map((item) => item.key)));
  }

  async function submit() {
    if (submitting || !allRequiredChecked) return;

    /*
     * 누른 순간부터 온보딩 첫 질문이 설 때까지가 기다림 하나다(2026-09-26 대표 지시 — 「약관 동의 →
     * 온보딩 이동 시 로딩이 발생한다. 로더를 넣거나 …」). 서버 답이 700ms를 넘기면 로그인과 같은
     * 원형 고리 화면이 선다(`SigningInOverlay`) — 그 전에는 폼 그대로다(빈 화면을 띄우지 않는다).
     */
    beginAuthProgress();
    setSubmitting(true);
    setError(null);

    /* 체크한 칸 전부 — 화면 키를 서버 키로 옮긴다(`benefit_alerts` → `marketing`). 서버가 모르는 키는 뺀다. */
    const consents = signupConsentsFor(checked, accepted);

    try {
      const state = await completeSignup({ consents });
      /* 방금 받은 «가입 완료»를 온보딩이 다시 묻지 않게 넘긴다(`sign-in-handoff`). */
      if (state.activated) noteSignupActivated();
      /*
       * 넘어가는 동안 `submitting`을 풀지 않는다 — 풀면 고리가 걷히고 동의 폼이 전환 동안 한 번 더
       * 비친 뒤 온보딩이 선다(웹 연속 캡처로 확인). 이 화면은 곧 내려간다.
       */
      dismissToOrReplace('/setup');
    } catch (caught) {
      setSubmitting(false);
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login');
        return;
      }
      setError(caught instanceof Error ? caught.message : '동의를 저장하지 못했어요.');
    }
  }

  if (status === 'loading') {
    /* 로그인 · 온보딩 사이의 같은 원형 고리(2026-09-26 「로더 써클만 돌도록 통합한다」). */
    return <SigningInView message={null} />;
  }

  if (status === 'error') {
    return (
      <ErrorView
        message="불러오지 못했어요."
        onRetry={() => {
          setStatus('loading');
          setAttempt((current) => current + 1);
        }}
      />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            {/* home.js `permTitle` 24/33/700 — 줄높이 33 토큰이 없어 t3(24/32)를 쓴다. */}
            <ThemedText type="t3">
              웨딩픽 이용을 위해{'\n'}동의가 필요해요
            </ThemedText>
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allChecked }}
            accessibilityLabel="전체 동의"
            onPress={toggleAll}
            style={[styles.allRow, { backgroundColor: CanonGray.gray100 }]}>
            <Mark on={allChecked} />
            <ThemedText type="f17" style={styles.bold}>
              전체 동의
            </ThemedText>
          </Pressable>

          <AgreementSection title="필수" items={REQUIRED_AGREEMENT_ITEMS} checked={checked} onToggle={toggle} onOpenDetail={setDetailKey} />
          <AgreementSection title="선택" items={OPTIONAL_AGREEMENT_ITEMS} checked={checked} onToggle={toggle} onOpenDetail={setDetailKey} />

          <View style={styles.permSection}>
            <ThemedText type="f14" style={styles.permSectionTitle}>
              앱 접근 권한
            </ThemedText>
            <View style={styles.permGrid}>
              {APP_PERMISSION_ITEMS.map((item) => (
                <PermissionCell key={item.key} item={item} />
              ))}
            </View>
            <PermissionNote />
          </View>

          {error ? (
            <ThemedText type="f13" themeColor="negative" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <ThemedView style={[styles.dock, { borderTopColor: CanonGray.gray200, paddingBottom: Math.max(DOCK_BOTTOM, Layout.gutter + insets.bottom) }]}>
          <ActionButton
            variant="primary"
            size="sheet"
            label="동의하고 시작하기"
            disabled={!allRequiredChecked || submitting}
            onPress={() => void submit()}
          />
        </ThemedView>
      </SafeAreaView>

      <SigningInOverlay active={submitting} />

      <TermsDetailModal
        visible={detailKey !== null}
        initialKey={detailKey ?? 'terms'}
        onClose={() => setDetailKey(null)}
        onAgree={() => {
          if (detailKey) setChecked((current) => new Set(current).add(detailKey));
          setDetailKey(null);
        }}
      />
    </ThemedView>
  );
}

function AgreementSection({
  title,
  items,
  checked,
  onToggle,
  onOpenDetail,
}: {
  title: string;
  items: readonly ConsentAgreementItem[];
  checked: ReadonlySet<ConsentAgreementKey>;
  onToggle: (key: ConsentAgreementKey) => void;
  onOpenDetail: (key: ConsentAgreementKey) => void;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="f14" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {items.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: checked.has(item.key) }}
          accessibilityLabel={item.label}
          onPress={() => onToggle(item.key)}
          style={styles.agreementRow}>
          <Mark on={checked.has(item.key)} />
          <ThemedText type="f15" style={styles.agreementLabel}>
            {item.label}
          </ThemedText>
          {item.hasDoc ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.label} 상세`}
              hitSlop={Spacing.two}
              onPress={() => onOpenDetail(item.key)}>
              <ProductSymbolChevron />
            </Pressable>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

function Mark({ on }: { on: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.mark,
        on ? { backgroundColor: theme.tint } : { borderWidth: 1.5, borderColor: theme.track },
      ]}>
      {on ? <ProductSymbol name="check" size={14} color={theme.onTint} /> : null}
    </View>
  );
}

function ProductSymbolChevron() {
  const theme = useTheme();
  return <ProductSymbol name="chevronRight" size={16} color={theme.textDisabled} />;
}

/** home.jsx frame-004 `permNoteT` — 13/19 · 「설정 > 웨딩픽」만 700. */
const PERMISSION_NOTE_BOLD = '설정 > 웨딩픽';

function PermissionNote() {
  const [before, after] = APP_PERMISSION_NOTE.split(PERMISSION_NOTE_BOLD);

  return (
    <ThemedText type="f13" themeColor="textAssistive" style={styles.permNote}>
      {after === undefined ? APP_PERMISSION_NOTE : (
        <>
          {before}
          <ThemedText type="f13" themeColor="textAssistive" style={styles.bold}>{PERMISSION_NOTE_BOLD}</ThemedText>
          {after}
        </>
      )}
    </ThemedText>
  );
}

const PERMISSION_ICON: Record<AppPermissionItem['key'], ProductSymbolName> = {
  notification: 'bell',
  camera: 'camera',
  photo: 'photo',
  mic: 'mic',
};

function PermissionCell({ item }: { item: AppPermissionItem }) {
  const theme = useTheme();

  return (
    <View style={styles.permCell}>
      <View style={[styles.permIconWrap, { backgroundColor: CanonGray.gray100 }]}>
        <ProductSymbol name={PERMISSION_ICON[item.key]} size={22} color={theme.text} />
      </View>
      <ThemedText type="f13" style={[styles.bold, styles.permName]}>
        {item.name}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  scroll: { paddingHorizontal: Layout.gutter, paddingTop: 40, paddingBottom: Spacing.four, gap: 28 },
  /* `permTitle` 24/33 두 줄 = 66. 줄높이 33 토큰이 없어 상자 높이로 맞춘다. */
  head: { gap: 8, minHeight: 66 },
  /* home.js `agAllRow` — min-height 60 · 좌우 16 · radius 8 · gap 12. */
  allRow: {
    minHeight: 60,
    borderRadius: Radius.picker,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
  },
  bold: { fontWeight: 700 },
  section: { gap: 2 },
  /* `agSecT` — 14/700 · #4d5159 · 줄 높이 normal(18) · 아래 6. */
  sectionTitle: { fontWeight: 700, lineHeight: LineHeight.micro, paddingBottom: 6, color: CanonGray.gray700 },
  /* `agItem.row` — min-height 44 · gap 12 · 좌우 4. */
  agreementRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Layout.inlineGap, paddingHorizontal: Spacing.one },
  agreementLabel: { flex: 1, minWidth: 0 },
  mark: {
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  /* 권한 구획도 `agSec`(gap 2 · 제목 아래 6)이고, 격자는 `permGrid`(4열 · gap 8 · 위 6 아래 12). */
  permSection: { gap: 2 },
  permSectionTitle: { fontWeight: 700, lineHeight: LineHeight.micro, paddingBottom: 6, color: CanonGray.gray700 },
  permGrid: { flexDirection: 'row', gap: Spacing.two, paddingTop: 6, paddingBottom: 12 },
  permCell: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
  permNote: { lineHeight: LineHeight.lh19 },
  /* `permName` 13/700 · 줄 높이 normal(18). */
  permName: { lineHeight: LineHeight.micro },
  permIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { paddingTop: 4 },
  /* `permCta` 도크 — 위 선 1 · 위 12 · CTA 56 · 아래 48 또는 24 + inset(정본 그림 y 828 · 아래 인디케이터 포함). */
  dock: { paddingHorizontal: Layout.gutter, paddingTop: 12, borderTopWidth: 1 },
});

/* 도크 아래 여백 — 정본 그림의 CTA y 828(아래 48). 홈 인디케이터 기기는 24 + inset이 더 크면 그것. */
const DOCK_BOTTOM = 48;
