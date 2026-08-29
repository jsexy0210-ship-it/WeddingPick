/**
 * 자동 의사결정 기록. 최종통합정책 v2.0 L장.
 *
 * v2.0은 사람이 반복 처리하는 구조를 만들지 말라고 하면서(A-2·M장), 대신
 * **자동으로 내린 결정마다 근거를 남기라고** 한다. 둘은 한 쌍이다 — 기록 없는
 * 자동화는 감독할 수 없고, 감독할 수 없는 자동화는 사람이 없는 것이 아니라 사람이
 * 눈을 감은 것이다.
 */

/** 지금 코드가 따르는 정책 문서. 결정마다 함께 적는다 — 정책이 바뀌면 근거가 달라진다. */
export const POLICY_VERSION = 'v2.0';

export const DECIDER_KINDS = ['rule', 'model', 'human'] as const;

export type DeciderKind = (typeof DECIDER_KINDS)[number];

export const DECISION_EXECUTIONS = ['succeeded', 'failed', 'rolled_back', 'pending'] as const;

export type DecisionExecution = (typeof DECISION_EXECUTIONS)[number];

/**
 * 근거는 **가리키기만 한다.**
 *
 * L장 마지막 줄이 "개인정보는 이 로그에 불필요하게 복제하지 않는다"고 적었다.
 * 값을 담을 자리를 만들지 않으면 복사할 수 없다 — 추출규칙 10번과 같은 생각이고,
 * 스키마의 CHECK가 이 모양만 통과시킨다.
 */
export type EvidenceRef = { kind: string; id: string };

/**
 * 누가 정했는가. **판별 유니온이다.**
 *
 * 이름 없는 사람 결정, 판 없는 규칙 결정, 확신 없는 모델 결정을 타입이 막는다.
 * 스키마에도 같은 제약이 걸려 있다 — 한쪽만 두면 다른 쪽으로 들어온다.
 */
export type Decider =
  | { kind: 'human'; userId: string }
  | { kind: 'rule'; ruleVersion: string }
  | { kind: 'model'; model: string; confidence: number };

export type DecisionRecord = {
  /** 같은 사건을 여러 단계가 나눠 처리해도 하나로 묶인다. B-3. */
  eventId: string;
  workflow: string;
  step: string;
  subjectKind: string;
  subjectId: string | null;
  decider: Decider;
  decision: string;
  /** 왜. 사람이 읽는 문장이 아니라 **세는 코드**다 — 같은 이유가 몇 번 났는지 알려면. */
  reasonCode: string;
  evidence: readonly EvidenceRef[];
  source?: string | null;
  sourceCheckedAt?: string | null;
  costUsd?: number | null;
  latencyMs?: number | null;
  retryCount?: number;
  execution?: DecisionExecution;
  rollbackTarget?: string | null;
};

/**
 * 이 결정이 사람 손을 거쳤는가.
 *
 * A-2가 사람 몫으로 남긴 것들(법률 판단, 개인정보 유출, 고액 지급, 중대 분쟁)은
 * 자동으로 끝나면 안 된다. 화면과 감사가 같은 답을 내도록 함수 하나로 둔다.
 */
export function wasHumanDecision(decider: Decider): boolean {
  return decider.kind === 'human';
}

/**
 * 확신이 낮은가.
 *
 * **낮다고 곧바로 사람에게 보내지 않는다**(B-2). 재시도 → 다른 규칙·모델 → 내부
 * DB 대조 → 교차검증 → 사용자 확인 순으로 먼저 가고, 그래도 안 되면 사람이다.
 * 이 함수는 그 경로를 시작할지 정할 뿐, 사람을 부르는 함수가 아니다.
 */
export const LOW_CONFIDENCE = 0.7;

export function needsMoreChecking(decider: Decider): boolean {
  return decider.kind === 'model' && decider.confidence < LOW_CONFIDENCE;
}
