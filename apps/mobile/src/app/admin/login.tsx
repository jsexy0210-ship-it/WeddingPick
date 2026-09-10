/**
 * 관리자 로그인 (21-admin.dc.html `isLogin`)
 *
 * 왼쪽 520 흰 판에 입력, 오른쪽 어두운 판에 오늘의 처리 현황. 시안 그대로다.
 *
 * **신뢰기기 체크박스는 그리지 않는다**(2026-09-10 사용자 보류 — 사무실 PC에서
 * 쓰는 중이고 자택 환경에서 이어 정하기로 했다). 눌러도 아무 일도 하지 않는 조작을
 * 두면 관리자는 유지된다고 믿고 자리를 뜬다. 신뢰기기를 만들 때 시안대로 되살린다.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { API_URL } from '@/api/config';
import { Colors, FontSize, LineHeight } from '@weddingpick/ui';

import { saveAdminToken } from './_session';


/**
 * Pick Mark — `spec/tokens.json`의 `symbol`. **절대 변경 금지.**
 *
 * `react-native-svg`로 그린다. 저장소의 다른 화면이 전부 그렇게 하고 있다.
 * 처음에는 `dangerouslySetInnerHTML`로 원본 SVG를 밀어 넣었는데, 이 저장소에
 * 전례가 없는 방식이고 react-native-web이 View의 알 수 없는 속성을 걸러낼 수 있어
 * 마크가 아예 안 그려질 수 있었다.
 */
function PickMark() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z"
        stroke={Colors.light.tint}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.4 11.9l1.7 1.7 3.4-3.4"
        stroke={Colors.light.tint}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function AdminLoginScreen() {
  const router = useRouter();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    if (!id.trim()) {
      setError('아이디를 입력해주세요');

      return;
    }
    if (!password) {
      setError('비밀번호를 입력해주세요');

      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/v1/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id.trim(), password }),
      });
      const body = (await response.json().catch(() => null)) as
        | { token?: string; error?: { message?: string } }
        | null;

      if (!response.ok || !body?.token) {
        /* 서버가 준 말을 그대로 쓴다 — 권한이 없을 때 무엇을 해야 하는지 적혀 있다. */
        setError(body?.error?.message ?? '아이디 또는 비밀번호가 맞지 않아요');

        return;
      }

      await saveAdminToken(body.token);

      /*
       * **전체 새로고침으로 들어간다.** `router.replace`로 옮기면 로그인 화면에서
       * 그대로 튕겨 돌아온다 — `_layout`이 토큰을 마운트할 때 한 번만 읽는데, 그
       * 레이아웃은 로그인 화면까지 감싸고 있어서 이 시점에는 이미 「토큰 없음」으로
       * 굳어 있다. 방금 저장한 토큰을 레이아웃은 모른 채 로그인으로 되돌린다.
       *
       * 로그아웃이 이미 같은 길을 쓴다. 콘솔은 웹 전용이라 이 길로 충분하다.
       */
      if (typeof window !== 'undefined') {
        window.location.assign('/admin/queue');

        return;
      }

      router.replace('/admin/queue' as never);
    } catch {
      setError('서버에 닿지 못했어요. 잠시 뒤 다시 시도해주세요');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.panel}>
        <View style={styles.brand}>
          <PickMark />
          <Text style={styles.brandText}>웨딩픽 관리자</Text>
        </View>

        <Text style={styles.title}>운영 콘솔에{'\n'}로그인해주세요</Text>
        <Text style={styles.lead}>심사 결정과 원본 열람은 모두 기록돼요.</Text>

        <View style={styles.fields}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>아이디</Text>
            <TextInput
              style={styles.input}
              value={id}
              onChangeText={(next) => {
                setId(next);
                setError(null);
              }}
              placeholder="아이디"
              placeholderTextColor={Colors.light.textDisabled}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={submit}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>비밀번호</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={(next) => {
                setPassword(next);
                setError(null);
              }}
              placeholder="비밀번호"
              placeholderTextColor={Colors.light.textDisabled}
              secureTextEntry
              onSubmitEditing={submit}
            />
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable style={styles.cta} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={Colors.light.background} /> : <Text style={styles.ctaText}>로그인</Text>}
        </Pressable>

        <View style={styles.note}>
          <Text style={styles.noteTitle}>다시 로그인이 필요한 경우</Text>
          <Text style={styles.noteBody}>
            직접 로그아웃 · 비밀번호나 권한 변경 · 세션 만료.
          </Text>
        </View>

        <Text style={styles.foot}>비밀번호를 잊었다면 운영 리드에게 문의해주세요.</Text>
      </View>

      <View style={styles.side}>
        <Text style={styles.sideLabel}>운영 콘솔</Text>
        <Text style={styles.sideTitle}>심사와 원본 열람은{'\n'}모두 기록돼요</Text>
        <Text style={styles.sideBody}>
          전 메뉴를 자동 검토해요. 리스크가 큰 건만 보류로 올라와요.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.light.background,
    minHeight: '100vh' as unknown as number,
  },
  /* 520 · 좌우 72 — 시안값. */
  panel: { width: 520, flexShrink: 0, justifyContent: 'center', paddingHorizontal: 72 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 34 },
  brandText: { fontSize: FontSize.t6, fontWeight: '700', color: Colors.light.text },
  title: {
    fontSize: FontSize.t2,
    lineHeight: LineHeight.t2,
    fontWeight: '700',
    color: Colors.light.text,
    paddingBottom: 10,
  },
  lead: {
    fontSize: FontSize.t7,
    lineHeight: LineHeight.t7,
    color: Colors.light.textSecondary,
    paddingBottom: 30,
  },
  fields: { gap: 10 },
  field: { gap: 6 },
  fieldLabel: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FontSize.t7,
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  errorBox: {
    backgroundColor: Colors.light.negativeBackground,
    borderRadius: 10,
    padding: 13,
    marginTop: 12,
  },
  errorText: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, fontWeight: '700', color: Colors.light.negative },
  cta: {
    marginTop: 18,
    height: 52,
    borderRadius: 10,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: FontSize.t6, fontWeight: '700', color: Colors.light.background },
  note: { marginTop: 22, padding: 15, borderRadius: 10, backgroundColor: Colors.light.backgroundElement, gap: 6 },
  noteTitle: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textSecondary },
  noteBody: { fontSize: FontSize.tab, lineHeight: LineHeight.t7, color: Colors.light.textAssistive },
  foot: {
    fontSize: FontSize.tab,
    lineHeight: LineHeight.t7,
    color: Colors.light.textAssistive,
    paddingTop: 18,
  },
  side: {
    flex: 1,
    minWidth: 0,
    backgroundColor: Colors.light.adminChrome,
    justifyContent: 'center',
    paddingHorizontal: 72,
    gap: 26,
  },
  sideLabel: {
    fontSize: FontSize.t7,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: Colors.light.textSecondary,
  },
  sideTitle: {
    fontSize: FontSize.t3,
    lineHeight: LineHeight.t3,
    fontWeight: '700',
    color: Colors.light.background,
  },
  sideBody: { fontSize: FontSize.tab, lineHeight: LineHeight.t7, color: Colors.light.textStrong },
});
