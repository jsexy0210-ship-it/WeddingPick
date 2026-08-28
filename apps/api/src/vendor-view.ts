import { DATA_SOURCES, formatAttribution } from '@weddingpick/domain';

/**
 * 업체 정보를 공공데이터에서 가져왔다면 출처를 밝힌다.
 *
 * 공공누리는 유형과 무관하게 출처 표시를 요구한다. 사용자가 올린 문서에서만 나온 업체는
 * 밝힐 바깥 출처가 없으므로 null이다.
 */
export function vendorSourceNote(source: string | null): string | null {
  if (source !== 'public_data') {
    return null;
  }

  return formatAttribution(DATA_SOURCES.localdata);
}
