import {
  BUDGET_EXHAUSTED_NOTICE,
  LOW_CONFIDENCE_THRESHOLD,
  budgetState,
  estimateCostUsd,
  fieldsNeedingConfirmation,
  needsVisionFallback,
  parsePaymentText,
  type ParsedPaymentProof,
  type PaymentProofField,
} from '@weddingpick/domain';
import type { Pool } from 'pg';

import type { PaymentProofReader, ProofImage, ProofReading } from './payment-reader';

/**
 * 결제내역을 읽는 한 줄.
 *
 * 스펙 7.3의 처리 순서를 그대로 코드로 옮긴 것이다:
 *
 *   규칙 파서 → (못 읽었으면) 저비용 모델 → (확신 낮으면) 상위 모델 → 사용자 확인
 *
 * 각 단계는 **앞 단계가 실패했을 때만** 돈다. 그리고 예산이 바닥나면 모델 단계를
 * 건너뛴다 — 서비스가 멈추지는 않는다. 스펙 7.3의 마지막 줄이 "AI가 죽어도 핵심
 * 서비스는 정상 동작해야 함"이고, 예산 소진은 AI가 죽은 것과 같은 상태다.
 */

export type ProofModels = {
  /** 먼저 부르는 모델. */
  cheap: string;
  /** 확신이 낮을 때 올라가는 모델. */
  strong: string;
};

export type ReadProofResult = {
  reading: ProofReading;
  /** 어디까지 가서 읽었는가. 화면에는 안 나가고 기록과 운영에 쓴다. */
  route: 'rules' | 'cheap_model' | 'strong_model' | 'rules_only_budget';
  needsConfirmation: PaymentProofField[];
  /** 예산이 바닥나 모델을 부르지 못했으면 그 안내. */
  notice: string | null;
  /** 사용자 수정률을 나중에 채우기 위한 열쇠. 모델을 안 불렀으면 null. */
  usageId: string | null;
};

/** 파서 결과를 읽기 결과 모양으로. 두 경로가 같은 것을 내보내야 뒤쪽이 갈라지지 않는다. */
function fromParsed(parsed: ParsedPaymentProof): ProofReading {
  const confidences = [parsed.merchantName, parsed.paidAmount, parsed.paidAt]
    .filter((field) => field !== null)
    .map((field) => field.confidence);

  return {
    merchantName: parsed.merchantName?.value ?? null,
    paidAmount: parsed.paidAmount?.value ?? null,
    paidAt: parsed.paidAt?.value ?? null,
    method: parsed.method?.value ?? null,
    maskedIdentifiers: parsed.maskedIdentifiers,
    rejection: parsed.rejection,
    // 읽은 것 중 가장 약한 확신이 전체의 확신이다. 평균을 내면 한 칸이 엉망이어도 묻힌다.
    confidence: confidences.length > 0 ? Math.min(...confidences) : 0,
  };
}

/** 모델이 읽은 것을 파서 모양으로 되돌린다. 확인이 필요한 칸을 같은 규칙으로 고르려고. */
function toParsedShape(reading: ProofReading): ParsedPaymentProof {
  const field = <T>(value: T | null) =>
    value === null ? null : { value, confidence: reading.confidence };

  return {
    merchantName: field(reading.merchantName),
    paidAmount: field(reading.paidAmount),
    paidAt: field(reading.paidAt),
    method: field(reading.method),
    maskedIdentifiers: reading.maskedIdentifiers,
    rejection: reading.rejection,
    missing: (['merchantName', 'paidAmount', 'paidAt', 'method'] as const).filter(
      (key) => reading[key] === null
    ),
  };
}

/** 이번 달 결제내역 읽기에 얼마를 썼는지. */
async function spentThisMonth(pool: Pool): Promise<{ spentUsd: number; budgetUsd: number | null }> {
  const { rows } = await pool.query<{ spent_usd: string; budget_usd: string | null }>(
    `SELECT spent_usd, budget_usd
     FROM structured.ai_budget_status
     WHERE feature = 'payment_proof_vision'`
  );

  return {
    spentUsd: Number(rows[0]?.spent_usd ?? 0),
    budgetUsd: rows[0]?.budget_usd === null || rows[0]?.budget_usd === undefined
      ? null
      : Number(rows[0].budget_usd),
  };
}

