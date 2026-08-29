import { POLICY_VERSION, type DecisionRecord } from '@weddingpick/domain';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

/**
 * 결정 한 줄을 남긴다. 최종통합정책 v2.0 L장.
 *
 * **결정을 내리는 코드와 같은 트랜잭션에서 부른다.** 따로 남기면 결정은 됐는데
 * 기록만 빠진 상태가 생기고, 그건 기록이 없는 것보다 나쁘다 — 있는 줄 알고
 * 찾으러 갔다가 없는 것을 발견하게 된다.
 */
export async function recordDecision(
  db: Pool | PoolClient,
  input: DecisionRecord
): Promise<string> {
  const { decider } = input;

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO structured.decisions
       (event_id, workflow, step, subject_kind, subject_id,
        decider, actor_user_id, rule_version, model, confidence,
        decision, reason_code, evidence_refs,
        source, source_checked_at, policy_version,
        cost_usd, latency_ms, retry_count, execution_status, rollback_target)
     VALUES ($1, $2, $3, $4, $5,
             $6::decider_kind, $7, $8, $9, $10,
             $11, $12, $13::jsonb,
             $14, $15, $16,
             $17, $18, $19, $20::decision_execution, $21)
     RETURNING id`,
    [
      input.eventId,
      input.workflow,
      input.step,
      input.subjectKind,
      input.subjectId,
      decider.kind,
      decider.kind === 'human' ? decider.userId : null,
      decider.kind === 'rule' ? decider.ruleVersion : null,
      decider.kind === 'model' ? decider.model : null,
      decider.kind === 'model' ? decider.confidence : null,
      input.decision,
      input.reasonCode,
      // 값이 아니라 가리키는 것만. 스키마가 이 모양만 통과시킨다.
      JSON.stringify(input.evidence.map((ref) => ({ kind: ref.kind, id: ref.id }))),
      input.source ?? null,
      input.sourceCheckedAt ?? null,
      POLICY_VERSION,
      input.costUsd ?? null,
      input.latencyMs ?? null,
      input.retryCount ?? 0,
      input.execution ?? 'succeeded',
      input.rollbackTarget ?? null,
    ]
  );

  return rows[0]!.id;
}

/** 한 사건에 붙일 열쇠. 같은 사건의 여러 단계가 이걸 나눠 쓴다. */
export function newEventId(): string {
  return randomUUID();
}
