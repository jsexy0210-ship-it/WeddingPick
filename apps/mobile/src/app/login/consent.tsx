import {
  APP_PERMISSION_ITEMS,
  APP_PERMISSION_NOTE,
  CONSENT_AGREEMENT_ITEMS,
  OPTIONAL_AGREEMENT_ITEMS,
  REQUIRED_AGREEMENT_ITEMS,
  type AppPermissionItem,
  type ConsentAgreementItem,
  type ConsentAgreementKey,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
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
import { TermsDetailModal } from '@/features/auth/terms-detail-modal';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { dismissToOrReplace } from '@/features/navigation/depth-back';

/**
 * 약관 동의 · 권한 안내 — WP-AUTH-010. v3.29 신규 화면.
 *
 * `docs/design/React_Native/home.jsx` 4번 화면. 카카오 로그인 직후,
 * 초기 설정(`/setup`) 전에 한 번 뜬다(README.md 「진입 흐름」). 필수 5개를 모두 체크해야
 * 하단 CTA가 켜진다. 필수 · 선택 · 앱 접근 권한 3구획, 권한은 아이콘 4칸으로만 보여준다.
 *
 * **서버가 실제로 받는 동의는 아직 `terms` · `privacy` · `marketing` 셋뿐이다**
 * (`packages/domain/src/consent-terms.ts` 머리말 참고 — DB의 `terms_doc_kind` enum이
 * 그 셋만 안다). 이 화면은 v3.29가 요구하는 8개 항목(필수 5 · 선택 3)을 전부 보여주고
 * 필수 체크를 게이트로 쓰지만, 서버로 보내는 값은 그 중 서버가 아는 항목만 추린다 —
 * 나머지(만 14세 · Pick 인증 · 상담 녹음 · 제3자 제공 · 야간 알림)는 서버 계약이
 * 넓어지면 그때 같이 보낸다.
 */
export default function ConsentScreen() {
  const theme = useTheme();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [checked, setChecked] = useState<ReadonlySet<ConsentAgreementKey>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState<ConsentAgreementKey | null>(null);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const token = await loadToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const state = await getSignupState();
        if (!alive) return;

        if (state.activated) {
          // 이미 동의를 마친 계정(다시 들어온 경우) — 초기 설정으로 바로 넘긴다.
          dismissToOrReplace('/setup');
          return;
        }

        setStatus('ready');
      } catch {
        if (alive) setStatus('error');
      }
    })();

    return () => { alive = false; };
  }, []);

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

    setSubmitting(true);
    setError(null);

    /* 서버가 아는 항목만 추린다 — 위 파일 머리말 참고. */
    const consents: string[] = [];
    if (checked.has('terms')) consents.push('terms');
    if (checked.has('privacy')) consents.push('privacy');
    if (checked.has('benefit_alerts')) consents.push('marketing');

    try {
      await completeSignup({ consents });
      dismissToOrReplace('/setup');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login');
        return;
      }
      setError(caught instanceof Error ? caught.message : '동의를 저장하지 못했어요.');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <ThemedView style={styles.loading}>
        <DelayedLoader size={40} />
      </ThemedView>
    );
  }

  if (status === 'error') {
    return <ErrorView message="불러오지 못했어요." onRetry={() => setStatus('loading')} />;
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
            style={[styles.allRow, { backgroundColor: theme.backgroundElement }]}>
            <Mark on={allChecked} />
            <ThemedText type="f17" style={styles.bold}>
              전체 동의
            </ThemedText>
          </Pressable>

          <AgreementSection title="필수" items={REQUIRED_AGREEMENT_ITEMS} checked={checked} onToggle={toggle} onOpenDetail={setDetailKey} />
          <AgreementSection title="선택" items={OPTIONAL_AGREEMENT_ITEMS} checked={checked} onToggle={toggle} onOpenDetail={setDetailKey} />

          <View style={styles.permSection}>
            <ThemedText type="f14" themeColor="textSecondary" style={styles.permSectionTitle}>
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

        <ThemedView style={[styles.dock, { borderTopColor: theme.border }]}>
          <ActionButton
            variant="primary"
            size="xlarge"
            label="동의하고 시작하기"
            disabled={!allRequiredChecked || submitting}
            onPress={() => void submit()}
          />
        </ThemedView>
      </SafeAreaView>

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
      <ThemedText type="f14" themeColor="textSecondary" style={styles.sectionTitle}>
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
  return <ProductSymbol name="chevronRight" size={16} color={theme.textAssistive} />;
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
      <View style={[styles.permIconWrap, { backgroundColor: theme.backgroundElement }]}>
        <ProductSymbol name={PERMISSION_ICON[item.key]} size={22} color={theme.text} />
      </View>
      <ThemedText type="f13" style={styles.bold}>
        {item.name}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: Layout.gutter, paddingTop: 40, paddingBottom: Spacing.four, gap: 28 },
  head: { gap: 8 },
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
  sectionTitle: { fontWeight: 700, paddingBottom: 6 },
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
  permSectionTitle: { fontWeight: 700, paddingBottom: 6 },
  permGrid: { flexDirection: 'row', gap: Spacing.two, paddingTop: 6, paddingBottom: 12 },
  permCell: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
  permNote: { lineHeight: LineHeight.lh19 },
  permIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { paddingTop: 4 },
  dock: { paddingHorizontal: Layout.gutter, paddingTop: 12, paddingBottom: Spacing.four, borderTopWidth: 1 },
});
