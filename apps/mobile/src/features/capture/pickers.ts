import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

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

/** 사진 앨범에서 요청한 수만큼 고른다. 1이면 시스템 다중 선택도 끈다. */
export async function pickFromLibrary(selectionLimit = 0): Promise<CapturedPage[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new PermissionDeniedError('사진 접근이 허용되지 않았습니다. 설정에서 권한을 켜주세요.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: selectionLimit !== 1,
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

/**
 * 카메라를 바로 열어 한 장 찍는다. 닫으면 null — 예산 추가 «자동 등록(Pick 인증)»
 * (2026-09-26 대표 지시 「카메라를 바로 연다」).
 *
 *   네이티브  OS 카메라(`launchCameraAsync`). 권한은 여는 순간 묻고, 거절하면 이유를 던진다.
 *   웹        `<input type="file" accept="image/*" capture="environment">` — 휴대폰 브라우저는
 *             뒤 카메라를, 데스크톱은 파일 선택 창을 연다.
 *
 * **웹에서는 누른 그 자리에서 곧장 연다.** 브라우저는 사용자가 누른 직후에만 파일 창을
 * 허락한다 — 앞에서 무엇이든 기다리면(권한 확인 등) 창이 조용히 막힌다. 그래서 웹은 권한을
 * 묻지 않고(`expo-image-picker` 웹은 늘 허용으로 답한다) 바로 `launchCameraAsync`를 부른다.
 * 부르는 쪽도 이 함수 앞에서 `await`하지 않는다.
 */
export async function takePhoto(): Promise<CapturedPage | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    cameraType: ImagePicker.CameraType.back,
    allowsMultipleSelection: false,
    /* 네이티브는 줄일 방법이 없어 압축만 한다 — 운영 Nginx `/v1/documents/` 상한(10MB) 안에 넉넉히. */
    quality: 0.7,
  };

  const result =
    Platform.OS === 'web'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.requestCameraPermissionsAsync().then((permission) => {
          if (!permission.granted) {
            throw new PermissionDeniedError('카메라 접근이 허용되지 않았습니다. 설정에서 권한을 켜주세요.');
          }
          return ImagePicker.launchCameraAsync(options);
        });

  if (result.canceled) return null;

  const asset = result.assets[0];

  if (!asset) return null;

  return createPage('camera', {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    name: asset.fileName ?? undefined,
    sizeBytes: asset.fileSize,
  });
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
    mimeType: consultationAudioType(asset.mimeType, asset.name),
    name: asset.name,
    sizeBytes: asset.size ?? undefined,
  });
}

/**
 * 브라우저 · 기기가 붙이는 다른 이름을 서버가 받는 이름(`VISIT_NOTE_AUDIO_TYPES`)으로 바꾼다.
 *
 * **웹에서 가장 흔한 녹음(.m4a)이 `audio/x-m4a`로 온다**(크롬 · 사파리). 그대로 보내면 서버의 형식
 * 목록에 없어 올릴 자리부터 거절된다 — 같은 파일인데 이름만 다르다. 모르는 이름은 그대로 둬서
 * 서버(와 올리기 전 검사)가 «읽을 수 없는 형식»으로 막게 한다 — `audio/webm`을 m4a라고 속이지 않는다.
 *
 * 기기가 형식을 안 알려주면(없음 · 빈 값 · `application/octet-stream`) 확장자로 정한다. `audio/*`로
 * 걸러 골랐으니 음성인 것은 맞다.
 */
export function consultationAudioType(mimeType: string | null | undefined, name: string): string {
  const raw = (mimeType ?? '').split(';')[0]!.trim().toLowerCase();

  if (raw === '' || raw === 'application/octet-stream') return mimeFromName(name);

  const aliases: Record<string, string> = {
    'audio/x-m4a': 'audio/m4a',
    'audio/x-wav': 'audio/wav',
    'audio/wave': 'audio/wav',
    'audio/vnd.wave': 'audio/wav',
    'audio/x-pn-wav': 'audio/wav',
    'audio/x-aiff': 'audio/aiff',
    'audio/x-flac': 'audio/flac',
    'audio/x-aac': 'audio/aac',
    'audio/aacp': 'audio/aac',
    'audio/x-mpeg': 'audio/mpeg',
    'audio/x-mp3': 'audio/mpeg',
    'audio/mpeg3': 'audio/mpeg',
    'audio/x-mpeg-3': 'audio/mpeg',
    'audio/x-ogg': 'audio/ogg',
  };

  return aliases[raw] ?? raw;
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
