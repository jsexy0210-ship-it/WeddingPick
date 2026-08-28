import { join } from 'node:path';

import { build } from './build';

// npm 워크스페이스 스크립트는 워크스페이스 디렉터리에서 돈다.
const path = build(join(process.cwd(), 'dist'));

console.log(`랜딩을 만들었다: ${path}`);
