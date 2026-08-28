import type { CapturedPage } from '@/features/capture/types';

export type CaptureAction =
  | { type: 'add'; pages: CapturedPage[] }
  | { type: 'remove'; id: string }
  | { type: 'clear' };

/** 촬영 draft의 장 목록 변화. 순서는 찍은/고른 순서를 유지한다. */
export function captureReducer(pages: CapturedPage[], action: CaptureAction): CapturedPage[] {
  switch (action.type) {
    case 'add':
      return [...pages, ...action.pages];
    case 'remove':
      return pages.filter((page) => page.id !== action.id);
    case 'clear':
      return [];
  }
}
