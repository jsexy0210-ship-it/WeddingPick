import { addCandidate, completeSetup, ensureWedding, getSignupState } from '@/api/client';
import { takePendingAction, type PendingAction } from '@/features/auth/pending-action';
import { clearWeddingDraft, loadWeddingDraft } from '@/features/onboarding/wedding-draft';

/** 로그인 직후에 무슨 일이 일어났는가. 화면이 이걸 보고 뭐라고 말할지 정한다. */
export type AfterSignIn = {
  /**
   * 아직 가입이 끝나지 않았다. 통합정책 v3.13 §N-2.
   *
   * 이때는 아무것도 올리지 않는다 — 서버가 대기 계정의 다른 경로를 전부 막아서
   * 시도해봐야 실패하고, 실패하면 적어둔 예식일이 "못 올린 값"으로 보인다.
   * 화면이 동의 화면으로 보내고, 동의가 끝난 뒤 이 함수를 다시 부른다.
   */
  needsSignup: boolean;
  /** 기기에 적어둔 최소 온보딩을 서버로 올렸는가. */
  savedWedding: boolean;
  /**
   * 그 값을 못 올렸으면 왜.
   *
   * 흔한 경우가 하나 있다: 적어두고 몇 달을 안 열면 그 예식일이 과거가 되고,
   * 서버는 과거 날짜를 받지 않는다. 그때 적어둔 값을 지우지 않고 남겨두면
   * 첫 화면이 다시 물어본다.
   */
  weddingError: string | null;
  /** 로그인 때문에 멈췄던 Pick을 대신 끝냈는가. */
  completed: PendingAction | null;
};

/**
 * 로그인이 끝난 직후 한 번. 통합정책 v3.10 §3.
 *
 * 순서가 중요하다. **웨딩을 먼저 만들고 Pick을 담는다** — 반대로 하면 Pick이
 * 웨딩 없이 담기려다 실패하거나, 임시 웨딩이 하나 더 생긴다.
 *
 * 실패해도 로그인 자체는 되돌리지 않는다. 로그인은 성공했는데 뒤처리가 안 됐다고
 * 로그아웃시키면 사용자는 로그인이 안 되는 앱을 보게 된다. 대신 무엇이 안 됐는지
 * 그대로 돌려주고, 화면이 그 말을 한다.
 */
export async function completeAfterSignIn(): Promise<AfterSignIn> {
  const result: AfterSignIn = {
    needsSignup: false,
    savedWedding: false,
    weddingError: null,
    completed: null,
  };

  /*
   * 가입이 끝났는지 먼저 본다. 안 끝났으면 여기서 멈춘다 — 적어둔 값은 기기에
   * 그대로 남고, 동의를 마친 뒤 이 함수를 다시 부르면 그때 올라간다.
   */
  const signup = await getSignupState();

  if (!signup.activated) {
    result.needsSignup = true;

    return result;
  }

  const draft = await loadWeddingDraft();

  if (draft) {
    try {
      await completeSetup({
        weddingDate: draft.weddingDate,
        region: draft.region,
        budgetBracket: draft.budgetBracket,
      });
      await clearWeddingDraft();
      result.savedWedding = true;
    } catch (caught) {
      /*
       * 여기서 멈추지 않는다. 사용자가 누른 것은 Pick이고, 예식일을 못 올렸다고
       * 그 Pick까지 없던 일이 되면 로그인이 아무것도 해주지 않은 셈이 된다.
       * 못 올렸다는 사실은 삼키지 않고 그대로 돌려준다.
       */
      result.weddingError = caught instanceof Error ? caught.message : '예식일을 저장하지 못했어요.';
    }
  }

  const action = await takePendingAction();

  if (action?.kind === 'pick') {
    const weddingId = await ensureWedding();

    await addCandidate(weddingId, action.vendorId);
    result.completed = action;
  }

  return result;
}
