import { z } from 'zod';

/**
 * 자주 묻는 것.
 *
 * **2026-09-16 대표 지시로 서버가 내려준다.** 그전까지 항목은 코드에
 * (`packages/domain/src/faq.ts`) 있었고 관리자 화면에서 고칠 수 없었다.
 *
 * 답은 **이미 채워져서 온다.** 표에는 `{{limited}}` 같은 자리표시자가 담기고 서버가
 * 공개 기준 건수를 넣어 내보낸다 — 화면마다 채우면 한 군데를 빠뜨리고, 그 화면에서만
 * 괄호가 글자로 나간다.
 */
export const faqItemSchema = z.object({
  /**
   * 화면 주소(`/my/faq/<key>`)에 실리는 이름.
   *
   * 코드에서 옮겨 온 일곱은 쓰던 이름을 그대로 지닌다 — 관련 질문 짝짓기와 문의 유형
   * 짝짓기가 이 값으로 걸려 있고, 저장된 링크도 이 주소다. 운영자가 새로 등록한
   * 항목은 행의 id가 그 자리에 온다.
   */
  key: z.string().min(1),
  category: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const faqListResponseSchema = z.object({
  items: z.array(faqItemSchema),
});

export type FaqItemResponse = z.infer<typeof faqItemSchema>;
export type FaqListResponse = z.infer<typeof faqListResponseSchema>;
