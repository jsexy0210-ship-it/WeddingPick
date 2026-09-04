import { Pool } from 'pg';
import { resetDatabase } from '../test/helpers';
import { syncCollected } from './sync';
import type { CollectedVendor } from './collect';

const dbDescribe = process.env.DATABASE_URL ? describe : describe.skip;
dbDescribe('공공데이터 DB 반영',()=>{
  let pool:Pool;
  const vendor:CollectedVendor={name:'검증용웨딩',region:'경기도 이천시',category:'hall',sourceKey:'icheon-halls',
    sourceUrl:'https://www.data.go.kr/data/15100736/fileData.do',sourceRecordId:'test-1',
    publishedOn:'2026-07-01',collectedAt:'2026-09-04T00:00:00Z',status:'needs_verification'};
  beforeAll(async()=>{await resetDatabase(); pool=new Pool({connectionString:process.env.DATABASE_URL});});
  afterAll(async()=>{await pool?.end();});
  test('동시 재실행·변경·오래된 값·수동 잠금을 검증한다',async()=>{
    const runs=await Promise.all([syncCollected(pool,[vendor]),syncCollected(pool,[vendor])]);
    expect(runs.reduce((n,r)=>n+r.created,0)).toBe(1);
    expect((await pool.query('SELECT count(*)::int AS n FROM structured.vendor_change_log')).rows[0].n).toBe(4);
    const newer={...vendor,name:'새 검증용웨딩',publishedOn:'2026-08-01'};
    expect((await syncCollected(pool,[newer])).updated).toBe(1);
    expect((await syncCollected(pool,[vendor])).held).toBe(1);
    await pool.query(`UPDATE structured.vendors SET admin_locked=true WHERE name=$1`,[newer.name]);
    expect((await syncCollected(pool,[{...newer,name:'덮어쓰기',publishedOn:'2026-09-01'}])).held).toBe(1);
    const rows=await pool.query('SELECT name,collection_status FROM structured.vendors');
    expect(rows.rows).toEqual([{name:newer.name,collection_status:'needs_verification'}]);
  });
});
