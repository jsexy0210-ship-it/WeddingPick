/**
 * Infra rollback/cutover regression tests that are present on main.
 *
 * Keep this list explicit. The runner separately discovers matching
 * rollback/cutover/transaction test files and fails when a new file lands
 * without being classified here.
 */
export const infraRegressionTests = Object.freeze({
  transaction: Object.freeze([
    'scripts/verification/app-web-live-marker-rollback.test.mjs',
    'scripts/verification/cors-cutover-restore.test.mjs',
    'scripts/verification/cors-rollback-idempotency.test.mjs',
    'scripts/verification/cutover-transaction.test.mjs',
    'scripts/verification/live-favicon-rollback.test.mjs',
    'scripts/verification/preview-route-rollback.test.mjs',
    'scripts/verification/static-port-probe-transaction.test.mjs',
    'scripts/verification/static-sites-cutover-transaction.test.mjs',
    'scripts/verification/worker-cutover-restore.test.mjs',
  ]),
  source: Object.freeze([
    'scripts/verification/api-current-tag-rollback.test.mjs',
    'scripts/verification/static-cutover-order.test.mjs',
  ]),
});