async function recordUsage(
  pool: Pool,
  input: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    succeeded: boolean;
    escalatedFrom: string | null;
    latencyMs: number;
  }
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO structured.ai_usage
       (feature, model, input_tokens, output_tokens, cached_input_tokens,
        estimated_cost_usd, succeeded, escalated_from, latency_ms)
     VALUES ('payment_proof_vision', $1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      input.model,
      input.inputTokens,
      input.outputTokens,
      input.cachedInputTokens,
      // 단가를 모르는 모델이면 null. 0으로 두면 합계에 섞여 예산이 넉넉해 보인다.
      estimateCostUsd({
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
      }),
      input.succeeded,
      input.escalatedFrom,
      input.latencyMs,
    ]
  );

  return rows[0]!.id;
}

export async function readPaymentProof(input: {
  pool: Pool;
  reader: PaymentProofReader;
  models: ProofModels;
  /** 붙여넣은 글. 있으면 규칙이 먼저 읽는다. */
  text?: string;
  /** 촬영한 이미지. 규칙이 못 읽었을 때만 쓴다. */
  images?: ProofImage[];
  now?: Date;
}): Promise<ReadProofResult> {
  const parsed = parsePaymentText(input.text ?? '', input.now);

  /*
   * 규칙으로 끝났으면 여기서 끝난다. 취소 문자도 여기서 끝난다 — 읽을 것이
   * 없어서가 아니라 읽으면 안 돼서다.
   */
  if (input.text && !needsVisionFallback(parsed)) {
    return {
      reading: fromParsed(parsed),
      route: 'rules',
      needsConfirmation: fieldsNeedingConfirmation(parsed, LOW_CONFIDENCE_THRESHOLD),
      notice: null,
      usageId: null,
    };
  }

  const images = input.images ?? [];

  if (images.length === 0) {
    // 넘길 이미지가 없다. 규칙이 읽은 것까지만 주고 나머지는 사람이 적는다.
    return {
      reading: fromParsed(parsed),
      route: 'rules',
      needsConfirmation: fieldsNeedingConfirmation(parsed, LOW_CONFIDENCE_THRESHOLD),
      notice: null,
      usageId: null,
    };
  }

  const budget = budgetState({
    feature: 'payment_proof_vision',
    ...(await spentThisMonth(input.pool)),
  });

  if (budget.kind === 'exceeded') {
    /*
     * 예산이 바닥났다. 읽어주는 것만 멈추고 등록은 그대로 된다 — 스펙 7.3의
     * "AI가 죽어도 핵심 서비스는 정상 동작해야 함"이다.
     */
    return {
      reading: fromParsed(parsed),
      route: 'rules_only_budget',
      needsConfirmation: fieldsNeedingConfirmation(parsed, LOW_CONFIDENCE_THRESHOLD),
      notice: BUDGET_EXHAUSTED_NOTICE,
      usageId: null,
    };
  }

  const startedAt = Date.now();
  let outcome;

  try {
    outcome = await input.reader.read(images, input.models.cheap);
  } catch (error) {
    await recordUsage(input.pool, {
      model: input.models.cheap,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      succeeded: false,
      escalatedFrom: null,
      latencyMs: Date.now() - startedAt,
    });

    throw error;
  }

  let usageId = await recordUsage(input.pool, {
    model: outcome.model,
    ...outcome.usage,
    succeeded: true,
    escalatedFrom: null,
    latencyMs: Date.now() - startedAt,
  });

  let route: ReadProofResult['route'] = 'cheap_model';

  /*
   * 확신이 낮으면 상위 모델로 한 번 더. 스펙 7.3의 escalation이다.
   *
   * 거절(취소 문자)에는 올라가지 않는다 — 저비용 모델이 취소라고 본 것을 비싼
   * 모델에게 다시 묻는 것은, 안 된다는 답을 살 때까지 묻는 것과 같다.
   */
  if (outcome.reading.rejection === null && outcome.reading.confidence < LOW_CONFIDENCE_THRESHOLD) {
    const escalatedAt = Date.now();
    const better = await input.reader.read(images, input.models.strong);

    usageId = await recordUsage(input.pool, {
      model: better.model,
      ...better.usage,
      succeeded: true,
      escalatedFrom: outcome.model,
      latencyMs: Date.now() - escalatedAt,
    });

    outcome = better;
    route = 'strong_model';
  }

  const shaped = toParsedShape(outcome.reading);

  return {
    reading: outcome.reading,
    route,
    needsConfirmation: fieldsNeedingConfirmation(shaped, LOW_CONFIDENCE_THRESHOLD),
    notice: null,
    usageId,
  };
}
