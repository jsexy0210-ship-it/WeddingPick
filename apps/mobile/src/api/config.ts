/**
 * 서버 주소. 없으면 앱은 기기 안에서만 돈다 — 촬영·저장까지는 되고 분석은 되지 않는다.
 * 앱 빌드 시 EXPO_PUBLIC_API_URL로 넣는다.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const isServerConfigured = Boolean(API_URL);
