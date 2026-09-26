import type { VendorSummary } from '@weddingpick/api-contract';
import { MANUAL_DECISION_NAME_MAX, VENDOR_CATEGORY_LABEL, regionLabel, type VendorCategory } from '@weddingpick/domain';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { searchVendors } from '@/api/client';
import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import {
  ActionButton,
  Border,
  FontSize,
  Layout,
  LineHeight,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';

import { onboarding as copy } from '../../../../../spec/strings.ko.json';
import { manualPrepName, type PrepCard, type PrepVendor, type PreparedCategory } from './flow';

/** 글자를 치는 동안 매번 부르지 않는다 — 검색 화면 · 후기 업체 시트와 같은 250ms. */
const DEBOUNCE_MS = 250;
/** 업종 하나에서 받을 수. 스드메처럼 업종이 넷인 카드는 넷을 합친다. */
const PER_CATEGORY = 10;

/**
 * 준비 현황(3/5) 카드의 업체 검색 시트 — 2026-09-26 대표 지시
 * 「웨딩홀을 누르면 웨딩홀 검색 바텀시트가 뜨고 «아직 정한 곳이 없어요» CTA가 있다」.
 *
 *   ━━                                   그래버(SheetPanel)
 *   웨딩홀 검색                      ✕    SheetHeader — 타이틀 + 우측 X(공통 시트 규칙)
 *   [🔍 업체 이름 검색              ]    search.js `searchBox` — 48 · radius 16 · 회색 면
 *   강남 A 웨딩홀                         결과 줄 — 누르면 고르고 닫힌다
 *   웨딩홀 · 서울
 *   [      아직 정한 곳이 없어요      ]   Primary CTA 하나 — 카드를 미정으로 돌린다
 *
 * **정본(`docs/design/React_Native`)에 이 시트가 없다.** WP-AUTH-004는 카드 넷을 켜고
 * 끄는 것까지만 그린다. 그래서 새 모양을 짓지 않고 이미 있는 조각만 잇는다 — 머리는
 * 공용 `SheetHeader`, 검색창은 검색 화면(`search.js` `searchBox`)과 같은 치수, 결과 줄은
 * 후기 업체 시트(`LoungeReviewVendorSheet`)와 같은 두 줄(이름 · 업종 · 지역)이다.
 *
 * **찾는 길은 검색 화면과 같다**(`searchVendors` → `GET /v1/vendors`). 계약이 업종을
 * 하나만 받으므로 카드의 업종마다 한 번씩 묻고 합친다 — 스드메 카드는 스튜디오 ·
 * 드레스 · 메이크업 · 헤어변형 넷이다. 카드 밖 업종의 업체는 여기서 나오지 않는다 —
 * 나오면 Pick의 다른 묶음에 들어가 홈과 Pick이 서로 다른 말을 한다.
 *
 * 지역(2/5)으로 거르지 않는다 — 이미 정한 곳은 사는 지역 밖일 수 있다.
 *
 * **직접 입력**(2026-09-26 대표 지시 「직접입력하는 방법 고안하라」). 글자를 넣으면 결과
 * 아래(결과가 없을 때는 안내 아래)에 조용한 줄 «직접 입력»이 선다. 누르면 같은 시트가
 * 입력 모드로 바뀐다 — 머리 «웨딩홀 직접 입력» + X, 검색창과 같은 칸(치던 글자가 그대로
 * 들어 있다), 안내 한 줄, Primary CTA «이 이름으로 정하기» 하나. 앞뒤 공백을 떼고
 * 1~30자일 때만 CTA가 켜진다. 고르면 그 카드의 결정으로 이름만 남는다(업체가 없어 Pick
 * 담기 · 상담 예약은 없다). 정본에 없는 모드라 새 모양을 짓지 않고 위 조각을 그대로 쓴다.
 */
export function PrepVendorSheet({
  visible,
  card,
  onChoose,
  onManual,
  onNone,
  onDismiss,
}: {
  visible: boolean;
  /** 연 카드. 닫히는 동안에도 머리 글자가 남도록 마지막 카드를 그대로 넘긴다. */
  card: PrepCard | null;
  onChoose: (vendor: PrepVendor) => void;
  /** 직접 입력한 이름(앞뒤 공백을 뗀 1~30자) — 그 카드의 결정으로 남긴다. */
  onManual: (name: string) => void;
  /** «아직 정한 곳이 없어요» — 카드를 미정으로 돌린다. Pick에는 아무것도 넣지 않는다. */
  onNone: () => void;
  onDismiss: () => void;
}) {
  return (
    /* 닫히면 children을 통째로 내린다 — 다시 열 때마다 검색어가 비어 있다. */
    <BottomSheet visible={visible && card !== null} onRequestClose={onDismiss} testID="prep-vendor-sheet">
      {card ? (
        <SheetBody card={card} onChoose={onChoose} onManual={onManual} onNone={onNone} onDismiss={onDismiss} />
      ) : null}
    </BottomSheet>
  );
}

function SheetBody({
  card,
  onChoose,
  onManual,
  onNone,
  onDismiss,
}: {
  card: PrepCard;
  onChoose: (vendor: PrepVendor) => void;
  onManual: (name: string) => void;
  onNone: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const { query, trimmed, change, vendors, loading, failed } = usePrepVendorSearch(card.categories);
  /** 직접 입력 모드. 들어갈 때 치던 검색어를 그대로 가져간다. */
  const [manual, setManual] = useState<string | null>(null);

  if (manual !== null) {
    const name = manualPrepName(manual);

    return (
      <SheetPanel style={styles.sheet}>
        <SheetHeader
          title={copy['prepVendor.manualTitle'].replace('{name}', card.name)}
          closeLabel={copy['prepVendor.close']}
          onClose={onDismiss}
        />

        {/* 검색창과 같은 칸 — 돋보기만 없다(찾는 칸이 아니라 적는 칸이다). */}
        <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement }]}>
          <TextInput
            autoFocus
            value={manual}
            onChangeText={setManual}
            placeholder={copy['prepVendor.manualPlaceholder']}
            placeholderTextColor={theme.textAssistive}
            accessibilityLabel={copy['prepVendor.manualPlaceholder']}
            maxLength={MANUAL_DECISION_NAME_MAX}
            returnKeyType="done"
            autoCorrect={false}
            onSubmitEditing={() => {
              if (name !== null) onManual(name);
            }}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <ThemedText type="t7" themeColor="textSecondary">
          {copy['prepVendor.manualHint'].replace('{max}', String(MANUAL_DECISION_NAME_MAX))}
        </ThemedText>

        <View style={styles.cta}>
          <ActionButton
            variant="primary"
            size="sheet"
            label={copy['prepVendor.manualCta']}
            disabled={name === null}
            onPress={() => {
              if (name !== null) onManual(name);
            }}
          />
        </View>
      </SheetPanel>
    );
  }

  /* 글자를 넣었고 찾는 중이 아니면 «직접 입력» 줄을 결과 아래에 조용히 세운다. */
  const manualRow =
    trimmed.length > 0 && !loading ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy['prepVendor.manualRow']}
        onPress={() => setManual(query.trim().slice(0, MANUAL_DECISION_NAME_MAX))}
        style={({ pressed }) => [styles.row, { borderBottomColor: theme.border }, pressed && styles.pressed]}>
        <ThemedText type="t6" themeColor="textSecondary" numberOfLines={1}>
          {copy['prepVendor.manualRow']}
        </ThemedText>
      </Pressable>
    ) : null;

  return (
    <SheetPanel style={styles.sheet}>
      <SheetHeader title={copy['prepVendor.title'].replace('{name}', card.name)} closeLabel={copy['prepVendor.close']} onClose={onDismiss} />

      <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement }]}>
        <ProductSymbol name="magnifier" size={Layout.iconField} color={theme.textAssistive} />
        <TextInput
          autoFocus
          value={query}
          onChangeText={change}
          placeholder={copy['prepVendor.placeholder']}
          placeholderTextColor={theme.textAssistive}
          accessibilityLabel={copy['prepVendor.placeholder']}
          returnKeyType="search"
          autoCorrect={false}
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      <ScrollView style={styles.results} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {trimmed.length === 0 ? (
          <ThemedText type="t7" themeColor="textSecondary" style={styles.message}>
            {copy['prepVendor.hint']}
          </ThemedText>
        ) : loading ? (
          <View style={styles.loader}>
            <DelayedLoader active size={28} />
          </View>
        ) : failed ? (
          <ThemedText type="t7" themeColor="negative" style={styles.message}>
            {copy['prepVendor.failed']}
          </ThemedText>
        ) : vendors.length === 0 ? (
          <ThemedText type="t7" themeColor="textSecondary" style={styles.message}>
            {copy['prepVendor.empty']}
          </ThemedText>
        ) : (
          vendors.map((vendor) => (
            <Pressable
              key={vendor.id}
              accessibilityRole="button"
              accessibilityLabel={vendor.name}
              onPress={() =>
                onChoose({ id: vendor.id, name: vendor.name, category: vendor.category as PreparedCategory })
              }
              style={({ pressed }) => [styles.row, { borderBottomColor: theme.border }, pressed && styles.pressed]}>
              <View style={styles.rowText}>
                <ThemedText type="t6" numberOfLines={1}>
                  {vendor.name}
                </ThemedText>
                <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
                  {VENDOR_CATEGORY_LABEL[vendor.category]} · {regionLabel(vendor.region)}
                </ThemedText>
              </View>
            </Pressable>
          ))
        )}
        {manualRow}
      </ScrollView>

      <View style={styles.cta}>
        <ActionButton variant="primary" size="sheet" label={copy['prepVendor.none']} onPress={onNone} />
      </View>
    </SheetPanel>
  );
}

