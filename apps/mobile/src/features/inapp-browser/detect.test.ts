import { detectInAppBrowser, detectMobileOs, planInAppEscape } from './detect';

/**
 * 표본 User-Agent. 실제 앱이 싣는 문자열 형태를 그대로 둔다 — 표식만 뽑아
 * 적어두면 앞뒤 문맥에서 생기는 오검출(예: `Line`과 `Linux`)을 못 잡는다.
 */
const UA = {
  kakaoAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S908N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.4.3',
  kakaoIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.3',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S908N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 Instagram 302.0.0.23.113 Android (33/13; 420dpi; 1080x2129; samsung; SM-S908N; ko_KR)',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.23.113 (iPhone14,2; iOS 17_5_1; ko_KR; ko; scale=3.00; 1170x2532)',
  facebookIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5.1;FBID/phone]',
  lineIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1 Line/14.5.0',
  naverAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S908N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 1000; 12.5.4)',
  daumAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S908N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36 DaumApps/6.5.0',

  /* 아래는 전부 일반 브라우저다. 하나라도 인앱으로 잡히면 안 된다. */
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  samsungInternet:
    'Mozilla/5.0 (Linux; Android 13; SM-S908N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/21.0 Chrome/110.0.0.0 Mobile Safari/537.36',
  whaleAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S908N) AppleWebKit/537.36 (KHTML, like Gecko) Whale/1.0.0.0 Chrome/116.0.0.0 Mobile Safari/537.36',
  chromeDesktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
} as const;

const URL_IN_APP = 'https://weddingpick-app-web.onrender.com/login?wp_ext=1';

describe('인앱 브라우저 판별', () => {
  it.each([
    ['카카오톡 안드로이드', UA.kakaoAndroid, 'kakaotalk'],
    ['카카오톡 iOS', UA.kakaoIos, 'kakaotalk'],
    ['인스타그램 안드로이드', UA.instagramAndroid, 'instagram'],
    ['인스타그램 iOS', UA.instagramIos, 'instagram'],
    ['페이스북 iOS', UA.facebookIos, 'facebook'],
    ['라인 iOS', UA.lineIos, 'line'],
    ['네이버 안드로이드', UA.naverAndroid, 'naver'],
    ['다음 안드로이드', UA.daumAndroid, 'daum'],
  ])('%s를 알아본다', (_name, userAgent, app) => {
    expect(detectInAppBrowser(userAgent)).toBe(app);
  });

  /**
   * 오검출이 미검출보다 나쁘다. 일반 브라우저를 인앱으로 보고 바깥으로 튕기면
   * 멀쩡히 쓰던 사람이 창을 잃는다 — 인앱을 못 알아본 쪽은 로그인 하나가
   * 불편해질 뿐이다.
   */
  it.each([
    ['안드로이드 크롬', UA.chromeAndroid],
    ['iOS 사파리', UA.safariIos],
    ['삼성 인터넷', UA.samsungInternet],
    ['웨일', UA.whaleAndroid],
    ['PC 크롬', UA.chromeDesktop],
    ['맥 사파리', UA.safariMac],
  ])('%s는 인앱으로 보지 않는다', (_name, userAgent) => {
    expect(detectInAppBrowser(userAgent)).toBeNull();
  });

  it('빈 User-Agent도 인앱으로 보지 않는다', () => {
    expect(detectInAppBrowser('')).toBeNull();
  });
});

describe('OS 판별', () => {
  it.each([
    [UA.kakaoIos, 'ios'],
    [UA.instagramIos, 'ios'],
    [UA.kakaoAndroid, 'android'],
    [UA.naverAndroid, 'android'],
    [UA.chromeDesktop, 'other'],
    [UA.safariMac, 'other'],
  ])('%s → %s', (userAgent, os) => {
    expect(detectMobileOs(userAgent)).toBe(os);
  });
});

describe('탈출 방법 결정', () => {
  it('일반 브라우저는 그냥 둔다', () => {
    expect(planInAppEscape(UA.chromeAndroid, URL_IN_APP)).toEqual({ kind: 'stay' });
    expect(planInAppEscape(UA.safariIos, URL_IN_APP)).toEqual({ kind: 'stay' });
  });

  it('카카오톡은 OS를 가리지 않고 openExternal 스킴으로 넘긴다', () => {
    const href = `kakaotalk://web/openExternal?url=${encodeURIComponent(URL_IN_APP)}`;

    expect(planInAppEscape(UA.kakaoAndroid, URL_IN_APP)).toEqual({ kind: 'open', href });
    expect(planInAppEscape(UA.kakaoIos, URL_IN_APP)).toEqual({ kind: 'open', href });
  });

  it('안드로이드 기타 인앱은 크롬을 지목한 intent 주소로 넘긴다', () => {
    expect(planInAppEscape(UA.instagramAndroid, URL_IN_APP)).toEqual({
      kind: 'open',
      href: 'intent://weddingpick-app-web.onrender.com/login?wp_ext=1#Intent;scheme=https;package=com.android.chrome;end',
    });
  });

  /**
   * **iOS 기타 인앱에서는 억지로 시도하지 않는다.** 사파리를 강제로 띄우는
   * 공개 API가 없다 — 안 되는 것을 되는 척하면 빈 화면이나 멈춘 화면만 남는다.
   */
  it.each([
    ['인스타그램', UA.instagramIos],
    ['페이스북', UA.facebookIos],
    ['라인', UA.lineIos],
  ])('iOS %s 인앱은 안내만 한다', (_name, userAgent) => {
    expect(planInAppEscape(userAgent, URL_IN_APP)).toEqual({ kind: 'guide' });
  });

  /** OS를 모르는 인앱은 사파리 안내가 맞지 않는 자리다. 그냥 둔다. */
  it('안드로이드도 iOS도 아닌 인앱은 그냥 둔다', () => {
    const desktopLine = `${UA.chromeDesktop} Line/14.5.0`;

    expect(detectInAppBrowser(desktopLine)).toBe('line');
    expect(planInAppEscape(desktopLine, URL_IN_APP)).toEqual({ kind: 'stay' });
  });
});
