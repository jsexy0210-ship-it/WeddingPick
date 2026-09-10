import type { Settings } from '@weddingpick/api-contract';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Switch } from 'react-native';

import { ErrorView, Layout, Toast, useTheme } from '@weddingpick/ui';
import { getSettings, updateSettings } from '@/api/client';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { NoteBox, Row, Rows, Section, SubScreen } from '@/features/settings/my-kit';

/** 시안 13-my-sub WP-MY-007 «알림 수신» 그룹과 같은 문구. */
const S = {
  title: '알림 설정',
  group: '알림 수신',
  service: '서비스 알림',
  serviceMeta: '일정 · Pick 변화 · 제보 결과',
  price: '가격 변동 알림',
  priceMeta: 'Pick한 곳의 제보 금액이 크게 바뀌면',
  noteTitle: '진행 중인 업종의 알림만 보내요',
  noteBody: '하루에 두 건까지 보내드려요. 배우자가 바꾼 것은 예외예요.',
  fail: '설정을 바꾸지 못했어요',
} as const;

/**
 * 알림 설정. 스위치를 누르면 바로 저장한다 — 토글은 상태 변경이지 제출이 아니다.
 *
 * 마케팅(혜택 · 이벤트) · 야간 수신 · 배우자 공유 알림은 Settings 계약에 없어 두지 않는다.
 * 계약이 나오면 행을 더한다. 알림 범위(진행 중 업종 · 하루 2건)는 SPEC §13.12.
 */
export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    void getSettings()
      .then((response) => {
        setLoadError(null);
        setSettings(response);
      })
      .catch((caught: Error) => setLoadError(caught.message ?? '알림 설정을 불러오지 못했어요'));
  }, []);

  useEffect(load, [load]);

  async function toggle(key: 'pushEnabled' | 'priceChangeEnabled', value: boolean) {
    if (!settings || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSettings({ ...settings, [key]: value });
    await updateSettings({ [key]: value })
      .then(setSettings)
      .catch(() => {
        setSettings(settings);
        setToast(S.fail);
      })
      .finally(() => {
        savingRef.current = false;
        setSaving(false);
      });
  }

  if (loadError) return <ErrorView message={loadError} onRetry={load} />;
  if (!settings) return <DelayedLoadingView />;

  const switchProps = {
    trackColor: { true: theme.tint, false: theme.track },
    thumbColor: theme.onTint,
    ios_backgroundColor: theme.track,
  };

  return (
    <SubScreen title={S.title} contentStyle={{ paddingTop: Layout.rowPaddingY }}>
      <Section title={S.group}>
        <Rows>
          <Row
            name={S.service}
            meta={S.serviceMeta}
            right={
              <Switch
                disabled={saving}
                value={settings.pushEnabled}
                onValueChange={(next) => void toggle('pushEnabled', next)}
                accessibilityLabel={S.service}
                {...switchProps}
              />
            }
          />
          <Row
            name={S.price}
            meta={S.priceMeta}
            right={
              <Switch
                disabled={saving}
                value={settings.priceChangeEnabled}
                onValueChange={(next) => void toggle('priceChangeEnabled', next)}
                accessibilityLabel={S.price}
                {...switchProps}
              />
            }
          />
        </Rows>
      </Section>

      <Section>
        <NoteBox title={S.noteTitle} body={S.noteBody} />
      </Section>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </SubScreen>
  );
}
