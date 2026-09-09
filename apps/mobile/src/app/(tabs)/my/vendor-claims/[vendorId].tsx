import type { ClaimEvidenceInput } from '@weddingpick/api-contract';
import {
  CLAIM_EVIDENCE_NOTICE,
  CLAIM_METHODS,
  CLAIM_METHOD_RULES,
  CLAIM_REVIEW_NOTICE,
  checkClaim,
  type ClaimMethod,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  FilterChip,
  FontSize,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { createVendorClaim } from '@/api/client';
import { pickFromLibrary } from '@/features/capture/pickers';
import { uploadBusinessDocument } from '@/features/capture/upload';

/**
 * 업체 관계자 인증 신청. 최종통합정책 v2.0 26번.
 *
 * 수단이 셋이고 **위쪽이 빠르다**. 회사 이메일이 없는 작은 업체가 아래쪽으로
 * 들어온다 — 원문이 대체 수단을 두라고 한 이유가 그것이다.
 *
 * 화면은 "인증 메일을 보내드렸어요"라고 적지 않는다. 메일을 보내는 것은 담당자고,
 * 앱이 보내지 않는 메일을 기다리게 만들 수 없다.
 */
export default function VendorClaimScreen() {
  const { vendorId, vendorName } = useLocalSearchParams<{
    vendorId: string;
    vendorName?: string;
  }>();
  const theme = useTheme();

  const [method, setMethod] = useState<ClaimMethod>('official_domain_email');
  const [claimedRole, setClaimedRole] = useState('');
  const [email, setEmail] = useState('');
  const [listedAt, setListedAt] = useState('');
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function evidenceOf(): ClaimEvidenceInput {
    if (method === 'business_document') {
      return { method, documentId: documentId ?? '' };
    }

    if (method === 'listed_email') {
      return { method, email: email.trim(), listedAt: listedAt.trim() };
    }

    return { method, email: email.trim() };
  }

  async function attach() {
    setMessage(null);

    try {
      const pages = await pickFromLibrary();

      if (pages.length === 0) return;

      setSending(true);
      setDocumentId(await uploadBusinessDocument(pages));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '증빙을 올리지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  async function send() {
    const evidence = evidenceOf();
    const check = checkClaim({ claimedRole, evidence });

    if (!check.ok) {
      setMessage(check.message);
      return;
    }

    setSending(true);
    setMessage(null);

    try {
      await createVendorClaim({ vendorId, claimedRole: claimedRole.trim(), evidence });
      router.replace('/my/vendor-claims');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '신청하지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  const field = {
    backgroundColor: theme.backgroundSelected,
    color: theme.text,
    borderRadius: Radius.input,
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">{'이 업체의\n관계자이신가요'}</ThemedText>

          {vendorName ? (
            <ThemedText type="t6" themeColor="textSecondary">
              {vendorName}
            </ThemedText>
          ) : null}

          {/* 넣자마자 되는 줄 알고 기다리지 않게 먼저 말한다. */}
          <ThemedView style={[styles.notice, { backgroundColor: theme.tintSubtle }]}>
            <ThemedText type="t6" themeColor="tint">
              {CLAIM_REVIEW_NOTICE}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              어떻게 확인할까요
            </ThemedText>
            <ThemedView style={styles.methods}>
              {CLAIM_METHODS.map((option) => (
                <FilterChip
                  key={option}
                  label={CLAIM_METHOD_RULES[option].label}
                  selected={method === option}
                  onPress={() => {
                    setMethod(option);
                    setMessage(null);
                  }}
                />
              ))}
            </ThemedView>
            <ThemedText type="t7" themeColor="textAssistive">
              {CLAIM_METHOD_RULES[method].description}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              업체에서 어떤 일을 하시나요
            </ThemedText>
            <TextInput
              value={claimedRole}
              onChangeText={setClaimedRole}
              placeholder="예약팀장"
              placeholderTextColor={theme.textAssistive}
              maxLength={60}
              style={[styles.input, field]}
            />
          </ThemedView>

          {method === 'business_document' ? (
            <ThemedView style={styles.field}>
              <ThemedText type="t7" themeColor="textSecondary">
                사업자 관련 증빙
              </ThemedText>
              <ActionButton
                label={documentId ? '다시 고르기' : '사진에서 고르기'}
                disabled={sending}
                onPress={() => void attach()}
              />
              {documentId ? (
                <ThemedText type="t7" themeColor="positive">
                  첨부했어요
                </ThemedText>
              ) : null}
              <ThemedText type="t7" themeColor="textAssistive">
                {CLAIM_EVIDENCE_NOTICE}
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedView style={styles.field}>
              <ThemedText type="t7" themeColor="textSecondary">
                연락받을 이메일
              </ThemedText>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="yeji@gaon.co.kr"
                placeholderTextColor={theme.textAssistive}
                autoCapitalize="none"
                keyboardType="email-address"
                maxLength={200}
                style={[styles.input, field]}
              />
            </ThemedView>
          )}

          {method === 'listed_email' ? (
            <ThemedView style={styles.field}>
              <ThemedText type="t7" themeColor="textSecondary">
                그 이메일이 어디에 공개돼 있나요
              </ThemedText>
              <TextInput
                value={listedAt}
                onChangeText={setListedAt}
                placeholder="공식 홈페이지 하단 문의처"
                placeholderTextColor={theme.textAssistive}
                maxLength={300}
                style={[styles.input, field]}
              />
            </ThemedView>
          ) : null}

          {message ? (
            <ThemedText type="t6" themeColor="negative">
              {message}
            </ThemedText>
          ) : null}

          <ActionButton
            variant="primary"
            label="확인 요청하기"
            disabled={sending}
            onPress={() => void send()}
          />
          <ActionButton label="그만두기" onPress={() => router.back()} />
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
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  notice: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  methods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  input: {
    paddingHorizontal: Layout.fieldPaddingX,
    paddingVertical: Spacing.three,
    /* 입력 칸 글자도 본문이다. 토큰 밖의 크기를 쓰지 않는다. */
    fontSize: FontSize.t6,
    minHeight: Layout.rowMinHeight,
  },
});
