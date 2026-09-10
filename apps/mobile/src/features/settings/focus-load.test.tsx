import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { listMyReports } from '@/api/client';
import CaptureScreen from '@/app/(tabs)/capture';

let mockFocus: () => (() => void) | undefined;
jest.mock('expo-router', () => ({
  router: { push: jest.fn() }, useFocusEffect: (effect: typeof mockFocus) => { mockFocus = effect; },
}));
jest.mock('@/api/client', () => ({ listMyReports: jest.fn() }));
jest.mock('@/api/config', () => ({ isServerConfigured: true }));
jest.mock('@/features/capture/capture-draft', () => ({ useCaptureDraft: () => ({ pages: [] }) }));
jest.mock('@/features/loading/delayed-loader', () => ({ DelayedLoader: 'Loading' }));
jest.mock('@/features/wedding/screen-kit', () => ({
  Badge: 'Badge', Band: 'Band', Hero: 'Hero', ListRow: 'ListRow', NavBar: 'NavBar', Screen: 'Screen', Section: 'Section',
}));
jest.mock('@weddingpick/ui', () => ({
  ActionButton: 'ActionButton', ThemedText: 'ThemedText', ProductSymbol: 'ProductSymbol',
  Layout: {}, Radius: {}, Spacing: {}, useTheme: () => ({}),
}));
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let tree: ReactTestRenderer;
let blur: (() => void) | undefined;
async function mount() { await act(async () => { tree = create(<CaptureScreen />); }); }
async function focus() { await act(async () => { blur = mockFocus(); }); }
afterEach(async () => { await act(async () => { blur?.(); tree.unmount(); }); });

it('대기·실패를 제보 0건으로 표시하지 않고 재시도 후 빈 목록을 표시한다', async () => {
  const request = deferred();
  jest.mocked(listMyReports).mockReturnValueOnce(request.promise as never).mockResolvedValueOnce({ reports: [] });
  await mount(); await focus();
  expect(tree.root.findAllByType('ListRow' as never)).toHaveLength(0);
  expect(tree.root.findAllByType('Loading' as never)).toHaveLength(1);
  await act(async () => request.reject(new Error('offline')));
  expect(tree.root.findAllByType('ListRow' as never)).toHaveLength(0);
  await act(async () => tree.root.findByType('ActionButton' as never).props.onPress());
  expect(tree.root.findByType('ListRow' as never).props.title).toBe('아직 제보한 것이 없어요');
});

it('이전 focus의 늦은 응답은 새 focus에서 읽은 제보를 덮지 않는다', async () => {
  const previous = deferred();
  const current = deferred();
  jest.mocked(listMyReports).mockReturnValueOnce(previous.promise as never).mockReturnValueOnce(current.promise as never);
  await mount(); await focus();
  await act(async () => blur?.());
  await focus();
  const report = { id: 'report-1', subject: '다시 확인한 업체', inUse: true, amount: null,
    kindLabel: 'Pick 인증', reportedAt: '2026-09-10T00:00:00Z' };
  await act(async () => current.resolve({ reports: [report] }));
  await act(async () => previous.resolve({ reports: [] }));
  expect(tree.root.findByType('ListRow' as never).props.title).toBe('다시 확인한 업체');
});
