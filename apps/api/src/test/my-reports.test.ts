import {
  consentToPaymentProofs,
  createTestApp,
  resetDatabase,
  signInAs,
  type TestApp,
} from "./helpers";

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

const BODY =
  "음식이 따뜻하게 나왔고 직원분들이 동선을 잘 안내해 주셨습니다. 주차는 조금 붐비는 편이었습니다.";

type Report = {
  kind: string;
  kindLabel: string;
  use: string;
  subject: string;
  amount: number | null;
  inUse: boolean;
  note: string | null;
};

/**
 * 내 제보 내역.
 *
 * 셋을 한 목록에 세우되 **합치지 않는다** — 종류가 행마다 붙는다. 내가 낸 것이
 * 무엇에 쓰이는지 모르는 채로 쌓이면 그건 제보가 아니라 수집이다.
 */
describeWithDb("내 제보 내역", () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  const list = (headers: Record<string, string>) =>
    test.app.inject({ method: "GET", url: "/v1/me/reports", headers });

  async function createVendor(name = "가온예식홀") {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, 'hall', '서울', 'public_data') RETURNING id`,
      [name],
    );

    return rows[0]!.id;
  }

  it("아무것도 안 냈으면 비어 있다", async () => {
    const { headers } = await signInAs(test);

    expect((await list(headers)).json<{ reports: Report[] }>().reports).toEqual(
      [],
    );
  });

  it("결제인증·가격제보·후기가 종류를 달고 한 목록에 선다", async () => {
    const { headers, userId } = await signInAs(test);
    const vendorId = await createVendor();

    await consentToPaymentProofs(test, headers);
    await test.app.inject({
      method: "POST",
      url: "/v1/payment-proofs",
      headers,
      payload: {
        merchantName: "가온예식홀",
        paidAmount: 3_000_000,
        paidAt: "2026-05-20T04:00:00.000Z",
        method: "card",
      },
    });

    await test.pool.query(
      `INSERT INTO structured.price_reports
         (vendor_id, reporter_user_id, product_name, total_amount, contracted_on)
       VALUES ($1, $2, '그랜드볼룸', 30000000, '2026-06-01')`,
      [vendorId, userId],
    );

    await test.app.inject({
      method: "POST",
      url: `/v1/vendors/${vendorId}/reviews`,
      headers,
      payload: {
        role: "contractor",
        overall: 4,
        title: "식사가 좋았습니다",
        body: BODY,
        aspects: [{ key: "food_taste", rating: 5 }],
      },
    });

    const { reports } = (await list(headers)).json<{ reports: Report[] }>();

    expect(reports).toHaveLength(3);
    expect(new Set(reports.map((report) => report.kind))).toEqual(
      new Set(["payment_proof", "price_report", "review"]),
    );
    // 종류마다 어디에 쓰이는지가 함께 온다.
    expect(reports.every((report) => report.use.length > 0)).toBe(true);
  });

  it("업체를 못 찾은 결제인증은 쓰이지 않는다고 말한다", async () => {
    /*
     * 목록에 세워두고 쓰인다고 말하면 그건 거짓이다. 남아 있는 것과 쓰이는 것은
     * 다르다.
     */
    const { headers } = await signInAs(test);

    await consentToPaymentProofs(test, headers);
    await test.app.inject({
      method: "POST",
      url: "/v1/payment-proofs",
      headers,
      payload: {
        merchantName: "어디인지모를곳",
        paidAmount: 3_000_000,
        paidAt: "2026-05-20T04:00:00.000Z",
        method: "card",
      },
    });

    const report = (await list(headers)).json<{ reports: Report[] }>()
      .reports[0]!;

    expect(report.inUse).toBe(false);
    expect(report.note).toContain("찾지 못해");
    // 업체를 못 찾았어도 가맹점 이름은 남는다. 빈 줄로 두면 무엇을 낸 건지 알 수 없다.
    expect(report.subject).toBe("어디인지모를곳");
  });

  it("허위로 판단해 뺀 가격제보도 남되 쓰이지 않는다고 말한다", async () => {
    const { headers, userId } = await signInAs(test);
    const vendorId = await createVendor();
    const operator = await test.pool.query<{ id: string }>(
      "INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id",
    );

    await test.pool.query(
      `INSERT INTO structured.price_reports
         (vendor_id, reporter_user_id, product_name, total_amount, contracted_on,
          rejected_at, rejected_by, rejection_reason)
       VALUES ($1, $2, '그랜드볼룸', 30000000, '2026-06-01', now(), $3, '중복 제보')`,
      [vendorId, userId, operator.rows[0]!.id],
    );

    const report = (await list(headers)).json<{ reports: Report[] }>()
      .reports[0]!;

    expect(report.kindLabel).toBe("가격제보");
    expect(report.inUse).toBe(false);
  });

  it("금액이 숫자로 온다", async () => {
    // bigint를 문자열 그대로 흘리면 화면이 "3000000"을 글자로 다룬다.
    const { headers } = await signInAs(test);
    await createVendor();

    await consentToPaymentProofs(test, headers);
    await test.app.inject({
      method: "POST",
      url: "/v1/payment-proofs",
      headers,
      payload: {
        merchantName: "가온예식홀",
        paidAmount: 3_000_000,
        paidAt: "2026-05-20T04:00:00.000Z",
        method: "card",
      },
    });

    expect(
      (await list(headers)).json<{ reports: Report[] }>().reports[0]!.amount,
    ).toBe(3_000_000);
  });

  it("남이 낸 것은 오지 않는다", async () => {
    const other = await signInAs(test, "other-user");
    const vendorId = await createVendor();

    await test.pool.query(
      `INSERT INTO structured.price_reports
         (vendor_id, reporter_user_id, product_name, total_amount, contracted_on)
       VALUES ($1, $2, '그랜드볼룸', 30000000, '2026-06-01')`,
      [vendorId, other.userId],
    );

    const me = await signInAs(test, "me");

    expect(
      (await list(me.headers)).json<{ reports: Report[] }>().reports,
    ).toEqual([]);
  });

  it("로그인해야 볼 수 있다", async () => {
    const response = await test.app.inject({
      method: "GET",
      url: "/v1/me/reports",
    });

    expect(response.statusCode).toBe(401);
  });
});
