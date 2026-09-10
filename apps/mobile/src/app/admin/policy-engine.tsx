/**
 * WP-ADM-051 정책 규칙 관리
 *
 * 시안 `22-admin-ops.dc.html` 10번. 자동 판단이 어느 값을 기준으로 움직이는지 편집한다.
 * ADMIN.md — **값을 바꾸면 무엇이 달라지는지 먼저 보여준 뒤 진행한다.**
 *
 * 그래서 「수정」은 곧바로 서버로 가지 않는다. 바꾼 값은 저장하지 않은 변경으로 쌓이고,
 * 상단 배너가 몇 건인지 말하고, 저장할 때 확인 카드가 바뀌는 항목을 전부 보여준다.
 * 영향 건수(하루 몇 건이 더 자동 승인되는지)는 서버가 계산해 주면 이 항목에 붙는다.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Colors, FontSize, LineHeight, Radius, Spacing } from '@weddingpick/ui';

import { formatDateTimeDot } from '@/features/common/format-date';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import {
  Card,
  CardGrid,
  ConfirmCard,
  EmptyState,
  LoadError,
  Page,
  Rows,
  StatusBanner,
  type RowItem,
} from './_ui';

type PolicyType = 'number' | 'percentage' | 'boolean' | 'string';
type PolicyItem = {
  id: string;
  key: string;
  label: string;
  description: string;
  category: string;
  type: PolicyType;
  value: string;
  defaultValue: string;
  lastChangedAt: string | null;
  lastChangedBy: string | null;
};

type PolicyData = { policies: PolicyItem[] };

export default function PolicyEngineScreen() {
  const [data, setData] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  /** 저장하지 않은 변경. 키 → 새 값. */
  const [draft, setDraft] = useState<Record<string, string>>({});
  /** 지금 값을 고치고 있는 규칙. */
  const [editing, setEditing] = useState<PolicyItem | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/policy-engine')
      .then((d) => {
        if (cancelled) return;
        setData(d as PolicyData);
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

  const reload = () => {
    setDraft({});
    setRev((r) => r + 1);
  };

  const policies = data?.policies ?? [];
  const changed = policies.filter((p) => draft[p.key] !== undefined && draft[p.key] !== p.value);

  function startEdit(policy: PolicyItem) {
    setEditing(policy);
    setEditValue(draft[policy.key] ?? policy.value);
  }

  function commitEdit() {
    if (!editing) return;
    setDraft((d) => ({ ...d, [editing.key]: editValue }));
    setEditing(null);
  }

  async function save() {
    setSaveError(null);
    try {
      await apiFetch('/v1/admin/policy-engine', {
        method: 'PATCH',
        body: JSON.stringify({
          changes: changed.map((p) => ({ key: p.key, value: draft[p.key] })),
        }),
      });
      setConfirming(false);
      reload();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : '저장 실패');
      setConfirming(false);
    }
  }

  const categories = Array.from(new Set(policies.map((p) => p.category)));

  function rowsOf(category: string): RowItem[] {
    return policies
      .filter((p) => p.category === category)
      .map((p) => {
        const next = draft[p.key];
        const isChanged = next !== undefined && next !== p.value;
        return {
          key: p.key,
          name: p.label,
          meta: isChanged
            ? `변경됨 ${p.value} → ${next}`
            : p.lastChangedAt
              ? `${p.description} · 마지막 변경 ${formatDateTimeDot(p.lastChangedAt)}`
              : `${p.description} · 기본값 ${p.defaultValue}`,
          num: isChanged ? next : p.value,
          numKind: isChanged ? ('bad' as const) : undefined,
          btn: { label: '수정', onPress: () => startEdit(p) },
        };
      });
  }

  return (
    <Page
      title="정책 규칙 관리"
      sub="자동 판단 규칙 · 임계값"
      action={
        changed.length > 0
          ? {
              label: '변경 사항 저장',
              onPress: () => setConfirming(true),
              kind: 'brand',
            }
          : undefined
      }
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <StatusBanner
            tone={saveError ? 'bad' : changed.length === 0 ? 'ok' : 'warn'}
            title={
              saveError
                ? '저장하지 못했어요'
                : changed.length === 0
                  ? '저장하지 않은 변경이 없어요'
                  : `저장하지 않은 변경 ${changed.length}건이 있어요`
            }
            detail={
              saveError
                ?? (changed.length === 0
                  ? '지금 값이 그대로 자동 판단에 쓰이고 있어요.'
                  : changed.map((p) => `${p.label} ${p.value} → ${draft[p.key]}`).join(' · '))
            }
            cta={changed.length > 0 && !saveError ? { label: '되돌리기', onPress: () => setDraft({}) } : undefined}
          />

          {policies.length === 0 ? (
            <CardGrid>
              <Card title="규칙" full>
                <EmptyState title="편집할 규칙이 없어요" detail="등록된 자동 판단 규칙이 아직 없어요." />
              </Card>
            </CardGrid>
          ) : (
            <CardGrid>
              {categories.map((category) => (
                <Card key={category} title={category} sub="바꾼 값은 저장하기 전까지 반영되지 않아요">
                  <Rows items={rowsOf(category)} />
                </Card>
              ))}
            </CardGrid>
          )}

          {editing ? (
            <ConfirmCard
              title={`${editing.label}을(를) 얼마로 할까요?`}
              body={editing.description}
              items={[
                `지금 값 ${editing.value}`,
                `기본값 ${editing.defaultValue}`,
                '저장하기 전까지는 자동 판단에 반영되지 않아요',
              ]}
              cta="적어두기"
              onConfirm={commitEdit}
              onCancel={() => setEditing(null)}
            >
              <TextInput
                value={editValue}
                onChangeText={setEditValue}
                keyboardType={editing.type === 'number' || editing.type === 'percentage' ? 'numeric' : 'default'}
                style={styles.input}
                accessibilityLabel={`${editing.label} 값`}
              />
            </ConfirmCard>
          ) : null}

          {confirming ? (
            <ConfirmCard
              title={`변경 ${changed.length}건을 저장할까요?`}
              body="저장하는 즉시 자동 판단이 새 값으로 움직여요."
              items={changed.map((p) => `${p.label} ${p.value} → ${draft[p.key]}`)}
              cta="저장"
              danger
              onConfirm={() => void save()}
              onCancel={() => setConfirming(false)}
            />
          ) : null}
        </>
      ) : null}
    </Page>
  );
}

const C = Colors.light;

const styles = StyleSheet.create({
  input: {
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: C.fieldBorder,
    backgroundColor: C.background,
    color: C.text,
    fontSize: FontSize.t6,
    lineHeight: LineHeight.t6,
    fontVariant: ['tabular-nums'],
  },
});
