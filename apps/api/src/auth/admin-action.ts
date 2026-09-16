import { ApiError } from '../errors';
import type { ResolvedAdmin } from './admin-role';

export function assertAdminAction(admin: ResolvedAdmin, method: string, route: string, body?: unknown): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
  if (admin.role === 'super') return;
  if (admin.role === 'viewer') throw new ApiError('forbidden', '이 계정은 읽기 전용이에요.');
  const deletion = method === 'DELETE'
    || /\/(delete|remove|dispose|redact|withdraw|sweep|collect-unreachable)$/.test(route)
    || /\/withdrawals\/[^/]+\/retry$/.test(route)
    || (/\/inquiries\/[^/]+\/answer$/.test(route)
      && typeof body === 'object' && body !== null && 'withdrawPlanner' in body && body.withdrawPlanner === true);
  if (deletion ? !admin.canDelete : !admin.canEdit) {
    throw new ApiError('forbidden', deletion ? '삭제 권한이 필요해요.' : '편집 권한이 필요해요.');
  }
}
