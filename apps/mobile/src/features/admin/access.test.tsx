import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AdminAccessProvider, useAdminAccess } from '@/app/admin/_ui';
import { apiFetch } from '@/app/admin/_api';

jest.mock('@/app/admin/_api', () => ({ apiFetch: jest.fn() }));
jest.mock('@/app/admin/_session', () => ({ clearAdminToken: jest.fn() }));
jest.mock('expo-router', () => ({ Link: () => null, router: { replace: jest.fn() } }));

type Access = ReturnType<typeof useAdminAccess>;
function Probe({ capture }: { capture: (value: Access) => void }) {
  capture(useAdminAccess());
  return null;
}

describe('관리자 공용 권한', () => {
  let renderer: ReactTestRenderer;
  let access: Access;
  const capture = (value: Access) => { access = value; };
  afterEach(async () => { await act(async () => { renderer?.unmount(); }); });

  it('여러 화면 부품이 권한 조회 한 번을 공유한다', async () => {
    jest.mocked(apiFetch).mockResolvedValue({ role: 'viewer', canEdit: false, canDelete: false, isSuperAdmin: false });
    await act(async () => {
      renderer = create(<AdminAccessProvider token="first"><Probe capture={capture} /><Probe capture={capture} /></AdminAccessProvider>);
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith('/v1/admin/access');
    expect(access!).toMatchObject({ role: 'viewer', canEdit: false, canDelete: false, loading: false });
  });

  it('조회 실패를 표시하고 재시도 성공 전에는 쓰기를 열지 않는다', async () => {
    jest.mocked(apiFetch).mockRejectedValueOnce(new Error('연결 실패'));
    await act(async () => { renderer = create(<AdminAccessProvider token="first"><Probe capture={capture} /></AdminAccessProvider>); });
    expect(access!).toMatchObject({ error: true, canEdit: false, canDelete: false });
    jest.mocked(apiFetch).mockResolvedValueOnce({ role: 'operator', canEdit: true, canDelete: false, isSuperAdmin: false });
    await act(async () => { access!.retry?.(); });
    expect(access!).toMatchObject({ error: false, canEdit: true, canDelete: false });
  });

  it('계정이 바뀌면 이전 계정의 쓰기 권한을 유지하지 않는다', async () => {
    jest.mocked(apiFetch).mockResolvedValueOnce({ role: 'super', canEdit: true, canDelete: true, isSuperAdmin: true });
    await act(async () => { renderer = create(<AdminAccessProvider key="first" token="first"><Probe capture={capture} /></AdminAccessProvider>); });
    expect(access!.canEdit).toBe(true);
    jest.mocked(apiFetch).mockReturnValueOnce(new Promise(() => {}));
    await act(async () => { renderer.update(<AdminAccessProvider key="second" token="second"><Probe capture={capture} /></AdminAccessProvider>); });
    expect(access!).toMatchObject({ loading: true, canEdit: false, canDelete: false, isSuperAdmin: false });
  });
});
