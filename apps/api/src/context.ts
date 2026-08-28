import type { Pool } from 'pg';

import type { PaymentProofReader } from './analysis/payment-reader';
import type { IdentityProviders } from './auth/identity-provider';
import type { Config } from './config';
import type { Storage } from './storage/port';

/** 라우트가 쓰는 바깥 세계. 테스트에서는 이걸 바꿔 끼운다. */
export type AppContext = {
  pool: Pool;
  storage: Storage;
  providers: IdentityProviders;
  config: Config;
  /** 결제내역 이미지를 읽는 쪽. 테스트에서는 가짜를 끼운다. */
  proofReader: PaymentProofReader;
};
