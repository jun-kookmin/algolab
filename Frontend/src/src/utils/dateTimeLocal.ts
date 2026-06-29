"use client";

type DateTimeRangeValidation =
  | { ok: true; start: Date; end: Date }
  | { ok: false; message: string };

const DATE_TIME_LOCAL_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export const parseDateTimeLocal = (value: string): Date | null => {
  if (!value) return null;
  const match = value.match(DATE_TIME_LOCAL_RE);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return date;
};

export const validateDateTimeRange = (
  startValue: string,
  endValue: string
): DateTimeRangeValidation => {
  const startDate = parseDateTimeLocal(startValue);
  if (!startDate) {
    return { ok: false, message: "시작일이 올바르지 않습니다." };
  }

  const endDate = parseDateTimeLocal(endValue);
  if (!endDate) {
    return { ok: false, message: "종료일이 올바르지 않습니다." };
  }

  if (startDate.getTime() > endDate.getTime()) {
    return { ok: false, message: "시작일이 종료일보다 늦습니다." };
  }

  return { ok: true, start: startDate, end: endDate };
};
