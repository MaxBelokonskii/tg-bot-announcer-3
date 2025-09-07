/**
 * [RU] Логика управления присутствием пользователей
 * [EN] User attendance management logic
 */

const { AttendanceAPI } = require('./api');
const texts = require('../../bot/texts');
const { createInlineKeyboard, safeSendMessage, standardButtons } = require('../../utils/message-helpers');

/**
 * [RU] Класс для управления логикой присутствия
 * [EN] Attendance management logic class
 */
class AttendanceLogic {
  constructor(database) {
    this.database = database;
    this.api = new AttendanceAPI(database);
  }

  /**
   * [RU] Обработка изменения статуса присутствия
   * [EN] Handle attendance status change
   */
  async handleAttendanceChange(ctx, userId) {
    try {
      console.log(`🎉 Пользователь ${userId} изменяет статус присутствия`);

      // Получаем текущий статус пользователя
      const currentStatus = await this.api.getUserAttendance(userId);
      
      // Создаем кнопки для выбора статуса
      const statusButtons = [
        { text: texts.attendance.options.attending, callback_data: 'attendance_attending' },
        { text: texts.attendance.options.notAttending, callback_data: 'attendance_not_attending' },
        { text: texts.attendance.options.maybe, callback_data: 'attendance_maybe' }
      ];

      statusButtons.push(standardButtons.mainMenu);

      const keyboard = createInlineKeyboard(statusButtons, 1);

      const currentStatusText = this.getStatusDisplayText(currentStatus);
      const messageText = `${texts.attendance.title}\n\n${texts.attendance.currentStatus.replace('{status}', currentStatusText)}\n\n${texts.attendance.changePrompt}`;

      await safeSendMessage(ctx, messageText, keyboard);
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка изменения присутствия:', error.message);
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(texts.errors.general);
      }
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обработка выбора статуса присутствия
   * [EN] Handle attendance status selection
   */
  async handleAttendanceStatusSelect(ctx, userId, status) {
    try {
      console.log(`✅ Пользователь ${userId} выбрал статус: ${status}`);

      // Обновляем статус в базе данных
      const result = await this.api.updateUserAttendance(userId, status);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      // Получаем текст для отображения статуса
      const statusText = this.getStatusDisplayText(status);
      
      // Отправляем подтверждение
      const confirmationText = texts.attendance.confirmChange.replace('{status}', statusText);
      const keyboard = createInlineKeyboard([standardButtons.mainMenu], 1);

      await safeSendMessage(ctx, confirmationText, keyboard);
      await ctx.answerCbQuery('✅ Статус обновлен');

      return { success: true, status };
    } catch (error) {
      console.error('❌ Ошибка обновления статуса присутствия:', error.message);
      
      await ctx.answerCbQuery(texts.errors.general);
      await safeSendMessage(ctx, texts.errors.general);
      
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
        return texts.attendance.options.attending;
      case 'not_attending':
        return texts.attendance.options.notAttending;
      case 'maybe':
        return texts.attendance.options.maybe;
      default:
        return texts.attendance.options.attending;
    }
  }

  /**
   * [RU] Получение статистики присутствия
   * [EN] Get attendance statistics
   */
  async getAttendanceStats() {
    try {
      return await this.api.getAttendanceStatistics();
    } catch (error) {
      console.error('❌ Ошибка получения статистики присутствия:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Валидация статуса присутствия
   * [EN] Validate attendance status
   */
  isValidAttendanceStatus(status) {
    const validStatuses = ['attending', 'not_attending', 'maybe'];
    return validStatuses.includes(status);
  }

  /**
   * [RU] Получение всех пользователей с их статусами присутствия
   * [EN] Get all users with their attendance statuses
   */
  async getAllUsersAttendance() {
    try {
      return await this.api.getAllUsersAttendance();
    } catch (error) {
      console.error('❌ Ошибка получения списка пользователей с присутствием:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = {
  AttendanceLogic
};