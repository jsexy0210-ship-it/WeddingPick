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
  /*
   * 병합한 업체는 되살리지 않는다(0120).
   *
   * 수집이 끊었던 업체를 관리자가 나중에 다른 업체로 합치면, `collection_status`는
   * 'closed'인 채로 남는다. 그 상태에서 원천에 다시 잡히면 예전 조건으로는
   * 되살리기에 걸려들었고 — 사람의 판단이 자동 수집에 덮이는 것에 더해,
   * 「병합됐는데 영업 중」이 CHECK에 걸려 **임포트 전체가 되돌아갔다.**
   */
  test('병합·정지된 업체는 되살리지 않는다',async()=>{
    await resetDatabase();
    const base={...vendor,name:'병합검증웨딩',sourceRecordId:'merged-1'};
    expect((await syncCollected(pool,[base])).created).toBe(1);
    const target=await pool.query<{id:string}>(
      `INSERT INTO structured.vendors(category,name,region,source)
       VALUES('hall','흡수한웨딩','경기도 이천시','public_data') RETURNING id`);
    await pool.query(`UPDATE structured.vendors
      SET is_active=false,collection_status='closed',merged_into_vendor_id=$2
      WHERE name=$1`,[base.name,target.rows[0]!.id]);

    // 터지지 않고 조용히 넘어가야 한다 — 임포트가 통째로 되돌아가면 그날 수집이 없어진다.
    await syncCollected(pool,[base]);

    const v=await pool.query<{is_active:boolean}>(
      'SELECT is_active FROM structured.vendors WHERE name=$1',[base.name]);
    expect(v.rows[0]!.is_active).toBe(false);
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
    // 예전에는 사유가 전부 'held' 하나였고, DB에는 skipped_count(변경 없음 + 보류)
    // 한 칸만 남아 되돌릴 수 없었다. 사유 이름은 vendor_import_holds.reason과 같다.
    expect((await syncCollected(pool,[base])).created).toBe(1);

    const stale=await syncCollected(pool,[{...base,name:'다른 이름',publishedOn:'2026-06-01'}]);
    expect(stale.held).toBe(1);
    expect(stale.heldBy).toEqual({admin_locked:0,multiple_matches:0,ambiguous_name:0,
      insert_conflict:0,field_conflict:1});

    await pool.query(`UPDATE structured.vendors SET admin_locked=true WHERE name=$1`,[base.name]);
    const locked=await syncCollected(pool,[{...base,name:'또 다른 이름',publishedOn:'2026-08-01'}]);
    expect(locked.heldBy).toEqual({admin_locked:1,multiple_matches:0,ambiguous_name:0,
      insert_conflict:0,field_conflict:0});

    const runs=await pool.query(
      `SELECT skipped_count,held_count FROM structured.import_runs ORDER BY started_at DESC LIMIT 1`);
    expect(runs.rows[0]).toEqual({skipped_count:1,held_count:1});
  });

  test('같은 이름의 다른 업체가 이미 있으면 새로 만들지 않고 보류한다',async()=>{
    await pool.query(
      `INSERT INTO structured.vendors(category,name,region,source) VALUES('hall',$1,'서울특별시 강남구','public_data')`,
      [base.name]);
    const result=await syncCollected(pool,[base]);
    expect(result.heldBy.ambiguous_name).toBe(1);
    expect(result.created).toBe(0);
  });

  test('sbiz-seoul·sbiz-gyeonggi에 중단 스위치 행이 있다',async()=>{
    // 0071이 이 둘을 빠뜨려, SBIZ_API_KEY가 등록되는 순간 --apply가
    // 업체 전건 SOURCE_DISABLED로 실패했다(수집은 되고 반영만 전량 실패).
    for(const sourceKey of ['sbiz-seoul','sbiz-gyeonggi'] as const){
      const result=await syncCollected(pool,[{...base,sourceKey,name:`${sourceKey} 웨딩홀`,
        sourceUrl:'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInUpjong',publishedOn:null}]);
      expect([sourceKey,result.errors,result.created]).toEqual([sourceKey,0,1]);
    }
  });
});
