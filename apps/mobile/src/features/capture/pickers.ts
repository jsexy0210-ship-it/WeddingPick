import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type { CapturedPage, CapturedPageSource } from '@/features/capture/types';

let sequence = 0;

export function createPage(
  source: CapturedPageSource,
  page: Omit<CapturedPage, 'id' | 'source'>
): CapturedPage {
  sequence += 1;
  return { id: `${Date.now()}-${sequence}`, source, ...page };
}

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

/** 사진 앨범에서 견적서·계약서 사진을 여러 장 고른다. 취소하면 빈 배열. */
export async function pickFromLibrary(): Promise<CapturedPage[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new PermissionDeniedError('사진 접근이 허용되지 않았습니다. 설정에서 권한을 켜주세요.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 1,
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.map((asset) =>
    createPage('library', {
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      name: asset.fileName ?? undefined,
      sizeBytes: asset.fileSize,
    })
  );
}

/** PDF 견적서를 고른다. 취소하면 빈 배열. */
export async function pickPdf(): Promise<CapturedPage[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.map((asset) =>
    createPage('file', {
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'application/pdf',
      name: asset.name,
      sizeBytes: asset.size ?? undefined,
    })
  );
}
