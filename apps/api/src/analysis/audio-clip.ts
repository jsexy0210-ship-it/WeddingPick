import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * 1차 판정에 보낼 조각을 잘라낸다.
 *
 * ## 왜 자르나
 *
 * Gemini는 음성을 **초당 32토큰**으로 센다. 길이가 곧 값이다. 한 시간짜리 녹음을
 * 통째로 보내면 48원이고, 5분짜리 조각은 0.4원이다. 1차에서 웨딩 상담이 아닌 것을
 * 걸러내면 그 파일에 대해 48원을 안 쓴다.
 *
 * **자르지 못하면 2단계는 절약이 아니라 두 배다** — 전체를 두 번 보내게 된다.
 * 그래서 이 파일이 실패하면 **전체를 보내는 쪽으로 흘러가지 않는다.** 조용히
 * 비싼 길로 새는 것이 가장 나쁜 실패다.
 *
 * ## 왜 앞뒤 둘인가
 *
 * 앞만 자르면 상담 중반에 처음 금액이 나오는 녹음을 「가격 얘기 없음」으로 읽는다.
 * 실제 상담은 인사 → 설명 → 금액 → 정리 순이고 **금액과 조건은 뒤쪽에 몰린다.**
 *
 * 두 조각을 이어붙이지 않는다 — 이어붙이려면 재인코딩이 필요하고, 그럴 값이 없다.
 * **두 부분으로 그냥 보낸다.** 한 요청에 음성 조각 둘을 담을 수 있다.
 */

/** 앞에서 이만큼. 업체·상품·상담 성격이 이 안에서 드러난다. */
export const CLIP_HEAD_SECONDS = 180;

/** 뒤에서 이만큼. 금액과 조건이 몰리는 자리다. */
export const CLIP_TAIL_SECONDS = 120;

/** 이보다 짧으면 자를 이유가 없다. 자른 것이 원본보다 길어질 수 없다. */
export const CLIP_SKIP_UNDER_SECONDS = CLIP_HEAD_SECONDS + CLIP_TAIL_SECONDS;

export type ClipPlan =
  | { kind: 'whole'; seconds: number }
  | { kind: 'headTail'; headSeconds: number; tailSeconds: number; seconds: number };

/**
 * 이 길이면 어떻게 자르나. **순수 함수다** — ffmpeg 없이 시험한다.
 *
 * 300초 이하는 통째로 보낸다. 앞 180 + 뒤 120이 이미 전체라서, 잘라도 같은 값을
 * 두 번 세게 될 뿐이다.
 */
export function clipPlan(seconds: number): ClipPlan {
  return seconds <= CLIP_SKIP_UNDER_SECONDS
    ? { kind: 'whole', seconds }
    : {
        kind: 'headTail',
        headSeconds: CLIP_HEAD_SECONDS,
        tailSeconds: CLIP_TAIL_SECONDS,
        seconds,
      };
}

/** 1차 판정이 실제로 무는 음성 초. 예산을 미리 재는 자리에서 쓴다. */
export function clipBilledSeconds(plan: ClipPlan): number {
  return plan.kind === 'whole' ? plan.seconds : plan.headSeconds + plan.tailSeconds;
}

/**
 * ffmpeg가 있는가. **없으면 여기서 멈춘다.**
 *
 * 없는 채로 「그럼 전체를 보내자」로 넘어가면 1차가 0.4원이 아니라 48원이 되고,
 * 그 사실은 청구서가 와야 드러난다.
 */
export async function assertFfmpeg(): Promise<void> {
  try {
    await run('ffmpeg', ['-version']);
  } catch {
    throw new Error(
      'ffmpeg가 없다. 1차 판정용 조각을 자를 수 없으므로 멈춘다 — 전체를 보내면 값이 백 배가 된다.'
    );
  }
}

/** 녹음 길이(초). 사용자가 적어 보낸 값을 믿지 않는다. */
export async function probeSeconds(path: string): Promise<number> {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    path,
  ]);

  const seconds = Number.parseFloat(stdout.trim());

  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error('녹음 길이를 읽지 못했다. 파일이 깨졌을 수 있다.');
  }

  return seconds;
}

export type AudioClip = { mimeType: string; bytes: Buffer; seconds: number };

/**
 * 1차 판정에 보낼 조각들을 만든다.
 *
 * **재인코딩하지 않는다**(`-c copy`). 자르기만 하므로 수백 밀리초이고 음질도 그대로다.
 * 어차피 Gemini가 16kbps 모노로 다시 낮추므로 우리가 손댈 값이 없다.
 */
export async function clipForClassification(input: {
  bytes: Buffer;
  mimeType: string;
  extension: string;
}): Promise<{ parts: AudioClip[]; plan: ClipPlan }> {
  await assertFfmpeg();

  const dir = await mkdtemp(join(tmpdir(), 'wp-clip-'));
  const source = join(dir, `source.${input.extension}`);

  try {
    await writeFile(source, input.bytes);

    const seconds = await probeSeconds(source);
    const plan = clipPlan(seconds);

    if (plan.kind === 'whole') {
      return { parts: [{ mimeType: input.mimeType, bytes: input.bytes, seconds }], plan };
    }

    const head = join(dir, `head.${input.extension}`);
    const tail = join(dir, `tail.${input.extension}`);

    await run('ffmpeg', ['-v', 'error', '-i', source, '-t', String(plan.headSeconds), '-c', 'copy', head]);
    await run('ffmpeg', ['-v', 'error', '-sseof', `-${plan.tailSeconds}`, '-i', source, '-c', 'copy', tail]);

    return {
      parts: [
        { mimeType: input.mimeType, bytes: await readFile(head), seconds: plan.headSeconds },
        { mimeType: input.mimeType, bytes: await readFile(tail), seconds: plan.tailSeconds },
      ],
      plan,
    };
  } finally {
    // 임시 파일을 남기지 않는다. 남으면 그것도 보관 중인 녹음이다.
    await rm(dir, { recursive: true, force: true });
  }
}
