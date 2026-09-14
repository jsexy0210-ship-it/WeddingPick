/**
 * 상담 녹음에서 방문노트를 뽑는 규칙.
 *
 * **사용자가 올린다.** 앱이 녹음하지 않는다(2026-09-14 대표 확정) — 이미 갖고 있는
 * 파일을 올리는 형태다. 그래서 「녹음 중」 화면도, 마이크 권한도 없다.
 *
 * **필요한 칸만 뽑고 원본은 바로 지운다.** 녹취록도 남기지 않는다. `visit_notes`가
 * 이미 가진 네 칸(업체명 · 방문일 · 제안금액 · 메모)을 채우면 그 파일로 할 일이
 * 끝난다. 남겨두면 지켜야 할 것만 늘어난다.
 */

/**
 * 받는 형식.
 *
 * Gemini가 읽는 목록에서 골랐다. **여기 없는 형식은 부르기 전에 막는다** — 거절당한
 * 호출도 돈이 나간다.
 */
export const VISIT_NOTE_AUDIO_TYPES = [
  'audio/wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/aiff',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  'audio/mp4',
  'audio/m4a',
] as const;

export type VisitNoteAudioType = (typeof VISIT_NOTE_AUDIO_TYPES)[number];

export function isVisitNoteAudioType(mimeType: string): mimeType is VisitNoteAudioType {
  return (VISIT_NOTE_AUDIO_TYPES as readonly string[]).includes(mimeType);
}

/**
 * 비용은 **길이**가 정한다. 파일 크기가 아니다.
 *
 * Gemini는 음성을 **초당 32토큰**으로 센다(2026-09-14 확인). 1분이 1,920토큰이고,
 * 보내기 전에 16kbps 모노로 다운샘플한다 — **압축해서 보내도 토큰은 그대로다.**
 * 그래서 파일을 줄이는 전처리는 돈을 아끼지 못하고 서버 시간만 쓴다.
 *
 * 줄일 수 있는 것은 길이뿐이고, 그것은 사용자가 정한다.
 */
export const AUDIO_TOKENS_PER_SECOND = 32;

/**
 * 받아주는 최대 길이.
 *
 * 상담은 보통 30분에서 한 시간이다. 두 시간은 넉넉히 잡은 값이고, **사고를 막는
 * 자리**다 — Gemini 자체는 9.5시간까지 받는다. 실수로 긴 파일이 올라오면 한 번에
 * 스무 배가 나간다.
 *
 * 막을 때는 **왜 막혔는지와 지금 길이를 함께** 말한다. 「올릴 수 없어요」만 보이면
 * 사용자는 파일이 잘못된 줄 안다.
 */
export const VISIT_NOTE_AUDIO_MAX_SECONDS = 2 * 60 * 60;

/** 이 길이면 음성 토큰이 몇인가. 예산을 미리 재는 자리에서 쓴다. */
export function audioTokensFor(seconds: number): number {
  return Math.ceil(seconds) * AUDIO_TOKENS_PER_SECOND;
}

/**
 * 올려도 되는 파일인가. **부르기 전에** 본다.
 *
 * 거절당한 호출도 과금된다. 형식과 길이는 보내기 전에 알 수 있으므로 여기서 막는다.
 */
export type VisitNoteAudioRejection =
  | { kind: 'type'; mimeType: string }
  | { kind: 'tooLong'; seconds: number; maxSeconds: number }
  | { kind: 'empty' };

export function checkVisitNoteAudio(input: {
  mimeType: string;
  seconds: number;
}): VisitNoteAudioRejection | null {
  if (!isVisitNoteAudioType(input.mimeType)) return { kind: 'type', mimeType: input.mimeType };
  if (input.seconds <= 0) return { kind: 'empty' };

  if (input.seconds > VISIT_NOTE_AUDIO_MAX_SECONDS) {
    return {
      kind: 'tooLong',
      seconds: input.seconds,
      maxSeconds: VISIT_NOTE_AUDIO_MAX_SECONDS,
    };
  }

  return null;
}

/**
 * 동의 문구가 말해야 하는 것.
 *
 * 화면 문구의 원본은 `spec/strings.ko.json`이고 여기는 **무엇을 반드시 말해야
 * 하는가**의 목록이다. 문구를 고칠 때 이 목록을 지웠는지 확인하는 자리다.
 *
 * **통신비밀보호법 제3조·제16조.** 대화 당사자가 녹음한 것은 합법이지만 **제3자가
 * 녹음한 것은 형사처벌 대상**이다. 우리는 파일만 받으므로 누가 녹음했는지 알 수
 * 없다 — 그래서 「본인이 참여한 대화만」을 동의에 명시한다. 이 줄이 없으면 우리가
 * 위법한 녹음을 받아 처리하는 통로가 된다.
 */
export const VISIT_NOTE_AUDIO_CONSENT_POINTS = [
  '본인이 참여한 대화만 올려주세요',
  '업체명 · 방문일 · 제안 금액 · 메모만 뽑아요',
  '뽑고 나면 녹음 파일은 바로 지워요',
  '녹취록은 만들지도, 남기지도 않아요',
  '읽어내는 일은 외부 서비스가 맡아요',
] as const;

/**
 * 동의 문구가 바뀌면 이 값을 함께 올린다.
 *
 * 결제 증빙(`PAYMENT_CONSENT_VERSION`)과 같은 규칙이다 — 무엇에 동의했는지가 바뀌면
 * 예전 동의는 그 새 내용에 대한 동의가 아니다.
 */
export const VISIT_NOTE_AUDIO_CONSENT_VERSION = '2026-09-14';
