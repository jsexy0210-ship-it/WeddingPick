import type { Settings } from '@weddingpick/api-contract';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Switch } from 'react-native';

import { ErrorView, Layout, Toast, useTheme } from '@weddingpick/ui';
import { getSettings, updateSettings } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import { useSession } from '@/features/auth/use-session';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { Row, Rows, Section, SubScreen } from '@/features/settings/my-kit';

/** 시안 13-my-sub WP-MY-007. */
const S = {
  title: '계정',
  login: '로그인',
  loginMethod: '소셜 로그인',
  primary: '주 계정',
  notify: '알림 수신',
  service: '서비스 알림',
  serviceMeta: '일정 · Pick 변화 · 제보 결과',
  price: '가격 변동 알림',
  priceMeta: 'Pick한 곳의 제보 금액이 크게 바뀌면',
  logout: '로그아웃',
  withdraw: '회원탈퇴',
  logoutTitle: '로그아웃할까요',
  logoutBody: '기기에 저장된 문서는 그대로 남아요',
  stay: '그만두기',
  toggleFail: '설정을 바꾸지 못했어요',
  logoutFail: '로그아웃하지 못했어요',
} as const;

/**
 * 계정 · WP-MY-007. 로그인 수단과 알림 수신을 여기서 관리한다.
 * 탈퇴는 맨 아래 회색으로 두고 강조하지 않는다(screens.json rule).
 *
 * **로그인 제공자는 `/v1/me`가 내려주지 않는다.** 시안은 카카오 · 네이버 · 구글 · 애플 4행이지만
 * 계약이 없어 «소셜 로그인 · 주 계정» 한 줄만 둔다 — 다른 제공자 «연결하기»도 API가 없다.
 * 마케팅 · 야간 수신 스위치도 계약에 없어 두지 않는다 — 저장되지 않는 스위치는 거짓말이다.
 */
export default function AccountScreen() {
  const theme = useTheme();
  const { signOut } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const savingRef = useRef(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    void getSettings()
      .then((response) => {
        setLoadError(null);
        setSettings(response);
      })
      .catch((caught: Error) => setLoadError(caught.message ?? '계정 정보를 불러오지 못했어요'));
  }, []);

  useEffect(load, [load]);

  async function toggle(key: 'pushEnabled' | 'priceChangeEnabled', value: boolean) {
    if (!settings || savingRef.current) return;
    savingRef.current = true;
    setSavingSettings(true);
    /* 먼저 화면을 바꾼다. 서버를 기다리면 스위치가 늦게 따라와 두 번 누르게 된다. */
    setSettings({ ...settings, [key]: value });
    await updateSettings({ [key]: value })
      .then(setSettings)
      .catch(() => {
        setSettings(settings);
        setToast(S.toggleFail);
      })
      .finally(() => {
        savingRef.current = false;
        setSavingSettings(false);
      });
  }

  function confirmSignOut() {
    confirmAlert(S.logoutTitle, S.logoutBody, [
      { text: S.stay, style: 'cancel' },
      {
        text: S.logout,
        style: 'destructive',
        onPress: () => {
          void signOut()
            .then(() => router.replace('/login'))
            .catch(() => setToast(S.logoutFail));
        },
      },
    ]);
  }

  if (loadError) return <ErrorView message={loadError} onRetry={load} />;
  if (!settings) return <DelayedLoadingView />;

  const switchProps = {
    trackColor: { true: theme.tint, false: theme.track },
    thumbColor: theme.onTint,
    ios_backgroundColor: theme.track,
  };

  return (
    <SubScreen title={S.title} contentStyle={{ paddingTop: TOP }}>
      <Section title={S.login}>
        <Rows>
          <Row name={S.loginMethod} tail={S.primary} tailBadge="brand" />
        </Rows>
      </Section>

      <Section title={S.notify}>
        <Rows>
          <Row
            name={S.service}
            meta={S.serviceMeta}
            right={
              <Switch
                disabled={savingSettings}
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
                disabled={savingSettings}
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
        <Rows>
          <Row name={S.logout} chevron onPress={confirmSignOut} />
          <Row name={S.withdraw} off chevron onPress={() => router.push('/my/withdrawal' as never)} />
        </Rows>
      </Section>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </SubScreen>
  );
}

/* 히어로 없는 화면 — 첫 섹션이 nav 아래 12에서 시작한다(padHero의 위 여백). */
const TOP = Layout.rowPaddingY;
