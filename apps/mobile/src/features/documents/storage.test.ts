import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CapturedPage } from '@/features/capture/types';
import {
  deleteDocumentSet,
  loadDocumentSets,
  saveDocumentSet,
} from '@/features/documents/storage';

const deletedDirectories: string[] = [];

jest.mock('expo-file-system', () => {
  // 실제 구현처럼 문자열·Directory·File을 섞어 받아 경로를 잇는다.
  const join = (parts: unknown[]) =>
    parts.map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri)).join('/');

  class Directory {
    uri: string;
    exists = true;

    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }

    create() {}

    delete() {
      deletedDirectories.push(this.uri);
    }
  }

  class File {
    uri: string;
    extension = '.jpg';

    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }

    async copy() {}
  }

  return { Directory, File, Paths: { document: 'file:///documents' } };
});

function page(id: string): CapturedPage {
  return { id, uri: `file:///cache/${id}.jpg`, mimeType: 'image/jpeg', source: 'camera' };
}

beforeEach(async () => {
  deletedDirectories.length = 0;
  await AsyncStorage.clear();
});

describe('문서 묶음 저장', () => {
  it('저장 직후 등급은 항상 L0이고 문서 종류는 미정이다', async () => {
    const set = await saveDocumentSet([page('a')]);

    // 분석·인증 전에 등급이 올라가면 시장 가격 계산이 오염된다.
    expect(set.verificationLevel).toBe('L0');
    expect(set.docType).toBe('unknown');
  });

  it('원본을 앱 문서 디렉터리로 옮긴 uri를 저장한다', async () => {
    const set = await saveDocumentSet([page('a'), page('b')]);

    expect(set.pages.map((item) => item.uri)).toEqual([
      'file:///documents/originals/' + set.id + '/1.jpg',
      'file:///documents/originals/' + set.id + '/2.jpg',
    ]);
  });

  it('최근 저장한 묶음이 앞에 온다', async () => {
    const older = await saveDocumentSet([page('a')], new Date('2026-08-01T10:00:00Z'));
    const newer = await saveDocumentSet([page('b')], new Date('2026-08-02T10:00:00Z'));

    expect((await loadDocumentSets()).map((set) => set.id)).toEqual([newer.id, older.id]);
  });

  it('묶음을 지우면 목록과 원본 디렉터리가 함께 사라진다', async () => {
    const set = await saveDocumentSet([page('a')]);

    await deleteDocumentSet(set.id);

    expect(await loadDocumentSets()).toEqual([]);
    expect(deletedDirectories).toEqual(['file:///documents/originals/' + set.id]);
  });

  it('저장 형식이 깨져 있으면 빈 목록으로 시작한다', async () => {
    await AsyncStorage.setItem('weddingpick.documentSets.v1', '{절반만 쓰다 만 JSON');

    await expect(loadDocumentSets()).resolves.toEqual([]);
  });
});
