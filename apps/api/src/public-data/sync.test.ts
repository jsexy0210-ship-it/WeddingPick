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
  // 보류는 사람이 봐야 하는 것이라, 사유가 안 남으면 넘어간 것과 같다.
  test('보류를 사유와 함께 남긴다',async()=>{
    await resetDatabase();
    const base={...vendor,name:'보류검증웨딩',sourceRecordId:'hold-1'};
    expect((await syncCollected(pool,[base])).created).toBe(1);
    // 업종이 다르면 반영하지 않고 넘긴다 — vendor_change_log에는 절대 안 남는 자리다.
    expect((await syncCollected(pool,[{...base,category:'studio',publishedOn:'2026-09-01'}])).held).toBe(1);
    await pool.query('UPDATE structured.vendors SET admin_locked=true WHERE name=$1',[base.name]);
    expect((await syncCollected(pool,[{...base,name:'덮어쓰기시도',publishedOn:'2026-09-02'}])).held).toBe(1);
    const holds=await pool.query<{reason:string;field_name:string|null}>(
      'SELECT reason,field_name FROM structured.vendor_import_holds ORDER BY created_at');
    expect(holds.rows).toEqual([
      {reason:'field_conflict',field_name:'category'},
      {reason:'admin_locked',field_name:null},
    ]);
    expect((await pool.query(`SELECT count(*)::int AS n FROM structured.vendor_change_log
      WHERE field_name='category' AND old_value IS NOT NULL`)).rows[0].n).toBe(0);
  });
  // 끊은 업체가 다시 잡히면 되살아나야 한다. 안 그러면 영영 안 보이는 채로 남는다.
  test('다시 나타난 업체를 되살린다',async()=>{
    await resetDatabase();
    const base={...vendor,name:'되살림검증웨딩',sourceRecordId:'revive-1'};
    expect((await syncCollected(pool,[base])).created).toBe(1);
    await pool.query(`UPDATE structured.vendors SET is_active=false,closed_at=now(),
      collection_status='closed' WHERE name=$1`,[base.name]);
    await syncCollected(pool,[base]);
    const v=await pool.query('SELECT is_active,closed_at,collection_status FROM structured.vendors');
    expect(v.rows[0]).toMatchObject({is_active:true,closed_at:null,collection_status:'needs_verification'});
    // 사람이 내린 업체는 그 표시가 없으므로 되살아나지 않는다.
    await pool.query(`UPDATE structured.vendors SET is_active=false,closed_at=now() WHERE name=$1`,[base.name]);
    await syncCollected(pool,[base]);
    expect((await pool.query('SELECT is_active FROM structured.vendors')).rows[0].is_active).toBe(false);
  });
});
