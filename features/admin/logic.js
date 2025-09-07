/**
 * [RU] Логика администрирования и управления списком гостей
 * [EN] Administration and guest list management logic
 */

const { AdminAPI } = require('./api');
const texts = require('../../bot/texts');
const { createInlineKeyboard, safeSendMessage, standardButtons } = require('../../utils/message-helpers');
const { isEnhancedBroadcastEnabled } = require('../../config/enhanced-admin');
const { formatEnhancedDeliveryStats } = require('../../utils/format-utils');

/**
 * [RU] Класс для управления логикой администрирования
 * [EN] Administration management logic class
 */
class AdminLogic {
  constructor(database) {
    this.database = database;
    this.api = new AdminAPI(database);
  }

  /**
   * [RU] Проверка, является ли пользователь администратором
   * [EN] Check if user is admin
   */
  isAdmin(userId) {
    const adminId = process.env.ADMIN_ID;
    const adminIds = process.env.ADMIN_IDS?.split(',') || [];
    
    return userId === adminId || adminIds.includes(userId.toString());
  }

  /**
   * [RU] Показ списка гостей (только для администраторов)
   * [EN] Show guest list (admin only)
   */
  async showGuestList(ctx) {
    try {
      const userId = ctx.from.id.toString();
      
      // Проверяем права администратора
      if (!this.isAdmin(userId)) {
        await ctx.answerCbQuery('❌ У вас нет прав доступа');
        await safeSendMessage(ctx, '❌ У вас нет прав для выполнения этой команды');
        return { success: false, error: 'Unauthorized' };
      }

      console.log(`👥 Администратор ${userId} запросил список гостей`);

      // Получаем список всех пользователей с их статусами присутствия
      const result = await this.api.getAllUsersWithAttendance();
      
      if (!result.success) {
        throw new Error(result.error);
      }

      const { users } = result;
      
      if (!users || users.length === 0) {
        const messageText = `${texts.admin.guestList.title}\n\n${texts.admin.guestList.noGuests}`;
        const keyboard = createInlineKeyboard([standardButtons.mainMenu], 1);
        
        await safeSendMessage(ctx, messageText, keyboard);
        
        if (ctx.callbackQuery) {
          await ctx.answerCbQuery();
        }
        
        return { success: true, userCount: 0 };
      }

      // Группируем пользователей по статусу присутствия
      const grouped = this.groupUsersByAttendance(users);
      
      // Формируем сообщение
      const messageText = this.formatGuestListMessage(grouped);
      
      // Создаем кнопки для дополнительных действий
      const actionButtons = [
        { text: '🔄 Обновить список', callback: 'admin_refresh_guest_list' },
        standardButtons.mainMenu
      ];
      
      const keyboard = createInlineKeyboard(actionButtons, 1);

      await safeSendMessage(ctx, messageText, keyboard, { parseMode: 'HTML' });
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
      }

      return { success: true, userCount: users.length };
    } catch (error) {
      console.error('❌ Ошибка показа списка гостей:', error.message);
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(texts.admin.guestList.loadError);
      }
      
      await safeSendMessage(ctx, texts.admin.guestList.loadError);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Группировка пользователей по статусу присутствия
   * [EN] Group users by attendance status
   */
  groupUsersByAttendance(users) {
    const grouped = {
      attending: [],
      not_attending: [],
      maybe: []
    };

    users.forEach(user => {
      const status = user.attendance_status || 'attending';
      if (grouped[status]) {
        grouped[status].push(user);
      } else {
        // Если статус неизвестен, помещаем в "присутствуют"
        grouped.attending.push(user);
      }
    });

    return grouped;
  }

  /**
   * [RU] Форматирование сообщения со списком гостей
   * [EN] Format guest list message
   */
  formatGuestListMessage(grouped) {
    const totalCount = grouped.attending.length + grouped.not_attending.length + grouped.maybe.length;
    
    let message = `${texts.admin.guestList.title}\n\n`;
    message += `${texts.admin.guestList.total.replace('{count}', totalCount)}\n\n`;

    // Присутствуют
    if (grouped.attending.length > 0) {
      message += `${texts.admin.guestList.attending.replace('{count}', grouped.attending.length)}\n`;
      grouped.attending.forEach(user => {
        message += `• ${user.full_name}\n`;
      });
      message += '\n';
    }

    // Не присутствуют
    if (grouped.not_attending.length > 0) {
      message += `${texts.admin.guestList.notAttending.replace('{count}', grouped.not_attending.length)}\n`;
      grouped.not_attending.forEach(user => {
        message += `• ${user.full_name}\n`;
      });
      message += '\n';
    }

    // Возможно присутствуют
    if (grouped.maybe.length > 0) {
      message += `${texts.admin.guestList.maybe.replace('{count}', grouped.maybe.length)}\n`;
      grouped.maybe.forEach(user => {
        message += `• ${user.full_name}\n`;
      });
      message += '\n';
    }

    return message.trim();
  }

