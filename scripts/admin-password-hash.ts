import { createInterface } from 'node:readline';

import { hashAdminPassword } from '../apps/api/src/auth/admin-password';

/**
 * 관리자 비밀번호 해시를 만든다.
 *
 *   npx tsx scripts/admin-password-hash.ts
 *
 * **원문을 인자로 받지 않는다.** `--password ejsglf!234`처럼 넘기면 셸 기록(`~/.bash_history`)과
 * 프로세스 목록(`ps`)에 그대로 남는다. 표준입력으로만 받고, 화면에도 되찍지 않는다.
 *
 * 나오는 값을 `ADMIN_PASSWORD_HASH`로 넣는다. 소금과 해시뿐이라 이 값에서 원문을
 * 되돌릴 수 없다 — 저장소에 두어도 되는 것은 아니지만, 새어도 비밀번호가 새지는 않는다.
 */
function ask(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  const password = (await ask('비밀번호(화면에 보입니다 — 어깨너머를 조심하세요): ')).trim();

  if (password.length < 10) {
    console.error('::error::열 글자 이상으로 정해주세요. 관리자 계정은 인터넷에 열려 있습니다.');
    process.exit(1);
  }

  /* 해시만 표준출력으로 낸다 — 파이프로 받아 쓸 수 있게. 안내는 전부 표준오류로. */
  console.error('\nADMIN_PASSWORD_HASH 로 넣을 값:\n');
  console.log(hashAdminPassword(password));
  console.error('\n원문은 어디에도 적지 마세요. 이 값에서 되돌릴 수 없습니다.');
}

void main();