/**
 * 카드 업종으로만 찾는다. 검색어가 비면 부르지 않는다(서버가 조건 없이 전부 훑는다).
 * 늦게 온 옛 응답이 새 검색어의 결과를 덮지 않게 한 번에 하나만 살린다.
 *
 * 로딩 · 실패 표시는 글자를 바꾸는 그 자리(`change`)에서 켠다 — 효과 안에서 바로
 * 상태를 바꾸면 한 번 더 그린다.
 */
function usePrepVendorSearch(categories: readonly VendorCategory[]) {
  const [query, setQuery] = useState('');
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const trimmed = query.trim();
  const key = categories.join(',');

  useEffect(() => {
    if (!trimmed) return;

    let active = true;
    const wanted = key.split(',') as VendorCategory[];
    const timer = setTimeout(() => {
      void Promise.all(wanted.map((category) => searchVendors({ q: trimmed, category, limit: PER_CATEGORY })))
        .then((responses) => {
          if (!active) return;

          const merged: VendorSummary[] = [];

          for (const vendor of responses.flatMap((response) => response.vendors)) {
            if (wanted.includes(vendor.category) && !merged.some((one) => one.id === vendor.id)) merged.push(vendor);
          }

          setVendors(merged);
        })
        .catch(() => {
          if (!active) return;

          setVendors([]);
          setFailed(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trimmed, key]);

  function change(text: string) {
    setQuery(text);
    setFailed(false);
    setLoading(text.trim().length > 0);
    if (!text.trim()) setVendors([]);
  }

  return { query, trimmed, change, vendors, loading, failed };
}

/** 결과 목록 높이 상한 — 시트가 화면을 다 덮지 않고 CTA가 늘 보인다. */
const RESULTS_MAX_HEIGHT = 320;
/** 결과 줄 — 후기 업체 시트와 같은 64. */
const ROW_MIN_HEIGHT = 64;

const styles = StyleSheet.create({
  sheet: { flexShrink: 1 },
  /* search.js `searchBox` — 48 · radius 16 · 좌우 16 · 사이 8. */
  searchBox: {
    height: Layout.searchField,
    borderRadius: Radius.cardLarge,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  /* search.js `searchPh` — 14/20. */
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.f14,
    lineHeight: LineHeight.lh20,
    paddingVertical: 0,
  },
  results: { flexGrow: 0, maxHeight: RESULTS_MAX_HEIGHT },
  loader: { minHeight: 120 },
  message: { paddingVertical: Spacing.four },
  row: {
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: Border.hairline,
  },
  rowText: { flex: 1, minWidth: 0, gap: Spacing.half },
  pressed: { opacity: 0.75 },
  /* width 100% · flex 0 0 — 세로 컨테이너에서 늘어나지 않는다(지역 시트와 같다). */
  cta: { width: '100%', flexGrow: 0, flexShrink: 0 },
});
