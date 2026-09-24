import { createGeminiFeedWriter } from './wedding-feed-writer';
import type { WeddingFeedTopic } from '@weddingpick/domain';

/**
 * 웨딩피드 글쓰기 — 제미나이로 쓴다(2026-09-15 대표 지시 — 「클로드 API는 싹다
 * 전면 폐기하고 제미나이로 명시해」).
 *
 * **이 파일은 오늘 두 번 뒤집혔다.** 아침에는 「제미나이를 부르면 안 된다 —
 * 글쓰기는 클로드 몫이다」라고 던지는 가짜가 박혀 있었다. 근거는 돈이었는데,
 * 운영 서버의 Anthropic 호출이 Max 구독 밖이라는 것이 드러나 그 근거가 뒤집혔다.
 *
 * **실제로 부르지 않는다.** 호출마다 돈이 든다. `./gemini-call`을 가짜로 끼워
 * 「무엇을 보내고 무엇을 받아 어떻게 푸는지」만 본다.
 *
 * 클로드로 되돌아가는 변경은 `no-claude.test.ts`가 잡는다 — 저장소 전체에
 * `@anthropic-ai/sdk`가 한 줄도 없는지를 본다. 여기서 흉내로 막지 않는다.
 */
const callGemini = jest.fn();

jest.mock('./gemini-call', () => ({
  callGemini: (...args: unknown[]) => callGemini(...args),
}));

const TOPIC: WeddingFeedTopic = {
  key: 'budget-sdm',
  categoryLabel: '예산',
  brief: '스드메 예산을 넘기지 않게 짜는 방법',
};

const DRAFT = {
  title: '예산을 넘기지 않는 스드메 조합 3가지',
  summary: '항목별로 먼저 상한을 정해두면 흔들리지 않아요.',
  body: '스드메 예산을 짤 때는…',
};

function okResponse(value: unknown = DRAFT) {
  return {
    value,
    usage: { inputTokens: 900, outputTokens: 320, audioTokens: 0, cachedInputTokens: 0 },
  };
}

beforeEach(() => {
  callGemini.mockReset();
});

describe('웨딩피드 제미나이 작성기', () => {
  it('부르는 쪽이 넘긴 모델과 열쇠 그대로 부른다 — 하드코딩하지 않는다', async () => {
    callGemini.mockResolvedValue(okResponse());

    await createGeminiFeedWriter({ apiKey: 'test-key', model: 'gemini-2.5-flash' }).write(TOPIC);

    expect(callGemini.mock.calls[0]?.[0]).toMatchObject({
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
    });
  });

  it('주제와 묶음을 프롬프트에 담아 보낸다', async () => {
    callGemini.mockResolvedValue(okResponse());

    await createGeminiFeedWriter({ apiKey: 'test-key', model: 'gemini-2.5-flash-lite' }).write(TOPIC);

    const call = callGemini.mock.calls[0]?.[0] as { parts: { text?: string }[] };
    const text = call.parts.map((part) => part.text ?? '').join('\n');

    expect(text).toContain(TOPIC.brief);
    expect(text).toContain(TOPIC.categoryLabel);
  });

  it('통계 주제면 넘긴 공공 통계를 적힌 모양 그대로 담는다', async () => {
    callGemini.mockResolvedValue(okResponse());

    await createGeminiFeedWriter({ apiKey: 'test-key', model: 'gemini-2.5-flash-lite' }).write(
      TOPIC,
      [
        {
          key: 'seoul.marriage.count',
          label: '서울 혼인 건수',
          value: 36324,
          unit: '건',
          period: '2025년',
          sourceName: '서울특별시',
          sourceUrl: 'https://www.data.go.kr/data/15000000/fileData.do',
        },
      ]
    );

    const call = callGemini.mock.calls[0]?.[0] as { parts: { text?: string }[] };
    const text = call.parts.map((part) => part.text ?? '').join('\n');

    expect(text).toContain('서울 혼인 건수: 36,324건 (2025년 · 서울특별시)');
  });

  it('통계가 없으면 공공 통계 줄을 넣지 않는다', async () => {
    callGemini.mockResolvedValue(okResponse());

    await createGeminiFeedWriter({ apiKey: 'test-key', model: 'gemini-2.5-flash-lite' }).write(TOPIC);

    const call = callGemini.mock.calls[0]?.[0] as { parts: { text?: string }[] };

    expect(call.parts.map((part) => part.text ?? '').join('\n')).not.toContain('공공 통계');
  });

  it('읽은 글과 사용량을 그대로 돌려준다', async () => {
    callGemini.mockResolvedValue(okResponse());

    const outcome = await createGeminiFeedWriter({
      apiKey: 'test-key',
      model: 'gemini-2.5-flash-lite',
    }).write(TOPIC);

    expect(outcome.draft).toEqual(DRAFT);
    expect(outcome.usage).toEqual({ inputTokens: 900, outputTokens: 320 });
  });

  /*
   * 열쇠가 없으면 «만들 때» 던진다. 부를 때까지 미루면 주제를 고르고 실행 기록을
   * 남긴 뒤에 실패해서, 아무것도 안 쓴 바퀴가 기록에 쌓인다.
   */
  it('열쇠가 없으면 만들 때 멈춘다', () => {
    expect(() => createGeminiFeedWriter({ apiKey: '', model: 'gemini-2.5-flash-lite' })).toThrow(
      'GEMINI_API_KEY'
    );
  });
});
