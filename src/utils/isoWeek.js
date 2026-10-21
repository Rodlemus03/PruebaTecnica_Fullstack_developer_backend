const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function getIsoWeek(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const weekday = date.getUTCDay() || 7;
  const thursday = new Date(date.getTime() + (4 - weekday) * MS_PER_DAY);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * MS_PER_DAY)) + 1;

  return { year, week };
}

function weeksInIsoYear(year) {
  return getIsoWeek(`${year}-12-28`).week;
}

function getIsoWeekRange(year, week) {
  const january4 = new Date(Date.UTC(year, 0, 4));
  const weekday = january4.getUTCDay() || 7;
  const firstMonday = january4.getTime() - (weekday - 1) * MS_PER_DAY;
  const start = new Date(firstMonday + (week - 1) * 7 * MS_PER_DAY);
  const end = new Date(start.getTime() + 6 * MS_PER_DAY);

  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
  };
}

module.exports = {
  getIsoWeek,
  getIsoWeekRange,
  weeksInIsoYear,
};
