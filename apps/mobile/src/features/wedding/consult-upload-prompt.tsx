import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Border, Layout, ProductSymbol, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import { uploadConsultationAudio } from './consultation-upload';

export const CONSULT_EMPTY_TITLE = '녹음 파일을 올려주세요';
export const CONSULT_EMPTY_BODY = '휴대폰 녹음앱에서 저장한 파일이면 돼요';
const CONSULT_UPLOADING = '올리는 중…';
const CONSULT_UPLOADED = '녹음을 올렸어요';

/**
 * «올리는 중…»에 올라간 비율을 붙인다 — 100MB 녹음은 오래 걸려, 멈춘 것처럼 보이지 않게.
 * 정본(note.js)에 올리는 중 상태가 없어 새 줄 · 막대를 만들지 않고 같은 글자 자리에만 적는다
 * (DESIGN_UNRESOLVED — 진행 표시 모양은 정본이 정하면 따른다). 비율을 모르는 동안은 글자만.
 */
export function uploadingLabel(progress: number | null): string {
  return progress === null ? CONSULT_UPLOADING : `${CONSULT_UPLOADING} ${Math.round(progress * 100)}%`;
}

/**
 * 웨딩노트 «상담기록» 빈 상자 — `docs/design/React_Native/note.js` `uploadBox`(WP-NOTE-004 빈 상태)
 * `margin-top:8px;padding:28px 20px;border-radius:10px;border:1px dashed #dcdee3;gap:6px` + 마이크 22.
 *
 * 2026-09-26 대표 지시 — 「녹음 파일을 올려주세요」를 누르면 **OS 파일 선택기를 바로 연다**
 * (중간 시트 없이). 헤더 «상담 추가»(동의 안내가 있는 시트)는 그대로 둔다. CLAUDE.md의 «본문에
 * 등록 진입점을 임의로 만들지 않는다»는 세션이 스스로 만드는 것을 막는 규칙이고, 이 상자는
 * 대표님이 직접 지시하신 자리다.
 *
 * 첫 녹음이 올라가면 이 상자는 사라진다 — 올린 즉시 스스로 숨고(`done`), 부모는 목록을 다시
 * 읽어(`onUploaded`) 기록이 한 건이라도 있으면 이 상자를 그리지 않는다.
 */
export function ConsultUploadPrompt({
  weddingId,
  onUploaded,
  onMessage,
}: {
  weddingId: string | null;
  onUploaded: () => void;
  onMessage: (message: string) => void;
}) {
  const theme = useTheme();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  if (done) return null;

  async function pickAndUpload() {
    if (!weddingId || uploading) return;
    setUploading(true);
    setProgress(null);
    try {
      const result = await uploadConsultationAudio(weddingId, { onProgress: setProgress });
      if (result === 'uploaded') {
        setDone(true);
        onMessage(CONSULT_UPLOADED);
        onUploaded();
      }
    } catch (caught) {
      onMessage(caught instanceof Error ? caught.message : '녹음을 올리지 못했어요.');
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={CONSULT_EMPTY_TITLE}
      accessibilityState={{ disabled: !weddingId || uploading, busy: uploading }}
      disabled={!weddingId || uploading}
      onPress={() => void pickAndUpload()}
      testID="consult-upload-prompt"
      style={({ pressed }) => [styles.box, { borderColor: theme.track }, pressed ? styles.pressed : null]}>
      <ProductSymbol name="mic" size={22} color={theme.textAssistive} />
      <ThemedText type="f15" style={styles.bold}>
        {uploading ? uploadingLabel(progress) : CONSULT_EMPTY_TITLE}
      </ThemedText>
      <ThemedText type="f13" themeColor="textAssistive" style={styles.center}>
        {CONSULT_EMPTY_BODY}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: Border.hairline,
    borderStyle: 'dashed',
    paddingVertical: 28,
    paddingHorizontal: Layout.cardPadding,
    alignItems: 'center',
    gap: Layout.menuGroupGap,
  },
  bold: { fontWeight: 700 },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.6 },
});
