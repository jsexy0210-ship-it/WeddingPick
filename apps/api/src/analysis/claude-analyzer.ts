import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import type { AnalysisOutcome, Analyzer, DocumentPage } from './analyzer';
import { EXTRACTION_SYSTEM_PROMPT, extractionSchema } from './schema';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

type ImageMediaType = (typeof IMAGE_TYPES)[number];

function isImage(mimeType: string): mimeType is ImageMediaType {
  return (IMAGE_TYPES as readonly string[]).includes(mimeType);
}

/** 문서 한 장을 API가 받는 블록으로 바꾼다. HEIC는 업로드 단계에서 JPEG로 바꿔 보낸다. */
function toContentBlock(page: DocumentPage) {
  const data = page.bytes.toString('base64');

  if (page.mimeType === 'application/pdf') {
    return {
      type: 'document' as const,
      source: { type: 'base64' as const, media_type: 'application/pdf' as const, data },
    };
  }

  if (!isImage(page.mimeType)) {
    throw new Error(`읽을 수 없는 형식이다: ${page.mimeType}`);
  }

  return {
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: page.mimeType, data },
  };
}

export function createClaudeAnalyzer(options: { model?: string } = {}): Analyzer {
  const client = new Anthropic();
  const model = options.model ?? 'claude-opus-5';

  return {
    async analyze(pages: DocumentPage[]): Promise<AnalysisOutcome> {
      const response = await client.messages.parse({
        model,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        system: [
          {
            type: 'text',
            text: EXTRACTION_SYSTEM_PROMPT,
            // 지시문은 문서마다 그대로다. 캐시가 먹도록 앞에 두고 문서를 뒤에 붙인다.
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: [
              ...pages.map(toContentBlock),
              { type: 'text', text: '이 문서를 읽고 스키마대로 채워라.' },
            ],
          },
        ],
        output_config: { format: zodOutputFormat(extractionSchema) },
      });

      if (!response.parsed_output) {
        throw new Error('구조화 출력을 읽지 못했다.');
      }

      return {
        extraction: response.parsed_output,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    },
  };
}
