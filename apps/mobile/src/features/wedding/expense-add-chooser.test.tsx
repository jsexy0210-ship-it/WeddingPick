import type { RegisterPaymentProofResponse } from '@weddingpick/api-contract';
import { PAYMENT_PROOF_CONSENT_POINTS } from '@weddingpick/domain';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  ApiError,
  createUpload,
  getSettings,
  grantPaymentConsent,
  registerPaymentProof,
  uploadDocumentPage,
} from '@/api/client';

import { ExpenseAddChooser } from './expense-add-chooser';
import {
  PAYMENT_PHOTO_UPLOAD_BYTES,
  autoResultFields,
  budgetRaiseNotice,
  fitPhotoForUpload,
  pendingProofs,
} from './expense-auto-register';

jest.mock('expo-image-picker', () => ({
  CameraType: { back: 'back', front: 'front' },
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('@/api/client', () => ({
  ApiError: class ApiError extends Error {
    status: number | null;
    constructor(_code: string, message: string, status: number | null = null) {
      super(message);
      this.status = status;
    }
  },
  getSettings: jest.fn(),
  grantPaymentConsent: jest.fn(),
  createUpload: jest.fn(),
  uploadDocumentPage: jest.fn(),
  registerPaymentProof: jest.fn(),
}));

declare const require: (id: string) => unknown;
declare const __dirname: string;
declare const global: { fetch: unknown };
const { readFileSync } = require('node:fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };

const camera = ImagePicker.launchCameraAsync as unknown as jest.Mock;
const cameraPermission = ImagePicker.requestCameraPermissionsAsync as unknown as jest.Mock;
const settings = getSettings as unknown as jest.Mock;
const consent = grantPaymentConsent as unknown as jest.Mock;
const upload = createUpload as unknown as jest.Mock;
const putPage = uploadDocumentPage as unknown as jest.Mock;
const register = registerPaymentProof as unknown as jest.Mock;

const SHOT = { uri: 'file:///receipt.jpg', mimeType: 'image/jpeg', fileName: 'receipt.jpg', fileSize: 2048 };

function proof(overrides: Partial<RegisterPaymentProofResponse> = {}): RegisterPaymentProofResponse {
  return {
    paymentProofId: '00000000-0000-4000-8000-000000000001',
    status: 'accepted',
    pendingFields: [],
    reviewNote: null,
    merchantName: '청담 E 웨딩홀',
    paidAmount: 5_000_000,
    paidAt: '2026-09-20T05:00:00.000Z',
    method: 'card',
    maskedIdentifiers: [],
    matchedVendorId: null,
    unmatchedNote: null,
    deepData: false,
    originalDeletedBy: null,
    ...overrides,
  };
}

function flush() {
  return act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });
}

/**
 * 2026-09-26 대표 지시 — 예산 추가를 누르면 «자동 등록(Pick 인증) · 직접 입력» 고르는 시트가 뜨고,
 * 자동 등록은 카메라를 바로 열어 한 장을 올리면 서버가 읽어 지출로 넣는다.
 */
describe('예산 추가 — 고르는 시트 · 자동 등록', () => {
  let view: ReactTestRenderer | null = null;
  let order: string[] = [];
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    order = [];
    cameraPermission.mockResolvedValue({ granted: true });
    camera.mockImplementation(async () => {
      order.push('camera');
      return { canceled: false, assets: [SHOT] };
    });
    consent.mockImplementation(async () => {
      order.push('consent');
      return {};
    });
    upload.mockImplementation(async () => {
      order.push('upload');
      return {
        rawDocumentId: '00000000-0000-4000-8000-0000000000aa',
        uploads: [{ pageIndex: 0, uploadPath: '/v1/documents/doc/pages/0' }],
      };
    });
    putPage.mockImplementation(async () => {
      order.push('put');
    });
    register.mockImplementation(async () => {
      order.push('register');
      return proof();
    });
    global.fetch = jest.fn(async () => ({ blob: async () => ({ size: 2048 }) }));
  });

  afterEach(() => {
    if (view) act(() => view!.unmount());
    view = null;
    global.fetch = originalFetch;
  });

  async function render(paymentConsent: boolean | 'error') {
    if (paymentConsent === 'error') settings.mockRejectedValue(new Error('x'));
    else settings.mockResolvedValue({ paymentConsent });
    const props = { onManual: jest.fn(), onClose: jest.fn(), onBusyChange: jest.fn() };
    act(() => {
      view = create(<ExpenseAddChooser weddingId="w-1" {...props} />);
    });
    await flush();
    return props;
  }

  const byTestId = (testID: string) =>
    view!.root.findAll((node) => node.props.testID === testID && typeof node.props.onPress === 'function');
  /* 화면에 찍힌 글자 — 호스트 Text 하나당 한 줄(«· » + 동의 문구처럼 쪼개진 자식은 이어 붙인다). */
  const texts = () =>
    view!.root
      .findAll((node) => (node.type as unknown) === 'Text')
      .map((node) => {
        const children = node.props.children as unknown;
        return (Array.isArray(children) ? children : [children])
          .filter((child) => typeof child === 'string' || typeof child === 'number')
          .join('');
      });
  const press = async (testID: string) => {
    await act(async () => {
      byTestId(testID)[0]!.props.onPress();
    });
    await flush();
  };
  const pressLabel = async (label: string) => {
    const button = view!.root.findAll(
      (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
    )[0];
    if (!button) {
      const found = view!.root.findAll((node) => node.props.label === label && typeof node.props.onPress === 'function')[0];
      await act(async () => {
        found!.props.onPress();
      });
    } else {
      await act(async () => {
        button.props.onPress();
      });
    }
    await flush();
  };

  it('타이틀 «예산 추가» + X · 두 칸 — 자동 등록(Pick 인증) · 직접 입력(정본 note.js `modes` 보조 문구)', async () => {
    const { onManual } = await render(true);
    expect(texts()).toEqual(
      expect.arrayContaining(['예산 추가', '자동 등록(Pick 인증)', '사진 한 장이면 돼요', '직접 입력', '금액을 적어요'])
    );
    expect(view!.root.findAll((node) => node.props.accessibilityLabel === '닫기' && node.props.onPress).length).toBeGreaterThan(0);

    await press('expense-choose-manual');
    expect(onManual).toHaveBeenCalledTimes(1);
    expect(camera).not.toHaveBeenCalled();
  });

  it('동의가 있으면 자동 등록이 카메라를 바로 열고, 올린 뒤 서버가 읽은 값을 «읽었어요»로 채운다', async () => {
    const { onBusyChange } = await render(true);
    await press('expense-choose-auto');

    expect(camera).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], cameraType: 'back' }));
    expect(consent).not.toHaveBeenCalled();
    expect(upload).toHaveBeenCalledWith({
      weddingId: 'w-1',
      kind: 'payment_proof',
      pages: [{ mimeType: 'image/jpeg', sizeBytes: 2048 }],
    });
    expect(putPage).toHaveBeenCalledWith('/v1/documents/doc/pages/0', { size: 2048 });
    expect(register).toHaveBeenCalledWith({ rawDocumentId: '00000000-0000-4000-8000-0000000000aa' });
    expect(order).toEqual(['camera', 'upload', 'put', 'register']);
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);

    expect(view!.root.findAll((node) => node.props.testID === 'expense-auto-accepted').length).toBeGreaterThan(0);
    expect(texts()).toEqual(
      expect.arrayContaining(['지출에 넣었어요', '업체', '청담 E 웨딩홀', '낸 금액', '500만원', '낸 날짜', '9.20', '읽었어요', '확인'])
    );
    expect(texts()).not.toContain('확인 필요');
  });

  it('총예산을 넘어 서버가 넘은 만큼 늘렸으면 결과 화면에 «총예산을 N만원 늘렸어요»를 한 줄로 알린다', async () => {
    register.mockResolvedValue(
      proof({
        budgetRaise: {
          weddingId: '00000000-0000-4000-8000-0000000000ee',
          before: 10_000_000,
          budget: 12_000_000,
          raisedBy: 2_000_000,
        },
      })
    );
    await render(true);
    await press('expense-choose-auto');

    expect(texts()).toContain('총예산을 200만원 늘렸어요');
    expect(view!.root.findAll((node) => node.props.testID === 'expense-auto-budget-raised').length).toBeGreaterThan(0);
  });

  it('안 늘렸으면(총예산 안 · 총예산 없음 · 옛 서버) 그 줄이 없다', async () => {
    await render(true);
    await press('expense-choose-auto');

    expect(texts().some((text) => text.startsWith('총예산을'))).toBe(false);
    expect(budgetRaiseNotice({ budgetRaise: null })).toBeNull();
    expect(budgetRaiseNotice({})).toBeNull();
    expect(
      budgetRaiseNotice({ budgetRaise: { weddingId: 'w', before: 3_000_000, budget: 3_540_000, raisedBy: 540_000 } })
    ).toBe('총예산을 54만원 늘렸어요');
  });

  it('동의가 없으면 외부 서비스 줄이 있는 Pick 인증 동의 안내를 먼저 보이고, «동의하고 계속»이 카메라를 연다 — 동의를 남긴 뒤 올린다', async () => {
    await render(false);
    await press('expense-choose-auto');

    expect(camera).not.toHaveBeenCalled();
    expect(view!.root.findAll((node) => node.props.testID === 'expense-auto-consent').length).toBeGreaterThan(0);
    const shown = texts().join('\n');
    for (const point of PAYMENT_PROOF_CONSENT_POINTS) expect(shown).toContain(point);
    expect(shown).toContain('사진을 읽어내는 일은 외부 서비스가 맡아요');

    await pressLabel('동의하고 계속');
    expect(order).toEqual(['camera', 'consent', 'upload', 'put', 'register']);
  });

  it('동의 여부를 못 읽으면 안내를 한 번 더 보여 준다', async () => {
    await render('error');
    await press('expense-choose-auto');
    expect(camera).not.toHaveBeenCalled();
    expect(view!.root.findAll((node) => node.props.testID === 'expense-auto-consent').length).toBeGreaterThan(0);
  });

  it('카메라를 닫으면 아무것도 올리지 않고 고르는 시트 그대로다', async () => {
    camera.mockResolvedValue({ canceled: true, assets: null });
    const { onBusyChange } = await render(true);
    await press('expense-choose-auto');

    expect(upload).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
    expect(onBusyChange).not.toHaveBeenCalled();
    expect(byTestId('expense-choose-auto')).toHaveLength(1);
  });

  it('못 읽었으면 «확인 중이에요» — 서버 보류 사유와 «확인 필요» 딱지, 값을 지어내지 않는다', async () => {
    register.mockResolvedValue(
      proof({
        status: 'pending_review',
        pendingFields: ['merchantName', 'paidAmount', 'paidAt'],
        reviewNote: '사진이 흐려 금액을 읽지 못했어요. 확인 뒤 알려드려요',
        merchantName: null,
        paidAmount: null,
        paidAt: null,
      })
    );
    await render(true);
    await press('expense-choose-auto');

    expect(view!.root.findAll((node) => node.props.testID === 'expense-auto-pending').length).toBeGreaterThan(0);
    const shown = texts();
    expect(shown).toEqual(expect.arrayContaining(['확인 중이에요', '사진이 흐려 금액을 읽지 못했어요. 확인 뒤 알려드려요']));
    expect(shown.filter((text) => text === '확인 필요').length).toBe(3); // 딱지 셋
    expect(shown.filter((text) => text === '확인하고 있어요').length).toBe(3); // 값을 지어내지 않는다
    expect(shown).not.toContain('읽었어요');
  });

  it('올리기 · 등록이 실패하면 서버 문구를 보이고 다시 누를 수 있게 고르는 시트로 돌아간다', async () => {
    register.mockRejectedValue(new Error('같은 결제를 이미 등록하셨습니다.'));
    const { onBusyChange } = await render(true);
    await press('expense-choose-auto');

    expect(texts()).toContain('같은 결제를 이미 등록하셨습니다.');
    expect(byTestId('expense-choose-auto')).toHaveLength(1);
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
  });

  it('10MB를 넘는 사진은 올리지 않는다', async () => {
    camera.mockResolvedValue({ canceled: false, assets: [{ ...SHOT, fileSize: 11 * 1024 * 1024 }] });
    await render(true);
    await press('expense-choose-auto');

    expect(upload).not.toHaveBeenCalled();
    expect(texts()).toContain('사진이 너무 커요. 10MB까지 올릴 수 있어요.');
  });

  it('운영 Nginx 본문 상한(413)에 걸리면 서버 문장 대신 다시 찍으라고 적는다', async () => {
    putPage.mockRejectedValue(new ApiError('internal', '서버와 통신하지 못했습니다.', 413));
    await render(true);
    await press('expense-choose-auto');

    expect(register).not.toHaveBeenCalled();
    expect(texts()).toContain('사진이 너무 커요. 한 번 더 찍어주세요.');
    expect(texts()).not.toContain('서버와 통신하지 못했습니다.');
  });

  it('줄이기는 웹만 — 이미 작거나 네이티브면 원본 그대로 보낸다(950KB · 운영 Nginx 1MB 아래)', async () => {
    expect(PAYMENT_PHOTO_UPLOAD_BYTES).toBe(950 * 1024);
    const small = { size: 2048 } as Blob;
    await expect(fitPhotoForUpload(small, 'image/jpeg')).resolves.toEqual({ blob: small, mimeType: 'image/jpeg' });
    const big = { size: 4 * 1024 * 1024 } as Blob; // 시험 환경은 네이티브(ios) — canvas가 없다
    await expect(fitPhotoForUpload(big, 'image/png')).resolves.toEqual({ blob: big, mimeType: 'image/png' });
  });

  it('운영 Nginx가 결제 사진 올리기 경로에 서버와 같은 10MB 상한을 둔다(기본 1MB면 네이티브 원본이 413)', () => {
    const install = readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'scripts', 'install-kakao-app-web.sh'), 'utf8');
    expect(install).toMatch(/location \^~ \/v1\/documents\/ \{\s+client_max_body_size 10m;/);
    const documents = readFileSync(join(__dirname, '..', '..', '..', '..', 'api', 'src', 'routes', 'documents.ts'), 'utf8');
    expect(documents).toContain('const MAX_FILE_SIZE = 10 * 1024 * 1024;');
  });

  it('읽은 칸 · 못 읽은 칸 딱지 — 정본 mergedFields «읽었어요 · 확인 필요»', () => {
    const fields = autoResultFields(proof({ status: 'pending_review', pendingFields: ['paidAmount'], paidAmount: 1_540_000 }));
    expect(fields.map((field) => [field.label, field.value, field.tag])).toEqual([
      ['업체', '청담 E 웨딩홀', '읽었어요'],
      ['낸 금액', '154만원', '확인 필요'],
      ['낸 날짜', '9.20', '읽었어요'],
    ]);
  });

  it('예산 목록 «확인 중» 줄은 못 읽은 Pick 인증만 — 가격 제보 · 후기 · 읽은 결제는 빼고 합계에 넣지 않는다', () => {
    const base = { kindLabel: 'x', use: 'x', vendorId: null, amount: null, reportedAt: '2026-09-26T00:00:00.000Z', inUse: false, note: null };
    const reports = [
      { ...base, id: 'a', kind: 'payment_proof' as const, subject: '확인 중인 자료', needsCheck: true },
      { ...base, id: 'b', kind: 'payment_proof' as const, subject: '청담 E 웨딩홀', needsCheck: false, inUse: true },
      { ...base, id: 'c', kind: 'price_report' as const, subject: 'A · 상품', needsCheck: false },
    ];
    expect(pendingProofs(reports).map((report) => report.id)).toEqual(['a']);

    /* 지출내역 풀팝업은 예산현황 목록으로 통합됐다(2026-09-26) — «확인 중» 줄도 그리로 옮겼다. */
    const screen = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'wedding', 'index.tsx'), 'utf8');
    expect(screen).toContain('listMyReports()');
    expect(screen).toContain('setPending(pendingProofs(r.reports))');
    const list = readFileSync(join(__dirname, 'budget-category-list.tsx'), 'utf8');
    expect(list).toContain("testID=\"expense-pending-row\"");
  });

  it('예산 추가 라우트는 먼저 고르는 시트를 띄운다 — 수정 · ?mode=manual · 업체에서 온 길은 건너뛴다', () => {
    const sheet = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'wedding', '[id]', 'expenses', 'add.tsx'), 'utf8');
    expect(sheet).toContain("() => !editing && modeParam !== 'manual' && !category && !vendorName");
    expect(sheet).toMatch(/\{choosing \? \(\s*<SheetPanel>\s*<ExpenseAddChooser/);
    expect(sheet).toContain('onManual={() => setChoosing(false)}');
    /* 올리고 읽는 동안에는 딤 · Back · X로 닫히지 않는다. */
    expect(sheet).toContain('dismissible={!autoBusy}');
    expect(sheet).toContain('if (saving || autoBusy) return;');
  });

  it('새 Gemini 호출 파일을 만들지 않는다 — 읽기는 기존 서버 길(POST /v1/payment-proofs)이다', () => {
    const auto = readFileSync(join(__dirname, 'expense-auto-register.ts'), 'utf8');
    expect(auto).toContain('registerPaymentProof({ rawDocumentId: target.rawDocumentId })');
    expect(auto).not.toContain('callGemini');
  });
});
