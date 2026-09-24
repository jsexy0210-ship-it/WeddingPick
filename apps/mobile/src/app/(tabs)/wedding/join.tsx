import type { InvitePreviewResponse } from '@weddingpick/api-contract';
import { TERMS, formatDateDot, inviteCodeFromLink } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { acceptWeddingInvite, previewWeddingInvite } from '@/api/client';
import { useDepthBack } from '@/features/navigation/depth-back';
import { ActionButton, Border, Layout, Radius, Spacing, ThemedText, WeddingMark, useTheme } from '@weddingpick/ui';
import { Avatar, Dock, Field, Hero, NavBar, NoteCard, Screen } from '@/features/wedding/screen-kit';

/**
 * `spec/strings.ko.json` `couple.*` · 정본 `docs/design/html/대메뉴_MY.dc.html`
 * WP-CPL-002(초대 수락) · WP-CPL-003(연결 완료).
 */
const S = {
  nav: '초대 받음',
  codeTitle: '초대 코드를 넣어주세요',
  codeSub: '배우자에게 받은 코드나 링크를 그대로 붙여도 돼요',
  codeField: '초대 코드',
  check: '확인하기',
  /* WP-CPL-002 avatarSec — 초대자 이름 · 예식일은 서버가 안 준다(개인정보). 아래 참고. */
  acceptTitle: '함께 준비하자고 해요',
  previewNav: '초대',
  sharedLabel: '수락하면 같이 봐요',
  noteTitle: '내가 담은 Pick은 그대로예요',
  noteBody: '두 사람의 Pick이 합쳐지지 않아요. 각자 담고 비교는 같이 봐요.',
  later: '나중에',
  accept: '수락하기',
  /* WP-CPL-003 */
  doneTitle: '함께 준비해요',
  doneRows: [
    { label: TERMS.ourWedding, sub: '일정 · 지출을 같이 봐요' },
    { label: 'Pick', sub: '각자 담고 비교는 같이 봐요' },
    { label: '알림', sub: '상대가 바뀌면 알려드려요' },
  ],
  reflectedLabel: '이렇게 반영됐어요',
  goWedding: '웨딩노트로 가기',
} as const;

/** 체크 링 72 — WP-CPL-003 doneMark. Pick Mark(하트+체크)를 코랄 배경 위 흰색으로 그린다. */
const RING = 72;

/**
 * 초대 수락 → 연결 완료. WP-CPL-002 · WP-CPL-003.
 *
 * **받아들이기 전에 무엇에 동의하는지 먼저 보여준다** — 동의는 무엇에 동의하는지 알 때만
 * 동의다. 링크로 들어와도(weddingpick://join?code=…) 코드만 채우고 자동으로 연결하지는 않는다.
 *
 * DESIGN_UNRESOLVED — WP-CPL-002의 `inviteSub`(예식일 · 지역)와 WP-CPL-003의 `doneSub` ·
 * `coupleCard`는 초대한 사람의 실명을 전제로 한 예시 문구다. `InvitePreviewResponse`는
 * 개인정보 보호를 위해 초대자 이름 · 예식일을 내려주지 않아(코드 내 기존 주석) 정본 문구를
 * 문자 그대로 쓸 수 없다. 이름 자리는 `TERMS.spouse`(배우자)로 대신하고, 실명 표시가
 * 필요하면 서버 계약을 먼저 넓혀야 한다.
 */
