import { apiBase } from './site-data';

/**
 * 약관 · 개인정보처리방침 · 마케팅 정보 수신 동의를 «표»에서 읽어 온다.
 *
 * 2026-09-16 대표 지시 — 「개인정보처리방침 이용약관 마케팅 약관도 동일하게 내가
 * 수정가능하도록 하고」. 전까지 본문은 `subpages.ts`에 박혀 있어서 한 글자를 고치려면
 * 코드를 고쳐 배포해야 했다.
 *
 * **정본은 여전히 하나다.** CLAUDE.md의 「약관과 개인정보처리방침의 정본은
 * 웹사이트다」가 막는 것은 사본이 둘이 되는 것이고, 그 위험은 그대로다 —
 * 2026-09-09에 앱과 방침이 어긋났고 낡은 쪽을 사용자가 봤다. 바뀐 것은 그 하나가
 * 코드가 아니라 표라는 것뿐이고, 앱은 지금처럼 이 페이지로 내보낸다.
 *
 * **읽는 시점은 빌드다.** 웹은 정적 HTML 생성기다(`build.ts`). 관리자가 「공개」를
 * 누르면 표가 바뀌고, 사이트에 나가는 것은 그다음 빌드다 — 링크 미리보기 문구가
 * 「저장 후 반영하기」로 배포를 거는 것과 같은 구조다(`routes/site-meta.ts`).
 */
export type LegalSection = {
  /** 화면에 그려지는 제목. 「제1조 목적」처럼 번호가 이미 안에 들어 있다. */
  t: string;
  l?: string[];
  table?: boolean;
  cols?: { label: string }[];
  rows?: string[][];
  lead?: string;
};

export type LegalDocument = {
  version: string;
  effectiveOn: string;
  sections: LegalSection[];
};

type ClauseResponse = {
  title: string;
  body: string;
  bodyTable: { lead: string | null; cols: { label: string }[]; rows: string[][] } | null;
};

type LegalResponse = {
  document: { version: string; effectiveOn: string; clauses: ClauseResponse[] } | null;
};

/**
 * 표의 한 줄을 그리는 쪽이 아는 모양으로 돌린다.
 *
 * 표가 없는 절은 `body`를 줄바꿈으로 가른다 — 관리자 편집칸이 여러 줄 입력이라
 * 운영자가 엔터로 조항을 나눈다. 저장 쪽(0420)도 같은 규칙으로 심었다.
 */
function toSection(clause: ClauseResponse): LegalSection {
  if (clause.bodyTable) {
    return {
      t: clause.title,
      table: true,
      cols: clause.bodyTable.cols,
      rows: clause.bodyTable.rows,
      ...(clause.bodyTable.lead === null ? {} : { lead: clause.bodyTable.lead }),
    };
  }

  return {
    t: clause.title,
    l: clause.body.split('\n').filter((line) => line.trim().length > 0),
  };
}

/**
 * 법적 문서를 못 읽으면 **빌드를 세운다.**
 *
 * 업체·금액은 없으면 「정보를 모으는 중이에요」로 나가지만(`site-data.ts`), 약관은
 * 그럴 수 없다. 빈 약관 페이지가 나가는 것은 문서가 없는 것보다 나쁘다 — 사용자는
 * 그것을 「약관이 없는 서비스」로 읽고, 앱스토어 심사는 그 링크를 확인한다.
 *
 * 옛 빌드가 계속 서빙되는 편이 낫다. 정적 사이트는 빌드가 실패하면 그렇게 된다.
 */
export async function loadLegalDocument(doc: 'terms' | 'privacy'): Promise<LegalDocument> {
  const base = apiBase();

  if (!base) {
    throw new Error(
      `약관·방침을 읽을 곳이 없습니다. WEDDINGPICK_API_URL을 설정해야 ${doc} 페이지를 만들 수 있습니다.`
    );
  }

  const response = await fetch(`${base}/v1/legal/${doc}`, { signal: AbortSignal.timeout(15_000) });

  if (!response.ok) {
    throw new Error(`약관·방침을 읽지 못했습니다(${doc}) — 응답 ${response.status}`);
  }

  const payload = (await response.json()) as LegalResponse;

  if (!payload.document) {
    throw new Error(
      `${doc} 문서에 공개된 판이 없습니다. 관리자에서 시행일을 정해 초안을 공개한 뒤 다시 배포해주세요.`
    );
  }

  if (payload.document.clauses.length === 0) {
    throw new Error(`${doc} 문서에 조문이 없습니다. 빈 약관을 내보내지 않습니다.`);
  }

  return {
    version: payload.document.version,
    effectiveOn: payload.document.effectiveOn,
    sections: payload.document.clauses.map(toSection),
  };
}