  /**
   * [RU] Получение статистики для администратора
   * [EN] Get admin statistics
   */
  async getAdminStats() {
    try {
      const userStats = await this.api.getUserStatistics();
      const attendanceStats = await this.api.getAttendanceStatistics();
      
      return {
        success: true,
        stats: {
          users: userStats.success ? userStats.stats : null,
          attendance: attendanceStats.success ? attendanceStats.stats : null
        }
      };
    } catch (error) {
      console.error('❌ Ошибка получения статистики администратора:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обработка команды или callback для отправки админского сообщения
   * [EN] Handle admin message command or callback
   */
  async handleAdminMessage(ctx, bot) {
    const userId = ctx.from.id.toString();
    
    console.log(`🔍 [DEBUG] handleAdminMessage: userId=${userId}, isAdmin=${this.isAdmin(userId)}, command=${ctx.message?.text || ctx.callbackQuery?.data}`);
    
    try {
      // Проверяем права администратора
      if (!this.isAdmin(userId)) {
        console.log(`⚠️ [DEBUG] Отказ в доступе пользователю ${userId}`);
        
        if (ctx.callbackQuery) {
          await ctx.answerCbQuery('❌ У вас нет прав доступа');
        }
        await ctx.reply('❌ У вас нет прав для выполнения этой команды');
        return { success: false, error: 'Unauthorized' };
      }

      console.log(`📢 Администратор ${userId} запросил панель отправки сообщений`);

      return await this.showMessageSendingPanel(ctx, bot);
    } catch (error) {
      console.error('❌ Ошибка обработки админского сообщения:', error.message);
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(texts.admin.message.error.replace('{error}', 'Ошибка системы'));
      }
      
      await ctx.reply(texts.admin.message.error.replace('{error}', 'Ошибка системы'));
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Показ панели управления отправкой сообщений с подтверждением
   * [EN] Show message sending panel with confirmation
   */
  async showMessageSendingPanel(ctx, bot) {
    try {
      // Получаем количество пользователей
      const usersResult = await this.api.getUserStatistics();
      if (!usersResult.success) {
        throw new Error('Не удалось получить статистику пользователей');
      }

      const userCount = usersResult.stats.total;
      const testMessage = texts.admin.message.testMessage;

      // Проверяем, доступна ли улучшенная рассылка
      const enhancedEnabled = isEnhancedBroadcastEnabled();
      
      // Формируем кнопки в зависимости от доступности улучшенной рассылки
      let confirmButtons;
      
      if (enhancedEnabled) {
        // Если доступна улучшенная рассылка, предлагаем выбор режима
        const modeSelectionText = `📧 <b>Выберите режим рассылки</b>\n\n` +
          `📊 <b>Доступно пользователей:</b> ${userCount}\n` +
          `💬 <b>Сообщение:</b> ${testMessage}\n\n` +
          `🔹 <b>Стандартная рассылка:</b> Отправка только основного сообщения\n` +
          `🔸 <b>Улучшенная рассылка:</b> Основное сообщение + полезная информация + детали события + автоматическое меню`;
        
        confirmButtons = [
          { text: '📨 Стандартная рассылка', callback_data: 'admin_confirm_standard' },
          { text: '🚀 Улучшенная рассылка', callback_data: 'admin_confirm_enhanced' },
          { text: texts.admin.message.buttons.cancel, callback_data: 'admin_cancel_send' },
          standardButtons.mainMenu
        ];
        
        const keyboard = createInlineKeyboard(confirmButtons, 1);
        await ctx.reply(modeSelectionText, {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup
        });
      } else {
        // Стандартная панель
        const confirmText = texts.admin.message.confirmPanel
          .replace('{message}', testMessage)
          .replace('{count}', userCount);

        confirmButtons = [
          { text: texts.admin.message.buttons.confirm, callback_data: 'admin_confirm_send' },
          { text: texts.admin.message.buttons.cancel, callback_data: 'admin_cancel_send' },
          standardButtons.mainMenu
        ];
        
        const keyboard = createInlineKeyboard(confirmButtons, 1);
        await ctx.reply(confirmText, {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup
        });
      }
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
      }

      return { success: true, userCount, enhancedAvailable: enhancedEnabled };
    } catch (error) {
      console.error('❌ Ошибка показа панели отправки:', error.message);
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(texts.admin.message.error.replace('{error}', error.message));
      }
      
      await ctx.reply(texts.admin.message.error.replace('{error}', error.message));
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Подтверждение отправки сообщения (стандартная рассылка)
   * [EN] Confirm message sending (standard broadcast)
   */
  async confirmMessageSending(ctx, bot) {
    return await this.processMessageSending(ctx, bot, 'standard');
  }

  /**
   * [RU] Подтверждение стандартной рассылки
   * [EN] Confirm standard broadcast
   */
  async confirmStandardBroadcast(ctx, bot) {
    return await this.processMessageSending(ctx, bot, 'standard');
  }

  /**
   * [RU] Подтверждение улучшенной рассылки
   * [EN] Confirm enhanced broadcast
   */
  async confirmEnhancedBroadcast(ctx, bot) {
    return await this.processMessageSending(ctx, bot, 'enhanced');
  }

  /**
   * [RU] Обработка отправки сообщения
   * [EN] Process message sending
   */
  async processMessageSending(ctx, bot, mode = 'standard') {
    const userId = ctx.from.id.toString();
    
    console.log(`🔍 [DEBUG] processMessageSending: userId=${userId}, mode=${mode}, isAdmin=${this.isAdmin(userId)}`);
    
    try {
      // Проверяем права администратора
      if (!this.isAdmin(userId)) {
        console.log(`⚠️ [DEBUG] Отказ в доступе пользователю ${userId} при подтверждении`);
        await ctx.answerCbQuery('❌ Недостаточно прав доступа');
        return { success: false, error: 'Unauthorized' };
      }

      console.log(`✅ Администратор ${userId} подтвердил отправку (режим: ${mode})`);

      // Показываем сообщение о начале отправки
      const startingText = mode === 'enhanced' 
        ? `🚀 <b>Начинаем улучшенную рассылку...</b>\n\nОбработано: 0/...\nДоставлено: 0\nОшибок: 0`
        : texts.admin.message.sending
          .replace('{completed}', '0')
          .replace('{total}', '...')
          .replace('{delivered}', '0')
          .replace('{failed}', '0');

      console.log(`🔍 [DEBUG] Обновляем сообщение на статус отправки`);
      const processingMessage = await ctx.editMessageText(startingText, { parse_mode: 'HTML' });
      await ctx.answerCbQuery();

      // Отправляем сообщение
      console.log(`🔍 [DEBUG] Начинаем отправку через AdminAPI (${mode} mode)`);
      
      let result;
      if (mode === 'enhanced') {
        result = await this.api.sendEnhancedBroadcast(bot, userId, {
          messageText: texts.admin.message.testMessage
        });
      } else {
        result = await this.api.sendTestMessage(bot, userId);
      }
      
      console.log(`🔍 [DEBUG] Результат отправки (${mode}):`, {
        success: result.success,
        messageId: result.messageId,
        stats: mode === 'enhanced' ? result.enhancedStats : result.deliveryStats,
        error: result.error
      });

      if (result.success) {
        // Показываем отчет о завершении
        let completedText;
        
        if (mode === 'enhanced') {
          const stats = result.enhancedStats;
          completedText = `🎉 <b>Улучшенная рассылка завершена!</b>\n\n` +
            `📊 <b>Общая статистика:</b>\n` +
            `👥 Всего пользователей: ${stats.total}\n` +
            `✅ Подходящих для улучшенной рассылки: ${stats.eligibleForEnhanced}\n` +
            `📨 Основных сообщений доставлено: ${stats.standardDelivered}\n\n` +
            `🚀 <b>Улучшенная последовательность:</b>\n` +
            `🎯 Полная последовательность: ${stats.enhancedSequenceCompleted}\n` +
            `💡 Полезная информация: ${stats.usefulInfoDelivered}\n` +
            `📅 Детали события: ${stats.eventDetailsDelivered}\n` +
            `🔄 Меню активировано: ${stats.menuTriggered}\n` +
            `❌ Ошибок последовательности: ${stats.sequenceFailures}\n\n` +
            `📈 <b>Эффективность:</b> ${stats.completionRate?.toFixed(1) || 0}%\n` +
            `⏱️ <b>Время выполнения:</b> ${result.duration}`;
        } else {
          const stats = result.deliveryStats;
          completedText = texts.admin.message.completed
            .replace('{total}', stats.total)
            .replace('{delivered}', stats.delivered)
            .replace('{failed}', stats.failed)
            .replace('{blocked}', stats.blocked)
            .replace('{duration}', result.duration);
        }

        // Кнопки после завершения
        const finalButtons = [
          { text: texts.admin.message.buttons.history, callback_data: 'admin_message_history' },
          standardButtons.mainMenu
        ];
        
        const finalKeyboard = createInlineKeyboard(finalButtons, 1);

        await ctx.editMessageText(completedText, {
          parse_mode: 'HTML',
          reply_markup: finalKeyboard.reply_markup
        });
      } else {
        const errorText = texts.admin.message.error.replace('{error}', result.error);
        
        const errorButtons = [
          { text: texts.admin.message.buttons.backToMenu, callback_data: 'main_menu' }
        ];
        
        const errorKeyboard = createInlineKeyboard(errorButtons, 1);

        await ctx.editMessageText(errorText, {
          parse_mode: 'HTML',
          reply_markup: errorKeyboard.reply_markup
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Ошибка обработки отправки:', error.message);
      console.error('❌ [DEBUG] Stack trace:', error.stack);
      
      await ctx.answerCbQuery(texts.admin.message.error.replace('{error}', error.message));
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Отмена отправки сообщения
   * [EN] Cancel message sending
   */
  async cancelMessageSending(ctx) {
    try {
      const keyboard = createInlineKeyboard([standardButtons.mainMenu], 1);
      
      await ctx.editMessageText(texts.admin.message.cancelled, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup
      });
      
      await ctx.answerCbQuery();
      
      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка отмены отправки:', error.message);
      
      await ctx.answerCbQuery(texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Валидация прав администратора для callback
   * [EN] Validate admin rights for callback
   */
  async validateAdminCallback(ctx, callback) {
    const userId = ctx.from.id.toString();
    
    if (callback.startsWith('admin_') && !this.isAdmin(userId)) {
      await ctx.answerCbQuery('❌ Недостаточно прав доступа');
      throw new Error('Unauthorized admin action attempt');
    }
    
    return true;
  }

  /**
   * [RU] Экспорт списка гостей (для будущего развития)
   * [EN] Export guest list (for future development)
   */
  async exportGuestList(format = 'text') {
    try {
      const result = await this.api.getAllUsersWithAttendance();
      
      if (!result.success) {
        return result;
      }

      const { users } = result;
      
      if (format === 'csv') {
        return this.exportToCsv(users);
      } else {
        return this.exportToText(users);
      }
    } catch (error) {
      console.error('❌ Ошибка экспорта списка гостей:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Экспорт в CSV формат
   * [EN] Export to CSV format
   */
  exportToCsv(users) {
    try {
      let csv = 'Имя,Статус присутствия,Дата обновления\n';
      
      users.forEach(user => {
        const status = this.getStatusDisplayText(user.attendance_status);
        const updatedAt = user.attendance_updated_at || 'Не указано';
        csv += `"${user.full_name}","${status}","${updatedAt}"\n`;
      });

      return { success: true, format: 'csv', data: csv };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Экспорт в текстовый формат
   * [EN] Export to text format
   */
  exportToText(users) {
    try {
      const grouped = this.groupUsersByAttendance(users);
      const messageText = this.formatGuestListMessage(grouped);

      return { success: true, format: 'text', data: messageText };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение текста для отображения статуса
   * [EN] Get display text for status
   */
  getStatusDisplayText(status) {
    switch (status) {
      case 'attending':
        return 'Присутствует';
      case 'not_attending':
        return 'Не присутствует';
      case 'maybe':
        return 'Возможно присутствует';
      default:
        return 'Присутствует';
    }
  }
}

module.exports = {
  AdminLogic
};