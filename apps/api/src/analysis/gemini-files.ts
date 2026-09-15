import { z } from 'zod';

/**
 * 큰 녹음을 Gemini Files API로 올린다.
 *
 * ## 왜 필요한가
 *
 * 요청 본문에 실어 보내는 방식(`inlineData`)은 음성 기준 총 요청 20MB가 한도이고,
 * base64로 실으면 용량이 약 1.33배가 된다. 대표님이 정한 상한 100MB는 어느 쪽
 * 한도로도 안 들어간다 — **올린 뒤 참조를 넘기는 길이 따로 있어야 한다.**
 *
 * ## 끝나면 지운다
 *
 * 올린 파일은 **48시간 뒤에 저쪽에서 자동으로 지워진다.** 그것을 기다리지 않는다.
 * 처리방침에 「읽어내기가 끝나는 즉시 삭제」라고 적었고, 우리 저장소만 비우고
 * 남의 저장소에 이틀 두는 것은 그 약속과 다르다. `deleteGeminiFile()`을 쓴다.
 *
 * **지우기 실패는 조용히 넘기지 않는다.** 부르는 쪽이 결과를 보고 재시도 큐에
 * 넣는다 — 「지웠다고 적어두고 안 지우는」 자리가 여기다.
 */

const BASE = 'https://generativelanguage.googleapis.com';

/**
 * 이 크기를 넘으면 올려서 보낸다.
 *
 * 한도(음성 기준 총 요청 20MB)보다 **넉넉히** 낮게 잡는다. base64로 싣는 순간
 * 정확히 4/3배가 되므로 15MiB는 20MiB가 되어 **한도에 딱 붙는다** — 지시문과
 * 스키마가 들어갈 자리가 없다. 그 상태로 두면 같은 길이의 녹음이 어떤 것은
 * 되고 어떤 것은 안 되는, 재현되지 않는 실패가 된다.
 *
 * 12MiB면 base64로 16MiB이고 4MiB가 남는다. 남는 자리는 낭비가 아니라 **재현
 * 가능성**이다 — 이 한도 아래는 언제나 된다.
 *
 * (처음에 15MiB로 적었다가 아래 시험이 잡았다. 시험을 고치지 않고 값을 고쳤다.)
 */
export const INLINE_MAX_BYTES = 12 * 1024 * 1024;

export function needsFilesApi(bytes: number): boolean {
  return bytes > INLINE_MAX_BYTES;
}

const fileSchema = z.object({
  file: z.object({
    /** `files/abc123` 꼴. 지울 때 쓴다. */
    name: z.string(),
    uri: z.string(),
    state: z.string().optional(),
  }),
});

const stateSchema = z.object({
  name: z.string(),
  uri: z.string().optional(),
  state: z.string().optional(),
  error: z.object({ message: z.string() }).optional(),
});

export type GeminiFile = { name: string; uri: string };

function headers(apiKey: string, extra: Record<string, string> = {}): Record<string, string> {
  // 키는 주소가 아니라 헤더로. 주소는 프록시·로그에 남는다.
  return { 'x-goog-api-key': apiKey, ...extra };
}

/** 오류 본문을 붙이지 않는다 — 되비쳐 담긴 요청에 녹음이 들어 있을 수 있다. */
function refuse(what: string, status: number): Error {
  return new Error(`Gemini Files가 ${what}에서 ${status}로 거절했다.`);
}

/**
 * 올린다. 한 번에 보내는 방식(multipart)을 쓴다 — 이어올리기(resumable)는 끊긴
 * 업로드를 이어붙이려고 있는 것인데, 우리는 실패하면 처음부터 다시 하면 된다.
 */
export async function uploadGeminiFile(input: {
  apiKey: string;
  bytes: Buffer;
  mimeType: string;
  displayName: string;
}): Promise<GeminiFile> {
  const boundary = `wp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ file: { display_name: input.displayName } });

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
        `--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`
    ),
    input.bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const response = await fetch(`${BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: headers(input.apiKey, {
      'content-type': `multipart/related; boundary=${boundary}`,
      'x-goog-upload-protocol': 'multipart',
    }),
    body: new Uint8Array(body),
  });

  if (!response.ok) throw refuse('올리기', response.status);

  const parsed = fileSchema.parse(await response.json());

  return { name: parsed.file.name, uri: parsed.file.uri };
}

/**
 * 쓸 수 있게 될 때까지 기다린다.
 *
 * 올린 직후는 `PROCESSING`이고, 그 상태로 부르면 거절당한다 — **거절당한 호출도
 * 과금된다.** 음성은 비싸서 그 한 번이 아깝다.
 */
export async function waitUntilActive(input: {
  apiKey: string;
  name: string;
  /** 기다리는 한도. 넘으면 포기한다 — 워커가 한 파일에 붙잡히지 않는다. */
  timeoutMs?: number;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<void> {
  const timeoutMs = input.timeoutMs ?? 120_000;
  const pollMs = input.pollMs ?? 2_000;
  const sleep = input.sleep ?? ((ms: number) => new Promise((done) => setTimeout(done, ms)));
  const until = Date.now() + timeoutMs;

  for (;;) {
    const response = await fetch(`${BASE}/v1beta/${input.name}`, {
      headers: headers(input.apiKey),
    });

    if (!response.ok) throw refuse('상태 확인', response.status);

    const state = stateSchema.parse(await response.json());

    if (state.state === 'ACTIVE') return;

    if (state.state === 'FAILED') {
      // 저쪽이 준 메시지는 상태 설명이라 붙여도 된다. 요청 본문이 아니다.
      throw new Error(`올린 녹음을 저쪽이 읽지 못했다. ${state.error?.message ?? ''}`.trim());
    }

    if (Date.now() >= until) {
      throw new Error('올린 녹음이 시간 안에 준비되지 않았다.');
    }

    await sleep(pollMs);
  }
}

/**
 * 지운다.
 *
 * **성공 여부를 돌려준다.** 예외를 삼키면 「지웠다」가 사실이 아닌 채로 기록된다 —
 * 부르는 쪽이 재시도 큐에 넣을 수 있어야 한다.
 */
export async function deleteGeminiFile(input: { apiKey: string; name: string }): Promise<boolean> {
  try {
    const response = await fetch(`${BASE}/v1beta/${input.name}`, {
      method: 'DELETE',
      headers: headers(input.apiKey),
    });

    // 이미 없으면 지운 것과 같다. 48시간이 지나 저쪽이 먼저 지웠을 수 있다.
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}
