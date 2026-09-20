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

it('한 장 선택 요청은 시스템과 반환값 모두 한 장으로 제한한다', async () => {
  const pages = await pickFromLibrary(1);

  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsMultipleSelection: false, selectionLimit: 1, orderedSelection: false })
  );
  expect(pages).toHaveLength(1);
  expect(pages[0]?.uri).toBe(assets[0]?.uri);
});
