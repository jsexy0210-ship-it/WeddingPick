import type { Pool } from 'pg';

import type { IdentityProviders } from './auth/identity-provider';
import type { Config } from './config';
import type { Storage } from './storage/port';

/** 라우트가 쓰는 바깥 세계. 테스트에서는 이걸 바꿔 끼운다. */
export type AppContext = {
  pool: Pool;
  storage: Storage;
  providers: IdentityProviders;
  config: Config;
};
