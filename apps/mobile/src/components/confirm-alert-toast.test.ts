import {
  DIALOG_TOAST_ACTION_MS,
  DIALOG_TOAST_DOCK_BOTTOM,
  DIALOG_TOAST_FREE_BOTTOM,
  DIALOG_TOAST_MS,
  dialogToastBottom,
  dialogToastDuration,
} from './confirm-alert-toast';

describe('DLG-F toast timing', () => {
  it('일반 안내는 1초다', () => {
    expect(DIALOG_TOAST_MS).toBe(1000);
    expect(dialogToastDuration(false)).toBe(1000);
  });

  it('행동이 있어도 1초다', () => {
    expect(DIALOG_TOAST_ACTION_MS).toBe(1000);
    expect(dialogToastDuration(true)).toBe(1000);
  });

  it('dock 유무에 따라 정본 하단 간격을 쓴다', () => {
    expect(DIALOG_TOAST_DOCK_BOTTOM).toBe(100);
    expect(DIALOG_TOAST_FREE_BOTTOM).toBe(32);
    expect(dialogToastBottom(true)).toBe(100);
    expect(dialogToastBottom(false)).toBe(32);
  });
});
