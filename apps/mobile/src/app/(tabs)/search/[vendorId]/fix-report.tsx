import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Layout, TextField, Toast } from '@weddingpick/ui';
import { createInquiry } from '@/api/client';
import { CheckCircle } from '@/features/onboarding/check-circle';
import { useDepthBack } from '@/features/navigation/depth-back';
import { Dock, Hero, NoteBox, Row, Rows, Section, SubScreen } from '@/features/settings/my-kit';

/**
 * v3.29 대메뉴_검색.dc.html WP-VEND-008 「정보 오류 제보」의 renderVals(2026-09-23
 * 재검증 — 이전 주석은 v3.28 이전 번호인 WP-VEND-006을 적고 있었다. v3.29는 화면
 * 1~17을 다시 매겼고 WP-VEND-006은 지금 「이미지 전체보기」다).
 */
const S = {
  title: '정보 오류 제보',
  hero: ['어떤 정보가', '틀렸나요?'],
  itemGroup: '항목',
  correct: '올바른 정보',
  correctPlaceholder: '아는 대로 적어주세요',
  evidence: '근거 링크',
  evidencePlaceholder: '선택이에요',
  evidenceInvalid: '주소 전체를 적어주세요 · https://로 시작해요',
  noteTitle: '확인하고 알려드려요',
  /*
   * 시안은 «보통 하루 안에 확인하고»라고 적지만 처리 기한이 아직 정해지지 않았다
   * (domain `INQUIRY_RESPONSE_BUSINESS_DAYS`가 null이다). 지키지 못할 기한을 적지 않는다.
   */
  noteBody: '사람이 직접 확인하고 결과를 알림으로 보내드려요.',
  /* WP-VEND-008 `ctaFull2` — 「제출하기」. 2026-09-23 재검증에서 잡은 값(전에는 「제보하기」). */
  cta: '제출하기',
  sending: '보내는 중…',
  failed: '보내지 못했어요',
} as const;

/**
 * 무엇이 틀렸는지. 시안의 라디오 다섯 줄 그대로다.
 *
 * `needsValue`가 true인 셋은 올바른 값을 받아야 고칠 수 있고, 나머지 둘은 상태를 알리는
 * 제보라 값이 없다 — «영업 종료했어요»에 올바른 영업시간을 물으면 말이 되지 않는다.
 */
const ITEMS = [
  { key: 'hours', label: '영업시간', needsValue: true },
  { key: 'contact', label: '연락처', needsValue: true },
  { key: 'address', label: '주소', needsValue: true },
  { key: 'closed', label: '영업 종료했어요', needsValue: false },
  { key: 'mixed', label: '다른 업체와 섞여 있어요', needsValue: false },
] as const;

type ItemKey = (typeof ITEMS)[number]['key'];

/**
 * 정보 오류 제보 · WP-VEND-008(v3.29 대메뉴_검색.dc.html — 2026-09-23 재검증에서
 * 옛 번호 WP-VEND-006 표기를 바로잡았다). 시안 항목 라디오 4 → 올바른 정보 → 근거
 * 링크(선택) → CTA «제출하기». 이 화면의 항목 목록(5개 · «영업 종료했어요» ·
 * «다른 업체와 섞여 있어요» 포함)과 note 상자는 정본의 4항목(가격·요금 정보 ·
 * 영업시간·연락처 · 주소·위치 · 영업 종료·폐업)과 다르다 — `data_correction` 접수
 * 분류가 이 항목 이름에 걸려 있어 이번 재검증에서는 문구·CTA만 맞추고 항목 구성은
 * `DESIGN_UNRESOLVED`로 남긴다(PR 본문 참고).
 *
 * 업체 상세 ⑩ «정보가 틀렸나요? 제보하기»와 공식 정보(WP-VEND-005)가 여기로 온다. 그전에는
 * 범용 문의 화면(`/my/contact`)이 항목만 채워진 채 열려서, 무엇이 틀렸는지 사용자가 문장으로
 * 적어야 했다.
 *
 * 접수는 이미 있는 창구를 쓴다 — `POST /v1/inquiries`의 `data_correction`(업체 정보 정정)이고
 * `subject`로 이 업체를 가리킨다. 새 라우트도 새 표도 만들지 않았다.
 *
 * **시안의 «지금 정보 · 오전 10시~오후 8시»는 적지 않는다.** 주소는 이제 상세가 내려주지만,
 * 영업시간 · 연락처는 `vendorDetailSchema`에 없다. 없는 값을 «지금 정보»라고 적을 수는 없으므로,
 * 그 자리는 서버가 실제 영업시간·연락처를 내려주기 시작하면 채운다.
 */
export default function FixReportScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const depthBack = useDepthBack();

  const [item, setItem] = useState<ItemKey | null>(null);
  const [value, setValue] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const chosen = ITEMS.find((one) => one.key === item) ?? null;
  const evidenceUrl = evidence.trim();
  const evidenceBad = evidenceUrl.length > 0 && !/^https?:\/\/\S+$/.test(evidenceUrl);
  const ready =
    chosen !== null && !evidenceBad && (!chosen.needsValue || value.trim().length > 0);

  async function submit() {
    if (!ready || busy || chosen === null) return;

    setBusy(true);
    try {
      /* 무엇이 틀렸는지 · 무엇이 맞는지를 한 줄씩. 접수한 사람이 그대로 읽는다. */
      const body = [chosen.label, value.trim() ? `${S.correct}: ${value.trim()}` : null]
        .filter((line): line is string => line !== null)
        .join('\n');

      const received = await createInquiry({
        category: 'data_correction',
        body,
        subject: { kind: 'vendor', id: vendorId },
        ...(evidenceUrl.length > 0 && { evidenceUrl }),
      });

      setDone(received.acknowledgement);
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : S.failed);
    } finally {
      setBusy(false);
    }
  }

  /* 접수 완료(states «제출 완료»). 접수 문구는 서버가 만든 것을 그대로 보여준다. */
  if (done !== null) {
    return (
      <SubScreen
        title={S.title}
        dock={<Dock primary={{ label: '확인', onPress: depthBack }} />}>
        <Hero lines={['제보를 받았어요', '확인하고 알려드릴게요']} />
        <Section>
          <NoteBox title={done} />
        </Section>
      </SubScreen>
    );
  }

  return (
    <SubScreen
      title={S.title}
      dock={
        <Dock
          primary={{
            label: busy ? S.sending : S.cta,
            disabled: !ready || busy,
            onPress: () => void submit(),
          }}
        />
      }>
      <Hero lines={S.hero} />

      <Section title={S.itemGroup}>
        <Rows>
          {ITEMS.map((one) => (
            <Row
              key={one.key}
              lead={<CheckCircle size={Layout.iconRow} checked={item === one.key} outline />}
              name={one.label}
              onPress={() => setItem(one.key)}
              accessibilityLabel={one.label}
            />
          ))}
        </Rows>
      </Section>

      <Section>
        <TextField
          label={S.correct}
          value={value}
          onChangeText={setValue}
          placeholder={S.correctPlaceholder}
          editable={chosen === null || chosen.needsValue}
        />
        <TextField
          label={S.evidence}
          value={evidence}
          onChangeText={setEvidence}
          placeholder={S.evidencePlaceholder}
          autoCapitalize="none"
          keyboardType="url"
          error={evidenceBad ? S.evidenceInvalid : undefined}
        />
      </Section>

      <Section>
        <NoteBox title={S.noteTitle} body={S.noteBody} />
      </Section>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </SubScreen>
  );
}
