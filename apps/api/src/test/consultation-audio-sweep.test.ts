import { VISIT_NOTE_AUDIO_CONSENT_VERSION } from '@weddingpick/domain';

import {
  countOverdueConsultationAudio,
  sweepExpiredConsultationAudio,
} from '../retention/consultation-audio';
import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 상담 녹음 원본 파기.
 *
 * **처리방침 제2항이 여기서 지켜진다** — 「업로드 시점부터 24시간을 넘겨 보관하지
 * 않습니다」. 적어 두는 것과 실제로 지워지는 것은 다르고, 이 시험이 그 차이를 본다.
 */
describeWithDb('상담 녹음 파기', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  /** 기한이 `hours` 뒤인(음수면 이미 지난) 상담기록 하나. */
  async function record(hours: number): Promise<string> {
    const { headers } = await signInAs(test, `sweep-${hours}`);
    const weddingId = await createWedding(test, headers);

    const created = await test.app.inject({
      method: 'POST',
      url: '/v1/consultations/uploads',
      headers,
      payload: {
        weddingId,
        mimeType: 'audio/m4a',
        seconds: 1800,
        byteSize: 1024,
        consentVersion: VISIT_NOTE_AUDIO_CONSENT_VERSION,
      },
    });

    const id = created.json().consultationId;

    await test.context.pool.query(
      `UPDATE structured.consultation_records
          SET audio_delete_by = now() + ($2 || ' hours')::interval
        WHERE id = $1`,
      [id, String(hours)]
    );

    return id;
  }

  async function audioKey(id: string): Promise<string | null> {
    const { rows } = await test.context.pool.query<{ audio_key: string | null }>(
      'SELECT audio_key FROM structured.consultation_records WHERE id = $1',
      [id]
    );

    return rows[0]?.audio_key ?? null;
  }

  it('기한이 지난 것을 지운다', async () => {
    const id = await record(-1);

    expect(await audioKey(id)).not.toBeNull();

    const result = await sweepExpiredConsultationAudio({
      pool: test.context.pool,
      storage: test.context.storage,
    });

    expect(result.deleted).toBe(1);
    expect(await audioKey(id)).toBeNull();
  });

  it('아직 기한이 안 된 것은 두고 본다', async () => {
    /* 사용자가 결과를 확인하는 중일 수 있다. 확인 전에 지우면 다시 읽어야 한다. */
    const id = await record(5);

    const result = await sweepExpiredConsultationAudio({
      pool: test.context.pool,
      storage: test.context.storage,
    });

    expect(result.deleted).toBe(0);
    expect(await audioKey(id)).not.toBeNull();
  });

  it('지운 뒤에는 삭제 시각이 남는다', async () => {
    // 「바로 지워요」라고 약속했으면 지워졌다는 것도 보여야 한다.
    const id = await record(-1);

    await sweepExpiredConsultationAudio({
      pool: test.context.pool,
      storage: test.context.storage,
    });

    const { rows } = await test.context.pool.query<{ audio_deleted_at: Date | null }>(
      'SELECT audio_deleted_at FROM structured.consultation_records WHERE id = $1',
      [id]
    );

    expect(rows[0]?.audio_deleted_at).not.toBeNull();
  });

  it('파일을 못 지우면 표를 건드리지 않는다', async () => {
    /*
     * **순서가 뜻을 갖는다.** 표를 먼저 비우면 「지웠다고 적혔는데 파일은 남은」
     * 줄이 생기고, 그 줄은 다음 차례에 조회되지 않아 영원히 남는다.
     */
    const id = await record(-1);
    const storage = {
      ...test.context.storage,
      delete: async () => {
        throw new Error('저장소가 응답하지 않는다');
      },
    };

    const result = await sweepExpiredConsultationAudio({ pool: test.context.pool, storage });

    expect(result.failed).toBe(1);
    expect(await audioKey(id)).not.toBeNull();
  });

  it('다음 차례에 다시 시도한다', async () => {
    const id = await record(-1);
    const broken = {
      ...test.context.storage,
      delete: async () => {
        throw new Error('저장소가 응답하지 않는다');
      },
    };

    await sweepExpiredConsultationAudio({ pool: test.context.pool, storage: broken });
    await sweepExpiredConsultationAudio({
      pool: test.context.pool,
      storage: test.context.storage,
    });

    expect(await audioKey(id)).toBeNull();
  });

  it('밀린 것이 몇인지 셀 수 있다', async () => {
    /* **0이 정상이다.** 0이 아니면 처리방침을 어기는 중이라는 뜻이다. */
    await record(-1);
    await record(-2);
    await record(5);

    expect(await countOverdueConsultationAudio(test.context.pool)).toBe(2);

    await sweepExpiredConsultationAudio({
      pool: test.context.pool,
      storage: test.context.storage,
    });

    expect(await countOverdueConsultationAudio(test.context.pool)).toBe(0);
  });

  it('이미 지운 것을 다시 세지 않는다', async () => {
    // 부분 색인이 이미 지운 줄을 담지 않는다 — 시간이 지날수록 이 일은 가벼워진다.
    const id = await record(-1);

    await sweepExpiredConsultationAudio({
      pool: test.context.pool,
      storage: test.context.storage,
    });

    const again = await sweepExpiredConsultationAudio({
      pool: test.context.pool,
      storage: test.context.storage,
    });

    expect(again.deleted).toBe(0);
    expect(await audioKey(id)).toBeNull();
  });
});
