// Read-only audit: parse current server responses; never call production APIs.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');
process.chdir(path.resolve(__dirname, '../..')); // repository root, regardless of caller cwd
const source = fs.readFileSync('apps/api/src/routes/admin.ts', 'utf8');
const ast = ts.createSourceFile('admin.ts', source, ts.ScriptTarget.Latest, true);
function literal(n) {
  if (ts.isAsExpression(n) || ts.isParenthesizedExpression(n)) return literal(n.expression);
  if (ts.isObjectLiteralExpression(n)) return Object.fromEntries(n.properties.map(p => [p.name.getText(ast), literal(p.initializer)]));
  if (ts.isArrayLiteralExpression(n)) return n.elements.map(literal);
  if (ts.isStringLiteral(n)) return n.text;
  if (ts.isNumericLiteral(n)) return Number(n.text);
  if (n.kind === ts.SyntaxKind.NullKeyword) return null;
  if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
  throw new Error('Nonliteral response');
}
const routes = new Map();
function walk(n) {
  if (ts.isCallExpression(n) && n.expression.getText(ast) === 'app.get' && ts.isStringLiteral(n.arguments[0])) {
    const fn = n.arguments.at(-1);
    if (fn.body && ts.isBlock(fn.body)) {
      const ret = fn.body.statements.find(ts.isReturnStatement);
      if (ret?.expression) {
        try { routes.set(n.arguments[0].text, { body: literal(ret.expression), line: ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 }); } catch {}
      }
    }
  }
  ts.forEachChild(n, walk);
}
walk(ast);
const cases = [
  ['revenue', '/v1/admin/revenue', 'data.summary.mrr', d => d.summary.mrr],
  ['data-pipeline', '/v1/admin/data/pipeline', 'data.today.received', d => d.today.received],
  ['terms', '/v1/admin/terms', 'data?.documents.find', d => d?.documents.find(x => x.type === 'terms')],
  ['ads-gate', '/v1/admin/ads-gate', 'data.blockers.length', d => d.blockers.length],
  ['email-matching', '/v1/admin/data/email-matching', 'data.summary.total', d => d.summary.total],
];
const results = cases.map(([screen, endpoint, expression, read]) => {
  const file = `apps/mobile/src/app/admin/${screen}.tsx`;
  const client = fs.readFileSync(file, 'utf8');
  if (!client.includes(expression)) throw new Error(`Audit fixture became stale: ${file}`);
  const response = routes.get(endpoint);
  if (!response) throw new Error(`Server response no longer literal: ${endpoint}`);
  try { read(response.body); return { screen, endpoint, result: 'NO_ERROR' }; }
  catch (error) { return { screen, endpoint, serverLine: response.line, clientLine: client.slice(0, client.indexOf(expression)).split('\n').length, response: response.body, result: error.message }; }
});
const adminFiles = fs.readdirSync('apps/mobile/src/app/admin').filter(x => x.endsWith('.tsx'));
const pending = adminFiles.flatMap(file => {
  const text = fs.readFileSync(path.join('apps/mobile/src/app/admin', file), 'utf8');
  const count = [...text.matchAll(/disabled=\{BACKEND_PENDING\b/g)].length;
  return count ? [{ file, disabledControls: count }] : [];
});
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const workingTreeDirty = Boolean(execFileSync('git', ['status', '--porcelain', '--', 'apps/api/src/routes', 'apps/mobile/src/app/admin'], { encoding: 'utf8' }).trim());
console.log(JSON.stringify({ sourceCommit, workingTreeDirty, method: 'Extract literal GET responses with TypeScript AST and replay existing client field access, without mounting React or logging in. Automation and rollback removed after latest fixes.', results, pending, disabledControls: pending.reduce((n, x) => n + x.disabledControls, 0) }, null, 2));
