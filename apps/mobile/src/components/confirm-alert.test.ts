import { orderNativeAlertButtons } from './confirm-alert';

describe('orderNativeAlertButtons', () => {
  it('keeps a single action unchanged', () => {
    expect(orderNativeAlertButtons([{ text: '확인' }])).toEqual([{ text: '확인' }]);
  });

  it('puts cancel first and destructive last', () => {
    expect(
      orderNativeAlertButtons([
        { text: '삭제', style: 'destructive' },
        { text: '계속' },
        { text: '취소', style: 'cancel' },
      ])
    ).toEqual([
      { text: '취소', style: 'cancel' },
      { text: '계속' },
      { text: '삭제', style: 'destructive' },
    ]);
  });

  it('does not mutate the caller array', () => {
    const buttons = [
      { text: '삭제', style: 'destructive' as const },
      { text: '취소', style: 'cancel' as const },
    ];

    orderNativeAlertButtons(buttons);

    expect(buttons.map((button) => button.text)).toEqual(['삭제', '취소']);
  });
});
