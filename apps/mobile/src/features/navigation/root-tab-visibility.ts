import { isRootTab } from './root-tabs';

/**
 * 탭 바는 다섯 Root 화면에서만 노출한다(docs/design/README.md).
 * 스택 index가 0이어도 직접 연 상세 화면일 수 있으므로 현재 경로를 확인한다.
 * usePathname()이 제공하는 경로를 사용해 서버 렌더와 브라우저의 판정도 맞춘다.
 */
export function isRootTabPath(pathname: string, routeName: string | undefined): boolean {
  if (!isRootTab(routeName)) return false;
  const path = pathname.replace(/\/+$/, '') || '/';
  const rootPath = routeName === 'index' ? '/' : `/${routeName}`;
  return path === rootPath;
}
