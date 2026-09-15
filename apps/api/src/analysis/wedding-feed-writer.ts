import { WEDDING_FEED_LIMITS, type WeddingFeedTopic } from '@weddingpick/domain';
import { z } from 'zod';

import { callGemini } from './gemini-call';

/**
 * 웨딩피드 글을 쓴다.
 *
 * 2026-09-15 대표 지시 — 「지속 콘텐츠 작성한다」. 주제는 `domain/wedding-feed.ts`가
 * 정해서 넘겨주고, 여기는 **그 주제로 한 편을 쓰는 것만** 한다.
 *
 * **모델이 주제를 고르지 않는다.** 고르게 두면 같은 이야기가 다른 제목으로 반복되고,
 * 목록에서 사람이 그것을 발견하기까지 오래 걸린다.
 *
 * **쓴 글은 바로 공개되지 않는다.** `draft`로 들어가고 사람이 읽고 올린다 —
 * 표의 기본값이 그것이고, 이 파일은 상태를 정하지 않는다.
 */

/**
 * 모델이 채울 수 있는 칸.
 *
 * **업체 이름을 담을 칸이 없다.** 「적지 마라」고 부탁하는 대신 적을 곳을 없앤다 —
 * 구조화 출력이라 스키마 밖의 값은 아예 나오지 못한다. 실제 업체를 지어내 칭찬하는
 * 글이 홈에 걸리면 그것은 광고이고, 우리가 쓰지 않은 광고다.
 */
export const feedDraftSchema = z.object({
  title: z
    .string()
    .describe(`글 제목. ${WEDDING_FEED_LIMITS.title}자 이내. 명사로 끝낸다.`),
  summary: z
    .string()
    .describe(`카드에 한 줄로 들어갈 요약. ${WEDDING_FEED_LIMITS.summary}자 이내.`),
  body: z
    .string()
    .describe(`본문. ${WEDDING_FEED_LIMITS.body}자 이내. 문단 사이는 빈 줄로 나눈다.`),
});

export type FeedDraft = z.infer<typeof feedDraftSchema>;

/**
 * 쓰는 규칙.
 *
 * 금지어는 `spec/glossary.json`이 정하고 `lint-copy.js`가 지킨다. 여기 적는 것은
 * **그중 모델이 특히 잘 어기는 것들**이다 — 「AI」 · 「데이터」 · 「탐색」은 웨딩 글에
 * 자연스럽게 섞여 들어온다.
 */
export const SYSTEM_PROMPT = `너는 한국의 결혼 준비 정보 글을 쓴다. 읽는 사람은 처음 결혼을 준비한다.

규칙:

1. **숫자를 지어내지 마라.** 금액 · 비율 · 기간을 모르면 적지 않는다. 「보통 200만원쯤」
   같은 문장은 쓰지 마라 — 읽는 사람이 그것을 기준으로 삼는다.
2. **실제 업체 이름을 쓰지 마라.** 지역 이름도 예시로 들지 마라.
3. 다음 말을 쓰지 마라: AI · 데이터 · 탐색 · 관심업체 · 찜 · 리뷰 · 평점 · 딜 ·
   확인된 제보 · 네이버페이 포인트. 각각 이렇게 쓴다 — 웨딩픽 · 정보 · 검색 · Pick ·
   Pick · 후기 · 이용한 사람들의 경험 · 현재 혜택 · 실 제보 · Npay.
4. 업종은 이 이름으로 부른다: 웨딩홀 · 스튜디오 · 드레스 · 메이크업 · **본식스냅** ·
   **헤어변형** · **결정사** · 허니문. 「스냅」 · 「헤메」 · 「플래너」라고 쓰지 마라.
5. **애매한 말을 쓰지 마라**: 거의 · 아마 · 대략 · 어느 정도 · 가능성이 높음 ·
   ~일 것으로 보임. 모르면 「확인해보세요」라고 적는다.
6. 「~하지 않아요」 · 「~못해요」로 끝내지 마라. **무엇이 되는지**를 말한다.
7. 존댓말로 쓴다. 문장은 짧게.
8. 본문은 문단 셋에서 다섯. 각 문단은 세 문장 안쪽.`;

export type FeedWriter = {
  write(topic: WeddingFeedTopic): Promise<{
    draft: FeedDraft;
    usage: { inputTokens: number; outputTokens: number };
  }>;
};

/**
 * Gemini로 쓴다.
 *
 * 부르는 방법(키를 헤더로 · 오류 본문을 안 붙이기 · 재시도 한도)은 전부
 * `gemini-call.ts`에 있다. 여기 남은 것은 「무엇을 보내는가」뿐이다.
 *
 * 모델 이름은 환경변수에서 온다 — 코드 여러 군데에 적지 않는다.
 */
export function createGeminiFeedWriter(env: NodeJS.ProcessEnv = process.env): FeedWriter {
  const apiKey = env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL;

  if (!apiKey) throw new Error('GEMINI_API_KEY가 없다. 자동 작성을 하려면 키가 있어야 한다.');
  if (!model) throw new Error('GEMINI_MODEL이 없다. 모델 이름은 환경변수에서 온다.');

  return {
    async write(topic) {
      const { value, usage } = await callGemini({
        apiKey,
        model,
        systemPrompt: SYSTEM_PROMPT,
        schema: feedDraftSchema,
        parts: [
          {
            text:
              `주제: ${topic.brief}\n` +
              `묶음: ${topic.categoryLabel}\n\n` +
              '이 주제로 한 편을 쓰고 스키마대로 채워라.',
          },
        ],
      });

      return {
        draft: value,
        usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
      };
    },
  };
}
