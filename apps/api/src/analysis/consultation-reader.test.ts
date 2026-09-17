import type { ConsultationCategory, ConsultationSignals } from '@weddingpick/domain';

import type { AudioClip } from './audio-clip';
import type { Classification } from './consultation-spec';
import {
  type ConsultationReader,
  createGeminiConsultationReader,
  readConsultation,
} from './consultation-reader';

jest.mock('./audio-clip', () => ({
  ...jest.requireActual('./audio-clip'),
  clipForClassification: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { clipForClassification } = require('./audio-clip') as {
  clipForClassification: jest.Mock;
};

const SIGNALS: ConsultationSignals = {
  vendorCustomerConversation: true,
  productOrServiceDiscussion: true,
  pricingMentioned: true,
  scheduleMentioned: true,
  contractMentioned: false,
  benefitMentioned: true,
};

function classification(overrides: Partial<Classification> = {}): Classification {
  return {
    status: 'SUPPORTED_WEDDING_CONSULTATION',
    isWeddingConsultation: true,
    isSupportedCategory: true,
    category: 'hall',
    confidence: 0.94,
    consultationSignals: SIGNALS,
    evidence: ['식대는 1인 78000원'],
    reason: '웨딩홀 상담으로 판단됨',
    ...overrides,
  };
}

const USAGE = { inputTokens: 200, outputTokens: 80, audioTokens: 9_600 };

function reader(overrides: Partial<ConsultationReader> = {}): ConsultationReader {
  return {
    classify: jest.fn().mockResolvedValue({ classification: classification(), usage: USAGE }),
    extract: jest.fn().mockResolvedValue({
      reading: { common: {}, categoryData: {}, after: {} },
      usage: { inputTokens: 300, outputTokens: 400, audioTokens: 115_200 },
    }),
    ...overrides,
  };
}

const CLIPS: AudioClip[] = [
  { mimeType: 'audio/m4a', bytes: Buffer.from('앞'), seconds: 180 },
  { mimeType: 'audio/m4a', bytes: Buffer.from('뒤'), seconds: 120 },
];

beforeEach(() => {
  clipForClassification.mockResolvedValue({
    parts: CLIPS,
    plan: { kind: 'headTail', headSeconds: 180, tailSeconds: 120, seconds: 3600 },
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

function run(overrides: { reader?: ConsultationReader; category?: ConsultationCategory } = {}) {
  return readConsultation({
    reader: overrides.reader ?? reader(),
    bytes: Buffer.from('가짜녹음'),
    mimeType: 'audio/m4a',
    extension: 'm4a',
    model: 'gemini-2.5-flash-lite',
    category: overrides.category,
  });
}

describe('상담 녹음 읽기', () => {
  it('키가 없으면 만들 때 바로 멈춘다', () => {
    expect(() => createGeminiConsultationReader({} as NodeJS.ProcessEnv)).toThrow('GEMINI_API_KEY');
  });

  it('1차에 조각만 보내고 2차에 전체를 보낸다', async () => {
    /*
     * **여기가 이 설계의 전부다.** 1차에도 전체를 보내면 두 번 부르는 것이 그냥
     * 두 배고, 2차에 조각만 보내면 중간에 말한 금액이 빠진다.
     */
    const r = reader();

    await run({ reader: r });

    expect((r.classify as jest.Mock).mock.calls[0]?.[0]).toBe(CLIPS);
    expect((r.extract as jest.Mock).mock.calls[0]?.[0].seconds).toBe(3600);
  });

  it('웨딩 상담이 아니면 2차를 부르지 않는다', async () => {
    // 48원이 여기서 안 나간다. 친구와의 치킨 주문 대화를 뜯어볼 이유가 없다.
    const r = reader({
      classify: jest.fn().mockResolvedValue({
        classification: classification({ status: 'NOT_WEDDING_CONSULTATION', category: null }),
        usage: USAGE,
      }),
    });

    const outcome = await run({ reader: r });

    expect(outcome.kind).toBe('stopped');
    expect(r.extract).not.toHaveBeenCalled();
  });

  it('지원하지 않는 업종이면 2차를 부르지 않는다', async () => {
    const r = reader({
      classify: jest.fn().mockResolvedValue({
        classification: classification({
          status: 'UNSUPPORTED_WEDDING_CONSULTATION',
          isSupportedCategory: false,
          category: null,
        }),
        usage: USAGE,
      }),
    });

    await run({ reader: r });

    expect(r.extract).not.toHaveBeenCalled();
  });

  it('확신이 낮으면 2차를 부르지 않는다', async () => {
    const r = reader({
      classify: jest.fn().mockResolvedValue({
        classification: classification({ confidence: 0.6 }),
        usage: USAGE,
      }),
    });

    await run({ reader: r });

    expect(r.extract).not.toHaveBeenCalled();
  });

  it('업종을 모르면 2차를 부르지 않고 사람에게 묻는다', async () => {
    /*
     * 어느 칸을 채울지 모르는 채로 전체를 보내면 값만 나가고 담을 곳이 없다.
     */
    const r = reader({
      classify: jest.fn().mockResolvedValue({
        classification: classification({ category: null }),
        usage: USAGE,
      }),
    });

    const outcome = await run({ reader: r });

    expect(outcome.kind).toBe('stopped');
    expect(outcome).toHaveProperty('decision.kind', 'ask');
    expect(r.extract).not.toHaveBeenCalled();
  });

  it('사용자가 고른 업종이 1차 판정보다 앞선다', async () => {
    const r = reader({
      classify: jest.fn().mockResolvedValue({
        classification: classification({ category: 'hall' }),
        usage: USAGE,
      }),
    });

    await run({ reader: r, category: 'studio' });

    expect((r.extract as jest.Mock).mock.calls[0]?.[1]).toBe('studio');
  });

  it('멈춘 호출의 비용도 돌려준다', async () => {
    /*
     * 안 돌려주면 막힌 파일의 값이 합계에서 사라지고 예산이 넉넉해 보인다.
     * 1차는 공짜가 아니다.
     */
    const r = reader({
      classify: jest.fn().mockResolvedValue({
        classification: classification({ status: 'NOT_WEDDING_CONSULTATION', category: null }),
        usage: USAGE,
      }),
    });

    const outcome = await run({ reader: r });

    expect(outcome.usage).toEqual(USAGE);
  });

  it('둘 다 부르면 비용을 합쳐서 돌려준다', async () => {
    const outcome = await run();

    expect(outcome.usage).toEqual({
      inputTokens: 500,
      outputTokens: 480,
      audioTokens: 124_800,
    });
  });
});
