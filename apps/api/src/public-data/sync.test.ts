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

dbDescribe('보류 사유와 중단 스위치',()=>{
  let pool:Pool;
  const base:CollectedVendor={name:'보류검증웨딩',region:'경기도 이천시',category:'hall',sourceKey:'icheon-halls',
    sourceUrl:'https://www.data.go.kr/data/15100736/fileData.do',sourceRecordId:'held-1',
    publishedOn:'2026-07-01',collectedAt:'2026-09-04T00:00:00Z',status:'needs_verification'};
  beforeEach(async()=>{await resetDatabase();});
  beforeAll(async()=>{pool=new Pool({connectionString:process.env.DATABASE_URL});});
  afterAll(async()=>{await pool?.end();});

  test('보류를 사유별로 나눠 세고 held_count를 실행 기록에 남긴다',async()=>{
    // 예전에는 locked·stale·ambiguous가 전부 'held' 하나였고, DB에는
    // skipped_count(변경 없음 + 보류) 한 칸만 남아 되돌릴 수 없었다.
    expect((await syncCollected(pool,[base])).created).toBe(1);

    const stale=await syncCollected(pool,[{...base,name:'다른 이름',publishedOn:'2026-06-01'}]);
    expect(stale.held).toBe(1);
    expect(stale.heldBy).toEqual({locked:0,stale:1,ambiguous:0,conflict:0});

    await pool.query(`UPDATE structured.vendors SET admin_locked=true WHERE name=$1`,[base.name]);
    const locked=await syncCollected(pool,[{...base,name:'또 다른 이름',publishedOn:'2026-08-01'}]);
    expect(locked.heldBy).toEqual({locked:1,stale:0,ambiguous:0,conflict:0});

    const runs=await pool.query(
      `SELECT skipped_count,held_count FROM structured.import_runs ORDER BY started_at DESC LIMIT 1`);
    expect(runs.rows[0]).toEqual({skipped_count:1,held_count:1});
  });

  test('같은 이름의 다른 업체가 이미 있으면 새로 만들지 않고 보류한다',async()=>{
    await pool.query(
      `INSERT INTO structured.vendors(category,name,region,source) VALUES('hall',$1,'서울특별시 강남구','public_data')`,
      [base.name]);
    const result=await syncCollected(pool,[base]);
    expect(result.heldBy.ambiguous).toBe(1);
    expect(result.created).toBe(0);
  });

  test('sbiz-seoul·sbiz-gyeonggi에 중단 스위치 행이 있다',async()=>{
    // 0071이 이 둘을 빠뜨려, SBIZ_API_KEY가 등록되는 순간 --apply가
    // 업체 전건 SOURCE_DISABLED로 실패했다(수집은 되고 반영만 전량 실패).
    for(const sourceKey of ['sbiz-seoul','sbiz-gyeonggi'] as const){
      const result=await syncCollected(pool,[{...base,sourceKey,name:`${sourceKey} 웨딩홀`,
        sourceUrl:'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInUpjong/v2',publishedOn:null}]);
      expect([sourceKey,result.errors,result.created]).toEqual([sourceKey,0,1]);
    }
  });
});
