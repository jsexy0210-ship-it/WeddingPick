import {
  DIALOG_TOAST_ACTION_MS,
  DIALOG_TOAST_MS,
  dialogToastDuration,
} from './confirm-alert-toast';

describe('DLG-F toast timing', () => {
  it('일반 안내는 2초다', () => {
    expect(DIALOG_TOAST_MS).toBe(2000);
    expect(dialogToastDuration(false)).toBe(2000);
  });

  it('행동이 있으면 4초다', () => {
    expect(DIALOG_TOAST_ACTION_MS).toBe(4000);
    expect(dialogToastDuration(true)).toBe(4000);
  });
});
