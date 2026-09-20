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

/**
 * 지금 사진 권한이 어떤 상태인가. **묻지 않고 본다** — 기기가 띄우는 창은 한 번뿐이라,
 * 왜 필요한지 먼저 말할 기회를 잃지 않으려면 요청 전에 상태만 확인해야 한다.
 *
 *   granted  이미 허용됨 — 설명 없이 바로 앨범을 연다
 *   ask      아직 묻지 않았거나 다시 물을 수 있다 — 설명 시트를 먼저 띄운다
 *   blocked  기기가 더 묻지 않는다 — 「허용하기」를 눌러도 아무 일도 없으니 설정으로 보낸다
 */
export type PhotoPermissionState = 'granted' | 'ask' | 'blocked';

export async function photoPermissionState(): Promise<PhotoPermissionState> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();

  if (current.granted) return 'granted';

  return current.canAskAgain ? 'ask' : 'blocked';
}

/** 사진 앨범에서 사진을 여러 장 고른다. 취소하면 빈 배열. */
export async function pickFromLibrary(selectionLimit = 0): Promise<CapturedPage[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new PermissionDeniedError('사진 접근이 허용되지 않았습니다. 설정에서 권한을 켜주세요.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    ...(selectionLimit > 0 ? { selectionLimit, orderedSelection: selectionLimit > 1 } : {}),
    quality: 1,
  });

  if (result.canceled) {
    return [];
  }

  const assets = selectionLimit > 0 ? result.assets.slice(0, selectionLimit) : result.assets;

  return assets.map((asset) =>
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

/**
 * 상담 녹음 파일을 하나 고른다. 취소하면 null.
 *
 * **길이를 재지 않는다.** 기기에서 음성 길이를 읽으려면 재생기(expo-av)가 필요한데,
 * 그 값을 재 봐야 서버가 믿지 않는다 — 보내는 쪽이 정하는 값이라 2시간짜리를
 * 60초라고 적어 보낼 수 있다. **길이는 파일이 도착한 뒤 서버가 `ffprobe`로 잰다.**
 *
 * 그래서 앱은 형식과 크기만 본다. 둘은 고르는 순간 알 수 있고, 미리 막으면
 * 다 올리고 나서 거절당하는 일이 없다.
 */
export async function pickConsultationAudio(): Promise<CapturedPage | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];

  if (!asset) return null;

  return createPage('file', {
    uri: asset.uri,
    /*
     * 기기가 형식을 안 알려주면 확장자로 정한다. `audio/*`로 걸러 골랐으니
     * 음성인 것은 맞고, 서버가 목록에 없는 형식을 다시 막는다.
     */
    mimeType: asset.mimeType ?? mimeFromName(asset.name),
    name: asset.name,
    sizeBytes: asset.size ?? undefined,
  });
}

/** 확장자 → 형식. 서버가 받는 목록(`VISIT_NOTE_AUDIO_TYPES`)과 같은 이름을 쓴다. */
function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? '';

  const byExtension: Record<string, string> = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    aiff: 'audio/aiff',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    mp4: 'audio/mp4',
    m4a: 'audio/m4a',
  };

  return byExtension[ext] ?? 'audio/m4a';
}
