const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');
process.chdir(path.resolve(__dirname, '../..')); // repository root, regardless of caller cwd
const normalize = s => s.split('?')[0].replace(/\$\{[^}]+\}|:[A-Za-z_][A-Za-z0-9_]*/g, '*');
function files(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]); }
function parse(file, callback) {
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  function walk(n) { callback(n,ast);ts.forEachChild(n,walk); } walk(ast);
}
const registered=new Set();
for(const file of files('apps/api/src/routes').filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts'))) parse(file,(n,ast)=>{
  if(!ts.isCallExpression(n)||!ts.isPropertyAccessExpression(n.expression))return;
  const method=n.expression.name.text.toUpperCase();
  if(!['GET','POST','PUT','PATCH','DELETE'].includes(method))return;
  const url=n.arguments[0];if(!url||!ts.isStringLiteral(url)||!url.text.startsWith('/v1/admin'))return;
  registered.add(method+' '+normalize(url.text));
});
const calls=[];
for(const file of files('apps/mobile/src/app/admin').filter(f=>f.endsWith('.tsx'))) parse(file,(n,ast)=>{
  if(!ts.isCallExpression(n)||n.expression.getText(ast)!=='apiFetch')return;
  const arg=n.arguments[0];if(!arg)return;
  const url=ts.isStringLiteral(arg)?arg.text:ts.isTemplateExpression(arg)?arg.getText(ast).slice(1,-1):null;
  if(!url)return;
  let method='GET';const opts=n.arguments[1];
  if(opts&&ts.isObjectLiteralExpression(opts)){const p=opts.properties.find(p=>p.name?.getText(ast)==='method');if(p?.initializer&&ts.isStringLiteral(p.initializer))method=p.initializer.text;}
  const key=method+' '+normalize(url);
  calls.push({file:file.replaceAll('\\','/'),line:ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1,method,url,registered:registered.has(key),pendingGuardFile:fs.readFileSync(file,'utf8').includes('BACKEND_PENDING')});
});
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const workingTreeDirty = Boolean(execFileSync('git', ['status', '--porcelain', '--', 'apps/api/src/routes', 'apps/mobile/src/app/admin'], { encoding: 'utf8' }).trim());
console.log(JSON.stringify({sourceCommit,workingTreeDirty,note:'Static literal/template apiFetch mapping. Dynamic segments collapse to *. Missing entries require manual review; registration does not imply persistence or response compatibility.',calls:calls.length,missing:calls.filter(c=>!c.registered),registeredRoutes:registered.size},null,2));
