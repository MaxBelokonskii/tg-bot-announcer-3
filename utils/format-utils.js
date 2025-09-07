/**
 * [RU] Утилиты для форматирования текста и данных
 * [EN] Text and data formatting utilities
 */

/**
 * [RU] Форматирование имени пользователя
 * [EN] Format user name
 */
function formatUserName(user) {
  if (!user) return 'Неизвестный пользователь';
  
  if (user.full_name) {
    return user.full_name;
  }
  
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  
  if (user.first_name) {
    return user.first_name;
  }
  
  if (user.username) {
    return `@${user.username}`;
  }
  
  return `Пользователь ${user.id || user.telegram_id || 'без имени'}`;
}

/**
 * [RU] Обрезка текста с многоточием
 * [EN] Truncate text with ellipsis
 */
function truncateText(text, maxLength = 100, ellipsis = '...') {
  if (!text || text.length <= maxLength) {
    return text || '';
  }
  
  return text.substring(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * [RU] Экранирование специальных символов для Telegram
 * [EN] Escape special characters for Telegram
 */
function escapeMarkdown(text) {
  if (!text) return '';
  
  // Экранируем специальные символы Markdown
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/**
 * [RU] Форматирование статуса
 * [EN] Format status
 */
function formatStatus(status) {
  const statusMap = {
    pending: '⏳ Ожидание',
    sent: '✅ Отправлено',
    delivered: '📨 Доставлено',
    failed: '❌ Ошибка',
    cancelled: '🚫 Отменено',
    blocked: '🔒 Заблокировано',
    active: '✅ Активен',
    inactive: '⏸️ Неактивен'
  };
  
  return statusMap[status] || status;
}

/**
 * [RU] Форматирование числа с разделителями тысяч
 * [EN] Format number with thousands separators
 */
function formatNumber(number, locale = 'ru-RU') {
  if (typeof number !== 'number') {
    return number;
  }
  
  return number.toLocaleString(locale);
}

/**
 * [RU] Форматирование размера файла
 * [EN] Format file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Б';
  
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * [RU] Форматирование времени выполнения
 * [EN] Format execution time
 */
function formatDuration(milliseconds) {
  if (milliseconds < 1000) {
    return `${milliseconds}мс`;
  }
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}д ${hours % 24}ч ${minutes % 60}м`;
  }
  
  if (hours > 0) {
    return `${hours}ч ${minutes % 60}м ${seconds % 60}с`;
  }
  
  if (minutes > 0) {
    return `${minutes}м ${seconds % 60}с`;
  }
  
  return `${seconds}с`;
}

/**
 * [RU] Создание прогресс-бара
 * [EN] Create progress bar
 */
function createProgressBar(current, total, length = 10) {
  if (total === 0) return '░'.repeat(length);
  
  const progress = Math.floor((current / total) * length);
  const filled = '█'.repeat(progress);
  const empty = '░'.repeat(length - progress);
  
  return filled + empty;
}

/**
 * [RU] Форматирование процентов
 * [EN] Format percentage
 */
function formatPercentage(value, total, decimals = 1) {
  if (total === 0) return '0%';
  
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * [RU] Форматирование списка элементов
 * [EN] Format list of items
 */
function formatList(items, options = {}) {
  const {
    numbered = false,
    bullet = '•',
    separator = '\n',
    maxItems = null
  } = options;
  
  if (!Array.isArray(items) || items.length === 0) {
    return 'Список пуст';
  }
  
  let displayItems = maxItems ? items.slice(0, maxItems) : items;
  
  const formatted = displayItems.map((item, index) => {
    const prefix = numbered ? `${index + 1}.` : bullet;
    return `${prefix} ${item}`;
  });
  
  let result = formatted.join(separator);
  
  if (maxItems && items.length > maxItems) {
    result += `${separator}... и ещё ${items.length - maxItems}`;
  }
  
  return result;
}

/**
 * [RU] Центрирование текста
 * [EN] Center text
 */
function centerText(text, width = 40, fillChar = ' ') {
  if (text.length >= width) return text;
  
  const totalPadding = width - text.length;
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  
  return fillChar.repeat(leftPadding) + text + fillChar.repeat(rightPadding);
}

/**
 * [RU] Очистка текста от лишних пробелов
 * [EN] Clean text from extra spaces
 */
function cleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/\s+/g, ' ')  // Множественные пробелы в один
    .replace(/\n\s*\n/g, '\n')  // Множественные переносы в один
    .trim();  // Убираем пробелы в начале и конце
}

/**
 * [RU] Создание заголовка с разделителями
 * [EN] Create header with separators
 */
function createHeader(title, char = '=', width = 40) {
  const cleanTitle = ` ${title} `;
  const totalPadding = Math.max(0, width - cleanTitle.length);
  const sidePadding = Math.floor(totalPadding / 2);
  
  const leftSide = char.repeat(sidePadding);
  const rightSide = char.repeat(totalPadding - sidePadding);
  
  return leftSide + cleanTitle + rightSide;
}

/**
 * [RU] Форматирование JSON для читаемого вывода
 * [EN] Format JSON for readable output
 */
function formatJSON(obj, indent = 2) {
  return JSON.stringify(obj, null, indent);
}

/**
 * [RU] Маскирование чувствительной информации
 * [EN] Mask sensitive information
 */
function maskSensitive(text, visibleChars = 4, maskChar = '*') {
  if (!text || text.length <= visibleChars) {
    return maskChar.repeat(text?.length || 4);
  }
  
  const visible = text.substring(0, visibleChars);
  const masked = maskChar.repeat(text.length - visibleChars);
  
  return visible + masked;
}

/**
 * [RU] Создание случайного идентификатора
 * [EN] Generate random identifier
 */
function generateId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * [RU] Форматирование сообщения с полезной информацией
 * [EN] Format useful information message
 */
function formatUsefulInfoMessage(usefulInfo) {
  if (!Array.isArray(usefulInfo) || usefulInfo.length === 0) {
    return '📋 <b>Полезная информация</b>\n\nИнформация временно недоступна.';
  }

  let message = '📋 <b>Полезная информация</b>\n\n';
  
  usefulInfo.forEach((info, index) => {
    message += `💡 ${info}`;
    if (index < usefulInfo.length - 1) {
      message += '\n\n';
    }
  });
  
  return message;
}

/**
 * [RU] Форматирование сообщения с деталями события
 * [EN] Format event details message
 */
function formatEventDetailsMessage(eventDetails) {
  if (!eventDetails || typeof eventDetails !== 'object') {
    return '📅 <b>Детали события</b>\n\nИнформация временно недоступна.';
  }

  let message = '📅 <b>Детали события</b>\n\n';
  
  if (eventDetails.name) {
    message += `🎉 <b>Название:</b> ${eventDetails.name}\n`;
  }
  
  if (eventDetails.date) {
    message += `📅 <b>Дата:</b> ${eventDetails.date}\n`;
  }
  
  if (eventDetails.time) {
    message += `⏰ <b>Время:</b> ${eventDetails.time}\n`;
  }
  
  if (eventDetails.location) {
    message += `📍 <b>Место:</b> ${eventDetails.location}\n`;
  }
  
  if (eventDetails.address) {
    message += `🗺️ <b>Адрес:</b> ${eventDetails.address}\n`;
  }
  
  if (eventDetails.dressCode) {
    message += `👗 <b>Дресс-код:</b> ${eventDetails.dressCode}\n`;
  }
  
  if (eventDetails.contact) {
    message += `📞 <b>Контакты:</b> ${eventDetails.contact}\n`;
  }
  
  if (eventDetails.description) {
    message += `\n📝 <b>Описание:</b>\n${eventDetails.description}`;
  }
  
  if (eventDetails.specialInstructions) {
    message += `\n\n⚠️ <b>Особые указания:</b>\n${eventDetails.specialInstructions}`;
  }
  
  return message;
}

/**
 * [RU] Форматирование статистики доставки для админской рассылки
 * [EN] Format delivery statistics for admin broadcast
 */
function formatEnhancedDeliveryStats(stats) {
  if (!stats) return 'Статистика недоступна';
  
  let message = '📊 <b>Статистика улучшенной рассылки</b>\n\n';
  
  if (stats.total !== undefined) {
    message += `👥 <b>Всего пользователей:</b> ${formatNumber(stats.total)}\n`;
  }
  
  if (stats.eligibleForEnhanced !== undefined) {
    message += `✅ <b>Подходящих для улучшенной рассылки:</b> ${formatNumber(stats.eligibleForEnhanced)}\n`;
  }
  
  if (stats.enhancedSequenceCompleted !== undefined) {
    message += `🎯 <b>Полная последовательность завершена:</b> ${formatNumber(stats.enhancedSequenceCompleted)}\n`;
  }
  
  if (stats.standardDelivered !== undefined) {
    message += `📨 <b>Стандартная доставка:</b> ${formatNumber(stats.standardDelivered)}\n`;
  }
  
  if (stats.usefulInfoDelivered !== undefined) {
    message += `💡 <b>Полезная информация доставлена:</b> ${formatNumber(stats.usefulInfoDelivered)}\n`;
  }
  
  if (stats.eventDetailsDelivered !== undefined) {
    message += `📅 <b>Детали события доставлены:</b> ${formatNumber(stats.eventDetailsDelivered)}\n`;
  }
  
  if (stats.menuTriggered !== undefined) {
    message += `🔄 <b>Меню активировано:</b> ${formatNumber(stats.menuTriggered)}\n`;
  }
  
  if (stats.sequenceFailures !== undefined && stats.sequenceFailures > 0) {
    message += `❌ <b>Ошибки последовательности:</b> ${formatNumber(stats.sequenceFailures)}\n`;
  }
  
  // Добавляем процент успешности
  if (stats.eligibleForEnhanced && stats.enhancedSequenceCompleted !== undefined) {
    const successRate = formatPercentage(stats.enhancedSequenceCompleted, stats.eligibleForEnhanced);
    message += `\n📈 <b>Успешность улучшенной рассылки:</b> ${successRate}`;
  }
  
  return message;
}

module.exports = {
  formatUserName,
  truncateText,
  escapeMarkdown,
  formatStatus,
  formatNumber,
  formatFileSize,
  formatDuration,
  createProgressBar,
  formatPercentage,
  formatList,
  centerText,
  cleanText,
  createHeader,
  formatJSON,
  maskSensitive,
  generateId,
  formatUsefulInfoMessage,
  formatEventDetailsMessage,
  formatEnhancedDeliveryStats
};