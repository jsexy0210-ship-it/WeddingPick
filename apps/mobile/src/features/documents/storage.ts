import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { CapturedPage } from '@/features/capture/types';
import type { DocumentSet, StoredPage } from '@/features/documents/types';

const STORAGE_KEY = 'weddingpick.documentSets.v1';
const ORIGINALS_DIR = 'originals';

/**
 * 촬영 직후의 파일은 캐시에 있어 시스템이 지울 수 있다. 저장 시 앱 문서 디렉터리로 옮겨둔다.
 *
 * 웹에서는 파일시스템을 쓰지 않고 원본 URI를 그대로 둔다. 개발 중 화면 확인용이며,
 * 새로고침하면 blob URI가 끊긴다.
 */
async function persistPages(setId: string, pages: CapturedPage[]): Promise<StoredPage[]> {
  if (Platform.OS === 'web') {
    return pages;
  }

  const directory = new Directory(Paths.document, ORIGINALS_DIR, setId);
  directory.create({ intermediates: true, idempotent: true });

  return Promise.all(
    pages.map(async (page, index) => {
      const source = new File(page.uri);
      const extension = source.extension || (page.mimeType === 'application/pdf' ? '.pdf' : '.jpg');
      const destination = new File(directory, `${index + 1}${extension}`);

      await source.copy(destination);

      return { ...page, uri: destination.uri };
    })
  );
}

function removeOriginals(setId: string) {
  if (Platform.OS === 'web') {
    return;
  }

  const directory = new Directory(Paths.document, ORIGINALS_DIR, setId);

  if (directory.exists) {
    directory.delete();
  }
}

async function readAll(): Promise<DocumentSet[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DocumentSet[]) : [];
  } catch {
    // 저장 형식이 깨졌으면 목록을 비운다. 원본 파일은 남아 있으므로 복구는 별도 문제로 다룬다.
    return [];
  }
}

async function writeAll(sets: DocumentSet[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}

export async function loadDocumentSets(): Promise<DocumentSet[]> {
  return readAll();
}

/** 촬영 묶음을 저장한다. 최신 것이 앞에 오도록 쌓는다. */
export async function saveDocumentSet(
  pages: CapturedPage[],
  createdAt = new Date()
): Promise<DocumentSet> {
  const id = `${createdAt.getTime()}`;
  const stored = await persistPages(id, pages);

  const set: DocumentSet = {
    id,
    createdAt: createdAt.toISOString(),
    label: formatLabel(createdAt),
    // AI 문서분류 전이다. 사용자에게 물어보지 않는다 — 제품 원칙 1.
    docType: 'unknown',
    // 분석·인증 전이므로 항상 L0에서 시작한다. 서비스정책서 2번.
    verificationLevel: 'L0',
    pages: stored,
  };

  await writeAll([set, ...(await readAll())]);

  return set;
}

export async function deleteDocumentSet(id: string): Promise<void> {
  const remaining = (await readAll()).filter((set) => set.id !== id);

  await writeAll(remaining);
  removeOriginals(id);
}

/** 사용자에게 입력시키지 않으므로(제품 원칙 1) 이름은 저장 시각에서 만든다. */
function formatLabel(date: Date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');

  return `${month}월 ${day}일 ${hour}:${minute} 문서`;
}
