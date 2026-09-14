import { POLICY_DOCUMENTS } from '@weddingpick/domain';
import { router } from 'expo-router';

import { Layout } from '@weddingpick/ui';
import { openExternal } from '@/features/open-external';
import { NoteBox, Row, Rows, Section, SubScreen } from '@/features/settings/my-kit';
import { APP_VERSION } from '@/features/settings/version';

/** 시안 16b-legal legalMenu · screens.json WP-MY-010. */
const S = {
  title: '서비스 정보',
  version: '버전 정보',
  versionValue: (v: string) => `v${v}`,
  noteTitle: '문서는 확정 전 초안이에요',
  noteBody: '법률 자문을 거쳐 확정되면 여기서 바로 볼 수 있어요.',
} as const;

/**
 * 서비스 정보 · WP-MY-010. 이용약관 / 개인정보처리방침 / 분석 안내 / 버전.
 *
 * 문서 목록은 @weddingpick/domain `POLICY_DOCUMENTS` — 웹 랜딩이 같은 것을 본다. 전문은 웹에 있어
 * 새 창으로 연다(발췌하지 않는다 · WP-LEGAL-001 rule). 랜딩 안 앵커('#…')는 앱의 안내 화면이 대신한다.
 * 오픈소스 라이선스 · 위치기반서비스 약관은 아직 문서가 없어 행을 두지 않는다.
 */
export default function PoliciesScreen() {
  return (
    <SubScreen title={S.title} contentStyle={{ paddingTop: Layout.rowPaddingY }}>
      <Section>
        <Rows>
          {POLICY_DOCUMENTS.map((policy) => (
            <Row
              key={policy.id}
              name={policy.title}
              meta={policy.status}
              chevron
              onPress={() => {
                if (policy.url && !policy.url.startsWith('#')) void openExternal(policy.url);
                else router.push('/my/guide' as never);
              }}
            />
          ))}
          <Row name={S.version} tail={S.versionValue(APP_VERSION)} tailDim />
        </Rows>
      </Section>

      <Section>
        <NoteBox title={S.noteTitle} body={S.noteBody} />
      </Section>
    </SubScreen>
  );
}