export default function JoinScreen() {
  const depthBack = useDepthBack();
  const theme = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  const [typed, setTyped] = useState<string | null>(null);
  const code = typed ?? params.code?.trim() ?? '';
  const [preview, setPreview] = useState<InvitePreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  async function check() {
    if (busy || code.trim().length === 0) return;
    setBusy(true);
    setError(null);

    try {
      setPreview(await previewWeddingInvite(code.trim()));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      await acceptWeddingInvite(code.trim());
      setJoined(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /* ---------------------------------------------------------- 연결 완료 · WP-CPL-003(back 없음 — 완료 화면) */
  if (joined) {
    const today = formatDateDot(new Date());
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.doneHero}>
            <View style={[styles.ring, { backgroundColor: theme.tint }]}>
              <WeddingMark size={40} color={theme.onTint} />
            </View>
            <View style={styles.doneText}>
              <ThemedText type="t2">{S.doneTitle}</ThemedText>
              <ThemedText type="t7" themeColor="textAssistive">
                {`${TERMS.spouse}님과 연결됐어요`}
              </ThemedText>
            </View>
          </View>

          <View style={styles.sec}>
            <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
              {S.reflectedLabel}
            </ThemedText>
            <View style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.background }]}>
              {S.doneRows.map((row, index) => (
                <View
                  key={row.label}
                  style={[
                    styles.infoRow,
                    index < S.doneRows.length - 1 && { borderBottomWidth: Border.hairline, borderBottomColor: theme.border },
                  ]}>
                  <ThemedText type="f15">{row.label}</ThemedText>
                  <ThemedText type="f12" themeColor="textAssistive">
                    {row.sub}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sec}>
            <View style={[styles.coupleCard, { backgroundColor: theme.tintSubtle }]}>
              <View style={styles.coupleAvatars}>
                <Avatar initial="나" tone="me" size={44} />
                <View style={styles.avatarOverlap}>
                  <Avatar initial={TERMS.spouse.slice(0, 1)} tone="partner" size={44} />
                </View>
              </View>
              <View style={styles.coupleCol}>
                <ThemedText type="f16" style={styles.bold}>
                  {`나 · ${TERMS.spouse}`}
                </ThemedText>
                <ThemedText type="f13" themeColor="textAssistive" numeric>
                  {`연결 ${today}`}
                </ThemedText>
              </View>
            </View>
          </View>
        </ScrollView>
        <Dock>
          <ActionButton variant="primary" size="sheet" label={S.goWedding} onPress={() => router.replace('/wedding' as never)} />
        </Dock>
      </Screen>
    );
  }

  const usable = preview?.usable === true ? preview : null;

  /* ---------------------------------------------------------- 초대 수락 · WP-CPL-002(back 없음 — navPad만) */
  if (usable) {
    return (
      <Screen>
        <View style={[styles.plainHeader]}>
          <View style={styles.navPad} />
          <ThemedText type="t6" style={[styles.bold, styles.center]}>
            {S.previewNav}
          </ThemedText>
          <View style={styles.navPad} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.avatarSec}>
            <View style={[styles.avatarBig, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="f32" themeColor="textDisabled" style={styles.bold}>
                ?
              </ThemedText>
            </View>
            <ThemedText type="t3" style={styles.textCenter}>
              {S.acceptTitle}
            </ThemedText>
          </View>

          <View style={styles.sec}>
            <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
              {S.sharedLabel}
            </ThemedText>
            <View style={[styles.listCard, { borderColor: theme.border, backgroundColor: theme.background }]}>
              {usable.shared.map((item, index) => (
                <View
                  key={item}
                  style={[
                    styles.scopeRow,
                    index < usable.shared.length - 1 && { borderBottomWidth: Border.hairline, borderBottomColor: theme.border },
                  ]}>
                  <View style={[styles.scopeDot, { backgroundColor: theme.tint }]} />
                  <ThemedText type="f15" numberOfLines={1} style={styles.scopeLabel}>
                    {item}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sec}>
            <NoteCard title={S.noteTitle} body={S.noteBody} />
          </View>

          {error ? (
            <ThemedText type="t7" themeColor="negative" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <Dock>
          <View style={styles.dockGhost}>
            <ActionButton variant="ghost" size="sheet" label={S.later} onPress={depthBack} />
          </View>
          <View style={styles.dockPrimary}>
            <ActionButton
              variant="primary"
              size="sheet"
              label={busy ? '연결 중…' : S.accept}
              disabled={busy}
              onPress={() => void join()}
            />
          </View>
        </Dock>
      </Screen>
    );
  }

  /* ---------------------------------------------------------- 코드 입력(정본에 없는 진입 보조 화면 — 링크 없이 들어왔을 때) */
  return (
    <Screen>
      <NavBar title={S.nav} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Hero title={S.codeTitle} sub={S.codeSub} />
        <View style={styles.fields}>
          <Field
            label={S.codeField}
            value={code}
            onChangeText={(text) => {
              // 링크를 통째로 붙여넣는 사람이 많다. 코드가 아니라고 되돌려주는 대신 코드를 꺼내 쓴다.
              setTyped(inviteCodeFromLink(text.trim()) ?? text);
              setPreview(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="WPK-0000"
            hint={preview && !preview.usable ? preview.message : null}
            hintColor="negative"
          />
        </View>

        {error ? (
          <ThemedText type="t7" themeColor="negative" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>

      <Dock>
        <ActionButton
          variant="primary"
          size="sheet"
          label={busy ? '확인 중…' : S.check}
          disabled={busy || code.trim().length === 0}
          onPress={() => void check()}
        />
      </Dock>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.four },
  fields: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four },
  error: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.three },

  /* 정본 navBar(56) — WP-CPL-002는 좌우 모두 navPad(36)뿐, back·close가 없다. */
  plainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Layout.navBar,
    paddingHorizontal: Layout.navPaddingRight,
    gap: Layout.navGap,
  },
  navPad: { width: 36, height: 36 },
  center: { flex: 1, textAlign: 'center' },
  textCenter: { textAlign: 'center' },
  bold: { fontWeight: 700 },

  /* avatarSec — 바깥 좌우 24px · gap 12 · 아바타 88. */
  avatarSec: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    alignItems: 'center',
    gap: Layout.rowPaddingY,
  },
  avatarBig: { width: 88, height: 88, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  sec: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four, gap: Layout.rowPaddingY },

  listCard: { borderRadius: Radius.medium, borderWidth: Border.hairline, overflow: 'hidden' },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: Layout.rowPaddingY, minHeight: 52, paddingHorizontal: Layout.rowPaddingY + 4 },
  scopeDot: { width: 5, height: 5, borderRadius: Radius.pill },
  scopeLabel: { flex: 1, minWidth: 0 },
  infoRow: { justifyContent: 'center', gap: 3, minHeight: 64, paddingHorizontal: Layout.rowPaddingY + 4 },

  /* WP-CPL-003 doneHero — 바깥 좌우 24px · gap 14. */
  doneHero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.tabBar - 12,
    paddingBottom: Spacing.four + Spacing.one,
    gap: Layout.sectionHeadGap,
    alignItems: 'center',
  },
  ring: { width: RING, height: RING, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  doneText: { gap: Spacing.two, alignItems: 'center' },

  /* coupleCard — radius 10 · padding 18 · gap 14. */
  coupleCard: { borderRadius: Radius.medium, padding: Spacing.three + Spacing.half, flexDirection: 'row', alignItems: 'center', gap: Layout.sectionHeadGap },
  coupleAvatars: { flexDirection: 'row', alignItems: 'center' },
  avatarOverlap: { marginLeft: -12 },
  coupleCol: { flex: 1, minWidth: 0, gap: Spacing.one },

  dockGhost: { flex: 1 },
  dockPrimary: { flex: 1.4 },
});
