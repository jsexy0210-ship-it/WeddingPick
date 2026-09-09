import { FAQ_ITEMS, POLICY_DOCUMENTS } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { listMyInquiries } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { openExternal } from '@/features/open-external';
import { Hero, Row, Rows, Section, SubScreen } from '@/features/settings/my-kit';
import { APP_VERSION } from '@/features/settings/version';

/** 시안 13-my-sub WP-MY-009. */
const S = {
  title: '고객지원',
  hero: '무엇을\n도와드릴까요?',
  faq: '많이 찾는 질문',
  faqAll: '전체 보기',
  faqCount: (n: number) => `${n}개`,
  inquiry: '문의',
  inquire: '문의하기',
  inquireMeta: '평일 오전 10시부터 오후 6시까지 답변드려요',
  myInquiries: '내 문의 내역',
  count: (n: number) => `${n}건`,
  none: '없어요',
  terms: '이용약관',
  privacy: '개인정보처리방침',
  version: '버전',
} as const;

/** 시안이 앞에 세운 질문 수. 나머지는 «전체 보기». */
const TOP_FAQ = 3;

/**
 * 고객지원 · WP-MY-009. 자주 묻는 질문을 먼저, 그다음 문의. 답변 시간을 미리 적어 기다림을
 * 예측할 수 있게 한다(시안 문구 그대로).
 *
 * «신고 내역» 행은 API가 없어 두지 않는다.
 */
export default function SupportScreen() {
  const [inquiryCount, setInquiryCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isServerConfigured) return;
    listMyInquiries()
      .then((response) => setInquiryCount(response.inquiries.length))
      .catch(() => setInquiryCount(null));
  }, []);

  const terms = POLICY_DOCUMENTS.find((policy) => policy.id === 'terms');
  const privacy = POLICY_DOCUMENTS.find((policy) => policy.id === 'privacy');

  return (
    <SubScreen title={S.title}>
      <Hero lines={S.hero.split('\n')} />

      <Section title={S.faq}>
        <Rows>
          {FAQ_ITEMS.slice(0, TOP_FAQ).map((item) => (
            <Row
              key={item.key}
              name={item.question}
              chevron
              onPress={() => router.push('/my/guide' as never)}
            />
          ))}
          <Row name={S.faqAll} tail={S.faqCount(FAQ_ITEMS.length)} tailDim chevron onPress={() => router.push('/my/guide' as never)} />
        </Rows>
      </Section>

      <Section title={S.inquiry}>
        <Rows>
          <Row name={S.inquire} meta={S.inquireMeta} chevron onPress={() => router.push('/my/contact' as never)} />
          <Row
            name={S.myInquiries}
            tail={inquiryCount === null ? undefined : inquiryCount > 0 ? S.count(inquiryCount) : S.none}
            tailDim={inquiryCount === 0}
            chevron
            onPress={() => router.push('/my/contact' as never)}
          />
        </Rows>
      </Section>

      <Section>
        <Rows>
          <Row name={S.terms} chevron onPress={() => terms?.url && void openExternal(terms.url)} />
          <Row name={S.privacy} chevron onPress={() => privacy?.url && void openExternal(privacy.url)} />
          <Row name={S.version} tail={APP_VERSION} tailDim />
        </Rows>
      </Section>
    </SubScreen>
  );
}
