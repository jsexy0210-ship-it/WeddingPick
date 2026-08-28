import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function CaptureScreen() {
  return (
    <ScreenPlaceholder
      screenId="A-04"
      title="촬영"
      phase={1}
      summary="카메라 촬영 / 사진 불러오기 / PDF 불러오기. 별도 입력폼을 요구하지 않는다 — 제품 원칙 1."
    />
  );
}
