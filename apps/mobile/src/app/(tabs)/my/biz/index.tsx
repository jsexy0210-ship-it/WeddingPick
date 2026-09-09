import { router } from 'expo-router';

import { Hero, NoteBox, Row, Rows, Section, SubScreen } from '@/features/settings/my-kit';

/** 시안 18-biz · 08c WP-BIZ-001. */
const S = {
  title: '업체 · 플래너 문의',
  hero: '업체 관계자시면\n여기서 접수해요',
  sub: '소속 확인이 끝나면 처리 결과를 알려드려요',
  kinds: '문의 유형',
  adRules: '광고 독립성',
  noEffect: '영향 없음',
  noteTitle: '광고와 추천은 따로 운영해요',
  noteBody: 'TOP3 · 웨딩픽 추천 · 검색 순위 · 후기 · 실 제보는 광고와 완전히 분리돼 있어요.',
} as const;

type BizItem = { name: string; meta: string; route: string };

/*
 * 시안은 «광고 · 제휴 문의»까지 5행이지만, 광고 제휴 접수는 2026-09-05 정책으로 삭제됐다(CLAUDE.md) —
 * 여기서도 뺀다. 소속 확인은 반론의 전제라 맨 위에 둔다.
 */
const KINDS: readonly BizItem[] = [
  { name: '소속 확인 요청', meta: '사업자등록번호 · 업체 도메인 메일로 확인해요', route: '/my/biz/claim' },
  { name: '내 인증 내역', meta: '소속 확인 요청과 처리 상태', route: '/my/vendor-claims' },
  { name: '정보 수정 · 자료 제공', meta: '주소 · 연락처 · 영업상태 · 대표 이미지 · 공식 소개자료', route: '/my/biz/data' },
  { name: '혜택 · 이벤트 등록', meta: '기간과 조건을 함께 알려주세요', route: '/my/biz/benefit' },
  { name: '후기 · 정보 반론', meta: '올라온 후기나 내용에 대한 업체 입장', route: '/my/rebuttals' },
];

/** 광고가 손대지 못하는 것. 08c adRules. */
const AD_RULES = ['TOP3 추천', '웨딩픽 추천', '검색 순위', '후기 · 실 제보'] as const;

/**
 * 업체 · 플래너 문의 · WP-BIZ-001. 유형을 고르고 들어간다. 광고 독립성 표를 첫 화면에 둔다 —
 * 광고로 추천 결과를 바꿀 수 있다고 기대하고 오는 문의를 여기서 거른다(SPEC §7.1).
 */
export default function BizHomeScreen() {
  return (
    <SubScreen title={S.title}>
      <Hero lines={S.hero.split('\n')} sub={S.sub} />

      <Section title={S.kinds}>
        <Rows>
          {KINDS.map((item) => (
            <Row key={item.route} name={item.name} meta={item.meta} chevron onPress={() => router.push(item.route as never)} />
          ))}
        </Rows>
      </Section>

      <Section title={S.adRules}>
        <Rows>
          {AD_RULES.map((name) => (
            <Row key={name} name={name} tail={S.noEffect} tailBadge="none" />
          ))}
        </Rows>
      </Section>

      <Section>
        <NoteBox title={S.noteTitle} body={S.noteBody} />
      </Section>
    </SubScreen>
  );
}
