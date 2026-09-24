import type { CurrentUser, Settings } from '@weddingpick/api-contract';
import { DISPLAY_NAME_HINT, MAX_DISPLAY_NAME_LENGTH, checkDisplayName } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';

import {
  ActionButton,
  Border,
  ErrorView,
  FontSize,
  Layout,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';
import { getCurrentUser, getSettings, setDisplayName, updateSettings } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import { useSession } from '@/features/auth/use-session';
import { BottomSheet, SHEET_PANEL } from '@/features/common/bottom-sheet';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { Avatar, Row, Rows, Section, SubScreen } from '@/features/settings/my-kit';

/** 정본 `docs/design/React_Native/my.jsx` 프로필 프레임 · WP-MY-002. */
const S = {
  title: '프로필',
  basic: '기본',
  name: '닉네임',
  nameEmpty: '정하기',
  notifications: '알림',
  service: '서비스 알림',
  serviceMeta: '일정 · Pick 변화 · 인증 결과',
  marketing: '마케팅 알림',
  marketingMeta: '혜택 · 이벤트',
  night: '야간 수신',
  nightMeta: '밤 9시 이후',
  notiNote: '진행 중인 업종에서만 보내고 하루 최대 2건이에요.',
  account: '계정',
  social: '카카오',
  connected: '연결됨',
  logout: '로그아웃',
  /* 메뉴 4글자는 붙여 쓴다(전체 공통 규칙) — WP-MY-012 navTitle과 같은 표기. */
  withdraw: '회원탈퇴',
  logoutTitle: '로그아웃할까요',
  logoutBody: '기기에 저장된 문서는 그대로 남아요',
  stay: '계속 이용하기',
  logoutFail: '로그아웃하지 못했어요',
  note: '배우자와 다른 사용자 모두에게 이 닉네임으로 보여요.',
  sheetTitle: '어떻게 불러드릴까요?',
  placeholder: '비워두면 이름 없이 인사해요',
  cancel: '취소',
  save: '저장',
  saving: '저장하는 중…',
  saveFail: '이름을 바꾸지 못했어요',
  saveDone: '닉네임을 바꿨어요',
  settingsFail: '알림 설정을 바꾸지 못했어요',
  settingsDone: '알림 설정을 바꿨어요',
} as const;

/**
 * 프로필 · WP-MY-002 · React_Native/my.jsx 프레임 2. MY 상단 프로필 카드를 누르면 들어온다.
 *
 * **MY의 설정 섹션을 흡수했다**(시안 「설정 섹션을 흡수해 이름 · 알림 · 계정을 한 화면에서
 * 다룹니다. 로그아웃과 탈퇴가 맨 아래입니다」).
 * 알림 설정은 시안대로 세 토글을 이 화면에서 바로 바꾼다. 서비스 알림은 서버의 전체 푸시와
 * 가격 변동 푸시를 함께 켜고 끈다 — 정본은 둘을 한 줄로 합쳤다.
 *
 * **이름 칸은 하나다**(v3.28 — 「이름 / 배우자에게 보이는 이름」 두 칸 → 「닉네임」 한 칸).
 * API의 displayName이 그 한 칸이고 배우자·후기·다른 사용자에게 모두 이 값으로 보인다.
 * 사진 바꾸기는 저장 계약이 없어 두지 않는다(v3.29 시안에도 있지만 업로드 계약이 아직 없다).
 *
 * **v3.29(대메뉴_MY.dc.html 2) 대조 — 미룬 것 셋.** 시안의 계정 섹션은 카카오 행에 마스킹
 * 이메일 · 「가입일」 · 「로그인 유지」 토글까지 5행인데 `currentUserSchema`에 이메일 · 가입일이
 * 없고 「로그인 유지」는 이 화면의 토글이 아니라 로그인 화면의 계정 기억 기능(WP-AUTH-008,
 * `features/auth/remembered-account.ts`)이다 — 값을 지어내지 않고 지금 세 행(카카오 연결 ·
 * 로그아웃 · 탈퇴)만 둔다. 알림 섹션도 시안은 「일정 알림 · Pick 변화 · 인증 결과 · 추천 갱신」
 * 네 개별 토글인데 서버 계약(`settingsSchema`)은 `pushEnabled`(+`priceChangeEnabled`) ·
 * `marketingEnabled` · `nightPushEnabled` 셋뿐이라 지금 묶음을 그대로 둔다. 헤더 우측 「저장」도
 * 안 그렸다 — 지금은 각 값이 바뀌는 즉시 저장돼 따로 모아 누를 저장이 없다. 셋 다 서버 계약을
 * 넓히는 결정이 필요해 대표님·MASTER 판단 전까지 보류한다.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const { signOut } = useSession();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const savingSettings = useRef(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const loadSettings = useCallback(() => {
    setSettingsError(null);
    void getSettings()
      .then(setSettings)
      .catch((caught: Error) => {
        setSettings(null);
        setSettingsError(caught.message ?? '알림 설정을 불러오지 못했어요');
      });
  }, []);

  const load = useCallback(() => {
    setLoadError(null);
    void getCurrentUser()
      .then(setMe)
      .catch((caught: Error) => setLoadError(caught.message ?? '프로필을 불러오지 못했어요'));
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    let active = true;

    // Effect 본문과 같은 tick에서 상태를 바꾸지 않되 테스트·화면에는 불필요한 timer를 남기지 않는다.
    void Promise.resolve().then(() => {
      if (active) load();
    });

    return () => {
      active = false;
    };
  }, [load]);

  const nameCheck = checkDisplayName(nameDraft);
  /* 비우는 것도 허용한다. 한 번 적었다고 영영 못 지우게 할 이유가 없다. */
  const nameReady = nameDraft.trim() === '' || nameCheck.ok;

  async function saveName() {
    if (!nameReady || !me || saving) return;
    setSaving(true);
    const previous = me;
    const next = nameDraft.trim() === '' ? null : nameDraft.trim();
    setMe({ ...me, displayName: next });
    setNameOpen(false);
    try {
      const saved = await setDisplayName(next);
      setMe((current) => current === null ? current : { ...current, displayName: saved.displayName });
      setToast(S.saveDone);
    } catch {
      setMe((current) => current === null ? current : { ...current, displayName: previous.displayName });
      setToast(S.saveFail);
    } finally {
      setSaving(false);
    }
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

  async function toggleSetting(
    key: 'service' | 'marketingEnabled' | 'nightPushEnabled',
    value: boolean
  ) {
    if (!settings || savingSettings.current) return;
    savingSettings.current = true;
    setSettingsSaving(true);
    const previous = settings;
    const patch = key === 'service'
      ? { pushEnabled: value, priceChangeEnabled: value }
      : { [key]: value };
    setSettings({ ...settings, ...patch });
    await updateSettings(patch)
      .then((saved) => {
        setSettings(saved);
        setToast(S.settingsDone);
      })
      .catch(() => {
        setSettings(previous);
        setToast(S.settingsFail);
      })
      .finally(() => {
        savingSettings.current = false;
        setSettingsSaving(false);
      });
  }

  if (loadError && !me) return <ErrorView message={loadError} onRetry={load} />;
  if (!me) return <DelayedLoadingView />;

  const switchProps = {
    trackColor: { true: theme.tint, false: theme.track },
    thumbColor: theme.onTint,
    ios_backgroundColor: theme.track,
  };

  return (
    <SubScreen title={S.title}>
      {/* 아바타 88 — 시안 avatarBig. */}
      <View style={styles.avatarWrap}>
        <Avatar initial={me.displayName?.slice(0, 1) ?? '나'} size={Layout.avatarLarge} />
      </View>

      <Section title={S.basic}>
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.track }]}>
          <Rows>
            {/* v3.28 — 「이름 / 배우자에게 보이는 이름」 두 칸을 «닉네임» 한 칸으로 합쳤다. */}
            <Row
              name={S.name}
              tail={me.displayName ?? S.nameEmpty}
              tailDim={!me.displayName}
              chevron
              onPress={() => {
                setNameDraft(me.displayName ?? '');
                setNameOpen(true);
              }}
              inset
            />
          </Rows>
        </View>
        <ThemedText type="t7" themeColor="textAssistive" style={styles.nameNote}>
          {S.note}
        </ThemedText>
      </Section>

      <Section title={S.notifications}>
        {settings ? (
          <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.track }]}>
            <Rows>
              <Row
                name={S.service}
                meta={S.serviceMeta}
                right={
                  <Switch
                    disabled={settingsSaving}
                    value={settings.pushEnabled}
                    onValueChange={(next) => void toggleSetting('service', next)}
                    accessibilityLabel={S.service}
                    {...switchProps}
                  />
                }
                inset
              />
              <Row
                name={S.marketing}
                meta={S.marketingMeta}
                right={
                  <Switch
                    disabled={settingsSaving}
                    value={settings.marketingEnabled}
                    onValueChange={(next) => void toggleSetting('marketingEnabled', next)}
                    accessibilityLabel={S.marketing}
                    {...switchProps}
                  />
                }
                inset
              />
              <Row
                name={S.night}
                meta={S.nightMeta}
                right={
                  <Switch
                    disabled={settingsSaving}
                    value={settings.nightPushEnabled}
                    onValueChange={(next) => void toggleSetting('nightPushEnabled', next)}
                    accessibilityLabel={S.night}
                    {...switchProps}
                  />
                }
                inset
              />
            </Rows>
          </View>
        ) : (
          <View style={[styles.settingsFallback, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="t7" themeColor="textAssistive">
              {settingsError ?? '알림 설정을 불러오는 중이에요'}
            </ThemedText>
            {settingsError ? (
              <ActionButton label="다시 불러오기" onPress={loadSettings} />
            ) : null}
          </View>
        )}
        <ThemedText type="t7" themeColor="textAssistive" style={styles.nameNote}>
          {S.notiNote}
        </ThemedText>
      </Section>

      {/* 시안 「계정」 — 로그인 연결 · 로그아웃 · 회원 탈퇴만 둔다. Pick 인증은 MY 별도 메뉴다. */}
      <Section title={S.account}>
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.track }]}>
          <Rows>
            <Row name={S.social} tail={S.connected} tailBadge="ok" inset />
            <Row name={S.logout} chevron onPress={confirmSignOut} inset />
            <Row name={S.withdraw} off chevron onPress={() => router.push('/my/withdrawal' as never)} inset />
          </Rows>
        </View>
      </Section>

      <BottomSheet dismissible={false} visible={nameOpen} onRequestClose={() => setNameOpen(false)}>
        <ThemedView style={[SHEET_PANEL, styles.sheet]}>
          <ThemedText type="t3">{S.sheetTitle}</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
            value={nameDraft}
            onChangeText={setNameDraft}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            placeholder={S.placeholder}
            placeholderTextColor={theme.textAssistive}
            accessibilityLabel={S.name}
          />
          <ThemedText type="t7" themeColor={nameReady ? 'textAssistive' : 'negative'}>
            {nameReady ? DISPLAY_NAME_HINT : nameCheck.ok ? DISPLAY_NAME_HINT : nameCheck.reason}
          </ThemedText>
          <View style={styles.sheetActions}>
            <View style={styles.sheetGhost}>
              <ActionButton size="xlarge" label={S.cancel} onPress={() => setNameOpen(false)} />
            </View>
            <View style={styles.sheetPrimary}>
              <ActionButton
                variant="primary"
                size="xlarge"
                label={saving ? S.saving : S.save}
                disabled={!nameReady || saving}
                onPress={() => void saveName()}
              />
            </View>
          </View>
        </ThemedView>
      </BottomSheet>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  /* 시안 profile: padding 20 24 28 · 가운데 */
  avatarWrap: {
    alignItems: 'center',
    paddingTop: Layout.cardPadding,
    paddingBottom: Layout.sectionGap,
  },
  card: {
    borderWidth: Border.hairline,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  settingsFallback: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Spacing.two,
  },
  nameNote: { marginTop: Spacing.two },
  sheet: { padding: Layout.gutter, paddingBottom: Layout.sectionGap, gap: Spacing.three },
  input: {
    height: Layout.field,
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: Layout.fieldPaddingX,
    fontSize: FontSize.t6,
  },
  sheetActions: { flexDirection: 'row', gap: Spacing.two },
  sheetGhost: { flex: 1 },
  sheetPrimary: { flex: 1.4 },
});
