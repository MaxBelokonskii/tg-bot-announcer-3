/**
 * [RU] API для доставки сообщений
 * [EN] Message delivery API
 */

const { UserUtils, DeliveryLogUtils } = require('../../utils/db-utils');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'message-delivery' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/delivery-error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/delivery.log' 
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * [RU] Класс для работы с API доставки сообщений
 * [EN] Message delivery API class
 */
class MessageDeliveryAPI {
  constructor(database) {
    this.db = database;
    this.userUtils = new UserUtils(database);
    this.deliveryLogUtils = new DeliveryLogUtils(database);
  }

  /**
   * [RU] Получение списка активных пользователей для рассылки
   * [EN] Get list of active users for broadcast
   */
  async getActiveUsers() {
    try {
      const users = this.userUtils.getAllUsers();
      
      logger.info('Retrieved active users for delivery', {
        count: users.length
      });

      return {
        success: true,
        users
      };
    } catch (error) {
      logger.error('Error retrieving active users', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Отправка сообщения одному пользователю
   * [EN] Send message to single user
   */
  async sendToUser(bot, userId, messageText, messageId = null, options = {}) {
    try {
      const {
        parseMode = 'HTML',
        disablePreview = true,
        disableNotification = false
      } = options;

      const sendOptions = {
        parse_mode: parseMode,
        disable_web_page_preview: disablePreview,
        disable_notification: disableNotification
      };

      // Отправляем сообщение через Telegram API
      await bot.telegram.sendMessage(userId, messageText, sendOptions);

      // Логируем успешную доставку
      if (messageId) {
        await this.logDelivery(userId, messageId, 'delivered');
      }

      logger.info('Message delivered successfully', {
        userId,
        messageId,
        messageLength: messageText.length
      });

      return {
        success: true,
        userId,
        status: 'delivered'
      };
    } catch (error) {
      // Логируем неудачную доставку
      if (messageId) {
        await this.logDelivery(userId, messageId, 'failed', error.message);
      }

      logger.error('Message delivery failed', {
        userId,
        messageId,
        error: error.message
      });

      return {
        success: false,
        userId,
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * [RU] Массовая рассылка сообщения всем пользователям
   * [EN] Broadcast message to all users
   */
  async broadcastMessage(bot, messageText, messageId = null, options = {}) {
    try {
      const {
        batchSize = 30,
        delay = 100,
        onProgress = null
      } = options;

      // Получаем всех активных пользователей
      const usersResult = await this.getActiveUsers();
      if (!usersResult.success) {
        throw new Error(usersResult.error);
      }

      const users = usersResult.users;
      const results = {
        total: users.length,
        delivered: 0,
        failed: 0,
        blocked: 0,
        errors: []
      };

      logger.info('Starting message broadcast', {
        totalUsers: users.length,
        messageId,
        batchSize
      });

      // Обрабатываем пользователей батчами
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (user, index) => {
          // Добавляем задержку для соблюдения лимитов Telegram API
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const result = await this.sendToUser(
            bot, 
            user.telegram_id, 
            messageText, 
            messageId, 
            options
          );

          if (result.success) {
            results.delivered++;
          } else {
            results.failed++;
            
            // Проверяем, заблокирован ли бот пользователем
            if (result.error?.includes('blocked')) {
              results.blocked++;
            }
            
            results.errors.push({
              userId: user.telegram_id,
              error: result.error
            });
          }

          // Вызываем callback прогресса если есть
          if (onProgress) {
            onProgress({
              processed: results.delivered + results.failed,
              total: results.total,
              delivered: results.delivered,
              failed: results.failed
            });
          }

          return result;
        });

        await Promise.all(batchPromises);
      }

      logger.info('Message broadcast completed', {
        messageId,
        results
      });

      return {
        success: true,
        results
      };
    } catch (error) {
      logger.error('Error during message broadcast', {
        messageId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Логирование доставки сообщения
   * [EN] Log message delivery
   */
  async logDelivery(userId, messageId, status, errorMessage = null) {
    try {
      // Получаем пользователя по telegram_id для получения внутреннего ID
      const user = this.userUtils.findUserByTelegramId(userId.toString());
      
      if (!user) {
        throw new Error(`Пользователь с telegram_id ${userId} не найден`);
      }

      const result = this.deliveryLogUtils.logDelivery(
        user.id, 
        messageId, 
        status, 
        errorMessage
      );

      if (!result.success) {
        throw new Error('Не удалось записать лог доставки');
      }

      return {
        success: true,
        logId: result.id
      };
    } catch (error) {
      logger.error('Error logging delivery', {
        userId,
        messageId,
        status,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Получение статистики доставки для сообщения
   * [EN] Get delivery statistics for message
   */
  async getDeliveryStats(messageId) {
    try {
      const stats = this.deliveryLogUtils.getDeliveryStats(messageId);
      
      const formattedStats = {
        messageId,
        total: 0,
        delivered: 0,
        failed: 0,
        blocked: 0
      };

      stats.forEach(stat => {
        formattedStats.total += stat.count;
        formattedStats[stat.status] = stat.count;
      });

      const deliveryRate = formattedStats.total > 0 
        ? ((formattedStats.delivered / formattedStats.total) * 100).toFixed(2)
        : 0;

      logger.info('Delivery statistics retrieved', {
        messageId,
        stats: formattedStats,
        deliveryRate
      });

      return {
        success: true,
        stats: {
          ...formattedStats,
          deliveryRate: parseFloat(deliveryRate)
        }
      };
    } catch (error) {
      logger.error('Error retrieving delivery statistics', {
        messageId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Получение списка пользователей, которым не удалось доставить сообщение
   * [EN] Get list of users who failed to receive message
   */
  async getFailedDeliveries(messageId) {
    try {
      const query = `
        SELECT dl.*, u.telegram_id, u.full_name
        FROM delivery_logs dl
        JOIN users u ON dl.user_id = u.id
        WHERE dl.message_id = ? AND dl.status IN ('failed', 'blocked')
        ORDER BY dl.sent_at DESC
      `;

      const failedDeliveries = this.deliveryLogUtils.getMany(query, [messageId]);

      logger.info('Retrieved failed deliveries', {
        messageId,
        count: failedDeliveries.length
      });

      return {
        success: true,
        failedDeliveries
      };
    } catch (error) {
      logger.error('Error retrieving failed deliveries', {
        messageId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Повторная отправка неудачных сообщений
   * [EN] Retry failed message deliveries
   */
  async retryFailedDeliveries(bot, messageId, originalMessageText, options = {}) {
    try {
      const failedResult = await this.getFailedDeliveries(messageId);
      
      if (!failedResult.success) {
        throw new Error(failedResult.error);
      }

      const failedDeliveries = failedResult.failedDeliveries;
      
      if (failedDeliveries.length === 0) {
        return {
          success: true,
          message: 'Нет неудачных доставок для повтора',
          retryResults: {
            total: 0,
            delivered: 0,
            failed: 0
          }
        };
      }

      const retryResults = {
        total: failedDeliveries.length,
        delivered: 0,
        failed: 0,
        errors: []
      };

      logger.info('Starting retry of failed deliveries', {
        messageId,
        failedCount: failedDeliveries.length
      });

      // Повторяем отправку только тем, у кого была ошибка (не блокировка)
      for (const delivery of failedDeliveries) {
        if (delivery.status === 'blocked') {
          retryResults.failed++;
          continue;
        }

        const result = await this.sendToUser(
          bot,
          delivery.telegram_id,
          originalMessageText,
          messageId,
          options
        );

        if (result.success) {
          retryResults.delivered++;
        } else {
          retryResults.failed++;
          retryResults.errors.push({
            userId: delivery.telegram_id,
            error: result.error
          });
        }

        // Небольшая задержка между повторными отправками
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      logger.info('Retry of failed deliveries completed', {
        messageId,
        retryResults
      });

      return {
        success: true,
        retryResults
      };
    } catch (error) {
      logger.error('Error retrying failed deliveries', {
        messageId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Получение общей статистики доставки
   * [EN] Get overall delivery statistics
   */
  async getOverallDeliveryStats() {
    try {
      const totalDeliveries = this.deliveryLogUtils.getCount('delivery_logs');
      const deliveredCount = this.deliveryLogUtils.getCount(
        'delivery_logs',
        'WHERE status = "delivered"'
      );
      const failedCount = this.deliveryLogUtils.getCount(
        'delivery_logs',
        'WHERE status = "failed"'
      );
      const blockedCount = this.deliveryLogUtils.getCount(
        'delivery_logs',
        'WHERE status = "blocked"'
      );

      const overallRate = totalDeliveries > 0 
        ? ((deliveredCount / totalDeliveries) * 100).toFixed(2)
        : 0;

      const stats = {
        total: totalDeliveries,
        delivered: deliveredCount,
        failed: failedCount,
        blocked: blockedCount,
        deliveryRate: parseFloat(overallRate),
        timestamp: new Date().toISOString()
      };

      logger.info('Overall delivery statistics retrieved', stats);

      return {
        success: true,
        stats
      };
    } catch (error) {
      logger.error('Error retrieving overall delivery statistics', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = {
  MessageDeliveryAPI
};