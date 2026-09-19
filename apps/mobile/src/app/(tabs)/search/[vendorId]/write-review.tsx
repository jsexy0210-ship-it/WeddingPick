import type { ReviewForm } from '@weddingpick/api-contract';
import {
  CHECKLIST_ANSWERS,
  CHECKLIST_ANSWER_LABEL,
  type ChecklistAnswer,
  type ReviewerRole,
} from '@weddingpick/domain';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { createReview, getReviewForm } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { requestDirtySheetClose } from '@/features/common/dirty-sheet-close';
import { dismissToOrReplace } from '@/features/navigation/depth-back';
import {
  ActionButton,
  FilterChip,
  Radius,
  RatingPicker,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

import VendorDetailScreen from './index';

/**
 * /write-review 딥링크는 업체 상세를 배경으로 남기고 DLG-D 작성 시트만 연다.
 */
export default function WriteReviewRoute() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const theme = useTheme();

  const [form, setForm] = useState<ReviewForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [role, setRole] = useState<ReviewerRole | null>(null);
  const [overall, setOverall] = useState<number | null>(null);
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [checklist, setChecklist] = useState<Record<string, ChecklistAnswer>>({});
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReviewForm(vendorId)
      .then(setForm)
      .catch((caught: Error) => setLoadError(caught.message));
  }, [vendorId]);

  const dirty =
    role !== null ||
    overall !== null ||
    Object.keys(aspects).length > 0 ||
    Object.keys(checklist).length > 0 ||
    title.length > 0 ||
    body.length > 0 ||
    pros.length > 0 ||
    cons.length > 0;

  const picked = form?.roles.find((option) => option.value === role) ?? null;
  const shortBody = form ? body.trim().length < form.minimumBodyLength : false;
  const ready =
    form !== null &&
    role !== null &&
    overall !== null &&
    title.trim().length > 0 &&
    !shortBody;

  function closeSheet() {
    dismissToOrReplace(`/search/${vendorId}`);
  }

  function requestClose() {
    if (sending) return;
    requestDirtySheetClose(dirty, closeSheet);
  }

  async function submit() {
    if (!form || !picked || overall === null || !ready || sending) return;

    setSending(true);
    setError(null);

    try {
      await createReview(vendorId, {
        role: picked.value,
        overall,
        title: title.trim(),
        body: body.trim(),
        ...(pros.trim() && { pros: pros.trim() }),
        ...(cons.trim() && { cons: cons.trim() }),
        aspects: picked.aspects.flatMap((aspect) => {
          const rating = aspects[aspect.key];
          return rating === undefined ? [] : [{ key: aspect.key, rating }];
        }),
        checklist: (form.checklist ?? []).flatMap((item) => {
          const answer = checklist[item.key];
          return answer === undefined ? [] : [{ key: item.key, answer }];
        }),
      });

      // 저장 뒤 부모 화면으로 돌아간다. 별도 성공 Alert는 띄우지 않는다.
      closeSheet();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '후기를 남기지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.host}>
      <VendorDetailScreen />

      <BottomSheet visible onRequestClose={requestClose} testID="review-write-sheet">
        <SheetPanel>
          <View style={styles.sheetHead}>
            <ThemedText type="t4">후기 작성</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              업체 정보를 보던 화면을 남겨둔 채 작성해요.
            </ThemedText>
          </View>

          {loadError ? (
            <View style={styles.section}>
              <ThemedText type="t7" themeColor="negative">
                {loadError}
              </ThemedText>
              <ActionButton label="닫기" onPress={closeSheet} />
            </View>
          ) : !form ? (
            <ThemedText type="t7" themeColor="textSecondary">
              후기 양식을 불러오고 있어요.
            </ThemedText>
          ) : form.alreadyWritten ? (
            <View style={styles.section}>
              <ThemedText type="t5">이미 후기를 쓰셨어요</ThemedText>
              <ThemedText type="t7" themeColor="textSecondary">
                한 업체에 후기는 하나만 남길 수 있어요. 고치고 싶으시면 문의로 알려주세요.
              </ThemedText>
              <ActionButton label="닫기" onPress={closeSheet} />
            </View>
          ) : (
            <>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                <ThemedView style={styles.section}>
                  <ThemedText type="subtitle">{form.vendorName}</ThemedText>
                  <ThemedView type="backgroundElement" style={styles.card}>
                    <ThemedText type="smallBold">{form.verification.label}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {form.verification.note}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.section}>
                  <ThemedText type="smallBold">어떤 자리로 오셨나요</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    고르신 자리에 따라 여쭙는 항목이 달라져요.
                  </ThemedText>
                  <ThemedView style={styles.chips}>
                    {form.roles.map((option) => (
                      <FilterChip
                        key={option.value}
                        label={option.label}
                        selected={role === option.value}
                        role="radio"
                        onPress={() => {
                          setRole(option.value);
                          setAspects({});
                        }}
                      />
                    ))}
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.section}>
                  <ThemedText type="smallBold">전체 만족도</ThemedText>
                  <RatingPicker
                    label="전체 만족도"
                    size="large"
                    value={overall}
                    onChange={setOverall}
                  />
                </ThemedView>

                {form.evaluationMode === 'checklist' && form.checklist.length > 0 ? (
                  <ThemedView style={styles.section}>
                    <ThemedText type="smallBold">이용 경험 확인</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      모르시는 항목은 모름으로 두셔도 돼요. 모름은 점수에 들어가지 않아요.
                    </ThemedText>
                    {form.checklist.map((item) => (
                      <ThemedView key={item.key} style={styles.section}>
                        <ThemedText type="small">{item.question}</ThemedText>
                        <ThemedView style={styles.chips}>
                          {CHECKLIST_ANSWERS.map((answer) => (
                            <FilterChip
                              key={answer}
                              label={CHECKLIST_ANSWER_LABEL[answer]}
                              selected={checklist[item.key] === answer}
                              role="radio"
                              onPress={() =>
                                setChecklist((current) => ({ ...current, [item.key]: answer }))
                              }
                            />
                          ))}
                        </ThemedView>
                      </ThemedView>
                    ))}
                  </ThemedView>
                ) : null}

                {picked && picked.aspects.length > 0 ? (
                  <ThemedView style={styles.section}>
                    <ThemedText type="smallBold">항목별 평가 (선택)</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      아시는 것만 골라주세요. 고르지 않은 항목은 계산에 들어가지 않아요.
                    </ThemedText>
                    {picked.aspects.map((aspect) => (
                      <ThemedView key={aspect.key} style={styles.aspectRow}>
                        <ThemedText type="small">{aspect.label}</ThemedText>
                        <RatingPicker
                          label={aspect.label}
                          value={aspects[aspect.key] ?? null}
                          onChange={(rating) =>
                            setAspects((current) => ({ ...current, [aspect.key]: rating }))
                          }
                        />
                      </ThemedView>
                    ))}
                  </ThemedView>
                ) : null}

                <ThemedView style={styles.section}>
                  <ThemedText type="smallBold">한 줄 제목</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="예: 음식이 따뜻하게 나왔습니다"
                    placeholderTextColor={theme.textSecondary}
                    accessibilityLabel="후기 제목"
                  />
                </ThemedView>

                <ThemedView style={styles.section}>
                  <ThemedText type="smallBold">후기</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {form.minimumBodyLength}자 이상 적어주세요.
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      styles.body,
                      { color: theme.text, borderColor: theme.border },
                    ]}
                    value={body}
                    onChangeText={setBody}
                    multiline
                    placeholder="무엇이 좋았고 무엇이 아쉬웠는지 적어주세요"
                    placeholderTextColor={theme.textSecondary}
                    accessibilityLabel="후기 내용"
                  />
                  {shortBody ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {body.trim().length}/{form.minimumBodyLength}자
                    </ThemedText>
                  ) : null}
                </ThemedView>

                <ThemedView style={styles.section}>
                  <ThemedText type="smallBold">좋았던 점 (선택)</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    value={pros}
                    onChangeText={setPros}
                    multiline
                    placeholderTextColor={theme.textSecondary}
                    accessibilityLabel="좋았던 점"
                  />
                </ThemedView>

                <ThemedView style={styles.section}>
                  <ThemedText type="smallBold">아쉬운 점 (선택)</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    value={cons}
                    onChangeText={setCons}
                    multiline
                    placeholderTextColor={theme.textSecondary}
                    accessibilityLabel="아쉬운 점"
                  />
                </ThemedView>

                <ThemedText type="small" themeColor="textSecondary">
                  직원분 실명처럼 다른 분을 알아볼 수 있는 내용은 적지 말아주세요.
                </ThemedText>

                {error ? (
                  <ThemedView type="backgroundElement" style={styles.card}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {error}
                    </ThemedText>
                  </ThemedView>
                ) : null}
              </ScrollView>

              <View style={styles.actions}>
                <ActionButton label="취소" disabled={sending} onPress={requestClose} />
                <ActionButton
                  variant="primary"
                  label={sending ? '올리는 중…' : '후기 남기기'}
                  disabled={!ready || sending}
                  onPress={() => void submit()}
                />
              </View>
            </>
          )}
        </SheetPanel>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  sheetHead: { gap: Spacing.one },
  scroll: { flexShrink: 1 },
  content: { paddingBottom: Spacing.two, gap: Spacing.four },
  section: { gap: Spacing.two },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  aspectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.input,
    padding: Spacing.three,
  },
  body: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: Spacing.two },
});
