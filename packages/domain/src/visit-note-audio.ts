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

/* ---------------------------------------------------------------------------
 * 동의와 확인
 *
 * **2026-09-16에 두 벌이 하나로 합쳐졌다.** 같은 이름의 파일이 main과 #230에서
 * 따로 자랐다 — main 쪽은 위의 형식·길이 검사를 들고 다섯 줄짜리 동의문을 가졌고,
 * #230 쪽은 법무 문구만 들고 네 줄짜리를 가졌다. 둘 다 판을 `2026-09-14`로 적어
 * 두어서, **서로 다른 문구에 같은 판 번호가 붙어 있었다.**
 *
 * 대표님이 **#230 판**으로 정하셨다(2026-09-16). 아래가 그 문구이고, 위의 기술
 * 검사는 main 것을 그대로 들고 왔다 — 그쪽은 #230에 없던 것이라 버리면 형식·길이
 * 검사가 통째로 사라진다.
 *
 * **판 번호를 `2026-09-16`으로 올렸다.** 문구가 바뀌었기 때문이다. 이 값이 하는
 * 일이 바로 그것이다 — 5줄판에 동의한 사람과 4줄판에 동의한 사람을 가른다.
 * 서버가 이 값을 검사하므로(`routes/consultations.ts`), 옛 앱 빌드에서 올라오는
 * 옛 판 동의는 거절된다. **그것이 맞는 동작이다** — 그 사람은 다른 글에 동의했다.
 *
 * **바뀌면서 빠진 줄을 적어 둔다.** main 판의 「녹취록은 만들지도, 남기지도
 * 않아요」가 동의 화면에서 없어진다. 그 사실 자체는 그대로다 — 이 파일 머리말과
 * 개인정보처리방침 제1항(「녹음 원본은 항목 추출이 끝나는 즉시 파기」)이 말한다.
 * 「본인이 참여한 대화만」도 동의 목록에서는 빠지지만 없어지지 않는다 —
 * `VISIT_NOTE_AUDIO_LAWFULNESS_CONFIRM`으로 옮겼다. 동의가 아니라 사실 진술이라
 * 갈라 받는 것이 맞다.
 * ------------------------------------------------------------------------- */

/**
 * 녹음 원본을 얼마나 들고 있는가. **항목을 읽어낸 뒤에는 들고 있지 않는다.**
 *
 * 시간값을 상수로 두지 않는 이유가 이것이다 — `PAYMENT_PROOF_RETENTION_HOURS`처럼
 * 숫자를 두면 언젠가 누가 그 숫자를 늘린다. 여기에는 늘릴 숫자가 없다.
 */
export const VISIT_NOTE_AUDIO_RETENTION_NOTICE =
  '올려주신 녹음은 방문노트 항목을 읽어내는 데만 사용하고, 다 읽어내면 원본은 바로 지워요. 서버에는 업체 이름·방문한 날·금액 같은 정리된 항목만 남아요.';

/**
 * 동의받을 때 무엇을 말해야 하는가.
 *
 * 다섯 가지를 네 줄에 담았다 — 읽어가는 것 · 남의 목소리 · 외부 서비스 · (원본을
 * 지운다 + 서버에 남는 것)이 마지막 한 줄이다. 마지막 둘은 같은 이야기의 앞뒤라
 * 줄을 나누면 같은 말을 두 번 읽는 것이 된다.
 *
 * 「읽어내는 일은 외부 서비스가 맡아요」는 2026-09-09에 결제 동의문에 더했던 줄과
 * 같은 이유로 들어간다. 무엇을 읽고 · 무엇을 버리는지만 적으면 읽는 사람은 이것을
 * 「웨딩픽이 내 녹음을 듣는다」로 읽는데, 실제로는 바깥 사업자에게 파일이 나간다.
 * 구글 데이터 안전의 「제3자와 공유」 신고와 이 화면이 어긋나면 심사에서 걸린다.
 */
export const VISIT_NOTE_AUDIO_CONSENT_POINTS = [
  '읽어가는 것: 업체 이름, 방문한 날, 그 자리에서 들은 금액, 메모',
  '녹음에는 함께 있던 다른 사람의 목소리가 같이 담길 수 있어요',
  '녹음을 읽어내는 일은 외부 서비스가 맡아요',
  VISIT_NOTE_AUDIO_RETENTION_NOTICE,
] as const;

/**
 * 올리기 전에 받는 확인. **동의가 아니라 사실 진술이다.**
 *
 * 통신비밀보호법 제3조는 대화에 참여하지 않은 사람이 남의 대화를 녹음하는 것을 막고,
 * 제16조가 그것을 형사처벌로 정한다. 대화 당사자가 자기가 낀 대화를 녹음하는 것은
 * 여기에 걸리지 않는다. **앱이 녹음하지 않으므로 녹음 행위는 올리는 사람의 것이고**,
 * 우리는 그 파일을 받아 처리하는 자리에 있다 — 그래서 올리는 화면에서 확인을 받는다.
 *
 * **화면에 조항 번호를 적지 않는다.** 번호를 적어도 확인의 뜻은 달라지지 않고, 안내는
 * 두 줄까지이며, 겁을 주는 문구는 쓰지 않는다(2026-09-14 판단 — 근거는 이 주석과
 * 개인정보처리방침에 남긴다). `~하면 안 돼요`가 아니라 **무엇을 올리는 것인지**를 적는다.
 */
export const VISIT_NOTE_AUDIO_LAWFULNESS_CONFIRM =
  '내가 함께 있던 상담 자리에서 녹음한 파일이에요';

/**
 * 지금 받고 있는 동의문·확인문의 판.
 *
 * **문구가 바뀌면 이 값도 올린다.** `PAYMENT_CONSENT_VERSION`과 같은 이유다 — 안내가
 * 바뀌면 이전 동의는 다른 것에 대한 동의이고, 판을 남기지 않으면 「이 사람이 무엇에
 * 동의했는지」에 답할 수 없다. 동의문과 확인문은 같은 화면에서 함께 받으므로 판도
 * 하나로 둔다. 둘 중 하나만 고쳐도 이 값을 올린다.
 */
export const VISIT_NOTE_AUDIO_CONSENT_VERSION = '2026-09-16';

/** 철회하면 하는 말. 이미 낸 자료가 어떻게 되는지 함께 말한다. */
export const VISIT_NOTE_AUDIO_CONSENT_REVOKED_NOTICE =
  '동의를 철회했어요. 앞으로는 녹음으로 방문노트를 정리할 수 없고, 이미 정리된 항목은 방문노트에서 지울 수 있어요';
