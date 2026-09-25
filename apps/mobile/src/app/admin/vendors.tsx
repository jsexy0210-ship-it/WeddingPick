/**
 * WP-ADM-014 데이터 · 업체 관리
 * 업체 병합·분리 · 상호 변경 · 영업상태 · 재귀속 이력 · 정보 수정 · 삭제
 *
 * **행마다 「수정」「삭제」가 있다**(2026-09-25 대표 지시 — 「업체 관리도 수정, 삭제
 * 버튼을 추가한다」). 모양은 FAQ 관리의 행 단추(`faq.tsx` editBtn · deleteBtn)를 그대로
 * 가져왔다 — 정본(`웨딩픽 관리자.dc.html`)에 업체 행 단추가 따로 그려져 있지 않다.
 * 삭제는 사용자 기록이 달린 업체면 서버가 거절한다(`vendor-admin.ts` DELETE_BLOCKERS).
 *
 * **2026-09-15 대표 확정 — 「업체·행사」 화면의 탭 하나(업체 관리 자신)다**(업체
 * 관리 · 이미지 관리 · 업체 문의 · 이메일 회신 · 박람회 관리 — 다섯 다 업체 관련
 * 운영). 이 파일 맨 아래 `VendorsShell`이 그 껍데기고, 여기 있던 본문은
 * `VendorsPanel`로 이름만 바꿨다.
 *
 * **박람회 탭은 2026-09-15에 붙었다.** 다른 세션(`session_01X9VA1VeAwEajpxUwTCHmFh`)이
 * `/admin/expos` 화면을 만들어 `main`에 올렸고(PR #254), MASTER 지시로 이 탭
 * 자리로 정했다 — `expos.tsx` 참고.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, FontSize, Spacing } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { WritePressable } from './_role';
import { AdminTabShell, ConfirmCard, type AdminTabDef } from './_ui';
import { ImagesPanel } from './images';
import { BizQueuePanel } from './biz-queue';
import { EmailMatchingPanel } from './email-matching';
import { ExposPanel } from './expos';
import { formatCount, VENDOR_CATEGORIES, VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';

type VendorStatus = 'active' | 'closed' | 'suspended' | 'merged';
type HistoryItem = { at: string; action: string; note: string };

type Vendor = {
  id: string;
  name: string;
  category: string;
  region: string;
  address: string | null;
  status: VendorStatus;
  dataCount: number;
  mergedInto: string | null;
  history: HistoryItem[];
};

type VendorListData = { vendors: Vendor[]; total: number };

/**
 * 업종 이름은 domain 한 곳(`VENDOR_CATEGORY_LABEL`)에서만 가져온다 —
 * `stats.tsx`의 `formatCat`과 같은 자리다. 서버는 DB enum(`hall` · `snap`)을
 * 그대로 주는데, 그것을 그대로 그리면 표에 「hall」이 뜬다. 운영자가 읽는 이름은
 * 「웨딩홀」이고, 같은 것을 두 이름으로 부르지 않는다(2026-09-11 대표 지시).
 *
 * 모르는 값이 오면 코드를 그대로 보여 준다 — 관리자 화면이라 감추기보다 드러내는
 * 쪽이 맞다.
 */
function formatCat(category: string) {
  return (VENDOR_CATEGORY_LABEL as Record<string, string>)[category] ?? category;
}

/**
 * 병합하면 무엇이 몇 건 옮겨 가는지. 서버가 세어서 준다.
 *
 * 병합은 되돌릴 수 없고 사용자가 쓴 기록(제보 · 후기 · Pick · 이미지)에 닿는다.
 * 그래서 누르기 전에 이 표를 먼저 그린다 — v3.27 관리자 공통 규칙,
 * 「위험한 조작은 무엇이 바뀌는지 항목으로 보여준 뒤 한 번 더 확인」.
 */
