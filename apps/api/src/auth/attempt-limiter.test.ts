import { createAttemptLimiter } from './attempt-limiter';

test('한도를 넘으면 막고, 창이 지나면 다시 허용한다', () => {
  let now = 0;
  const limiter = createAttemptLimiter({ max: 3, windowMs: 1000, now: () => now });

  expect(limiter.allowed('a@test.com')).toBe(true);
  limiter.fail('a@test.com');
  limiter.fail('a@test.com');
  expect(limiter.allowed('a@test.com')).toBe(true);
  expect(limiter.failCount('a@test.com')).toBe(2);

  limiter.fail('a@test.com');
  expect(limiter.allowed('a@test.com')).toBe(false);

  now = 1001;
  expect(limiter.allowed('a@test.com')).toBe(true);
  expect(limiter.failCount('a@test.com')).toBe(0);
});

test('키가 다르면 서로 영향을 주지 않는다', () => {
  const limiter = createAttemptLimiter({ max: 1, windowMs: 1000 });

  limiter.fail('a@test.com');
  expect(limiter.allowed('a@test.com')).toBe(false);
  expect(limiter.allowed('b@test.com')).toBe(true);
});

test('성공하면 기록이 지워진다', () => {
  const limiter = createAttemptLimiter({ max: 1, windowMs: 1000 });

  limiter.fail('a@test.com');
  expect(limiter.allowed('a@test.com')).toBe(false);

  limiter.reset('a@test.com');
  expect(limiter.allowed('a@test.com')).toBe(true);
  expect(limiter.failCount('a@test.com')).toBe(0);
});
