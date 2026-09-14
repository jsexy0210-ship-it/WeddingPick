import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ActionButton } from '@weddingpick/ui';

import { FullScreenError } from './full-screen-error';

jest.mock('@weddingpick/ui', () => ({
  ActionButton: 'ActionButton',
  ThemedText: 'ThemedText',
  ThemedView: 'ThemedView',
  ProductSymbol: 'ProductSymbol',
  Layout: { gutter: 24 },
  Spacing: { two: 8, four: 16 },
  MaxContentWidth: 600,
  useTheme: () => ({ textAssistive: '#868b94' }),
}));

describe('전면 오류의 복구 행동', () => {
  let screen: ReactTestRenderer;

  afterEach(() => {
    if (screen) act(() => screen.unmount());
  });

  it('점검 중 버튼은 알림 신청 대신 실제 재시도를 실행한다', () => {
    const retry = jest.fn();
    act(() => { screen = create(<FullScreenError kind="maintenance" onRetry={retry} />); });
    const button = screen.root.findByType(ActionButton);
    expect(button.props.label).toBe('다시 시도');
    act(() => button.props.onPress());
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('복구 동작이 없으면 작동하지 않는 버튼을 보여주지 않는다', () => {
    act(() => { screen = create(<FullScreenError kind="general" />); });
    expect(screen.root.findAllByType(ActionButton)).toHaveLength(0);
  });

  it('업데이트 버튼으로 단순 재시도를 실행하지 않는다', () => {
    act(() => { screen = create(<FullScreenError kind="update" onRetry={jest.fn()} />); });
    expect(screen.root.findAllByType(ActionButton)).toHaveLength(0);
  });

  it('업데이트 연결이 있으면 해당 동작을 실행한다', () => {
    const retry = jest.fn();
    const update = jest.fn();
    act(() => { screen = create(<FullScreenError kind="update" onRetry={retry} onUpdate={update} />); });
    const button = screen.root.findByType(ActionButton);
    expect(button.props.label).toBe('업데이트');
    act(() => button.props.onPress());
    expect(update).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });
});