type MergeCount = { label: string; moves: number; blocked: number };
type MergePreview = {
  source: { id: string; name: string; category: string };
  target: { id: string; name: string; category: string };
  counts: MergeCount[];
  categoryDiffers: boolean;
};

/**
 * 수정에서 고를 수 있는 업종. 결정사는 뺀다 — 2026-09-24 대표 지시(「결정사 따윈
 * 필요없다」). 서버도 같은 목록만 받는다(`EDITABLE_VENDOR_CATEGORIES`).
 */
const EDIT_CATEGORIES = VENDOR_CATEGORIES.filter((c) => c !== 'wedding_info_company');

type VendorForm = { id: string; name: string; category: string; region: string; address: string };

/** 「제보」·「후기」·「Pick」·「이미지」가 같은 선에서 시작하도록 잡아 두는 폭. */
const MERGE_LABEL_WIDTH = 64;

const STATUS_LABEL: Record<VendorStatus, string> = {
  active: '영업중',
  closed: '폐업',
  suspended: '정지',
  merged: '병합됨',
};
const STATUS_COLOR: Record<VendorStatus, string> = {
  active: Colors.light.positive,
  closed: Colors.light.textAssistive,
  suspended: Colors.light.negative,
  merged: Colors.light.accent,
};

function VendorsPanel() {
  const [data, setData] = useState<VendorListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [acting, setActing] = useState(false);
  const [nameEdit, setNameEdit] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  // 병합 확인 단계. 미리보기를 받아 두기 전에는 병합을 부르지 않는다.
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [mergeReason, setMergeReason] = useState('');
  // 행의 「수정」 · 「삭제」.
  const [form, setForm] = useState<VendorForm | null>(null);
  const [deleting, setDeleting] = useState<Vendor | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/vendors')
      .then((d) => {
        if (cancelled) return;
        setData(d as VendorListData);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [rev]);

  function selectVendor(v: Vendor) {
    setSelected(v);
    setNameEdit(v.name);
    // 대상 ID 칸은 비워서 연다. `mergedInto`는 사람이 읽을 이름이지 ID가 아니고,
    // 이미 병합된 업체는 어차피 다시 합칠 수 없다.
    setMergeTarget('');
    setActionError(null);
  }

  async function updateName() {
    if (!selected || !nameEdit.trim()) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/vendors/${selected.id}/name`, {
        method: 'PATCH',
        body: JSON.stringify({ name: nameEdit.trim() }),
      });
      setSelected(null);
      setRev((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  async function updateStatus(status: VendorStatus) {
    if (!selected) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/vendors/${selected.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setSelected(null);
      setRev((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  /** 1단계 — 무엇이 몇 건 옮겨 가는지 세어 온다. 아직 아무것도 바꾸지 않는다. */
  async function previewMerge() {
    if (!selected || !mergeTarget.trim()) return;
    setActing(true);
    setActionError(null);
    try {
      const p = (await apiFetch(
        `/v1/admin/vendors/${selected.id}/merge-preview?targetId=${encodeURIComponent(mergeTarget.trim())}`
      )) as MergePreview;
      setMergePreview(p);
      setMergeReason('');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  /** 2단계 — 사유를 받아 실제로 합친다. 되돌릴 수 없다. */
  async function confirmMerge() {
    if (!selected || !mergePreview || !mergeReason.trim()) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/vendors/${selected.id}/merge`, {
        method: 'POST',
        body: JSON.stringify({
          targetId: mergePreview.target.id,
          reason: mergeReason.trim(),
        }),
      });
      setMergePreview(null);
      setSelected(null);
      setRev((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  function openEdit(v: Vendor) {
    setActionError(null);
    setForm({ id: v.id, name: v.name, category: v.category, region: v.region, address: v.address ?? '' });
  }

  async function saveEdit() {
    if (!form || !form.name.trim() || !form.region.trim()) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/vendors/${form.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          region: form.region.trim(),
          address: form.address.trim() || null,
        }),
      });
      setForm(null);
      setRev((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    setListError(null);
    try {
      await apiFetch(`/v1/admin/vendors/${target.id}`, { method: 'DELETE' });
      setRev((r) => r + 1);
    } catch (e) {
      // 사용자 기록이 달린 업체는 서버가 무엇이 몇 건인지 적어 거절한다 — 그 말을 그대로 보여준다.
      setListError(e instanceof Error ? e.message : '삭제 실패');
    }
  }

  const filtered = data?.vendors.filter(
    (v) => !search || v.name.includes(search) || v.id.includes(search)
  ) ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>업체 관리</Text>
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <DelayedLoader active={loading} size={40} style={styles.centered} />
      {!loading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => setRev((r) => r + 1)}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && data && (
        <View style={styles.body}>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="업체명 또는 ID 검색"
              value={search}
              onChangeText={setSearch}
            />
            <Text style={styles.totalText}>총 {formatCount(data.total)}개</Text>
          </View>
          {listError && <Text style={styles.listError}>{listError}</Text>}
          <ScrollView>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colName]}>업체명</Text>
              <Text style={[styles.th, styles.colCategory]}>카테고리</Text>
              <Text style={[styles.th, styles.colStatus]}>상태</Text>
              <Text style={[styles.th, styles.colCount]}>제보</Text>
              <Text style={[styles.th, styles.colActions]}>관리</Text>
            </View>
            {filtered.map((v, i) => (
              <Pressable
                key={v.id}
                style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra, selected?.id === v.id && styles.tableRowActive]}
                onPress={() => selectVendor(v)}
              >
                <Text style={[styles.td, styles.colName]} numberOfLines={1}>{v.name}</Text>
                <Text style={[styles.td, styles.colCategory]}>{formatCat(v.category)}</Text>
                <Text style={[styles.td, styles.colStatus, { color: STATUS_COLOR[v.status] }]}>
                  {STATUS_LABEL[v.status]}
                </Text>
                <Text style={[styles.td, styles.colCount]}>{formatCount(v.dataCount)}</Text>
                <View style={[styles.colActions, styles.rowActions]}>
                  {/* 병합된 업체는 흡수된 껍데기라 고칠 것이 없다 — 서버도 거절한다. 삭제는 된다. */}
                  {v.status !== 'merged' && (
                    <WritePressable style={styles.editBtn} onPress={() => openEdit(v)}>
                      <Text style={styles.editBtnText}>수정</Text>
                    </WritePressable>
                  )}
                  <WritePressable style={styles.deleteBtn} onPress={() => { setListError(null); setDeleting(v); }}>
                    <Text style={styles.deleteBtnText}>삭제</Text>
                  </WritePressable>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 상세 모달 */}
      <Modal visible={selected !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalBox} contentContainerStyle={styles.modalBoxContent}>
            <Text style={styles.modalTitle}>{selected?.name}</Text>
            <Text style={styles.modalSub}>{selected?.id} · {selected ? formatCat(selected.category) : ''}</Text>

            <Text style={styles.fieldLabel}>상호 변경</Text>
            <TextInput
              style={styles.fieldInput}
              value={nameEdit}
              onChangeText={setNameEdit}
            />
            <WritePressable
              style={[styles.primaryBtn, (acting) && styles.btnDisabled]}
              onPress={() => void updateName()}
              disabled={acting}
            >
              <Text style={styles.primaryBtnText}>상호 저장</Text>
            </WritePressable>

            <Text style={styles.fieldLabel}>영업 상태 변경</Text>
            <View style={styles.statusRow}>
              {(['active', 'closed', 'suspended'] as VendorStatus[]).map((s) => (
                <WritePressable
                  key={s}
                  style={[styles.statusBtn, selected?.status === s && { borderColor: STATUS_COLOR[s] }]}
                  onPress={() => void updateStatus(s)}
                  disabled={acting}
                >
                  <Text style={[styles.statusBtnText, selected?.status === s && { color: STATUS_COLOR[s] }]}>
                    {STATUS_LABEL[s]}
                  </Text>
                </WritePressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>업체 병합 (대상 ID)</Text>
            <TextInput
              style={styles.fieldInput}
              value={mergeTarget}
              onChangeText={setMergeTarget}
              placeholder="병합할 대상 업체 ID"
            />
            <WritePressable
              style={[styles.dangerBtn, (acting) && styles.btnDisabled]}
              onPress={() => void previewMerge()}
              disabled={acting || !mergeTarget.trim()}
            >
              <Text style={styles.dangerBtnText}>병합할 내용 확인</Text>
            </WritePressable>

            {actionError && <Text style={styles.actionError}>{actionError}</Text>}

            {/* 이력 */}
            {selected && selected.history.length > 0 && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 20 }]}>재귀속 이력</Text>
                {selected.history.map((h, i) => (
                  <View key={i} style={styles.historyRow}>
                    <Text style={styles.historyTime}>{h.at}</Text>
                    <Text style={styles.historyAction}>{h.action}</Text>
                    <Text style={styles.historyNote}>{h.note}</Text>
                  </View>
                ))}
              </>
            )}

            <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
              <Text style={styles.closeBtnText}>닫기</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* 정보 수정 — 표에 있는 상호 · 업종에 지역 · 주소를 더한 네 칸. */}
      <Modal visible={form !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>업체 정보 수정</Text>
            <Text style={styles.modalSub}>{form?.id}</Text>

            <Text style={styles.fieldLabel}>상호</Text>
            <TextInput
              style={styles.fieldInput}
              value={form?.name ?? ''}
              onChangeText={(name) => setForm((f) => f && { ...f, name })}
            />

            <Text style={styles.fieldLabel}>업종</Text>
            <View style={styles.categoryRow}>
              {EDIT_CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.statusBtn, form?.category === c && styles.categoryBtnOn]}
                  onPress={() => setForm((f) => f && { ...f, category: c })}
                >
                  <Text style={[styles.statusBtnText, form?.category === c && styles.categoryBtnTextOn]}>
                    {formatCat(c)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>지역</Text>
            <TextInput
              style={styles.fieldInput}
              value={form?.region ?? ''}
              onChangeText={(region) => setForm((f) => f && { ...f, region })}
            />

            <Text style={styles.fieldLabel}>주소</Text>
            <TextInput
              style={styles.fieldInput}
              value={form?.address ?? ''}
              onChangeText={(address) => setForm((f) => f && { ...f, address })}
              placeholder="비우면 주소를 지워요"
            />

            {actionError && <Text style={styles.actionError}>{actionError}</Text>}

            <WritePressable
              style={[styles.primaryBtn, styles.saveGap, (acting || !form?.name.trim() || !form?.region.trim()) && styles.btnDisabled]}
              onPress={() => void saveEdit()}
              disabled={acting || !form?.name.trim() || !form?.region.trim()}
            >
              <Text style={styles.primaryBtnText}>{acting ? '저장 중…' : '저장'}</Text>
            </WritePressable>
            <Pressable style={styles.closeBtn} onPress={() => setForm(null)}>
              <Text style={styles.closeBtnText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {deleting && (
        <ConfirmCard
          title="업체를 지울까요?"
          body="지운 업체는 되돌릴 수 없어요."
          items={[
            `${deleting.name} · ${formatCat(deleting.category)} · ${deleting.region}`,
            '업체 정보 · 이미지 · 가격 통계 · 변경 이력이 함께 지워져요',
            'Pick 후보 · 후기 · 제보 금액 · Pick 결정이 달린 업체는 지우지 않고 알려드려요',
          ]}
          cta="삭제"
          danger
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}

      {/*
        병합 확인. 되돌릴 수 없는 조작이므로 무엇이 몇 건 옮겨 가는지 항목으로
        보여주고, 사유를 받은 뒤에야 합친다 — v3.27 관리자 공통 규칙.
      */}
      <Modal visible={mergePreview !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalBox} contentContainerStyle={styles.modalBoxContent}>
            <Text style={styles.modalTitle}>업체를 합칠까요?</Text>
            <Text style={styles.mergeSummary}>
              {mergePreview?.source.name} → {mergePreview?.target.name}
            </Text>
            <Text style={styles.mergeWarn}>합치면 되돌릴 수 없어요.</Text>

            {mergePreview?.categoryDiffers && (
              <Text style={styles.mergeWarn}>
                업종이 서로 달라요 ({formatCat(mergePreview.source.category)} · {formatCat(mergePreview.target.category)}).
              </Text>
            )}

            <Text style={styles.fieldLabel}>옮겨 가는 것</Text>
            {mergePreview?.counts.map((c) => (
              <View key={c.label} style={styles.mergeRow}>
                <Text style={styles.mergeRowLabel}>{c.label}</Text>
                <Text style={styles.mergeRowValue}>{formatCount(c.moves)}건</Text>
                {c.blocked > 0 && (
                  // 겹쳐서 옮기지 못하는 것도 적는다. 감추면 「전부 옮겨 갔다」로 읽힌다.
                  <Text style={styles.mergeRowBlocked}>겹침 {formatCount(c.blocked)}건</Text>
                )}
              </View>
            ))}

            <Text style={styles.fieldLabel}>사유</Text>
            <TextInput
              style={styles.fieldInput}
              value={mergeReason}
              onChangeText={setMergeReason}
              placeholder="왜 합치는지 적어 주세요"
            />

            {actionError && <Text style={styles.actionError}>{actionError}</Text>}

            <WritePressable
              style={[styles.dangerBtn, (acting || !mergeReason.trim()) && styles.btnDisabled]}
              onPress={() => void confirmMerge()}
              disabled={acting || !mergeReason.trim()}
            >
              <Text style={styles.dangerBtnText}>합치기</Text>
            </WritePressable>

            <Pressable style={styles.closeBtn} onPress={() => setMergePreview(null)}>
              <Text style={styles.closeBtnText}>그만두기</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const TABS: AdminTabDef[] = [
  { key: 'vendors', label: '업체 관리' },
  { key: 'images', label: '이미지 관리' },
  { key: 'biz-queue', label: '업체 소유 확인' },
  { key: 'email-matching', label: '이메일 회신', readOnly: true, hidden: true },
  { key: 'expos', label: '박람회 관리' },
];

/**
 * 「업체·행사」 — 업체 관리 · 이미지 관리 · 업체 문의 · 이메일 회신 · 박람회 관리를
 * 탭으로 묶는다. **업체 문의 · 이메일 회신은 「조회만」 딱지가 붙는다** — 읽기는
 * 되지만 쓰기 단추가 화면 안에서 잠겨 있다(넷 중 둘.
 * `test/admin-read-only-pairing.test.ts`가 이 딱지와 화면 안쪽 잠금이 짝인지
 * 확인한다). 되는 화면 둘 사이에서 안 되는 화면이 묻히지 않게 탭에도 표시를 남긴다.
 *
 * **박람회 관리는 2026-09-15 MASTER 지시로 이 탭에 자리 잡았다** — 박람회도 결국
 * 업체가 참가하는 행사라 이미 업체·시설을 다루는 이 묶음과 성격이 같고, 새 사이드바
 * 묶음을 신설하는 것은 32개를 9개로 줄이는 방향과 반대이기 때문이다.
 */
export default function VendorsShell() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const initial = TABS.some((t) => t.key === tab) ? (tab as string) : 'vendors';
  const [active, setActive] = useState(initial);

  return (
    <AdminTabShell tabs={TABS} active={active} onChange={setActive}>
      {active === 'vendors' && <VendorsPanel />}
      {active === 'images' && <ImagesPanel />}
      {active === 'biz-queue' && <BizQueuePanel />}
      {active === 'email-matching' && <EmailMatchingPanel />}
      {active === 'expos' && <ExposPanel />}
    </AdminTabShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },
  mergeSummary: { fontSize: FontSize.t6, fontWeight: '700', marginTop: Spacing.two },
  mergeWarn: { fontSize: FontSize.t7, color: Colors.light.negative, marginTop: Spacing.one },
  mergeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  mergeRowLabel: {
    fontSize: FontSize.t7,
    color: Colors.light.textAssistive,
    width: MERGE_LABEL_WIDTH,
  },
  mergeRowValue: { fontSize: FontSize.t7, fontWeight: '700' },
  mergeRowBlocked: { fontSize: FontSize.micro, color: Colors.light.cautionary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.light.backgroundSelected,
  },
  refreshText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  body: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
  },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: FontSize.t7,
    backgroundColor: Colors.light.backgroundElement,
  },
  totalText: { fontSize: FontSize.t7, color: Colors.light.textAssistive },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
    alignItems: 'center',
  },
  tableRowZebra: { backgroundColor: Colors.light.backgroundElement },
  tableRowActive: { backgroundColor: 'rgba(255,111,97,0.08)' },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textAssistive, textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: Colors.light.textStrong },
  colName: { flex: 3 },
  colCategory: { flex: 2 },
  colStatus: { width: 60 },
  colCount: { width: 50, textAlign: 'right' as const },
  /* 수정 · 삭제 두 단추가 한 줄에 들어가는 폭. */
  colActions: { width: 120, marginLeft: 16 },
  rowActions: { flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  /* 행 단추 — `faq.tsx`의 editBtn · deleteBtn과 같은 값이다. */
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: Colors.light.backgroundSelected,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
  },
  editBtnText: { fontSize: FontSize.tab, color: Colors.light.textStrong },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: Colors.light.negativeBoxBackground,
    borderWidth: 1,
    borderColor: Colors.light.negativeBorder,
  },
  deleteBtnText: { fontSize: FontSize.tab, color: Colors.light.negative, fontWeight: '700' },
  listError: { fontSize: FontSize.t7, color: Colors.light.negative, paddingHorizontal: 16, paddingVertical: 8 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  categoryBtnOn: { borderColor: Colors.light.tint },
  categoryBtnTextOn: { color: Colors.light.tint, fontWeight: '700' },
  saveGap: { marginTop: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalBox: {
    backgroundColor: Colors.light.background,
    borderRadius: 14,
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
  },
  modalBoxContent: { padding: 24 },
  modalTitle: { fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  modalSub: { fontSize: FontSize.t7, color: Colors.light.textAssistive, marginBottom: 20 },
  fieldLabel: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.textAssistive, marginBottom: 6, marginTop: 14 },
  fieldInput: {
    height: 40,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: FontSize.t7,
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  dangerBtn: {
    backgroundColor: Colors.light.negativeBoxBackground,
    borderWidth: 1,
    borderColor: Colors.light.negative,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  dangerBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.negative },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
  },
  statusBtnText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  actionError: { fontSize: FontSize.t7, color: Colors.light.negative, marginTop: 8 },
  historyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  historyTime: { fontSize: FontSize.tab, color: Colors.light.textAssistive, width: 80 },
  historyAction: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textStrong, width: 80 },
  historyNote: { flex: 1, fontSize: FontSize.tab, color: Colors.light.textSecondary },
  closeBtn: {
    marginTop: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: Colors.light.backgroundSelected,
    alignItems: 'center',
  },
  closeBtnText: { fontSize: FontSize.t7, color: Colors.light.textStrong },
  btnDisabled: { opacity: 0.5 },
});
