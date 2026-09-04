import { join } from 'node:path';

import { build } from './build';

// npm 워크스페이스 스크립트는 워크스페이스 디렉터리에서 돈다.
build(join(process.cwd(), 'dist'))
  .then((path) => {
    console.log(`웹을 만들었다: ${path}`);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
