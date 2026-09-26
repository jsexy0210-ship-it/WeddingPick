import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { PRIVACY_POLICY_TAB_KEY, TERMS_POPUP_TABS } from '@weddingpick/domain';

import PrivacyPolicyScreen from '@/app/(tabs)/my/privacy-policy';

import { TermsDetailModal } from './terms-detail-modal';

declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

/**
 * 2026-09-26 대표 지시 — 개인정보처리방침을 공통 약관 풀팝업(WP-AUTH-011)의 탭으로 연다.
 * 본문은 `/my/privacy-policy`가 그리던 웹사이트 원문(`PolicyDocumentBody id="privacy"`)
 * 그대로이고, MY 행과 저장된 링크 둘 다 이 탭으로 연다.
 */

const mockDepthBack = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/features/settings/policy-document-body', () => ({ PolicyDocumentBody: 'PolicyDocumentBody' }));
jest.mock('@/features/navigation/depth-back', () => ({ useDepthBack: () => mockDepthBack }));

let tree: ReactTestRenderer;

afterEach(() => act(() => tree?.unmount()));

function selectedTab(): string {
  const tab = tree.root.find(
    (node) => node.props.accessibilityRole === 'tab' && node.props.accessibilityState?.selected === true
  );

  return JSON.stringify(tab.findAll((node) => typeof node.props.children === 'string').map((node) => node.props.children));
}

describe('약관 풀팝업 — 개인정보처리방침 탭', () => {
  it('탭 메뉴에 «개인정보처리방침»이 있다', () => {
    act(() => {
      tree = create(<TermsDetailModal visible initialKey="terms" onClose={() => undefined} />);
    });

    const labels = tree.root
      .findAll((node) => node.props.accessibilityRole === 'tab' && typeof node.type !== 'string')
      .map((node) => node.findAll((child) => typeof child.props.children === 'string')[0]?.props.children);

    expect([...new Set(labels)]).toEqual(TERMS_POPUP_TABS.map((tab) => tab.tab));
    expect(tree.root.findAllByType('PolicyDocumentBody' as never)).toHaveLength(0);
  });

  it('개인정보처리방침 탭으로 열면 그 탭이 선택되고 웹사이트 원문 본문을 그린다', () => {
    act(() => {
      tree = create(<TermsDetailModal visible initialKey={PRIVACY_POLICY_TAB_KEY} onClose={() => undefined} />);
    });

    expect(selectedTab()).toContain('개인정보처리방침');
    const body = tree.root.findAllByType('PolicyDocumentBody' as never);
    expect(body).toHaveLength(1);
    expect(body[0]!.props.id).toBe('privacy');
  });

  it('다른 탭을 누르면 조문 목록으로 돌아간다', () => {
    act(() => {
      tree = create(<TermsDetailModal visible initialKey={PRIVACY_POLICY_TAB_KEY} onClose={() => undefined} />);
    });

    const terms = tree.root.findAll(
      (node) => node.props.accessibilityRole === 'tab' && typeof node.props.onPress === 'function'
    )[0]!;
    act(() => terms.props.onPress());

    expect(tree.root.findAllByType('PolicyDocumentBody' as never)).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('서비스 이용약관');
  });

  it('저장된 링크 /my/privacy-policy는 같은 풀팝업을 그 탭으로 열고, 닫으면 Depth Back이다', () => {
    act(() => {
      tree = create(<PrivacyPolicyScreen />);
    });

    const modal = tree.root.findByType(TermsDetailModal);
    expect(modal.props.visible).toBe(true);
    expect(modal.props.initialKey).toBe(PRIVACY_POLICY_TAB_KEY);
    modal.props.onClose();
    expect(mockDepthBack).toHaveBeenCalledTimes(1);
  });

  it('MY 「개인정보처리방침」 행은 경로를 밀지 않고 풀팝업 탭을 연다', () => {
    const my = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'my', 'index.tsx'), 'utf8');

    expect(my).toContain('setTermsKey(PRIVACY_POLICY_TAB_KEY)');
    expect(my).not.toContain("router.push('/my/privacy-policy'");
  });
});
