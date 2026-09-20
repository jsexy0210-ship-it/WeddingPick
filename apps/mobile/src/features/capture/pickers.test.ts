import * as ImagePicker from 'expo-image-picker';

import { pickFromLibrary } from '@/features/capture/pickers';

jest.mock('expo-image-picker', () => ({
  getMediaLibraryPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

const assets = Array.from({ length: 4 }, (_, index) => ({
  uri: `file:///proof-${index + 1}.jpg`,
  mimeType: 'image/jpeg',
  fileName: `proof-${index + 1}.jpg`,
  fileSize: 1024,
}));

beforeEach(() => {
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets } as never);
});

it('Pick 인증 앨범 선택은 시스템과 반환값 모두 최대 3장으로 제한한다', async () => {
  const pages = await pickFromLibrary(3);

  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 3, orderedSelection: true })
  );
  expect(pages).toHaveLength(3);
  expect(pages.map((page) => page.uri)).toEqual(assets.slice(0, 3).map((asset) => asset.uri));
});
