import type { AuthProvider } from '@weddingpick/api-contract';
import { Platform } from 'react-native';

import { providerLabel, signingInNotice, usableProviders } from './providers';

/**
 * 로그인 제공자 고르기. 카카오 하나이던 목록에 애플이 붙으면서 «어느 버튼이 어디에
 * 보이는가»가 판단이 됐다 — 틀리면 심사에서 막히거나(애플이 빠짐) 눌러도 아무 일이
 * 없는 버튼이 선다(안드로이드의 애플).
 *
 * 여기서 확인하는 것은 목록과 문구뿐이다. 실제 로그인(`startSignIn`)은 네이티브
 * 모듈과 카카오 서버를 타므로 이 자리에서 흉내 내지 않는다.
 */
const KAKAO: AuthProvider = { provider: 'kakao', isDevelopmentStandIn: false };
const APPLE: AuthProvider = { provider: 'apple', isDevelopmentStandIn: false };
const GOOGLE: AuthProvider = { provider: 'google', isDevelopmentStandIn: false };
const NAVER: AuthProvider = { provider: 'naver', isDevelopmentStandIn: false };
/** 서버는 개발용 대체를 `apple` 자리에 얹어 내려보낸다(api `index.ts`). */
const STAND_IN: AuthProvider = { provider: 'apple', isDevelopmentStandIn: true };

function onPlatform(os: 'ios' | 'android' | 'web', run: () => void) {
  const original = Platform.OS;

  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

  try {
    run();
  } finally {
    Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
  }
}

describe('usableProviders', () => {
  it('iOS는 카카오와 애플 둘 다 — 심사지침 4.8이 애플을 요구한다', () => {
    onPlatform('ios', () => {
      expect(usableProviders([APPLE, KAKAO])).toEqual([KAKAO, APPLE]);
    });
  });

  it('안드로이드·웹에서는 애플을 뺀다 — 눌러도 열 수 없다', () => {
    onPlatform('android', () => {
      expect(usableProviders([APPLE, KAKAO])).toEqual([KAKAO]);
    });
    onPlatform('web', () => {
      expect(usableProviders([APPLE, KAKAO])).toEqual([KAKAO]);
    });
  });

  it('네이버·구글은 어느 플랫폼에서도 화면에 두지 않는다', () => {
    onPlatform('ios', () => {
      expect(usableProviders([KAKAO, GOOGLE, NAVER])).toEqual([KAKAO]);
    });
  });

  it('개발용 대체는 `apple` 자리에 와도 남는다 — 안드로이드 개발 빌드의 유일한 문이다', () => {
    onPlatform('android', () => {
      expect(usableProviders([STAND_IN])).toEqual([STAND_IN]);
    });
  });

  it('순서는 카카오 · 애플 · 개발용이다', () => {
    onPlatform('ios', () => {
      expect(usableProviders([STAND_IN, APPLE, KAKAO]).map((p) => p.isDevelopmentStandIn)).toEqual([
        false,
        false,
        true,
      ]);
    });
  });
});

describe('providerLabel', () => {
  it('애플은 첫 로그인이든 아니든 «Apple로 계속하기» 하나다', () => {
    expect(providerLabel(APPLE, 'start')).toBe('Apple로 계속하기');
    expect(providerLabel(APPLE, 'continue')).toBe('Apple로 계속하기');
  });

  it('카카오는 첫 진입과 로그인 유지가 다르다', () => {
    expect(providerLabel(KAKAO, 'start')).toBe('카카오로 시작하기');
    expect(providerLabel(KAKAO, 'continue')).toBe('카카오로 계속하기');
  });

  it('개발용 대체는 `apple` 자리에 와도 애플이라고 적지 않는다', () => {
    expect(providerLabel(STAND_IN, 'start')).toBe('개발용 로그인');
  });
});

describe('signingInNotice', () => {
  it('제공자마다 다른 한 줄 — 애플을 눌렀는데 카카오라고 적지 않는다', () => {
    expect(signingInNotice(APPLE)).toBe('Apple로 로그인하는 중이에요');
    expect(signingInNotice(KAKAO)).toBe('카카오로 로그인하는 중이에요');
  });

  it('개발용 대체와 아직 모르는 상태는 카카오 문구로 둔다', () => {
    expect(signingInNotice(STAND_IN)).toBe('카카오로 로그인하는 중이에요');
    expect(signingInNotice(null)).toBe('카카오로 로그인하는 중이에요');
  });
});
