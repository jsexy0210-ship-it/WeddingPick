import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { PRIVACY_POLICY_TAB_KEY, TERMS_POPUP_TABS } from '@weddingpick/domain';

import PrivacyPolicyScreen from '@/app/(tabs)/my/privacy-policy';
import TermsScreen from '@/app/(tabs)/my/terms';

import { TermsDetailPage } from './terms-detail-page';

declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

/**
 * 개인정보처리방침을 공통 약관 페이지(WP-AUTH-011)의 탭으로 연다.
 * 본문은 관리자 공개판(`PolicyDocumentBody id="privacy"`)을 RN으로 그리며,
 * MY 행과 저장된 링크 둘 다 이 탭으로 연다.
 */

const mockDepthBack = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/features/settings/policy-document-body', () => ({ PolicyDocumentBody: 'PolicyDocumentBody' }));
jest.mock('@/features/navigation/depth-back', () => ({ useDepthBack: () => mockDepthBack }));

let tree: ReactTestRenderer;

beforeEach(() => mockDepthBack.mockClear());
afterEach(() => act(() => tree?.unmount()));

function selectedTab(): string {
  const tab = tree.root.find(
    (node) => node.props.accessibilityRole === 'tab' && node.props.accessibilityState?.selected === true
  );

  return JSON.stringify(tab.findAll((node) => typeof node.props.children === 'string').map((node) => node.props.children));
}

describe('약관 페이지 — 개인정보처리방침 탭', () => {
  it('탭 메뉴에 «개인정보처리방침»이 있다', () => {
    act(() => {
      tree = create(<TermsDetailPage initialKey="terms" onBack={() => undefined} />);
    });

    const labels = tree.root
      .findAll((node) => node.props.accessibilityRole === 'tab' && typeof node.type !== 'string')
      .map((node) => node.findAll((child) => typeof child.props.children === 'string')[0]?.props.children);

    expect([...new Set(labels)]).toEqual(TERMS_POPUP_TABS.map((tab) => tab.tab));
    expect(tree.root.findAllByType('PolicyDocumentBody' as never)).toHaveLength(0);
  });

  it('개인정보처리방침 탭으로 열면 공개판을 읽는 RN 본문을 그린다', () => {
    act(() => {
      tree = create(<TermsDetailPage initialKey={PRIVACY_POLICY_TAB_KEY} onBack={() => undefined} />);
    });

    expect(selectedTab()).toContain('개인정보처리방침');
    const body = tree.root.findAllByType('PolicyDocumentBody' as never);
    expect(body).toHaveLength(1);
    expect(body[0]!.props.id).toBe('privacy');
  });

  it('다른 탭을 누르면 조문 목록으로 돌아간다', () => {
    act(() => {
      tree = create(<TermsDetailPage initialKey={PRIVACY_POLICY_TAB_KEY} onBack={() => undefined} />);
    });

    const terms = tree.root.findAll(
      (node) => node.props.accessibilityRole === 'tab' && typeof node.props.onPress === 'function'
    )[0]!;
    act(() => terms.props.onPress());

    expect(tree.root.findAllByType('PolicyDocumentBody' as never)).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('서비스이용약관');
  });

  it('저장된 링크 /my/privacy-policy는 페이지의 해당 탭을 열고, Back은 Depth Back이다', () => {
    act(() => {
      tree = create(<PrivacyPolicyScreen />);
    });

    const page = tree.root.findByType(TermsDetailPage);
    expect(page.props.initialKey).toBe(PRIVACY_POLICY_TAB_KEY);
    page.props.onBack();
    expect(mockDepthBack).toHaveBeenCalledTimes(1);
  });

  it('MY 서비스이용약관은 하위 페이지를 열고 Back으로 MY에 돌아간다', () => {
    act(() => { tree = create(<TermsScreen />); });
    const page = tree.root.findByType(TermsDetailPage);
    expect(page.props.initialKey).toBe('terms');
    page.props.onBack();
    expect(mockDepthBack).toHaveBeenCalledTimes(1);
  });

  it('MY 「개인정보처리방침」 행은 하위 페이지를 연다', () => {
    const my = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'my', 'index.tsx'), 'utf8');

    expect(my).toContain("guestPush('/my/privacy-policy')");
  });
});
