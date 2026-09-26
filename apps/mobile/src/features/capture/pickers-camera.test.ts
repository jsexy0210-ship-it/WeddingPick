import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { PermissionDeniedError, takePhoto } from '@/features/capture/pickers';

jest.mock('expo-image-picker', () => ({
  CameraType: { back: 'back', front: 'front' },
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

const camera = ImagePicker.launchCameraAsync as unknown as jest.Mock;
const permission = ImagePicker.requestCameraPermissionsAsync as unknown as jest.Mock;
const originalOS = Platform.OS;

function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

/** 2026-09-26 — 예산 추가 «자동 등록»은 카메라를 바로 연다(네이티브 OS 카메라 · 웹 capture=environment). */
describe('takePhoto — 카메라를 바로 연다', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    camera.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///r.jpg', mimeType: 'image/jpeg', fileName: 'r.jpg', fileSize: 10 }],
    });
  });
  afterEach(() => setOS(originalOS));

  it('웹은 권한을 묻지 않고 누른 그 자리(같은 동기 흐름)에서 뒤 카메라 입력을 연다', async () => {
    setOS('web');
    const pending = takePhoto();
    /* await 전에 이미 불렸다 — 브라우저의 «사용자가 누른 직후» 조건을 지킨다. */
    expect(camera).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], cameraType: 'back' }));
    expect(permission).not.toHaveBeenCalled();
    await expect(pending).resolves.toEqual(expect.objectContaining({ uri: 'file:///r.jpg', source: 'camera' }));
  });

  it('네이티브는 카메라 권한을 받은 뒤 OS 카메라를 연다 — 거절하면 이유를 던진다', async () => {
    setOS('ios');
    permission.mockResolvedValue({ granted: true });
    await expect(takePhoto()).resolves.toEqual(expect.objectContaining({ mimeType: 'image/jpeg', sizeBytes: 10 }));
    expect(permission).toHaveBeenCalledTimes(1);

    permission.mockResolvedValue({ granted: false });
    camera.mockClear();
    await expect(takePhoto()).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(camera).not.toHaveBeenCalled();
  });

  it('닫으면 null', async () => {
    setOS('android');
    permission.mockResolvedValue({ granted: true });
    camera.mockResolvedValue({ canceled: true, assets: null });
    await expect(takePhoto()).resolves.toBeNull();
  });
});
