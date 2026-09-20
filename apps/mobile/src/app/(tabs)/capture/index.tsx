import { Redirect } from 'expo-router';

/** 없어진 제보 홈의 저장 링크는 동의 여부를 확인한 뒤 Pick 인증 등록 화면으로 넘긴다. */
export default function CaptureRedirect() {
  return <Redirect href="/capture/payment/consent?from=reports" />;
}
