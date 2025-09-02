/**
 * [RU] Утилиты для работы с датами и временем
 * [EN] Date and time utilities
 */

/**
 * [RU] Форматирование даты в читаемый формат
 * [EN] Format date to readable format
 */
function formatDate(date, options = {}) {
  const {
    includeTime = false,
    includeSeconds = false,
    locale = 'ru-RU'
  } = options;

  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    throw new Error('Неверный формат даты');
  }

  const formatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  };

  if (includeTime) {
    formatOptions.hour = '2-digit';
    formatOptions.minute = '2-digit';
    
    if (includeSeconds) {
      formatOptions.second = '2-digit';
    }
  }

  return dateObj.toLocaleDateString(locale, formatOptions);
}

/**
 * [RU] Относительное время (как давно/через сколько)
 * [EN] Relative time (how long ago/in how long)
 */
function getRelativeTime(date) {
  const now = new Date();
  const targetDate = new Date(date);
  const diffMs = targetDate - now;
  const diffMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const isPast = diffMs < 0;

  if (diffMinutes < 1) {
    return isPast ? 'только что' : 'прямо сейчас';
  }

  if (diffMinutes < 60) {
    return isPast 
      ? `${diffMinutes} мин. назад`
      : `через ${diffMinutes} мин.`;
  }

  if (diffHours < 24) {
    return isPast 
      ? `${diffHours} ч. назад`
      : `через ${diffHours} ч.`;
  }

  if (diffDays < 7) {
    return isPast 
      ? `${diffDays} дн. назад`
      : `через ${diffDays} дн.`;
  }

  // Для больших периодов возвращаем точную дату
  return formatDate(date, { includeTime: true });
}

/**
 * [RU] Проверка, является ли дата сегодня
 * [EN] Check if date is today
 */
function isToday(date) {
  const today = new Date();
  const checkDate = new Date(date);
  
  return today.toDateString() === checkDate.toDateString();
}

/**
 * [RU] Проверка, является ли дата завтра
 * [EN] Check if date is tomorrow
 */
function isTomorrow(date) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const checkDate = new Date(date);
  
  return tomorrow.toDateString() === checkDate.toDateString();
}

/**
 * [RU] Проверка, является ли дата в пределах указанного количества дней
 * [EN] Check if date is within specified number of days
 */
function isWithinDays(date, days) {
  const now = new Date();
  const targetDate = new Date(date);
  const diffMs = Math.abs(targetDate - now);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays <= days;
}

/**
 * [RU] Получение временных меток для напоминаний
 * [EN] Get reminder timestamps
 */
function getReminderTimes(eventDate) {
  const event = new Date(eventDate);
  
  return {
    weekBefore: new Date(event.getTime() - (7 * 24 * 60 * 60 * 1000)),
    dayBefore: new Date(event.getTime() - (24 * 60 * 60 * 1000)),
    hourBefore: new Date(event.getTime() - (60 * 60 * 1000)),
    eventTime: event
  };
}

/**
 * [RU] Парсинг даты из различных форматов
 * [EN] Parse date from various formats
 */
function parseDate(dateString) {
  // Поддерживаемые форматы
  const formats = [
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,        // DD.MM.YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,        // DD/MM/YYYY
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,          // YYYY-MM-DD
    /^(\d{1,2})\s+(\w+)\s+(\d{4})$/           // DD MONTH YYYY
  ];

  // Месяцы на русском
  const months = {
    'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3,
    'мая': 4, 'июня': 5, 'июля': 6, 'августа': 7,
    'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
  };

  for (const format of formats) {
    const match = dateString.match(format);
    if (match) {
      if (format.source.includes('\\w+')) {
        // Формат с названием месяца
        const [, day, monthName, year] = match;
        const month = months[monthName.toLowerCase()];
        if (month !== undefined) {
          return new Date(year, month, day);
        }
      } else if (format.source.startsWith('^(\\d{4})')) {
        // YYYY-MM-DD
        const [, year, month, day] = match;
        return new Date(year, month - 1, day);
      } else {
        // DD.MM.YYYY или DD/MM/YYYY
        const [, day, month, year] = match;
        return new Date(year, month - 1, day);
      }
    }
  }

  // Пытаемся стандартный парсинг
  const standardDate = new Date(dateString);
  if (!isNaN(standardDate.getTime())) {
    return standardDate;
  }

  throw new Error(`Не удалось распознать формат даты: ${dateString}`);
}

/**
 * [RU] Создание даты с временем
 * [EN] Create date with time
 */
function createDateTime(date, time = '00:00') {
  const dateObj = new Date(date);
  const [hours, minutes] = time.split(':').map(Number);
  
  dateObj.setHours(hours, minutes, 0, 0);
  return dateObj;
}

/**
 * [RU] Получение начала дня
 * [EN] Get start of day
 */
function getStartOfDay(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * [RU] Получение конца дня
 * [EN] Get end of day
 */
function getEndOfDay(date = new Date()) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * [RU] Валидация даты
 * [EN] Date validation
 */
function isValidDate(date) {
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * [RU] Добавление времени к дате
 * [EN] Add time to date
 */
function addTime(date, amount, unit) {
  const result = new Date(date);
  
  switch (unit) {
    case 'minutes':
      result.setMinutes(result.getMinutes() + amount);
      break;
    case 'hours':
      result.setHours(result.getHours() + amount);
      break;
    case 'days':
      result.setDate(result.getDate() + amount);
      break;
    case 'weeks':
      result.setDate(result.getDate() + (amount * 7));
      break;
    case 'months':
      result.setMonth(result.getMonth() + amount);
      break;
    case 'years':
      result.setFullYear(result.getFullYear() + amount);
      break;
    default:
      throw new Error(`Неподдерживаемая единица времени: ${unit}`);
  }
  
  return result;
}

module.exports = {
  formatDate,
  getRelativeTime,
  isToday,
  isTomorrow,
  isWithinDays,
  getReminderTimes,
  parseDate,
  createDateTime,
  getStartOfDay,
  getEndOfDay,
  isValidDate,
  addTime
};