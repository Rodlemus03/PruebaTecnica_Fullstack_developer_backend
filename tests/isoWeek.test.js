const { getIsoWeek, getIsoWeekRange, weeksInIsoYear } = require('../src/utils/isoWeek');

describe('semanas ISO', () => {
  test.each([
    [2023, 1, '2023-01-02', '2023-01-08'],
    [2023, 4, '2023-01-23', '2023-01-29'],
    [2023, 52, '2023-12-25', '2023-12-31'],
    [2022, 52, '2022-12-26', '2023-01-01'],
    [2020, 53, '2020-12-28', '2021-01-03'],
    [2026, 1, '2025-12-29', '2026-01-04'],
  ])('%i-W%i va de %s a %s', (year, week, startDate, endDate) => {
    expect(getIsoWeekRange(year, week)).toEqual({ startDate, endDate });
  });

  test.each([
    ['2023-01-01', 2022, 52],
    ['2023-01-02', 2023, 1],
    ['2021-01-03', 2020, 53],
    ['2024-12-30', 2025, 1],
    ['2025-12-29', 2026, 1],
  ])('%s pertenece a %i-W%i', (date, year, week) => {
    expect(getIsoWeek(date)).toEqual({ year, week });
  });

  test('calcula si el año tiene 52 o 53 semanas', () => {
    expect([2015, 2020, 2021, 2023, 2026].map(weeksInIsoYear)).toEqual([53, 53, 52, 52, 53]);
  });

  test('las semanas son consecutivas y cada día pertenece a su semana', () => {
    let previousEnd = null;

    for (let year = 2000; year <= 2030; year += 1) {
      for (let week = 1; week <= weeksInIsoYear(year); week += 1) {
        const { startDate, endDate } = getIsoWeekRange(year, week);

        if (previousEnd) {
          const nextDay = new Date(`${previousEnd}T00:00:00Z`);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          expect(startDate).toBe(nextDay.toISOString().slice(0, 10));
        }

        expect(getIsoWeek(startDate)).toEqual({ year, week });
        expect(getIsoWeek(endDate)).toEqual({ year, week });
        previousEnd = endDate;
      }
    }
  });
});
