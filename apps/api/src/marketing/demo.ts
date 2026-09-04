/**
 * 마케팅 파이프라인 개발용 예제 실행기.
 * CLI demo 명령과 동일하지만 programmatic 사용을 위한 함수형 인터페이스.
 */

import type { MarketingChannel, MarketingFormat, MarketingSource } from '@weddingpick/api-contract';
import { generateContent } from './content';

export const DEMO_SOURCE: MarketingSource = {
  id: 'demo-source-01',
  factIds: ['pick', 'compare', 'together', 'schedule', 'data'],
  reviewed: true,
  reviewedAt: new Date().toISOString(),
  expiresAt: null,
  nextVerifyAt: null,
  active: true,
  note: '개발용 예제 소재',
};

export type DemoResult = {
  channel: MarketingChannel;
  format: MarketingFormat;
  title?: string;
  body?: string;
  utmUrl?: string;
  error?: string;
};

export function runAllDemos(): DemoResult[] {
  const channels: MarketingChannel[] = ['blog', 'instagram', 'shortform', 'community'];
  const formats: MarketingFormat[] = ['product', 'feature', 'checklist', 'data'];
  const results: DemoResult[] = [];

  for (const channel of channels) {
    for (const format of formats) {
      const key = `demo_${channel}_${format}`;
      const result = generateContent(DEMO_SOURCE, channel, format, key);
      results.push(
        result.ok
          ? { channel, format, title: result.title, body: result.body, utmUrl: result.utmUrl }
          : { channel, format, error: result.error },
      );
    }
  }
  return results;
}
