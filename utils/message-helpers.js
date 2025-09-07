/**
 * [RU] Утилиты для конструирования и отправки сообщений
 * [EN] Message construction and sending utilities
 */

const { Markup } = require('telegraf');

/**
 * [RU] Создание клавиатуры с кнопками
 * [EN] Create keyboard with buttons
 * @deprecated Функция больше не используется. Используйте createInlineKeyboard()
 * @param {Array} buttons - Array of button texts
 * @param {Object} options - Keyboard options
 * @returns {Object} Markup keyboard or removeKeyboard
 */
function createKeyboard(buttons, options = {}) {
  console.warn('⚠️ createKeyboard deprecated. Use createInlineKeyboard instead.');
  
  const {
    columns = 2,
    resize = true,
    oneTime = false,
    selective = false
  } = options;

  if (!Array.isArray(buttons) || buttons.length === 0) {
    return Markup.removeKeyboard();
  }

  // Группируем кнопки по столбцам
  const rows = [];
  for (let i = 0; i < buttons.length; i += columns) {
    rows.push(buttons.slice(i, i + columns));
  }

  return Markup.keyboard(rows).resize(resize).oneTime(oneTime).selective(selective);
}

/**
 * [RU] Создание inline клавиатуры
 * [EN] Create inline keyboard
 */
function createInlineKeyboard(buttons, columns = 2) {
  if (!Array.isArray(buttons) || buttons.length === 0) {
    console.warn("⚠️ Предупреждение: пустой массив кнопок для клавиатуры");
    return Markup.inlineKeyboard([]);
  }

  const rows = [];
  for (let i = 0; i < buttons.length; i += columns) {
    const row = buttons
      .slice(i, i + columns)
      .map((button) => {
        if (typeof button === "string") {
          return Markup.button.callback(button, button);
        }

        // Проверка наличия необходимых полей
        if (!button.text) {
          console.error("❌ Ошибка: отсутствует поле text в кнопке:", button);
          return null;
        }

        // Используем callback_data для соответствия со спецификацией
        const callbackData = button.callback_data || button.callback || button.text;

        return Markup.button.callback(button.text, callbackData);
      })
      .filter(Boolean); // Убираем null значения

    if (row.length > 0) {
      rows.push(row);
    }
  }

  return Markup.inlineKeyboard(rows);
}

/**
 * [RU] Стандартные кнопки навигации
 * [EN] Standard navigation buttons
 */
const standardButtons = {
  mainMenu: { text: '🏠 Главное меню', callback_data: 'main_menu' },
  back: { text: '⬅️ Назад', callback_data: 'back' },
  cancel: { text: '❌ Отмена', callback_data: 'cancel' },
  confirm: { text: '✅ Подтвердить', callback_data: 'confirm' },
  refresh: { text: '🔄 Обновить', callback_data: 'refresh' },
  
  // Ответы на события
  yes: { text: '✅ Да, буду', callback_data: 'response_yes' },
  no: { text: '❌ Нет, не смогу', callback_data: 'response_no' },
  maybe: { text: '🤔 Возможно', callback_data: 'response_maybe' },
  
  // Меню разделы
  events: { text: '📅 События', callback_data: 'events' },
  responses: { text: '💬 Мои ответы', callback_data: 'responses' },
  settings: { text: '⚙️ Настройки', callback_data: 'settings' },
  help: { text: '❓ Помощь', callback_data: 'help' }
};

/**
 * [RU] Создание сообщения с разметкой
 * [EN] Create message with markup
 */
function createMessage(text, keyboard = null, options = {}) {
  const {
    parseMode = 'HTML',
    disablePreview = true,
    disableNotification = false
  } = options;

  const messageOptions = {
    parse_mode: parseMode,
    disable_web_page_preview: disablePreview,
    disable_notification: disableNotification
  };

  if (keyboard) {
    // Правильно обрабатываем Markup объекты от Telegraf
    messageOptions.reply_markup = keyboard.reply_markup || keyboard;
  }

  return {
    text: text,
    options: messageOptions
  };
}

/**
 * [RU] Безопасная отправка сообщения
 * [EN] Safe message sending
 */
