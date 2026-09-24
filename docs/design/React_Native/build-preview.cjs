// 앱 디자인 미리보기 전용 컴파일러. 제품 애플리케이션의 빌드 도구가 아닙니다.
const fs = require('fs'), path = require('path');
require('./build-icons.cjs');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'vendor/react18-runtime.js'), 'utf8');
let modules={},errors=[],css=[];
function visit(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())visit(p);else if(/\.(jsx?|tsx?)$/.test(p)){
 const rel=path.relative(root,p).replaceAll(path.sep,'/');
 const code=fs.readFileSync(p,'utf8');
 const r=ts.transpileModule(code,{fileName:rel,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true},reportDiagnostics:true});
 const diag=(r.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 errors.push(...diag.map(d=>({file:rel,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:0,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')})));
 modules[rel]=r.outputText;
 }}}
visit(path.join(root,'src'));
if(errors.length){console.log(errors);process.exit(1);}
const bundle=`(function(){const modules={${Object.entries(modules).map(([id,code])=>JSON.stringify(id)+':function(module,exports,require){\n'+code+'\n}').join(',\n')}};const cache={};function resolve(spec,from){if(spec==='react'||spec==='react-dom/client'||spec==='react-dom')return spec;if(spec.endsWith('.css'))return 'css';const parts=from.split('/');parts.pop();for(const s of spec.split('/')){if(s==='..')parts.pop();else if(s!=='.')parts.push(s);}return parts.join('/');}function req(id){if(id==='react')return globalThis.React;if(id==='react-dom/client'||id==='react-dom')return globalThis.ReactDOM;if(id==='css')return {};if(cache[id])return cache[id].exports;const module={exports:{}};cache[id]=module;if(!modules[id])throw Error('Missing module '+id);modules[id](module,module.exports,(s)=>req(resolve(s,id)));return module.exports;}req('src/main.jsx');})();`;
fs.writeFileSync(path.join(root,'reports/syntax-check.json'),JSON.stringify({compiler:ts.version,files:Object.keys(modules),errors,method:'TypeScript transpileModule: JSX syntax validation and CommonJS compilation; runtime rendered separately.'},null,2));
const styles=['src/source-styles.css','src/preview.css'].map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
const html=`<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="robots" content="noindex,nofollow"><title>WeddingPick · 앱 디자인 React 미리보기</title><style>${styles}</style></head><body><div id="root"></div><script>${(runtime+bundle).replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
fs.writeFileSync(path.join(root,'preview.html'),html);
console.log('Compiled',Object.keys(modules).length,'modules with TypeScript',ts.version,'to',html.length,'character preview.');
