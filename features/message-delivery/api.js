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
    
    // Username resolution cache
    this.usernameCache = new Map();
    this.cacheTimeout = parseInt(process.env.USERNAME_RESOLUTION_CACHE_TTL) || 300000; // 5 minutes
  }

  /**
   * [RU] Получение списка активных пользователей с username для рассылки
   * [EN] Get list of active users with username for broadcast
   */
  async getActiveUsersWithUsername(filterOptions = {}) {
    try {
      const {
        requireUsername = false,
        includeEmpty = true,
        attendanceFilter = null
      } = filterOptions;

      let query = `
        SELECT 
          id,
          telegram_id,
          username,
          full_name,
          attendance_status,
          created_at
        FROM users
      `;
      
      const conditions = [];
      const params = [];
      
      if (requireUsername) {
        conditions.push('username IS NOT NULL AND username != ""');
      }
      
      if (attendanceFilter) {
        conditions.push('attendance_status = ?');
        params.push(attendanceFilter);
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY username IS NULL, username, full_name';
      
      const users = this.userUtils.getMany(query, params);
      
      // Статистика по методам доставки
      const stats = {
        total: users.length,
        withUsername: users.filter(u => u.username && u.username.trim()).length,
        withoutUsername: users.filter(u => !u.username || !u.username.trim()).length
      };
      
      logger.info('Retrieved active users with username filtering', {
        filterOptions,
        stats
      });

      return {
        success: true,
        users,
        stats
      };
    } catch (error) {
      logger.error('Error retrieving active users with username', {
        error: error.message,
        filterOptions
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Получение списка активных пользователей для рассылки (легаси)
   * [EN] Get list of active users for broadcast (legacy)
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
   * [RU] Резолвинг username в chat_id через Telegram API
   * [EN] Resolve username to chat_id via Telegram API
   */
  async resolveUsernameToChat(bot, username) {
    try {
      // Очищаем username от @ символа
      const cleanUsername = username.replace(/^@/, '');
      
      // Проверяем кэш
      const cacheKey = `username_${cleanUsername}`;
      const cached = this.usernameCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        logger.info('Username resolution from cache', {
          username: cleanUsername,
          chatId: cached.chatId
        });
        
        return {
          success: true,
          chatId: cached.chatId,
          method: 'cached'
        };
      }
      
      // Пытаемся получить чат по username
      try {
        const chat = await bot.telegram.getChat(`@${cleanUsername}`);
        const chatId = chat.id;
        
        // Кэшируем результат
        this.usernameCache.set(cacheKey, {
          chatId,
          timestamp: Date.now()
        });
        
        logger.info('Username resolved successfully', {
          username: cleanUsername,
          chatId
        });
        
        return {
          success: true,
          chatId,
          method: 'resolved'
        };
      } catch (resolveError) {
        logger.warn('Username resolution failed', {
          username: cleanUsername,
          error: resolveError.message
        });
        
        return {
          success: false,
          error: resolveError.message,
          errorType: this.categorizeError(resolveError)
        };
      }
    } catch (error) {
      logger.error('Error in username resolution', {
        username,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  /**
   * [RU] Отправка сообщения одному пользователю по username
   * [EN] Send message to single user by username
   */
  async sendToUserByUsername(bot, username, messageText, messageId = null, options = {}) {
    try {
      const {
        parseMode = 'HTML',
        disablePreview = true,
        disableNotification = false,
        fallbackToTelegramId = true
      } = options;

      // Пытаемся резолвить username
      const resolveResult = await this.resolveUsernameToChat(bot, username);
      
      if (resolveResult.success) {
        // Отправляем по резолвленному chat_id
        const result = await this.sendToUser(
          bot, 
          resolveResult.chatId, 
          messageText, 
          messageId, 
          options
        );
        
        return {
          ...result,
          method: 'username',
          username: username,
          resolutionMethod: resolveResult.method
        };
      } else if (fallbackToTelegramId) {
        // Fallback: ищем пользователя по username в базе и отправляем по telegram_id
        const user = this.userUtils.findUserByUsername(username.replace(/^@/, ''));
        
        if (user && user.telegram_id) {
          logger.info('Using fallback to telegram_id', {
            username,
            telegramId: user.telegram_id
          });
          
          const result = await this.sendToUser(
            bot, 
            user.telegram_id, 
            messageText, 
            messageId, 
            options
          );
          
          return {
            ...result,
            method: 'fallback_telegram_id',
            username: username,
            fallbackReason: resolveResult.error
          };
        }
      }
      
      // Ни username, ни fallback не сработали
      return {
        success: false,
        error: `Не удалось отправить сообщение по username ${username}`,
        method: 'username',
        username: username,
        usernameResolutionError: resolveResult.error
      };
    } catch (error) {
      logger.error('Error sending message by username', {
        username,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message,
        method: 'username',
        username: username
      };
    }
  }

  /**
   * [RU] Отправка сообщения одному пользователю (легаси метод)
   * [EN] Send message to single user (legacy method)
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

      // Логируем успешную доставку только для обычных сообщений (не админских)
      if (messageId && !this.isAdminMessage(messageId)) {
        await this.logDelivery(userId, messageId, 'delivered');
      }

      logger.info('Message delivered successfully', {
        userId,
        messageId,
        messageLength: messageText.length,
        isAdmin: this.isAdminMessage(messageId)
      });

      return {
        success: true,
        userId,
        status: 'delivered'
      };
    } catch (error) {
      // Определяем тип ошибки для более точного статуса
      const errorStatus = this.categorizeError(error);
      
      // Логируем неудачную доставку только для обычных сообщений (не админских)
      if (messageId && !this.isAdminMessage(messageId)) {
        await this.logDelivery(userId, messageId, errorStatus, error.message);
      }

      logger.error('Message delivery failed', {
        userId,
        messageId,
        error: error.message,
        errorCode: error.code,
        errorStatus,
        isAdmin: this.isAdminMessage(messageId)
      });

      return {
        success: false,
        userId,
        status: errorStatus,
        error: error.message,
        errorCode: error.code
      };
    }
  }

  /**
   * [RU] Массовая рассылка сообщения всем пользователям (легаси)
   * [EN] Broadcast message to all users (legacy)
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
            if (result.status === 'blocked') {
              results.blocked++;
            }
            
            results.errors.push({
              userId: user.telegram_id,
              error: result.error,
              status: result.status
            });
          }

          // Вызываем callback прогресса если есть
          if (onProgress) {
            onProgress({
              processed: results.delivered + results.failed,
              total: results.total,
              delivered: results.delivered,
              failed: results.failed,
              blocked: results.blocked
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
   * [RU] Массовая рассылка сообщения по username
   * [EN] Broadcast message by username
   */
  async broadcastMessageByUsername(bot, messageText, messageId = null, options = {}) {
    try {
      const {
        batchSize = 25,
        delay = 150,
        onProgress = null,
        preferUsername = true,
        fallbackToTelegramId = true,
        requireUsername = false
      } = options;

      // Получаем пользователей с фильтрацией по username
      const usersResult = await this.getActiveUsersWithUsername({ requireUsername });
      if (!usersResult.success) {
        throw new Error(usersResult.error);
      }

      const users = usersResult.users;
      const results = {
        total: users.length,
        delivered: 0,
        failed: 0,
        blocked: 0,
        usernameDelivered: 0,
        telegramIdDelivered: 0,
        usernameResolutionFailed: 0,
        errors: []
      };

      const methodBreakdown = {
        username: { attempted: 0, successful: 0 },
        telegram_id: { attempted: 0, successful: 0 }
      };

      logger.info('Starting username-based message broadcast', {
        totalUsers: users.length,
        messageId,
        batchSize,
        usersWithUsername: usersResult.stats.withUsername,
        usersWithoutUsername: usersResult.stats.withoutUsername
      });

      // Обрабатываем пользователей батчами
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (user, index) => {
          // Добавляем задержку для соблюдения лимитов Telegram API
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          let result;
          
          // Определяем метод отправки
          if (preferUsername && user.username && user.username.trim()) {
            // Пытаемся отправить по username
            methodBreakdown.username.attempted++;
            
            result = await this.sendToUserByUsername(
              bot,
              user.username,
              messageText,
              messageId,
              { ...options, fallbackToTelegramId }
            );
            
            if (result.success) {
              if (result.method === 'username') {
                methodBreakdown.username.successful++;
                results.usernameDelivered++;
              } else if (result.method === 'fallback_telegram_id') {
                methodBreakdown.telegram_id.successful++;
                results.telegramIdDelivered++;
              }
            } else {
              if (result.usernameResolutionError) {
                results.usernameResolutionFailed++;
              }
            }
          } else {
            // Отправляем по telegram_id
            methodBreakdown.telegram_id.attempted++;
            
            result = await this.sendToUser(
              bot, 
              user.telegram_id, 
              messageText, 
              messageId, 
              options
            );
            
            if (result.success) {
              methodBreakdown.telegram_id.successful++;
              results.telegramIdDelivered++;
            }
          }

          if (result.success) {
            results.delivered++;
          } else {
            results.failed++;
            
            // Проверяем, заблокирован ли бот пользователем
            if (result.status === 'blocked') {
              results.blocked++;
            }
            
            results.errors.push({
              userId: user.telegram_id,
              username: user.username,
              error: result.error,
              status: result.status,
              method: result.method
            });
          }

          // Вызываем callback прогресса если есть
          if (onProgress) {
            onProgress({
              processed: results.delivered + results.failed,
              total: results.total,
              delivered: results.delivered,
              failed: results.failed,
              blocked: results.blocked,
              usernameDelivered: results.usernameDelivered,
              telegramIdDelivered: results.telegramIdDelivered,
              usernameResolutionFailed: results.usernameResolutionFailed
            });
          }

          return result;
        });

        await Promise.all(batchPromises);
      }

      logger.info('Username-based message broadcast completed', {
        messageId,
        results,
        methodBreakdown
      });

      return {
        success: true,
        results,
        methodBreakdown
      };
    } catch (error) {
      logger.error('Error during username-based message broadcast', {
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
   * [RU] Проверка, является ли сообщение админским
   * [EN] Check if message is admin message
   */
  isAdminMessage(messageId) {
    if (!messageId) return false;
    return typeof messageId === 'string' && messageId.startsWith('admin_');
  }

  /**
   * [RU] Категоризация ошибок Telegram API
   * [EN] Categorize Telegram API errors
   */
  categorizeError(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    
    if (errorMessage.includes('blocked') || errorMessage.includes('bot was blocked')) {
      return 'blocked';
    }
    
    if (errorMessage.includes('chat not found') || errorMessage.includes('user not found')) {
      return 'failed';
    }
    
    if (errorMessage.includes('too many requests') || error.code === 429) {
      return 'rate_limited';
    }
    
    if (errorMessage.includes('bad request') || error.code >= 400 && error.code < 500) {
      return 'failed';
    }
    
    // Серверные ошибки или сетевые проблемы
    return 'failed';
  }

  /**
   * [RU] Валидация токена бота
   * [EN] Validate bot token
   */
  async validateBotToken(bot) {
    try {
      const me = await bot.telegram.getMe();
      logger.info('Bot token validation successful', {
        botId: me.id,
        botUsername: me.username,
        botName: me.first_name
      });
      
      return {
        success: true,
        bot: me
      };
    } catch (error) {
      logger.error('Bot token validation failed', {
        error: error.message,
        errorCode: error.code
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Диагностическая отправка тестового сообщения администратору
   * [EN] Diagnostic test message send to admin
   */
  async sendDiagnosticMessage(bot, adminId, testMessage = "🔧 Диагностическое сообщение - бот работает корректно") {
    try {
      const result = await this.sendToUser(bot, adminId, testMessage, 'admin_diagnostic', {
        parseMode: 'HTML',
        disablePreview: true
      });
      
      logger.info('Diagnostic message sent', {
        adminId,
        result
      });
      
      return result;
    } catch (error) {
      logger.error('Diagnostic message failed', {
        adminId,
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