import { Redirect } from 'expo-router';

/** WP-RPT-010은 v3.24에서 폐기됐다. 기존 링크도 사진 기반 Pick 인증으로 연결한다. */
export default function PriceReportScreen() {
  return <Redirect href="/capture/payment/consent" />;
}
