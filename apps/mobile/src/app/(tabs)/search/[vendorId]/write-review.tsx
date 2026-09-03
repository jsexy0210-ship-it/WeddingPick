import type { ReviewForm } from '@weddingpick/api-contract';
import {
  CHECKLIST_ANSWERS,
  CHECKLIST_ANSWER_LABEL,
  type ChecklistAnswer,
  type ReviewerRole,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createReview, getReviewForm } from '@/api/client';
import {
  ActionButton,
  ErrorView,
  FilterChip,
  LoadingView,
  MaxContentWidth,
  RatingPicker,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/**
 * 후기 쓰기.
 *
 * 무엇을 물을지 앱이 정하지 않는다. 업종마다 다르고 역할마다 다르며, 그 규칙은 서버에
 * 있다 — 하객에게 추가비용을 물으면 짐작으로 채우고, 그 짐작이 업체 점수가 된다.
 *
 * 확인 단계도 서버가 정한다. 작성자가 자기 후기를 "계약 확인"이라고 말할 수 있으면 그
 * 표시는 아무 뜻이 없다. 대신 **쓰기 전에** 어디까지 확인되는지 보여준다 — 다 쓰고
 * 나서 알려주면 그건 통보다.
 */
export default function WriteReviewScreen() {
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
  const [done, setDone] = useState<{ label: string; caveat: string } | null>(null);

  useEffect(() => {
    getReviewForm(vendorId)
      .then(setForm)
      .catch((caught: Error) => setLoadError(caught.message));
  }, [vendorId]);

  if (loadError) {
    return <ErrorView message={loadError} onBack={() => router.back()} />;
  }

  if (!form) {
    return <LoadingView />;
  }

  if (done) {
    /*
     * 스튜디오·드레스·메이크업을 한 평점으로 합치지 않는다(사업계획서 19번) —
     * 그러려면 셋을 각자 물어야 한다. 같은 견적으로 묶인 다른 업체가 있고 아직
     * 안 썼으면, 여기서 바로 다음 업체로 이어간다. 이 목록은 쓰기 시작할 때
     * 이미 받아뒀다 — 방금 쓴 후기 하나로 목록이 바뀌지 않는다.
     */
    const next = form.packageSiblings[0];

    return (
      <Frame>
        <ThemedText type="subtitle">후기를 남겼어요</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {done.label}로 올라갔어요.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {done.caveat}
        </ThemedText>

        {next ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">
              같은 견적에 {next.roleLabel} 업체도 있어요
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {next.vendorName}은 다른 업체라 후기도 따로 남겨야 반영돼요.
            </ThemedText>
            <ActionButton
              label={`${next.vendorName} 후기 쓰기`}
              onPress={() => router.replace(`/search/${next.vendorId}/write-review`)}
            />
          </ThemedView>
        ) : null}

        <ActionButton
          label={next ? '나중에 할게요' : '후기 보러 가기'}
          variant={next ? 'secondary' : 'primary'}
          onPress={() => router.back()}
        />
      </Frame>
    );
  }

  if (form.alreadyWritten) {
    return (
      <Frame>
        <ThemedText type="subtitle">이미 후기를 쓰셨어요</ThemedText>
        {/* 한 사람이 한 업체에 하나. 여러 개면 점수를 밀어 올릴 수 있다. */}
        <ThemedText type="small" themeColor="textSecondary">
          한 업체에 후기는 하나만 남길 수 있어요. 고치고 싶으시면 문의로 알려주세요.
        </ThemedText>
        <ActionButton label="돌아가기" onPress={() => router.back()} />
      </Frame>
    );
  }

  const picked = form.roles.find((option) => option.value === role) ?? null;
  const shortBody = body.trim().length < form.minimumBodyLength;
  const ready = role !== null && overall !== null && title.trim().length > 0 && !shortBody;

  async function submit() {
    if (!picked || overall === null) return;

    setSending(true);
    setError(null);

    try {
      const created = await createReview(vendorId, {
        role: picked.value,
        overall,
        title: title.trim(),
        body: body.trim(),
        ...(pros.trim() && { pros: pros.trim() }),
        ...(cons.trim() && { cons: cons.trim() }),
        // 이 역할에게 물은 것만 보낸다. 역할을 바꾸면 안 묻는 항목이 남아 있을 수 있다.
        aspects: picked.aspects.flatMap((aspect) => {
          const rating = aspects[aspect.key];

          return rating === undefined ? [] : [{ key: aspect.key, rating }];
        }),
        // 업종이 방식을 정한다. 둘 중 하나만 채워져 나간다.
        checklist: (form!.checklist ?? []).flatMap((item) => {
          const answer = checklist[item.key];

          return answer === undefined ? [] : [{ key: item.key, answer }];
        }),
      });

      setDone({ label: created.verificationLabel, caveat: created.caveat });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '후기를 남기지 못했어요.');
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">{form.vendorName}</ThemedText>
            {/* 쓰기 전에 알려준다. 다 쓰고 나서 말하면 그건 통보다. */}
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
                    // 자리를 바꾸면 안 묻는 항목의 답이 남지 않게 지운다.
                    setAspects({});
                  }}
                />
              ))}
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">전체 만족도</ThemedText>
            <RatingPicker label="전체 만족도" size="large" value={overall} onChange={setOverall} />
          </ThemedView>

          {/*
            결정사는 체크리스트다. 평점이 답할 수 없는 것을 답할 수 있어서다 —
            "모름"이 점수 계산에서 빠진다. 평점은 모르는 것도 3점쯤으로 찍힌다.
          */}
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
              {form.minimumBodyLength}자 이상 적어주세요. 짧은 글은 다음 분에게 도움이 되지
              않아요.
            </ThemedText>
            <TextInput
              style={[styles.input, styles.body, { color: theme.text, borderColor: theme.border }]}
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

          {error ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView style={styles.section}>
            {/*
              다른 사람 이름을 적지 말아 달라고 여기서 말한다. 자유 글에서 이름을 기계로
              걸러낼 수 없어, 적히면 신고와 사람 확인으로만 지워진다.
            */}
            <ThemedText type="small" themeColor="textSecondary">
              직원분 실명처럼 다른 분을 알아볼 수 있는 내용은 적지 말아주세요.
            </ThemedText>
            <ActionButton
              variant="primary"
              label={sending ? '올리는 중…' : '후기 남기기'}
              disabled={!ready || sending}
              onPress={() => void submit()}
            />
            <ActionButton label="그만두기" onPress={() => router.back()} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>{children}</ThemedView>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
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
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  body: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
});
