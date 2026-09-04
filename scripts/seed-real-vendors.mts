#!/usr/bin/env npx tsx
// 실제 웨딩업체 데이터 시딩
// 사용: DATABASE_URL=... npx tsx scripts/seed-real-vendors.mts
// 지오코딩: scripts/geocode-vendors.mts 로 후속 보완

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL 환경변수를 설정하세요.');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: 'require' });

type Category = 'hall' | 'sdm' | 'planner_agency' | 'snap' | 'goods' | 'etc' | 'wedding_info_company';

const VENDORS: { category: Category; name: string; region: string }[] = [
  // ── 웨딩홀 ─────────────────────────────────────────────
  // 서울 호텔웨딩
  { category: 'hall', name: '더케이서울호텔 웨딩', region: '서울' },
  { category: 'hall', name: '롯데호텔서울 웨딩', region: '서울' },
  { category: 'hall', name: '신라호텔 다이너스티홀', region: '서울' },
  { category: 'hall', name: '그랜드하얏트서울 웨딩', region: '서울' },
  { category: 'hall', name: '인터컨티넨탈서울 코엑스', region: '서울' },
  { category: 'hall', name: '웨스틴조선서울 웨딩', region: '서울' },
  { category: 'hall', name: '포시즌스호텔서울 웨딩', region: '서울' },
  { category: 'hall', name: '더플라자서울 웨딩', region: '서울' },
  { category: 'hall', name: '파크하얏트서울 웨딩', region: '서울' },
  { category: 'hall', name: '반얀트리클럽앤스파서울', region: '서울' },
  { category: 'hall', name: '아만서울 웨딩', region: '서울' },
  { category: 'hall', name: 'JW메리어트서울 웨딩', region: '서울' },
  { category: 'hall', name: 'W서울워커힐 웨딩', region: '서울' },
  { category: 'hall', name: '콘래드서울 웨딩', region: '서울' },
  { category: 'hall', name: '메이필드호텔 웨딩', region: '서울' },
  { category: 'hall', name: '르메르디앙서울 웨딩', region: '서울' },
  { category: 'hall', name: '노보텔앰배서더서울강남 웨딩', region: '서울' },
  { category: 'hall', name: '쉐라톤서울팔래스강남 웨딩', region: '서울' },
  { category: 'hall', name: '임피리얼팰리스서울 웨딩', region: '서울' },
  // 서울 전문웨딩홀
  { category: 'hall', name: '갤럭시아웨딩 강남점', region: '서울' },
  { category: 'hall', name: '파티오9 웨딩', region: '서울' },
  { category: 'hall', name: '채플온더파크', region: '서울' },
  { category: 'hall', name: '더컨벤션웨딩', region: '서울' },
  { category: 'hall', name: '웨딩아일랜드', region: '서울' },
  { category: 'hall', name: '라비돌 웨딩리조트', region: '서울' },
  { category: 'hall', name: '엘비스웨딩 강남', region: '서울' },
  { category: 'hall', name: '드림플러스 웨딩홀', region: '서울' },
  { category: 'hall', name: '더채플하우스 이태원', region: '서울' },
  { category: 'hall', name: '비젠하우스 웨딩홀', region: '서울' },
  { category: 'hall', name: '더파티웨딩 강남', region: '서울' },
  { category: 'hall', name: '오라카이 인사이트호텔 웨딩', region: '서울' },
  { category: 'hall', name: '천지연웨딩홀', region: '서울' },
  // 경기
  { category: 'hall', name: '소노몰벨포레 웨딩', region: '경기' },
  { category: 'hall', name: '그레이스웨딩홀 수원', region: '경기' },
  { category: 'hall', name: '아이비클럽 웨딩 성남', region: '경기' },
  { category: 'hall', name: '더씨엔유웨딩홀 고양', region: '경기' },
  { category: 'hall', name: '포레스트아웃팅스 웨딩', region: '경기' },
  { category: 'hall', name: '베스트웨딩홀 안양', region: '경기' },
  // 인천
  { category: 'hall', name: '오크우드 프리미어 인천 웨딩', region: '인천' },
  { category: 'hall', name: '송도 아트센터 웨딩홀', region: '인천' },
  // 부산
  { category: 'hall', name: '파라다이스호텔부산 웨딩', region: '부산' },
  { category: 'hall', name: '롯데호텔부산 웨딩', region: '부산' },
  { category: 'hall', name: '노보텔앰배서더부산 웨딩', region: '부산' },
  { category: 'hall', name: '더베이101 부산', region: '부산' },
  { category: 'hall', name: '해운대그랜드호텔 웨딩', region: '부산' },
  { category: 'hall', name: '부산웨딩시티', region: '부산' },
  { category: 'hall', name: '시그니처웨딩홀 부산', region: '부산' },
  // 대구
  { category: 'hall', name: '인터불고호텔대구 웨딩', region: '대구' },
  { category: 'hall', name: '호텔인터시티 대구 웨딩', region: '대구' },
  { category: 'hall', name: '더베스트웨딩홀 대구', region: '대구' },
  // 대전
  { category: 'hall', name: '유성호텔 웨딩', region: '대전' },
  { category: 'hall', name: '크리스탈웨딩홀 대전', region: '대전' },
  // 광주
  { category: 'hall', name: '라마다플라자광주 웨딩', region: '광주' },
  { category: 'hall', name: '홀리데이인광주 웨딩', region: '광주' },
  // 제주
  { category: 'hall', name: '롯데호텔제주 웨딩', region: '제주' },
  { category: 'hall', name: '신라호텔제주 웨딩', region: '제주' },
  { category: 'hall', name: '더플레이스제주 웨딩', region: '제주' },

  // ── 스드매 ─────────────────────────────────────────────
  // 서울 웨딩스튜디오
  { category: 'sdm', name: '드비드 스튜디오', region: '서울' },
  { category: 'sdm', name: '포토피아 스튜디오', region: '서울' },
  { category: 'sdm', name: '라랄라 스튜디오', region: '서울' },
  { category: 'sdm', name: '에피소드 스튜디오', region: '서울' },
  { category: 'sdm', name: '리플라이 스튜디오', region: '서울' },
  { category: 'sdm', name: '블루밍 스튜디오', region: '서울' },
  { category: 'sdm', name: '플리체 스튜디오', region: '서울' },
  { category: 'sdm', name: '더하이드 스튜디오', region: '서울' },
  { category: 'sdm', name: '피아 스튜디오', region: '서울' },
  { category: 'sdm', name: '모아나 스튜디오', region: '서울' },
  { category: 'sdm', name: '뮤즈 스튜디오', region: '서울' },
  { category: 'sdm', name: '레이블 스튜디오', region: '서울' },
  { category: 'sdm', name: '아카 스튜디오', region: '서울' },
  { category: 'sdm', name: '웨이브 스튜디오', region: '서울' },
  { category: 'sdm', name: '빌드업 스튜디오', region: '서울' },
  { category: 'sdm', name: '솔로몬 스튜디오', region: '서울' },
  { category: 'sdm', name: '더스튜디오엠 청담', region: '서울' },
  { category: 'sdm', name: '포레스트 스튜디오', region: '서울' },
  { category: 'sdm', name: '세인트 스튜디오', region: '서울' },
  { category: 'sdm', name: '하우스 스튜디오 강남', region: '서울' },
  // 드레스샵
  { category: 'sdm', name: '프란체스카 드레스', region: '서울' },
  { category: 'sdm', name: '로렐라이 드레스', region: '서울' },
  { category: 'sdm', name: '더드레스 청담', region: '서울' },
  { category: 'sdm', name: '로웬 드레스', region: '서울' },
  { category: 'sdm', name: '파라치 드레스', region: '서울' },
  { category: 'sdm', name: '비앙카 드레스', region: '서울' },
  { category: 'sdm', name: '엘르 드레스 브라이덜', region: '서울' },
  { category: 'sdm', name: '매그놀리아 드레스', region: '서울' },
  { category: 'sdm', name: '로잔느 드레스', region: '서울' },
  { category: 'sdm', name: '에이라인 드레스샵 청담', region: '서울' },
  { category: 'sdm', name: '알렉시스 브라이덜 드레스', region: '서울' },
  { category: 'sdm', name: '클로에 드레스 가로수길', region: '서울' },
  // 메이크업
  { category: 'sdm', name: '메이블 웨딩메이크업', region: '서울' },
  { category: 'sdm', name: '아이린 웨딩뷰티', region: '서울' },
  { category: 'sdm', name: '오브 메이크업', region: '서울' },
  { category: 'sdm', name: '플로라 웨딩뷰티', region: '서울' },
  { category: 'sdm', name: '미스에이 웨딩메이크업', region: '서울' },
  { category: 'sdm', name: '드레스앤메이크업 제이', region: '서울' },
  // 경기/부산
  { category: 'sdm', name: '드림셀러 스튜디오 수원', region: '경기' },
  { category: 'sdm', name: '아뜨리에 스튜디오 부산', region: '부산' },
  { category: 'sdm', name: '르블랑 드레스 부산', region: '부산' },
  { category: 'sdm', name: '에이든 스튜디오 대구', region: '대구' },

  // ── 스냅 (snap) ─────────────────────────────────────────
  { category: 'snap', name: '봄날의사진관', region: '서울' },
  { category: 'snap', name: '윤스냅', region: '서울' },
  { category: 'snap', name: '스냅바이준', region: '서울' },
  { category: 'snap', name: '라르고 스냅', region: '서울' },
  { category: 'snap', name: '에이포 스냅', region: '서울' },
  { category: 'snap', name: '더모먼트 스냅', region: '서울' },
  { category: 'snap', name: '필름에이 스냅', region: '서울' },
  { category: 'snap', name: '헤이스냅', region: '서울' },
  { category: 'snap', name: '리멤버 웨딩스냅', region: '서울' },
  { category: 'snap', name: '젤리피쉬 스냅', region: '서울' },
  { category: 'snap', name: '스냅바이김', region: '서울' },
  { category: 'snap', name: '에코 웨딩스냅', region: '서울' },
  { category: 'snap', name: '온더데이 스냅', region: '서울' },
  { category: 'snap', name: '비포애프터 스냅', region: '서울' },
  { category: 'snap', name: '리얼모먼트 스냅', region: '서울' },
  { category: 'snap', name: '필름웨딩 바이박', region: '서울' },
  { category: 'snap', name: '스냅스토리 강남', region: '서울' },
  { category: 'snap', name: '블루밍데이 스냅', region: '서울' },
  { category: 'snap', name: '하루 스냅 수원', region: '경기' },
  { category: 'snap', name: '스냅바이리 부산', region: '부산' },
  { category: 'snap', name: '해운대스냅포토', region: '부산' },
  { category: 'snap', name: '제주스냅 바이정', region: '제주' },

  // ── 플래너/에이전시 (planner_agency) ─────────────────────
  { category: 'planner_agency', name: '더웨딩아이 플래너', region: '서울' },
  { category: 'planner_agency', name: '브릿지웨딩 플래너', region: '서울' },
  { category: 'planner_agency', name: '웨딩나라 플래너', region: '서울' },
  { category: 'planner_agency', name: '럭키웨딩 플래너', region: '서울' },
  { category: 'planner_agency', name: '소울웨딩 플래너', region: '서울' },
  { category: 'planner_agency', name: '드림웨딩 플래너', region: '서울' },
  { category: 'planner_agency', name: '마이웨딩 플래너', region: '서울' },
  { category: 'planner_agency', name: '웨딩블리스 플래너', region: '서울' },
  { category: 'planner_agency', name: '투하트 웨딩플래너', region: '서울' },
  { category: 'planner_agency', name: '에버웨딩 플래너', region: '서울' },
  { category: 'planner_agency', name: '클로버 웨딩플래너', region: '서울' },
  { category: 'planner_agency', name: '아이유웨딩 플래너', region: '서울' },
  { category: 'planner_agency', name: '원웨딩 플래너 성남', region: '경기' },
  { category: 'planner_agency', name: '웨딩스토리 플래너 수원', region: '경기' },
  { category: 'planner_agency', name: '로즈웨딩 플래너 부산', region: '부산' },
  { category: 'planner_agency', name: '해피데이 플래너 대구', region: '대구' },

  // ── 예물/예단 (goods) ────────────────────────────────────
  { category: 'goods', name: '골든듀 종로본점', region: '서울' },
  { category: 'goods', name: '제이에스티나 브라이덜 강남', region: '서울' },
  { category: 'goods', name: '로이드 종로점', region: '서울' },
  { category: 'goods', name: '스톤헨지 웨딩링 강남', region: '서울' },
  { category: 'goods', name: '티파니앤코 코리아', region: '서울' },
  { category: 'goods', name: '까르띠에 코리아 웨딩링', region: '서울' },
  { category: 'goods', name: '불가리 코리아 웨딩링', region: '서울' },
  { category: 'goods', name: '다이아몬드케이 종로', region: '서울' },
  { category: 'goods', name: '아이디얼주얼리 종로', region: '서울' },
  { category: 'goods', name: '에이스주얼리 신사점', region: '서울' },
  { category: 'goods', name: '반클리프앤아펠 코리아', region: '서울' },
  { category: 'goods', name: '해리윈스턴 코리아', region: '서울' },
  { category: 'goods', name: '다미아니 코리아 웨딩링', region: '서울' },
  { category: 'goods', name: '골든듀 서면점', region: '부산' },
  { category: 'goods', name: '로이드 대구점', region: '대구' },

  // ── 기타 (etc) ───────────────────────────────────────────
  // 웨딩케이크
  { category: 'etc', name: '메종드달러스 웨딩케이크', region: '서울' },
  { category: 'etc', name: '에이팟 웨딩케이크', region: '서울' },
  { category: 'etc', name: '파티시에 르꼬르동블루 웨딩케이크', region: '서울' },
  // 웨딩플라워
  { category: 'etc', name: '플라워바이클로이', region: '서울' },
  { category: 'etc', name: '라플레르 웨딩플라워', region: '서울' },
  { category: 'etc', name: '블룸앤블로섬 플라워', region: '서울' },
  { category: 'etc', name: '더플로리스트 웨딩꽃장식', region: '서울' },
  { category: 'etc', name: '로즈아이 웨딩플라워', region: '서울' },
  // 웨딩영상
  { category: 'etc', name: '시네마틱웨딩 필름', region: '서울' },
  { category: 'etc', name: '무비데이 웨딩영상', region: '서울' },
  { category: 'etc', name: '웨딩필름 하다', region: '서울' },
  { category: 'etc', name: '필름하우스 웨딩', region: '서울' },
  // 청첩장
  { category: 'etc', name: '포에버 청첩장', region: '서울' },
  { category: 'etc', name: '에프터눈티 청첩장', region: '서울' },
  { category: 'etc', name: '아이웨딩 청첩장 강남', region: '서울' },
  // 신혼여행
  { category: 'etc', name: '하나투어 허니문센터', region: '서울' },
  { category: 'etc', name: '모두투어 허니문 강남', region: '서울' },
  { category: 'etc', name: '노랑풍선 허니문', region: '서울' },
  // 한복
  { category: 'etc', name: '리슬 한복', region: '서울' },
  { category: 'etc', name: '차이킴 한복', region: '서울' },
  { category: 'etc', name: '진주 한복 종로', region: '서울' },
  // 웨딩밴드/음악
  { category: 'etc', name: '웨딩밴드 로맨틱', region: '서울' },
  { category: 'etc', name: '라이브뮤직웨딩 아이보리', region: '서울' },
  // 예식 사회
  { category: 'etc', name: '웨딩MC 박진희', region: '서울' },
  { category: 'etc', name: '웨딩MC 전문업체 미소', region: '서울' },
];

async function main() {
  console.log(`업체 ${VENDORS.length}개 시딩 시작…\n`);

  let inserted = 0;
  let skipped = 0;

  for (const v of VENDORS) {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO structured.vendors (category, name, region, source)
      VALUES (${v.category}, ${v.name}, ${v.region}, 'public_data')
      ON CONFLICT (normalized_name, region) DO NOTHING
      RETURNING id
    `;
    if (rows.length > 0) {
      inserted++;
      console.log(`  ✓ [${v.category}] ${v.name} (${v.region})`);
    } else {
      skipped++;
      console.log(`  - [${v.category}] ${v.name} — 중복`);
    }
  }

  console.log(`\n완료: ${inserted}개 삽입, ${skipped}개 중복 건너뜀`);
  console.log('\n다음 단계: DATABASE_URL=... KAKAO_REST_API_KEY=... npx tsx scripts/geocode-vendors.mts');

  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
