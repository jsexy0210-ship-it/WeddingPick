/** SVG 아이콘은 로컬 파일에서 생성한 데이터 URL을 사용한다. 미첨부 사진만 null로 유지한다. */
import { iconAssets } from './iconAssets.js';

export const assetOverrides = {
  ...iconAssets,
  "uploads/samples-1788175716375-3z0c.jpg": null,
  "uploads/samples-1788175716407-57s9.jpg": null,
  "uploads/samples-1788175716419-flvg.jpg": null,
  "uploads/스타일 이미지/glamorous.png": null,
  "uploads/스타일 이미지/natural.png": null,
  "uploads/스타일 이미지/romantic.png": null,
  "uploads/스타일 이미지/urban.png": null
};
