import { TIME_PATTERN } from '@/features/common/os-picker-field.shared';

/**
 * 일정 폼의 값 계산. 날짜 · 시간은 OS 선택기(`OsDateField` · `OsTimeField`)가 고른다 —
 * 달력과 시각 직접 입력을 묶던 «일시» 필드(`DateTimeField`)는 쓰는 곳이 없어 지웠다
 * (2026-09-25 대표 지시 「OS 데이트피커 · 타임피커」).
 */

/** `YYYY-MM-DD` + `HH:MM`(로컬) → ISO. 둘 중 하나라도 없으면 null. */
export function combineDayTime(day: string | null, time: string): string | null {
  if (day === null || !TIME_PATTERN.test(time)) return null;

  const parsed = new Date(`${day}T${time}:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
