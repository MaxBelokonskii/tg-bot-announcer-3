/**
 * [RU] Логика администрирования и управления списком гостей
 * [EN] Administration and guest list management logic
 */

const { AdminAPI } = require('./api');
const texts = require('../../bot/texts');
const { createInlineKeyboard, safeSendMessage, standardButtons } = require('../../utils/message-helpers');

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