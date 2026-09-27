import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ActionButton } from '@weddingpick/ui';

import { getPublishedLegalDocument, UnpublishedLegalDocumentError } from '@/api/client';
import { openExternal } from '@/features/open-external';

import { PolicyDocumentBody } from './policy-document-body';

jest.mock('@/api/client', () => ({
  getPublishedLegalDocument: jest.fn(),
  UnpublishedLegalDocumentError: class extends Error {},
}));
jest.mock('@/features/open-external', () => ({ openExternal: jest.fn() }));
jest.mock('@/features/loading/delayed-loader', () => ({ DelayedLoader: 'DelayedLoader' }));

const document = {
  version: 'v1.0', effectiveOn: '2026-09-01',
  clauses: [
    { id: 'first', title: '처리 목적', body: '첫 줄\nhttps://privacy.kisa.or.kr', bodyTable: null },
    {
      id: 'second', title: '처리 항목', body: '',
      bodyTable: { lead: '항목별 안내', cols: [{ label: '항목' }, { label: '보유기간' }], rows: [['이름', '1년']] },
    },
  ],
};

let tree: ReactTestRenderer | null = null;
afterEach(async () => { if (tree) await act(async () => tree?.unmount()); tree = null; });

describe('인앱 개인정보처리방침', () => {
  it('공개판의 줄·표·링크를 네이티브 본문에 그린다', async () => {
    jest.mocked(getPublishedLegalDocument).mockResolvedValue(document as never);
    await act(async () => { tree = create(<PolicyDocumentBody id="privacy" />); });

    const rendered = JSON.stringify(tree!.toJSON());
    for (const value of ['개인정보처리방침', '처리 목적', '첫 줄', '처리 항목', '항목별 안내', '보유기간', '1년']) {
      expect(rendered).toContain(value);
    }
    expect(rendered).not.toContain('v1.0');
    expect(rendered).not.toContain('iframe');
    expect(rendered).not.toContain('WebView');

    const link = tree!.root.find((node) => node.props.accessibilityRole === 'link');
    await act(async () => link.props.onPress());
    expect(openExternal).toHaveBeenCalledWith('https://privacy.kisa.or.kr', { title: '관련 사이트' });
  });

  it('읽기에 실패하면 재시도로 공개판을 다시 불러온다', async () => {
    jest.mocked(getPublishedLegalDocument).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(document as never);
    await act(async () => { tree = create(<PolicyDocumentBody id="privacy" />); });

    expect(JSON.stringify(tree!.toJSON())).toContain('문서를 불러오지 못했어요.');
    const retry = tree!.root.findByType(ActionButton);
    await act(async () => retry.props.onPress());
    expect(getPublishedLegalDocument).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(tree!.toJSON())).toContain('처리 목적');
  });

  it('공개 전이면 통신 실패와 다른 안내를 보이고 재시도할 수 있다', async () => {
    jest.mocked(getPublishedLegalDocument)
      .mockRejectedValueOnce(new UnpublishedLegalDocumentError())
      .mockResolvedValueOnce(document as never);
    await act(async () => { tree = create(<PolicyDocumentBody id="privacy" />); });

    expect(JSON.stringify(tree!.toJSON())).toContain('개인정보처리방침이 아직 공개되지 않았어요.');
    expect(JSON.stringify(tree!.toJSON())).not.toContain('문서를 불러오지 못했어요.');
    const retry = tree!.root.findByType(ActionButton);
    await act(async () => retry.props.onPress());
    expect(JSON.stringify(tree!.toJSON())).toContain('처리 목적');
  });
});
