/** 네이티브 다이얼로그가 플랫폼 Alert로 되돌아가지 않는 회귀 게이트. */
declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

const nativeAlert = readFileSync(join(__dirname, 'confirm-alert.ts'), 'utf8');
const host = readFileSync(join(__dirname, 'confirmation-dialog-host.tsx'), 'utf8');
const rootLayout = readFileSync(join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');

describe('native canonical confirmation overlay', () => {
  it('React Native Alert.alert를 사용하지 않는다', () => {
    expect(nativeAlert).not.toContain("from 'react-native'");
    expect(nativeAlert).not.toContain('Alert.alert');
    expect(nativeAlert).toContain('showNativeConfirmation(request, choose)');
  });

  it('DLG-E는 공통 BottomSheet, 중앙 확인은 RN Modal을 사용한다', () => {
    expect(host).toContain('<BottomSheet visible onRequestClose={cancel}');
    expect(host).toContain('<Modal');
    expect(host).toContain('onRequestClose={danger ? noop : cancel}');
    expect(host).toContain("tone={destructive ? 'danger' : 'primary'}");
    expect(host).toContain('{cancelIndex >= 0 || danger ? (');
  });

  it('앱 루트에 overlay host가 한 번만 장착된다', () => {
    expect(rootLayout).toContain('<ConfirmationDialogHost />');
    expect(rootLayout.match(/<ConfirmationDialogHost \/>/g)).toHaveLength(1);
  });
});
