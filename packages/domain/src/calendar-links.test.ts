import { googleCalendarLink, outlookCalendarLink } from './calendar-links';

const input = {
  title: '서울 웨딩박람회',
  startsAt: '2026-09-12T09:00:00.000Z',
  endsAt: '2026-09-12T18:00:00.000Z',
  location: '코엑스',
};

describe('구글 캘린더 링크', () => {
  it('UTC 시각을 YYYYMMDDTHHmmssZ 꼴로 담는다', () => {
    const link = googleCalendarLink(input);

    expect(link).toContain('dates=20260912T090000Z%2F20260912T180000Z');
  });

  it('제목과 장소를 담는다', () => {
    const link = googleCalendarLink(input);

    expect(link).toContain(`text=${encodeURIComponent('서울 웨딩박람회')}`);
    expect(link).toContain(`location=${encodeURIComponent('코엑스')}`);
  });

  it('없는 값은 쿼리에 싣지 않는다', () => {
    const link = googleCalendarLink({ title: '박람회', startsAt: input.startsAt, endsAt: input.endsAt });

    expect(link).not.toContain('location=');
    expect(link).not.toContain('details=');
  });
});

describe('아웃룩 캘린더 링크', () => {
  it('일정 추가 딥링크 형태를 쓴다', () => {
    const link = outlookCalendarLink(input);

    expect(link).toContain('rru=addevent');
    expect(link).toContain(`subject=${encodeURIComponent('서울 웨딩박람회')}`);
  });
});
