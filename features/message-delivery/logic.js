/**
 * [RU] Бизнес-логика доставки сообщений
 * [EN] Message delivery business logic
 */

const { MessageDeliveryAPI } = require('./api');
const { formatPercentage, formatNumber } = require('../../utils/format-utils');
const texts = require('../../bot/texts');

/**
 * [RU] Основной класс для логики доставки сообщений
 * [EN] Main message delivery logic class
 */
class MessageDeliveryLogic {
  constructor(database) {
    this.api = new MessageDeliveryAPI(database);
    this.activeDeliveries = new Map();
  }

  /**
   * [RU] Доставка запланированного напоминания всем пользователям
   * [EN] Deliver scheduled reminder to all users
   */
  async deliverReminder(bot, reminder) {
    try {
      console.log(`📤 Начинаю доставку напоминания ${reminder.id} всем пользователям`);

      const deliveryId = `reminder_${reminder.id}_${Date.now()}`;
      
      // Добавляем в активные доставки
      this.activeDeliveries.set(deliveryId, {
        type: 'reminder',
        reminderId: reminder.id,
        startTime: new Date(),
        status: 'in_progress'
      });

      // Прогресс-функция для отслеживания
      const onProgress = (progress) => {
        const delivery = this.activeDeliveries.get(deliveryId);
        if (delivery) {
          delivery.progress = progress;
          delivery.lastUpdate = new Date();
        }

        console.log(`📊 Прогресс доставки ${reminder.id}: ${progress.processed}/${progress.total} (${formatPercentage(progress.processed, progress.total)})`);
      };

      // Выполняем массовую рассылку
      const result = await this.api.broadcastMessage(
        bot,
        reminder.message_text,
        reminder.id,
        {
          batchSize: 25,
          delay: 150,
          onProgress,
          parseMode: 'HTML'
        }
      );

      // Обновляем статус доставки
      const delivery = this.activeDeliveries.get(deliveryId);
      if (delivery) {
        delivery.status = result.success ? 'completed' : 'failed';
        delivery.endTime = new Date();
        delivery.result = result;
      }

      if (result.success) {
        console.log(`✅ Доставка напоминания ${reminder.id} завершена:`);
        console.log(`   📨 Доставлено: ${result.results.delivered}`);
        console.log(`   ❌ Не доставлено: ${result.results.failed}`);
        console.log(`   🔒 Заблокировано: ${result.results.blocked}`);
        
        return {
          success: true,
          reminderId: reminder.id,
          deliveryStats: result.results,
          message: `Напоминание доставлено ${result.results.delivered} пользователям`
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error(`❌ Ошибка доставки напоминания ${reminder.id}:`, error.message);
      
      // Обновляем статус при ошибке
      const deliveryId = `reminder_${reminder.id}_${Date.now()}`;
      const delivery = this.activeDeliveries.get(deliveryId);
      if (delivery) {
        delivery.status = 'error';
        delivery.error = error.message;
        delivery.endTime = new Date();
      }

      return {
        success: false,
        reminderId: reminder.id,
        error: error.message
      };
    }
  }

  /**
   * [RU] Отправка индивидуального сообщения пользователю
   * [EN] Send individual message to user
   */
  async sendIndividualMessage(bot, userId, messageText, options = {}) {
    try {
      const {
        messageId = null,
        parseMode = 'HTML',
        disablePreview = true,
        withKeyboard = null
      } = options;

      const sendOptions = {
        parseMode,
        disablePreview
      };

      if (withKeyboard) {
        sendOptions.reply_markup = withKeyboard;
      }

      const result = await this.api.sendToUser(
        bot,
        userId,
        messageText,
        messageId,
        sendOptions
      );

      if (result.success) {
        console.log(`✅ Сообщение доставлено пользователю ${userId}`);
      } else {
        console.log(`❌ Не удалось доставить сообщение пользователю ${userId}: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error(`❌ Ошибка отправки индивидуального сообщения пользователю ${userId}:`, error.message);
      
      return {
        success: false,
        userId,
        error: error.message
      };
    }
  }

  /**
   * [RU] Отправка ответа на действие пользователя
   * [EN] Send response to user action
   */
  async sendUserResponse(bot, ctx, responseText, keyboard = null) {
    try {
      const userId = ctx.from.id;
      
      const sendOptions = {
        parseMode: 'HTML',
        disablePreview: true
      };

      if (keyboard) {
        sendOptions.reply_markup = keyboard;
      }

      if (ctx.callbackQuery) {
        // Если это callback query, редактируем сообщение
        await ctx.editMessageText(responseText, sendOptions);
        await ctx.answerCbQuery();
      } else {
        // Обычный ответ
        await ctx.reply(responseText, sendOptions);
      }

      console.log(`📱 Ответ отправлен пользователю ${userId}`);

      return {
        success: true,
        userId,
        responseType: ctx.callbackQuery ? 'edit' : 'reply'
      };
    } catch (error) {
      console.error(`❌ Ошибка отправки ответа пользователю ${ctx.from.id}:`, error.message);

      // Попытка отправить базовую ошибку
      try {
        await ctx.reply(texts.errors.general);
      } catch (fallbackError) {
        console.error('❌ Критическая ошибка отправки ответа:', fallbackError.message);
      }

      return {
        success: false,
        userId: ctx.from.id,
        error: error.message
      };
    }
  }

  /**
   * [RU] Получение статистики доставки для сообщения
   * [EN] Get delivery statistics for message
   */
  async getMessageDeliveryStats(messageId) {
    try {
      const result = await this.api.getDeliveryStats(messageId);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      const stats = result.stats;
      
      // Форматируем статистику для удобного отображения
      const formattedStats = {
        messageId,
        total: stats.total,
        delivered: stats.delivered,
        failed: stats.failed,
        blocked: stats.blocked,
        deliveryRate: stats.deliveryRate,
        formattedReport: this.formatDeliveryReport(stats)
      };

      return {
        success: true,
        stats: formattedStats
      };
    } catch (error) {
      console.error(`❌ Ошибка получения статистики доставки для сообщения ${messageId}:`, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Форматирование отчета о доставке
   * [EN] Format delivery report
   */
  formatDeliveryReport(stats) {
    const report = `📊 Статистика доставки:

📨 Всего отправлено: ${formatNumber(stats.total)}
✅ Доставлено: ${formatNumber(stats.delivered)} (${formatPercentage(stats.delivered, stats.total)})
❌ Не доставлено: ${formatNumber(stats.failed)} (${formatPercentage(stats.failed, stats.total)})
🔒 Заблокировано: ${formatNumber(stats.blocked)} (${formatPercentage(stats.blocked, stats.total)})

📈 Успешность доставки: ${stats.deliveryRate}%`;

    return report;
  }

  /**
   * [RU] Повторная отправка неудачных доставок
   * [EN] Retry failed deliveries
   */
  async retryFailedDeliveries(bot, messageId, originalMessageText) {
    try {
      console.log(`🔄 Повторная отправка неудачных доставок для сообщения ${messageId}`);

      const result = await this.api.retryFailedDeliveries(
        bot,
        messageId,
        originalMessageText,
        {
          parseMode: 'HTML',
          disablePreview: true
        }
      );

      if (result.success) {
        console.log(`✅ Повторная отправка завершена:`);
        console.log(`   📨 Доставлено: ${result.retryResults.delivered}`);
        console.log(`   ❌ Все еще не доставлено: ${result.retryResults.failed}`);
        
        return {
          success: true,
          messageId,
          retryStats: result.retryResults,
          message: `Повторно доставлено ${result.retryResults.delivered} сообщений`
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error(`❌ Ошибка повторной отправки для сообщения ${messageId}:`, error.message);
      
      return {
        success: false,
        messageId,
        error: error.message
      };
    }
  }

  /**
   * [RU] Получение активных доставок
   * [EN] Get active deliveries
   */
  getActiveDeliveries() {
    const active = Array.from(this.activeDeliveries.entries()).map(([id, delivery]) => ({
      id,
      ...delivery,
      duration: delivery.endTime 
        ? delivery.endTime - delivery.startTime
        : Date.now() - delivery.startTime
    }));

    return {
      count: active.length,
      deliveries: active
    };
  }

  /**
   * [RU] Очистка завершенных доставок
   * [EN] Clean up completed deliveries
   */
  cleanupCompletedDeliveries() {
    const maxAge = 30 * 60 * 1000; // 30 минут
    const now = new Date();

    for (const [id, delivery] of this.activeDeliveries.entries()) {
      if (delivery.endTime && (now - delivery.endTime) > maxAge) {
        this.activeDeliveries.delete(id);
        console.log(`🧹 Очищена завершенная доставка: ${id}`);
      }
    }
  }

  /**
   * [RU] Получение общей статистики доставки
   * [EN] Get overall delivery statistics
   */
  async getOverallStats() {
    try {
      const result = await this.api.getOverallDeliveryStats();
      
      if (!result.success) {
        throw new Error(result.error);
      }

      const stats = result.stats;
      
      return {
        success: true,
        stats: {
          ...stats,
          formattedReport: this.formatDeliveryReport(stats),
          activeDeliveries: this.getActiveDeliveries().count
        }
      };
    } catch (error) {
      console.error('❌ Ошибка получения общей статистики доставки:', error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Отправка уведомления администратору
   * [EN] Send admin notification
   */
  async sendAdminNotification(bot, adminId, message, urgent = false) {
    try {
      if (!adminId) {
        console.log('⚠️ Admin ID не настроен для уведомлений');
        return { success: false, error: 'Admin ID not configured' };
      }

      const prefix = urgent ? '🚨 СРОЧНОЕ УВЕДОМЛЕНИЕ' : '📢 Уведомление';
      const timestamp = new Date().toLocaleString('ru-RU');
      
      const fullMessage = `${prefix}\n\n${message}\n\n🕐 ${timestamp}`;

      const result = await this.sendIndividualMessage(
        bot,
        adminId,
        fullMessage,
        {
          parseMode: 'HTML',
          disablePreview: true
        }
      );

      if (result.success) {
        console.log(`📬 Уведомление отправлено администратору ${adminId}`);
      }

      return result;
    } catch (error) {
      console.error(`❌ Ошибка отправки уведомления администратору:`, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = {
  MessageDeliveryLogic
};