async function safeSendMessage(ctx, text, keyboard = null, options = {}) {
  try {
    const messageOptions = {
      parse_mode: options.parseMode || 'HTML',
      disable_web_page_preview: options.disablePreview !== false,
      disable_notification: options.disableNotification || false
    };

    // Правильно добавляем клавиатуру в опции
    if (keyboard) {
      // Телеграм ожидает объект reply_markup в messageOptions
      messageOptions.reply_markup = keyboard.reply_markup || keyboard;
    }
    
    if (ctx.callbackQuery) {
      // Если это callback query, редактируем сообщение
      await ctx.editMessageText(text, messageOptions);
      await ctx.answerCbQuery();
    } else {
      // Обычная отправка
      await ctx.reply(text, messageOptions);
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error.message);
    
    // Попытка отправить уведомление об ошибке
    try {
      await ctx.reply('😔 Произошла ошибка при отправке сообщения. Попробуйте еще раз.');
    } catch (fallbackError) {
      console.error('❌ Критическая ошибка отправки:', fallbackError.message);
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * [RU] Отправка уведомления администратору
 * [EN] Send admin notification
 */
async function sendAdminNotification(bot, adminId, message, urgent = false) {
  if (!adminId) return { success: false, error: 'Admin ID not configured' };
  
  try {
    const prefix = urgent ? '🚨 СРОЧНО:' : '📢 Уведомление:';
    const fullMessage = `${prefix}\n\n${message}\n\n📅 ${new Date().toLocaleString('ru-RU')}`;
    
    await bot.telegram.sendMessage(adminId, fullMessage, {
      parse_mode: 'HTML',
      disable_notification: !urgent
    });
    
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка отправки уведомления администратору:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * [RU] Отправка группового сообщения
 * [EN] Send broadcast message
 */
async function sendBroadcast(bot, userIds, message, options = {}) {
  const {
    delay = 100, // Задержка между отправками в мс
    batchSize = 30, // Размер батча для Telegram API limits
    onProgress = null, // Callback для отслеживания прогресса
    onError = null // Callback для обработки ошибок
  } = options;

  const results = {
    total: userIds.length,
    sent: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (userId, index) => {
      try {
        // Добавляем задержку для избежания rate limit
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        await bot.telegram.sendMessage(userId, message.text, message.options);
        results.sent++;
        
        if (onProgress) {
          onProgress(results);
        }
        
        return { userId, success: true };
      } catch (error) {
        results.failed++;
        const errorInfo = { userId, error: error.message };
        results.errors.push(errorInfo);
        
        if (onError) {
          onError(errorInfo);
        }
        
        return { userId, success: false, error: error.message };
      }
    });

    await Promise.all(batchPromises);
  }

  return results;
}

/**
 * [RU] Создание сообщения с подтверждением
 * [EN] Create confirmation message
 */
function createConfirmationMessage(text, confirmCallback = 'confirm', cancelCallback = 'cancel') {
  const keyboard = createInlineKeyboard([
    { text: '✅ Подтвердить', callback_data: confirmCallback },
    { text: '❌ Отмена', callback_data: cancelCallback }
  ], 2);

  return createMessage(text, keyboard);
}

/**
 * [RU] Создание пагинированного списка
 * [EN] Create paginated list
 */
function createPaginatedList(items, page = 1, itemsPerPage = 5, baseCallback = 'page') {
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = items.slice(startIndex, endIndex);

  let text = currentItems.join('\n\n');
  text += `\n\n📄 Страница ${page} из ${totalPages}`;

  const buttons = [];
  
  if (page > 1) {
    buttons.push({ text: '◀️ Пред.', callback_data: `${baseCallback}_${page - 1}` });
  }
  
  if (page < totalPages) {
    buttons.push({ text: '▶️ След.', callback_data: `${baseCallback}_${page + 1}` });
  }

  buttons.push(standardButtons.mainMenu);

  const keyboard = createInlineKeyboard(buttons, 2);
  return createMessage(text, keyboard);
}

/**
 * [RU] Создание меню выбора
 * [EN] Create selection menu
 */
function createSelectionMenu(title, options, baseCallback = 'select') {
  let text = title + '\n\n';
  
  const buttons = options.map((option, index) => ({
    text: `${index + 1}. ${option.text}`,
    callback_data: `${baseCallback}_${option.value || index}`
  }));

  buttons.push(standardButtons.back);

  const keyboard = createInlineKeyboard(buttons, 1);
  return createMessage(text, keyboard);
}

/**
 * [RU] Форматирование ошибок для пользователя
 * [EN] Format errors for user
 */
function formatUserError(error, context = '') {
  const userFriendlyErrors = {
    'Bad Request: message is not modified': 'Сообщение уже актуально',
    'Bad Request: query is too old': 'Запрос устарел, попробуйте снова',
    'Forbidden: bot was blocked by the user': 'Пользователь заблокировал бота',
    'Bad Request: chat not found': 'Чат не найден'
  };

  const friendlyMessage = userFriendlyErrors[error.message] || 'Произошла техническая ошибка';
  
  return context 
    ? `😔 ${friendlyMessage} (${context})`
    : `😔 ${friendlyMessage}`;
}

/**
 * [RU] Логирование действий пользователя
 * [EN] Log user actions
 */
function logUserAction(ctx, action, details = '') {
  const user = ctx.from;
  const timestamp = new Date().toISOString();
  
  const logEntry = {
    timestamp,
    userId: user.id,
    username: user.username || 'unknown',
    action,
    details,
    chatId: ctx.chat?.id
  };

  console.log(`📊 User Action:`, JSON.stringify(logEntry, null, 2));
  return logEntry;
}

module.exports = {
  createKeyboard,
  createInlineKeyboard,
  standardButtons,
  createMessage,
  safeSendMessage,
  sendAdminNotification,
  sendBroadcast,
  createConfirmationMessage,
  createPaginatedList,
  createSelectionMenu,
  formatUserError,
  logUserAction
};