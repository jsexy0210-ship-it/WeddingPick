import { DISCLOSURE_THRESHOLDS } from './disclosure';
import {
  FAQ_PLACEHOLDER_LABEL,
  FAQ_PLACEHOLDER_NAMES,
  fillFaqPlaceholders,
  unknownFaqPlaceholders,
} from './faq';

/**
 * 답 안의 자리표시자.
 *
 * **여기서 붙드는 것은 「치환이 되는가」가 아니다.** 운영자가 이름을 잘못 적었을 때
 * 그것이 사용자 화면까지 가느냐다 — `{{limitedd}}`가 그대로 나가면 아무도 고장으로
 * 보지 않는다. 글자라서 문구의 일부로 읽고 지나간다.
 */
describe('FAQ 자리표시자', () => {
  it('아는 이름은 코드의 기준 건수로 채운다', () => {
    expect(fillFaqPlaceholders('실 제보가 {{limited}}건 모이면 구간을 보여드려요.')).toBe(
      `실 제보가 ${DISCLOSURE_THRESHOLDS.limited}건 모이면 구간을 보여드려요.`
    );
  });

  it('한 문장에 여럿이 있어도 각자 제 값으로 채운다', () => {
    expect(fillFaqPlaceholders('{{limited}}건 · {{normal}}건 · {{detailed}}건')).toBe(
      `${DISCLOSURE_THRESHOLDS.limited}건 · ${DISCLOSURE_THRESHOLDS.normal}건 · ${DISCLOSURE_THRESHOLDS.detailed}건`
    );
  });

  it('안쪽 공백은 다듬어 읽는다', () => {
    // 이것을 「모르는 이름」으로 돌려보내면 무엇이 틀렸는지 알 수 없다.
    expect(fillFaqPlaceholders('{{ limited }}건')).toBe(`${DISCLOSURE_THRESHOLDS.limited}건`);
    expect(unknownFaqPlaceholders('{{ limited }}건')).toEqual([]);
  });

  it('기준이 바뀌면 문장도 같이 바뀐다', () => {
    // 표에 든 것은 자리표시자뿐이라 옛 수를 말하는 사본이 생기지 않는다.
    expect(fillFaqPlaceholders('{{detailed}}')).toBe(String(DISCLOSURE_THRESHOLDS.detailed));
  });

  it('모르는 이름을 찾아낸다', () => {
    expect(unknownFaqPlaceholders('실 제보가 {{limitedd}}건 모이면')).toEqual(['limitedd']);
  });

  it('같은 오타가 여러 번 나와도 한 번만 말한다', () => {
    expect(unknownFaqPlaceholders('{{limitedd}} {{limitedd}}')).toEqual(['limitedd']);
  });

  it('닫히지 않은 괄호도 걸린다', () => {
    // `{{limited`는 치환되지 않고 그 글자 그대로 화면에 나간다.
    expect(unknownFaqPlaceholders('실 제보가 {{limited건 모이면')).toContain('{{');
  });

  it('모르는 이름은 채우지 않고 그대로 둔다', () => {
    // 빈 문자열로 지우면 문장이 조용히 말을 바꾼다 — "실 제보가 건 모이면".
    expect(fillFaqPlaceholders('실 제보가 {{limitedd}}건')).toBe('실 제보가 {{limitedd}}건');
  });

  it('자리표시자가 없는 답은 그대로다', () => {
    const plain = '개별 금액은 보이지 않아요.';

    expect(fillFaqPlaceholders(plain)).toBe(plain);
    expect(unknownFaqPlaceholders(plain)).toEqual([]);
  });

  it('쓸 수 있는 이름에는 전부 설명이 붙어 있다', () => {
    // 관리자 화면이 이 설명을 적어 둔다. 빠지면 운영자가 이름을 외워야 한다.
    for (const name of FAQ_PLACEHOLDER_NAMES) {
      expect(FAQ_PLACEHOLDER_LABEL[name]).toBeTruthy();
    }
  });
});
