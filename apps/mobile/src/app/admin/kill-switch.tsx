/**
 * WP-ADM-041 긴급 중지
 *
 * 시안 `22-admin-ops.dc.html` 8번. **위험한 조작이라 스위치를 내리면 확인 카드가 뜨고,
 * 무엇이 멈추는지 항목으로 보여준 뒤 진행한다**(ADMIN.md 공통 규칙 · WP-ADM-041).
 * 다시 켜는 것은 되돌리는 일이라 확인 없이 바로 된다.
 */
import { useEffect, useState } from 'react';

import { withParticle } from '@weddingpick/domain';

import { formatDateTimeDot } from '@/features/common/format-date';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import {
  Card,
  CardGrid,
  ConfirmCard,
  EmptyState,
  KpiRow,
  LoadError,
  Page,
  Rows,
  StatusBanner,
  type RowItem,
} from './_ui';

type SwitchItem = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: string;
  /**
   * 이 스위치를 읽는 코드가 실제로 있는가. false면 껐다 켜도 동작이 바뀌지 않는다.
   * 화면이 그 사실을 숨기면, 끈 줄 알고 손을 놓는 일이 생긴다.
   */
  wired?: boolean;
  lastChangedAt: string | null;
  lastChangedBy: string | null;
};

type KillSwitchData = { switches: SwitchItem[] };

export default function KillSwitchScreen() {
  const [data, setData] = useState<KillSwitchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  /** 끄기를 기다리는 스위치. 확인 카드가 이것으로 열린다. */
  const [pending, setPending] = useState<SwitchItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/kill-switches')
      .then((d) => {
        if (cancelled) return;
        setData(d as KillSwitchData);
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

  const reload = () => setRev((r) => r + 1);

  async function apply(item: SwitchItem, enabled: boolean) {
    try {
      await apiFetch(`/v1/admin/kill-switches/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
    } finally {
      setPending(null);
      reload();
    }
  }

  /**
   * 끄기는 확인을 거치고, 켜기는 바로 한다 — 되돌리는 조작까지 한 번 더 묻으면
   * 급할 때 복구가 늦어진다.
   */
  function onToggle(item: SwitchItem) {
    if (item.enabled) setPending(item);
    else void apply(item, true);
  }

  const switches = data?.switches ?? [];
  const off = switches.filter((s) => !s.enabled);
  const unwired = switches.filter((s) => s.wired === false);

  /** 시안은 「자동 판단」·「발송 · 노출」 두 묶음이다. 실제 묶음은 서버가 준 category를 따른다. */
  const categories = Array.from(new Set(switches.map((s) => s.category)));

  function rowsOf(category: string): RowItem[] {
    return switches
      .filter((s) => s.category === category)
      .map((s) => ({
        key: s.id,
        name: s.name,
        meta: s.wired === false ? `${s.description} · 아직 배선되지 않았어요` : s.description,
        toggle: { on: s.enabled, onPress: () => onToggle(s) },
      }));
  }

  /** 확인 카드에 들어갈 항목. 무엇이 멈추는지 · 되돌릴 수 있는지 · 마지막 변경. */
  function confirmItems(item: SwitchItem): string[] {
    const items = [item.description];
    if (item.wired === false) items.push('이 스위치는 아직 배선되지 않았어요 — 꺼도 동작이 바뀌지 않아요');
    else if (item.lastChangedAt) {
      items.push(`마지막 변경 ${formatDateTimeDot(item.lastChangedAt)}${item.lastChangedBy ? ` · ${item.lastChangedBy}` : ''}`);
    }
    return items;
  }

  return (
    <Page title="긴급 중지" sub="기능별 스위치 · 끄면 무엇이 멈추는지 보여요">
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <StatusBanner
            tone={off.length === 0 ? 'ok' : 'bad'}
            title={off.length === 0 ? '모두 켜져 있어요' : `${off.length}개가 꺼져 있어요`}
            detail={
              off.length === 0
                ? '멈춰 있는 기능이 없어요.'
                : `꺼진 기능: ${off.map((s) => s.name).join(' · ')}`
            }
          />

          <KpiRow
            items={[
              { label: '켜짐', value: `${switches.length - off.length}개`, note: `전체 ${switches.length}개`, kind: 'ok' },
              { label: '꺼짐', value: `${off.length}개`, note: off.length === 0 ? '멈춘 것이 없어요' : '동작이 멈춰 있어요', kind: off.length === 0 ? 'ok' : 'bad' },
              { label: '배선 안 됨', value: `${unwired.length}개`, note: '꺼도 동작이 바뀌지 않아요', kind: unwired.length === 0 ? 'ok' : 'warn' },
            ]}
          />

          {switches.length === 0 ? (
            <CardGrid>
              <Card title="스위치" full>
                <EmptyState title="스위치가 없어요" detail="등록된 긴급 중지 스위치가 아직 없어요." />
              </Card>
            </CardGrid>
          ) : (
            <CardGrid>
              {categories.map((category) => (
                <Card key={category} title={category} sub="끄면 무엇이 멈추는지 확인 카드로 보여드려요">
                  <Rows items={rowsOf(category)} />
                </Card>
              ))}
            </CardGrid>
          )}

          {pending ? (
            <ConfirmCard
              title={`${withParticle(pending.name, '을를')} 끌까요?`}
              body="끄는 즉시 아래가 멈춰요. 다시 켜면 바로 복구되고, 멈춘 동안 쌓인 건은 확인 필요 목록에 남아요."
              items={confirmItems(pending)}
              cta="끄기"
              danger
              onConfirm={() => void apply(pending, false)}
              onCancel={() => setPending(null)}
            />
          ) : null}
        </>
      ) : null}
    </Page>
  );
}
