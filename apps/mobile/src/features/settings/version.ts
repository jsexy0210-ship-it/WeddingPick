import Constants from 'expo-constants';

/**
 * 화면에 적는 앱 버전. 핸드오프 19번.
 *
 * **app.json의 값을 그대로 읽는다.** 화면에 숫자를 박아두면 배포할 때마다 두 곳을
 * 고쳐야 하고, 언젠가 한 곳만 고친다 — 그러면 사용자가 문의할 때 말하는 버전과
 * 실제로 깔린 버전이 달라진다.
 */
export const APP_VERSION = Constants.expoConfig?.version ?? '알 수 없음';
