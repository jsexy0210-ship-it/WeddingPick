import { SITE_ORIGIN } from '@weddingpick/domain';

import strings from '../../../../spec/strings.ko.json';

/**
 * 앱 웹(`export:web`) 링크 공유 카드(OG) 값.
 *
 * 문구는 새로 짓지 않는다 — `apps/web`이 이미 쓰는
 * `spec/strings.ko.json`의 `webLanding.metaTitle` · `metaDescription`을 그대로
 * 가져온다. 그림도 `apps/web`이 굽는 코랄 카드(`SITE_ORIGIN`의
 * `weddingpick-og.png`)를 그대로 가리킨다 — 같은 그림을 앱 웹에 또 두면 문구나
 * 색이 바뀔 때 한쪽만 다시 구워지는 사본이 생긴다.
 *
 * **`og:url`만은 앱 웹 자신의 주소여야 한다.** `EXPO_PUBLIC_WEB_URL`은
 * 이 export의 배포 주소(빌드 타임 환경변수)이고, 값이 없는 로컬·프리뷰 빌드에서는
 * 운영 주소로 대신한다.
 */
const APP_WEB_ORIGIN_FALLBACK = 'https://210.109.82.212';

export const APP_WEB_ORIGIN = (process.env.EXPO_PUBLIC_WEB_URL || APP_WEB_ORIGIN_FALLBACK).replace(/\/+$/, '');

const COPY = strings.webLanding;

export const SHARE_TITLE = COPY.metaTitle;
export const SHARE_DESCRIPTION = COPY.metaDescription;
export const SHARE_IMAGE = `${SITE_ORIGIN}/assets/weddingpick-og.png`;
export const SHARE_IMAGE_ALT = `${COPY.brand} — ${COPY.og.hero.split('\n').join(' ')}`;
