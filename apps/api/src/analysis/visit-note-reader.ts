import { z } from 'zod';

/** 읽어달라고 넘기는 녹음 한 개. */
export type VisitNoteAudio = { mimeType: string; bytes: Buffer; seconds: number };

/**
 * 녹음에서 뽑아낸 것.
 *
 * **`visit_notes` 표가 가진 네 칸과 같은 모양이다.** 표에 없는 칸은 여기에도 없다 —
 * 담을 곳이 없으면 모델이 뽑아낼 수도 없다.
 *
 * **녹취록을 담을 칸이 없다.** 「남기지 마라」고 부탁하는 대신 적을 곳을 없앤다.
 * 결제내역에서 카드번호 칸을 없앤 것과 같은 방식이다.
 */
export const visitNoteReadingSchema = z.object({
  vendorLabel: z
    .string()
    .nullable()
    .describe('상담한 업체 이름. 말한 그대로. 확실하지 않으면 null.'),
  visitedOn: z
    .string()
    .nullable()
    .describe('상담한 날. YYYY-MM-DD. 대화에 날짜가 없으면 null — 오늘로 채우지 마라.'),
  quotedAmount: z
    .number()
    .int()
    .nullable()
    .describe('그 자리에서 들은 제안 금액(원). 계약한 금액이 아니다. 없으면 null.'),
  memo: z
    .string()
    .nullable()
    .describe('상담에서 정해진 것과 다음에 확인할 것. 세 줄 이내. 대화를 옮겨 적지 마라.'),
  rejection: z
    .string()
    .nullable()
    .describe('상담 녹음이 아니라고 판단했다면 그 이유. 아니면 null.'),
  confidence: z.number().min(0).max(1).describe('뽑아낸 값이 맞다는 확신. 0~1.'),
});

export type VisitNoteReading = z.infer<typeof visitNoteReadingSchema>;

export type VisitNoteReadOutcome = {
  reading: VisitNoteReading;
  model: string;
  /**
   * 음성 토큰은 **따로 센다.** 글자보다 비싸서(2.5 Flash-Lite 기준 세 배) 합쳐
   * 넘기면 비용이 실제보다 적게 잡힌다 — `estimateCostUsd`가 그래서 나눠 받는다.
   */
  usage: { inputTokens: number; outputTokens: number; audioTokens: number };
};

/**
 * 상담 녹음을 읽는다.
 *
 * 테스트에서는 가짜를 끼운다 — 실제 호출은 돈이 들고 결과가 매번 다르다.
 * `PaymentProofReader`와 같은 자리다.
 */
export type VisitNoteReader = {
  read(audio: VisitNoteAudio, model: string): Promise<VisitNoteReadOutcome>;
};

/**
 * 읽는 규칙.
 *
 * **뽑는 것이지 옮겨 적는 것이 아니다.** 녹취록을 만들면 남길지 지울지를 매번
 * 정해야 하고, 지운다고 적어두고 안 지우는 일이 생긴다. 애초에 만들지 않는다.
 */
export const VISIT_NOTE_PROMPT = `너는 웨딩 업체 상담 녹음에서 방문노트 네 칸을 뽑는다.

규칙:

1. **대화를 옮겨 적지 마라.** 녹취록을 만드는 일이 아니다. 아래 네 칸만 채운다.
2. 적혀 있지 않거나 들리지 않는 값은 null로 둔다. 짐작해서 채우지 마라.
3. **금액은 그 자리에서 들은 제안가다.** 계약한 금액이 아니고, 정가·할인 전 금액도
   아니다. 여러 금액이 나오면 「이 조건이면 얼마」로 말한 값을 고른다. 확실하지
   않으면 null로 두고 confidence를 낮춘다.
4. 날짜가 대화에 없으면 visitedOn을 null로 둔다. **오늘 날짜로 채우지 마라** —
   올린 날과 상담한 날은 다르다.
5. memo는 **정해진 것과 다음에 확인할 것** 위주로 세 줄 이내. 인사말·잡담은 뺀다.
6. **사람 이름을 어느 칸에도 넣지 마라.** 업체 이름 자리에 상담사 이름을 넣는
   실수가 가장 흔하다.
7. 전화번호·계좌번호·카드번호를 **어느 칸에도 적지 마라.** 담을 칸이 없다.
8. 상담 녹음이 아니면(음악·통화 연결음·빈 녹음) rejection에 적고 나머지는 null로
   둔다.
9. 확신이 없으면 confidence를 낮게 준다. 낮으면 사람이 직접 고치는 자리로 간다 —
   틀린 값을 높은 확신으로 주는 것보다 낫다.`;
