import { createClaudeFeedWriter } from './wedding-feed-writer';
import type { WeddingFeedTopic } from '@weddingpick/domain';

/**
 * 웨딩피드 글쓰기 — 클로드로 쓴다(2026-09-15 대표 지시, `CLAUDE.md` 커밋 `94ca7c62`).
 *
 * **실제로 부르지 않는다.** 호출마다 돈이 든다. `@anthropic-ai/sdk`를 가짜로
 * 끼워 「무엇을 보내고 무엇을 받아 어떻게 푸는지」만 본다.
 *
 * **`callGemini`가 여기서 불리면 실패한다.** 예전에는 이 파일이 Gemini로 글을
 * 썼다 — 되돌리면 이 시험이 잡는다. `./gemini-call`을 가짜로 끼워 부르는 즉시
 * 던지게 한다.
 */
/*
 * **`mockImplementation`으로 생성자를 흉내 내지 않는다.** 이 프로젝트의 jest
 * 설정은 `resetMocks: true`다 — 테스트마다 모든 jest.fn의 구현을 지운다.
 * 생성자 흉내가 모듈을 부를 때 딱 한 번만 설정되면, 첫 시험 전에 이미 지워져
 * `new Anthropic()`이 빈 객체를 돌려준다. 대신 **프로토타입에 얹는다** —
 * 그것은 jest의 mock 상태가 아니라 평범한 객체 프로퍼티라 리셋되지 않는다.
 * `parse` 자체(호출마다 다시 정하는 응답)만 리셋 대상이다.
 */
jest.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {}

  return { __esModule: true, default: MockAnthropic };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: MockAnthropic } = require('@anthropic-ai/sdk') as { default: new () => unknown };
const parse = jest.fn();

(MockAnthropic.prototype as { messages?: unknown }).messages = { parse };

/*
 * 같은 이유로 `jest.fn()`이 아니라 평범한 함수로 던진다 — `jest.fn()`이었다면
 * `resetMocks`가 첫 시험 전에 이 구현도 지워 아무것도 안 던지는 채로 남는다.
 */
jest.mock('./gemini-call', () => ({
  callGemini: () => {
    throw new Error('제미나이를 부르면 안 된다 — 글쓰기는 클로드 몫이다.');
  },
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

function okResponse(parsed_output: unknown = DRAFT) {
  return {
    parsed_output,
    model: 'claude-opus-5',
    usage: { input_tokens: 900, output_tokens: 320 },
  };
}

beforeEach(() => {
  parse.mockReset();
});

describe('웨딩피드 클로드 작성기', () => {
  it('제미나이를 부르지 않는다', async () => {
    parse.mockResolvedValue(okResponse());

    await createClaudeFeedWriter({ model: 'claude-opus-5' }).write(TOPIC);

    // `callGemini`가 한 번이라도 불렸다면 위 mock이 던져 이 자리에 닿지 못한다.
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('부르는 쪽이 넘긴 모델 그대로 부른다 — 하드코딩하지 않는다', async () => {
    parse.mockResolvedValue(okResponse());

    await createClaudeFeedWriter({ model: 'claude-sonnet-5' }).write(TOPIC);

    expect(parse.mock.calls[0]?.[0]).toMatchObject({ model: 'claude-sonnet-5' });
  });

  it('주제와 묶음을 프롬프트에 담아 보낸다', async () => {
    parse.mockResolvedValue(okResponse());

    await createClaudeFeedWriter({ model: 'claude-opus-5' }).write(TOPIC);

    const call = parse.mock.calls[0]?.[0] as { messages: { content: { text: string }[] }[] };
    const text = call.messages[0]?.content[0]?.text ?? '';

    expect(text).toContain(TOPIC.brief);
    expect(text).toContain(TOPIC.categoryLabel);
  });

  it('읽은 글과 사용량을 그대로 돌려준다', async () => {
    parse.mockResolvedValue(okResponse());

    const outcome = await createClaudeFeedWriter({ model: 'claude-opus-5' }).write(TOPIC);

    expect(outcome.draft).toEqual(DRAFT);
    expect(outcome.usage).toEqual({ inputTokens: 900, outputTokens: 320 });
  });

  it('구조화 출력을 못 읽으면 멈춘다', async () => {
    parse.mockResolvedValue({ parsed_output: null, usage: { input_tokens: 10, output_tokens: 0 } });

    await expect(createClaudeFeedWriter({ model: 'claude-opus-5' }).write(TOPIC)).rejects.toThrow(
      '구조화 출력을 읽지 못했다'
    );
  });
});
