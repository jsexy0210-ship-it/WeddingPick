import {
  CLAIM_METHODS,
  checkClaim,
  claimSignal,
  domainOf,
  matchesOfficialDomain,
  methodRank,
  strongestMethod,
} from './vendor-claim';

describe('업체 관계자 인증', () => {
  describe('수단 우선순위', () => {
    it('공식 도메인 이메일이 가장 앞이다', () => {
      expect(CLAIM_METHODS[0]).toBe('official_domain_email');
      expect(methodRank('official_domain_email')).toBeLessThan(methodRank('listed_email'));
      expect(methodRank('listed_email')).toBeLessThan(methodRank('business_document'));
    });

    it('여러 수단을 내면 가장 강한 것으로 본다', () => {
      expect(strongestMethod(['business_document', 'official_domain_email'])).toBe(
        'official_domain_email'
      );
    });

    it('낸 수단이 없으면 없다고 한다', () => {
      expect(strongestMethod([])).toBeNull();
    });
  });

  describe('도메인 견주기', () => {
    it('하위 도메인은 같은 곳으로 본다', () => {
      expect(matchesOfficialDomain('yeji@mail.gaon.co.kr', 'gaon.co.kr')).toBe(true);
    });

    it('꼬리만 같은 남의 도메인은 아니다', () => {
      expect(matchesOfficialDomain('yeji@notgaon.co.kr', 'gaon.co.kr')).toBe(false);
    });

    it('대소문자는 가리지 않는다', () => {
      expect(matchesOfficialDomain('Yeji@GAON.co.kr', 'gaon.co.kr')).toBe(true);
    });

    it('업체 공식 도메인을 모르면 견줄 수 없다', () => {
      expect(matchesOfficialDomain('yeji@gaon.co.kr', null)).toBe(false);
    });

    it('이메일 꼴이 아니면 도메인이 없다', () => {
      expect(domainOf('yeji_gaon.co.kr')).toBeNull();
      expect(domainOf('@gaon.co.kr')).toBeNull();
      expect(domainOf('yeji@gaon')).toBeNull();
      expect(domainOf('yeji@gaon.')).toBeNull();
    });
  });

  describe('접수 확인', () => {
    it('무슨 일을 하는지 없으면 받지 않는다', () => {
      const result = checkClaim({
        claimedRole: ' ',
        evidence: { method: 'official_domain_email', email: 'yeji@gaon.co.kr' },
      });

      expect(result).toEqual({ ok: false, message: '업체에서 어떤 일을 하시는지 적어주세요' });
    });

    it('공개된 이메일은 어디에 공개돼 있는지를 함께 받는다', () => {
      const result = checkClaim({
        claimedRole: '예약팀장',
        evidence: { method: 'listed_email', email: 'yeji@naver.com', listedAt: '' },
      });

      expect(result).toEqual({
        ok: false,
        message: '그 이메일이 어디에 공개돼 있는지 알려주세요',
      });
    });

    it('증빙 수단은 첨부가 있어야 받는다', () => {
      const result = checkClaim({
        claimedRole: '대표',
        evidence: { method: 'business_document', documentId: '' },
      });

      expect(result.ok).toBe(false);
    });

    it('갖춰지면 받는다', () => {
      expect(
        checkClaim({
          claimedRole: '예약팀장',
          evidence: {
            method: 'listed_email',
            email: 'yeji@naver.com',
            listedAt: '공식 홈페이지 하단 문의처',
          },
        })
      ).toEqual({ ok: true });
    });
  });

  describe('심사 재료', () => {
    it('도메인이 같아도 결론을 내지 않는다', () => {
      const signal = claimSignal({
        evidence: { method: 'official_domain_email', email: 'yeji@gaon.co.kr' },
        officialDomain: 'gaon.co.kr',
      });

      /*
       * 승인이라는 값이 아예 없다. 도메인이 같다는 것은 그 회사의 주소라는
       * 뜻이지, 신청한 사람이 그 주소를 쓴다는 뜻이 아니다.
       */
      expect(signal.domainMatches).toBe(true);
      expect(Object.keys(signal).sort()).toEqual(['domainMatches', 'note', 'reasonCode']);
    });

    it('공식 도메인을 모르면 모른다고 한다', () => {
      const signal = claimSignal({
        evidence: { method: 'official_domain_email', email: 'yeji@gaon.co.kr' },
        officialDomain: null,
      });

      expect(signal.domainMatches).toBe(false);
      expect(signal.reasonCode).toBe('official_domain_unknown');
    });

    it('증빙 수단은 도메인을 보지 않는다', () => {
      const signal = claimSignal({
        evidence: { method: 'business_document', documentId: 'doc-1' },
        officialDomain: 'gaon.co.kr',
      });

      expect(signal.reasonCode).toBe('document_submitted');
    });
  });
});
