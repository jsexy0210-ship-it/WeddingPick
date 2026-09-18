const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps/mobile/src/components/confirmation-queue.ts'), 'utf8');
const built = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} });
assert.equal(built.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const mod = { exports: {} };
vm.runInNewContext(built.outputText, { module: mod, exports: mod.exports });
const { createConfirmationQueue } = mod.exports;
function setup() {
 let scope='/a', shown=[], disposed=[], errors=[], controls=[];
 const queue=createConfirmationQueue({scope:()=>scope,render:(r,select)=>{shown.push(r);controls.push(select);return()=>disposed.push(r.id);},onError:e=>errors.push(e)});
 return {queue,shown,disposed,errors,controls,move:s=>scope=s};
}
test('requests render one at a time in FIFO order',()=>{const x=setup();x.queue.enqueue('a','',[]);x.queue.enqueue('b','',[]);assert.equal(x.shown.length,1);x.controls[0](null);assert.deepEqual(x.shown.map(x=>x.title),['a','b']);assert.deepEqual(x.disposed,[1]);});
test('double click invokes an action once and cannot close the next dialog',()=>{const x=setup();let n=0;x.queue.enqueue('a','',[{text:'ok',onPress:()=>n++}]);x.queue.enqueue('b','',[]);x.controls[0](0);x.controls[0](0);assert.equal(n,1);assert.deepEqual(x.disposed,[1]);});
test('invalid button indexes never dismiss or execute',()=>{const x=setup();let n=0;x.queue.enqueue('a','',[{text:'ok',onPress:()=>n++}]);for(const i of [-1,2,.3,NaN,Infinity])x.controls[0](i);assert.equal(n,0);assert.equal(x.disposed.length,0);x.controls[0](0);assert.equal(n,1);});
test('navigation invalidates queued requests and does not run cancellation callbacks',()=>{const x=setup();let n=0;x.queue.enqueue('a','',[{text:'cancel',style:'cancel',onPress:()=>n++}]);x.queue.enqueue('b','',[]);x.move('/b');x.queue.checkScope();assert.equal(x.shown.length,1);assert.deepEqual(x.disposed,[1]);x.controls[0](0);assert.equal(n,0);});
test('action click checks navigation synchronously, before the scope timer',()=>{const x=setup();let n=0;x.queue.enqueue('a','',[{text:'delete',onPress:()=>n++}]);x.move('/b');x.controls[0](0);assert.equal(n,0);assert.deepEqual(x.disposed,[1]);});
test('nested request opens only after current dialog cleanup',()=>{const x=setup();x.queue.enqueue('a','',[{text:'ok',onPress:()=>{assert.deepEqual(x.disposed,[1]);x.queue.enqueue('nested','',[]);assert.equal(x.shown.length,1);}}]);x.controls[0](0);assert.equal(x.shown[1].title,'nested');});
test('requests from the previous route are dropped after callback navigation',()=>{const x=setup();x.queue.enqueue('a','',[{text:'ok',onPress:()=>x.move('/b')}]);x.queue.enqueue('old success','',[]);x.controls[0](0);assert.equal(x.shown.length,1);});
test('new request after navigation can open immediately',()=>{const x=setup();x.queue.enqueue('old','',[]);x.move('/b');x.queue.enqueue('new','',[]);assert.deepEqual(x.shown.map(x=>x.title),['old','new']);});
test('caller cannot mutate the callbacks of an open request',()=>{const x=setup();let n=0;const b=[{text:'a',onPress:()=>n++}];x.queue.enqueue('a','',b);b[0].onPress=()=>n+=100;b[0].text='changed';x.controls[0](0);assert.equal(n,1);assert.equal(x.shown[0].buttons[0].text,'a');});
test('synchronous errors are reported and the next request remains usable',()=>{const x=setup();x.queue.enqueue('a','',[{text:'ok',onPress:()=>{throw Error('failure');}}]);x.queue.enqueue('next','',[]);x.controls[0](0);assert.equal(x.errors.length,1);assert.equal(x.shown[1].title,'next');});
test('asynchronous callback errors are reported',async()=>{const x=setup();x.queue.enqueue('a','',[{text:'ok',onPress:async()=>{throw Error('async');}}]);x.controls[0](0);await new Promise(r=>setImmediate(r));assert.equal(x.errors[0].message,'async');});
test('asynchronous errors from an old route are not raised in a new route',async()=>{const x=setup();let reject;const wait=new Promise((_,r)=>reject=r);x.queue.enqueue('a','',[{text:'ok',onPress:()=>wait}]);x.controls[0](0);x.move('/b');reject(Error('old'));await new Promise(r=>setImmediate(r));assert.equal(x.errors.length,0);});
test('reset cleans an active modal and all pending requests',()=>{const x=setup();x.queue.enqueue('a','',[]);x.queue.enqueue('b','',[]);x.queue.reset();assert.deepEqual(x.disposed,[1]);x.queue.enqueue('c','',[]);assert.deepEqual(x.shown.map(r=>r.title),['a','c']);});
test('renderer failures are reported rather than considered success',()=>{const errors=[];const x=createConfirmationQueue({scope:()=>'',render:()=>{throw Error('render');},onError:e=>errors.push(e)});x.enqueue('a','',[]);assert.equal(errors.length,1);});
