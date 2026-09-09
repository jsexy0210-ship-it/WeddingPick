import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Layout, TextField, Toast } from '@weddingpick/ui';
import { createInquiry } from '@/api/client';
import { CheckCircle } from '@/features/onboarding/check-circle';
import { Dock, Hero, NoteBox, Row, Rows, Section, SubScreen } from '@/features/settings/my-kit';

/** 시안 09b-vendor-sub #5 «정보 오류 제보 · WP-VEND-006»의 renderVals. */
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
  cta: '제보하기',
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
 * 정보 오류 제보 · WP-VEND-006. 시안 09b-vendor-sub #5 — 항목 라디오 5 → 올바른 정보 →
 * 근거 링크(선택) → note → CTA «제보하기».
 *
 * 업체 상세 ⑩ «정보가 틀렸나요? 제보하기»와 공식 정보(WP-VEND-005)가 여기로 온다. 그전에는
 * 범용 문의 화면(`/my/contact`)이 항목만 채워진 채 열려서, 무엇이 틀렸는지 사용자가 문장으로
 * 적어야 했다.
 *
 * 접수는 이미 있는 창구를 쓴다 — `POST /v1/inquiries`의 `data_correction`(업체 정보 정정)이고
 * `subject`로 이 업체를 가리킨다. 새 라우트도 새 표도 만들지 않았다.
 *
 * **시안의 «지금 정보 · 오전 10시~오후 8시»는 적지 않는다.** 영업시간 · 연락처 · 주소는
 * `vendorDetailSchema`에 없다(서버가 지역 · 마지막 확인일 · 출처만 준다). 없는 값을 «지금
 * 정보»라고 적을 수는 없으므로, 그 자리는 서버가 그 셋을 내려주기 시작하면 채운다.
 */
export default function FixReportScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();

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
        dock={<Dock primary={{ label: '확인', onPress: () => router.back() }} />}>
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
