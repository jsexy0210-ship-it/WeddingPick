import type { MyVendorClaim } from '@weddingpick/api-contract';
import { CLAIM_EVIDENCE_NOTICE } from '@weddingpick/domain';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ErrorView,
  Layout,
  LoadingView,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';
import { listMyVendorClaims } from '@/api/client';

/**
 * 내가 낸 업체 관계자 인증. 최종통합정책 v2.0 26·27번.
 *
 * **증빙과 연락처는 여기 없다.** 응답이 들고 오지 않으므로 화면이 꺼낼 것도
 * 없다 — 원문 27번을 관례가 아니라 자료의 모양으로 지킨다.
 */
export default function MyVendorClaimsScreen() {
  const [claims, setClaims] = useState<MyVendorClaim[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    void listMyVendorClaims()
      .then((response) => {
        setLoadError(null);
        setClaims(response.claims);
      })
      .catch((caught: Error) => setLoadError(caught.message ?? '인증 내역을 불러오지 못했어요.'));
  }, []);

  useEffect(load, [load]);

  if (loadError) {
    return <ErrorView message={loadError} onBack={load} />;
  }

  if (claims === null) {
    return <LoadingView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">업체 관계자 인증</ThemedText>

          {claims.length === 0 ? (
            <ThemedText type="t6" themeColor="textSecondary">
              아직 신청한 업체가 없어요. 업체 화면에서 이 업체의 관계자예요를
              눌러 신청해주세요
            </ThemedText>
          ) : null}

          {claims.map((claim) => (
            <ThemedView key={claim.id} type="backgroundElement" style={styles.card}>
              <View style={styles.cardHead}>
                <ThemedText type="t5">{claim.vendorName}</ThemedText>
                <ThemedText
                  type="badge"
                  themeColor={claim.status === 'approved' ? 'positive' : 'textAssistive'}>
                  {claim.statusLabel}
                </ThemedText>
              </View>

              <ThemedText type="t7" themeColor="textSecondary">
                {claim.claimedRole} · {claim.methodLabel}
              </ThemedText>

              <ThemedText type="t6" themeColor="textSecondary">
                {claim.statusNote}
              </ThemedText>

              {/*
                * 사유는 확인하지 못했을 때만 보여준다. 확인된 신청의
                * decisionNote는 담당자가 무엇으로 확인했는지 적은 말이고, 낸
                * 사람에게 필요한 것은 지금 확인됐다는 사실이다.
                */}
              {claim.status === 'rejected' && claim.decisionNote ? (
                <ThemedText type="t7" themeColor="negative">
                  {claim.decisionNote}
                </ThemedText>
              ) : null}
            </ThemedView>
          ))}

          <ThemedText type="t7" themeColor="textAssistive">
            {CLAIM_EVIDENCE_NOTICE}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
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
    gap: Spacing.three,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
