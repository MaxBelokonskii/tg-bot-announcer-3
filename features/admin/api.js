/**
 * [RU] API для администрирования и управления списком гостей
 * [EN] Administration and guest list management API
 */

const { DatabaseUtils } = require('../../utils/db-utils');
const { MessageDeliveryAPI } = require('../message-delivery/api');
const { MessageSequenceProcessor } = require('../../utils/message-sequence-processor');
const { UserDataValidator } = require('../../utils/user-data-validator');
const { getConfig } = require('../../config/enhanced-admin');
const { formatEnhancedDeliveryStats } = require('../../utils/format-utils');

/**
 * [RU] Класс API для администрирования
 * [EN] Administration API class
 */
class AdminAPI extends DatabaseUtils {
  constructor(database) {
    super(database);
    this.messageDeliveryAPI = new MessageDeliveryAPI(database);
    this.messageSequenceProcessor = new MessageSequenceProcessor(database);
    this.userDataValidator = new UserDataValidator(database);
  }

  /**
   * [RU] Получение всех пользователей с их статусами присутствия
   * [EN] Get all users with their attendance statuses
   */
  async getAllUsersWithAttendance() {
    try {
      const query = `
        SELECT 
          id,
          telegram_id,
          username,
          full_name,
          attendance_status,
          attendance_updated_at,
          created_at
        FROM users 
        ORDER BY attendance_status, full_name
      `;

      const users = this.getMany(query);
      
      console.log(`📊 Получен список из ${users.length} пользователей`);
      
      return { success: true, users };
    } catch (error) {
      console.error('❌ Ошибка получения списка пользователей с присутствием:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение статистики пользователей
   * [EN] Get user statistics
   */
  async getUserStatistics() {
    try {
      const totalQuery = `SELECT COUNT(*) as total FROM users`;
      const totalResult = this.getOne(totalQuery);
      
      const recentQuery = `
        SELECT COUNT(*) as recent 
        FROM users 
        WHERE created_at >= datetime('now', '-30 days')
      `;
      const recentResult = this.getOne(recentQuery);

      const stats = {
        total: totalResult.total || 0,
        recent: recentResult.recent || 0
      };

      return { success: true, stats };
    } catch (error) {
      console.error('❌ Ошибка получения статистики пользователей:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение статистики присутствия
   * [EN] Get attendance statistics
   */
  async getAttendanceStatistics() {
    try {
      const query = `
        SELECT 
          attendance_status,
          COUNT(*) as count
        FROM users 
        GROUP BY attendance_status
      `;

      const results = this.getMany(query);
      
      // Инициализируем статистику с нулевыми значениями
      const stats = {
        attending: 0,
        not_attending: 0,
        maybe: 0,
        total: 0
      };

      // Заполняем реальными данными
      results.forEach(row => {
        const status = row.attendance_status || 'attending';
        if (stats.hasOwnProperty(status)) {
          stats[status] = row.count;
        }
        stats.total += row.count;
      });

      return { success: true, stats };
    } catch (error) {
      console.error('❌ Ошибка получения статистики присутствия:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение пользователей по статусу присутствия
   * [EN] Get users by attendance status
   */
  async getUsersByAttendanceStatus(status) {
    try {
      const validStatuses = ['attending', 'not_attending', 'maybe'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid attendance status: ${status}`);
      }

      const query = `
        SELECT 
          id,
          telegram_id,
          username,
          full_name,
          attendance_updated_at,
          created_at
        FROM users 
        WHERE attendance_status = ?
        ORDER BY full_name
      `;

      const users = this.getMany(query, [status]);
      
      return { success: true, users, status, count: users.length };
    } catch (error) {
      console.error(`❌ Ошибка получения пользователей со статусом ${status}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение детальной информации о пользователе
   * [EN] Get detailed user information
   */
  async getUserDetails(userId) {
    try {
      const userQuery = `
        SELECT 
          id,
          telegram_id,
          username,
          full_name,
          attendance_status,
          attendance_updated_at,
          created_at,
          updated_at
        FROM users 
        WHERE telegram_id = ?
      `;

      const user = this.getOne(userQuery, [userId]);
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Получаем количество ответов пользователя
      const responsesQuery = `
        SELECT COUNT(*) as response_count 
        FROM user_responses 
        WHERE user_id = ?
      `;
      
      const responsesResult = this.getOne(responsesQuery, [user.id]);
      
      user.response_count = responsesResult.response_count || 0;

      return { success: true, user };
    } catch (error) {
      console.error('❌ Ошибка получения детальной информации о пользователе:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение активности пользователей за период
   * [EN] Get user activity for period
   */
  async getUserActivity(days = 30) {
    try {
      const query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as registrations
        FROM users 
        WHERE created_at >= datetime('now', '-${days} days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

      const activity = this.getMany(query);
      
      return { success: true, activity, period: days };
    } catch (error) {
      console.error('❌ Ошибка получения активности пользователей:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Поиск пользователей по имени
   * [EN] Search users by name
   */
  async searchUsersByName(searchTerm) {
    try {
      const query = `
        SELECT 
          id,
          telegram_id,
          username,
          full_name,
          attendance_status,
          created_at
        FROM users 
        WHERE full_name LIKE ? OR username LIKE ?
        ORDER BY 
          CASE 
            WHEN full_name LIKE ? THEN 1
            WHEN username LIKE ? THEN 2
            ELSE 3
          END,
          full_name
        LIMIT 50
      `;

      const searchPattern = `%${searchTerm}%`;
      const exactPattern = `${searchTerm}%`;
      
      const users = this.getMany(query, [
        searchPattern, searchPattern, 
        exactPattern, exactPattern
      ]);
      
      return { success: true, users, searchTerm, count: users.length };
    } catch (error) {
      console.error('❌ Ошибка поиска пользователей по имени:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Поиск пользователей по username
   * [EN] Search users by username
   */
  async searchUsersByUsername(searchTerm) {
    try {
      const query = `
        SELECT 
          id,
          telegram_id,
          username,
          full_name,
          attendance_status,
          created_at
        FROM users 
        WHERE username LIKE ? AND username IS NOT NULL
        ORDER BY 
          CASE 
            WHEN username LIKE ? THEN 1
            ELSE 2
          END,
          username
        LIMIT 50
      `;

      const searchPattern = `%${searchTerm}%`;
      const exactPattern = `${searchTerm}%`;
      
      const users = this.getMany(query, [searchPattern, exactPattern]);
      
      return { success: true, users, searchTerm, count: users.length };
    } catch (error) {
      console.error('❌ Ошибка поиска пользователей по username:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обновление статуса присутствия администратором
   * [EN] Update attendance status by admin
   */
  async adminUpdateUserAttendance(targetUserId, status, adminUserId) {
    try {
      const validStatuses = ['attending', 'not_attending', 'maybe'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid attendance status: ${status}`);
      }

      const query = `
        UPDATE users 
        SET attendance_status = ?, 
            attendance_updated_at = CURRENT_TIMESTAMP 
        WHERE telegram_id = ?
      `;

      const result = this.updateRecord(query, [status, targetUserId]);
      
      if (result.changes === 0) {
        throw new Error(`User ${targetUserId} not found`);
      }

      console.log(`✅ Администратор ${adminUserId} изменил статус пользователя ${targetUserId} на: ${status}`);
      
      return { 
        success: true, 
        status,
        targetUserId,
        adminUserId,
        updated_at: new Date().toISOString() 
      };
    } catch (error) {
      console.error('❌ Ошибка административного обновления статуса:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение логов изменений статуса присутствия
   * [EN] Get attendance status change logs
   */
  async getAttendanceChangeLogs(limit = 100) {
    try {
      // В будущем можно создать отдельную таблицу для логов
      // Пока используем информацию об обновлениях из таблицы users
      const query = `
        SELECT 
          telegram_id,
          full_name,
          attendance_status,
          attendance_updated_at
        FROM users 
        WHERE attendance_updated_at IS NOT NULL
        ORDER BY attendance_updated_at DESC
        LIMIT ?
      `;

      const logs = this.getMany(query, [limit]);
      
      return { success: true, logs, count: logs.length };
    } catch (error) {
      console.error('❌ Ошибка получения логов изменений присутствия:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Отправка улучшенной админской рассылки с последовательностью сообщений
   * [EN] Send enhanced admin broadcast with message sequence
   */
  async sendEnhancedBroadcast(bot, adminUserId, options = {}) {
    const startTime = new Date();
    let messageId = null;
    
    // Получаем конфигурацию
    const configResult = getConfig(options.config || {});
    const config = configResult.config;
    
    if (!configResult.validation.valid) {
      console.warn('⚠️ Проблемы с конфигурацией:', configResult.validation.errors);
    }
    
    let enhancedStats = {
      total: 0,
      eligibleForEnhanced: 0,
      enhancedSequenceCompleted: 0,
      standardDelivered: 0,
      usefulInfoDelivered: 0,
      eventDetailsDelivered: 0,
      menuTriggered: 0,
      sequenceFailures: 0,
      completionRate: 0
    };

    try {
      messageId = `admin_enhanced_${Date.now()}`;
      const messageText = options.messageText || "Это тестовое сообщение с улучшенной последовательностью. Если ты его видишь, то напиши Максиму";

      console.log(`🚀 Администратор ${adminUserId} начал отправку улучшенной рассылки`);

      // Проверяем валидность бота
      const botValidation = await this.messageDeliveryAPI.validateBotToken(bot);
      if (!botValidation.success) {
        throw new Error(`Ошибка валидации бота: ${botValidation.error}`);
      }

      console.log(`✅ Валидация бота успешна: ${botValidation.bot.username}`);

      // Получаем подходящих пользователей
      const eligibleUsersResult = this.userDataValidator.getEligibleUsersForEnhancedBroadcast();
      
      if (!eligibleUsersResult.success) {
        throw new Error(`Ошибка получения подходящих пользователей: ${eligibleUsersResult.error}`);
      }

      const eligibleUsers = eligibleUsersResult.users;
      enhancedStats.total = eligibleUsersResult.totalCount || 0;
      enhancedStats.eligibleForEnhanced = eligibleUsers.length;
      
      console.log(`👥 Найдено ${enhancedStats.eligibleForEnhanced} подходящих пользователей из ${enhancedStats.total} общих`);

      if (eligibleUsers.length === 0) {
        console.log('⚠️ Нет подходящих пользователей для улучшенной рассылки');
        
        // Логируем сообщение
        this.logEnhancedAdminMessage(messageText, adminUserId, enhancedStats, messageId);
        
        return {
          success: false,
          error: 'Нет подходящих пользователей для улучшенной рассылки',
          enhancedStats,
          duration: `${Math.round((new Date().getTime() - startTime.getTime()) / 1000)} сек`
        };
      }

      // Отправляем основное сообщение всем подходящим пользователям
      const broadcastResult = await this.messageDeliveryAPI.broadcastMessage(
        bot,
        messageText,
        messageId,
        {
          batchSize: config.batching.maxUsersPerBatch,
          delay: config.delays.betweenUsers,
          parseMode: 'HTML',
          targetUsers: eligibleUsers.map(user => ({ telegram_id: user.telegram_id })),
          onProgress: (stats) => {
            console.log(`📈 Прогресс основной рассылки: ${stats.processed}/${stats.total}`);
          }
        }
      );

      if (!broadcastResult.success) {
        throw new Error(`Ошибка основной рассылки: ${broadcastResult.error}`);
      }

      enhancedStats.standardDelivered = broadcastResult.results?.delivered || 0;
      console.log(`✅ Основное сообщение доставлено ${enhancedStats.standardDelivered} пользователям`);

      // Обрабатываем каждого пользователя для улучшенной последовательности
      const successfulUsers = eligibleUsers.filter(user => 
        broadcastResult.results?.successful?.includes(user.telegram_id)
      );

      console.log(`🔄 Начинаем обработку улучшенной последовательности для ${successfulUsers.length} пользователей`);

      // Пакетная обработка последовательностей
      const sequenceOptions = {
        includeUsefulInfo: config.sequence.includeUsefulInfo,
        includeEventDetails: config.sequence.includeEventDetails,
        triggerMenu: config.sequence.triggerMenu,
        sequenceDelay: config.delays.betweenMessages
      };

      for (let i = 0; i < successfulUsers.length; i += config.batching.maxUsersPerBatch) {
        const batch = successfulUsers.slice(i, i + config.batching.maxUsersPerBatch);
        
        const batchPromises = batch.map(async (user) => {
          try {
            const sequenceResult = await this.messageSequenceProcessor.processUserMessageSequence(
              bot, 
              user.telegram_id, 
              messageText, 
              sequenceOptions
            );
            
            // Логируем результат последовательности
            await this.logEnhancedDeliverySequence(user.telegram_id, messageId, sequenceResult);
            
            return sequenceResult;
          } catch (error) {
            console.error(`❌ Ошибка обработки последовательности для пользователя ${user.telegram_id}:`, error.message);
            return { success: false, error: error.message, userId: user.telegram_id };
          }
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Обрабатываем результаты пакета
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.success && result.value.results) {
            const sequenceData = result.value.results;
            enhancedStats.enhancedSequenceCompleted++;
            
            if (sequenceData.steps.usefulInfo.success) enhancedStats.usefulInfoDelivered++;
            if (sequenceData.steps.eventDetails.success) enhancedStats.eventDetailsDelivered++;
            if (sequenceData.steps.menuTrigger.success) enhancedStats.menuTriggered++;
          } else {
            enhancedStats.sequenceFailures++;
          }
        });
        
        // Задержка между пакетами
        if (i + config.batching.maxUsersPerBatch < successfulUsers.length) {
          await this.delay(config.batching.batchProcessingDelay);
        }
      }

      enhancedStats.completionRate = enhancedStats.eligibleForEnhanced > 0 
        ? (enhancedStats.enhancedSequenceCompleted / enhancedStats.eligibleForEnhanced) * 100 
        : 0;

      console.log(`🎉 Улучшенная рассылка завершена: ${enhancedStats.enhancedSequenceCompleted}/${enhancedStats.eligibleForEnhanced} (${enhancedStats.completionRate.toFixed(1)}%)`);

      // Логируем результат
      this.logEnhancedAdminMessage(messageText, adminUserId, enhancedStats, messageId);

      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

      return {
        success: true,
        messageId,
        enhancedStats,
        botInfo: botValidation.bot,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: `${duration} сек`,
        config: {
          enhanced: true,
          sequenceSteps: Object.keys(sequenceOptions).filter(key => sequenceOptions[key]).length + 1
        }
      };
    } catch (error) {
      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
      
      console.error('❌ Критическая ошибка улучшенной рассылки:', error.message);
      
      // Логируем ошибку
      try {
        this.logEnhancedAdminMessage(
          `Ошибка улучшенной отправки: ${error.message}`,
          adminUserId,
          enhancedStats,
          messageId,
          'error'
        );
      } catch (logError) {
        console.error('❌ Ошибка логирования:', logError.message);
      }
      
      return {
        success: false,
        error: error.message,
        messageId,
        enhancedStats,
        duration: `${duration} сек`,
        errorDetails: {
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * [RU] Отправка тестового сообщения всем пользователям
   * [EN] Send test message to all users
   */
  async sendTestMessage(bot, adminUserId, options = {}) {
    const startTime = new Date();
    let messageId = null;
    let deliveryStats = {
      total: 0,
      delivered: 0,
      failed: 0,
      blocked: 0,
      usernameDelivered: 0,
      telegramIdDelivered: 0,
      usernameResolutionFailed: 0
    };
    
    let methodBreakdown = {
      username: { attempted: 0, successful: 0 },
      telegram_id: { attempted: 0, successful: 0 }
    };

    try {
      messageId = `admin_test_${Date.now()}`;
      const messageText = "Это тестовое сообщение. Если ты его видишь, то напиши Максиму";

      const {
        sendMethod = process.env.PREFERRED_SEND_METHOD || 'auto',
        batchSize = 25,
        delay = 150
      } = options;

      console.log(`📢 Администратор ${adminUserId} начал отправку тестового сообщения (метод: ${sendMethod})`);

      // Проверяем валидность бота перед отправкой
      const botValidation = await this.messageDeliveryAPI.validateBotToken(bot);
      if (!botValidation.success) {
        throw new Error(`Ошибка валидации бота: ${botValidation.error}`);
      }

      console.log(`✅ Валидация бота успешна: ${botValidation.bot.username} (${botValidation.bot.first_name})`);

      // Получаем список всех пользователей
      const usersResult = await this.getAllUsersWithAttendance();
      if (!usersResult.success) {
        throw new Error(`Ошибка получения пользователей: ${usersResult.error}`);
      }

      const users = usersResult.users;
      if (!users || users.length === 0) {
        const noUsersResult = {
          success: false,
          error: 'Нет пользователей для отправки сообщений',
          deliveryStats: {
            total: 0,
            delivered: 0,
            failed: 0,
            blocked: 0
          },
          duration: '0 сек'
        };
        
        console.log('⚠️ Нет пользователей для отправки');
        
        // Всё равно сохраняем запись об отправке
        this.logAdminMessage(messageText, adminUserId, noUsersResult.deliveryStats);
        
        return noUsersResult;
      }

      console.log(`👥 Найдено ${users.length} пользователей для отправки`);

      // Отправляем сообщение через MessageDeliveryAPI с admin префиксом
      const result = await this.messageDeliveryAPI.broadcastMessage(
        bot,
        messageText,
        messageId, // Используем admin префикс для отключения стандартного логирования
        {
          batchSize: 25,
          delay: 150,
          parseMode: 'HTML',
          onProgress: (stats) => {
            console.log(`📊 Прогресс отправки: ${stats.processed}/${stats.total} (доставлено: ${stats.delivered}, ошибок: ${stats.failed}, заблокировано: ${stats.blocked})`);
          }
        }
      );

      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

      if (!result.success) {
        throw new Error(`Ошибка рассылки: ${result.error}`);
      }

      deliveryStats = {
        total: result.results?.total || 0,
        delivered: result.results?.delivered || 0,
        failed: result.results?.failed || 0,
        blocked: result.results?.blocked || 0,
        usernameDelivered: 0,
        telegramIdDelivered: result.results?.delivered || 0,
        usernameResolutionFailed: 0
      };

      // Сохраняем запись об отправке в таблице admin_messages
      this.logAdminMessage(messageText, adminUserId, deliveryStats);

      console.log(`✅ Отправка завершена. Доставлено: ${deliveryStats.delivered}/${deliveryStats.total}, заблокировано: ${deliveryStats.blocked}`);

      return {
        success: true,
        messageId,
        deliveryStats,
        botInfo: botValidation.bot,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: `${duration} сек`
      };
    } catch (error) {
      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
      
      console.error('❌ Критическая ошибка рассылки:', error.message);
      
      // Логируем ошибку в админские сообщения
      try {
        this.logAdminMessage(
          `Ошибка отправки: ${error.message}`,
          adminUserId,
          deliveryStats,
          'error'
        );
      } catch (logError) {
        console.error('❌ Ошибка логирования:', logError.message);
      }
      
      return {
        success: false,
        error: error.message,
        messageId,
        deliveryStats,
        duration: `${duration} сек`,
        errorDetails: {
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * [RU] Получение истории отправленных тестовых сообщений
   * [EN] Get test message history
   */
  async getTestMessageHistory(limit = 50) {
    try {
      const query = `
        SELECT 
          id,
          message_text,
          message_type,
          sent_by,
          sent_at,
          total_recipients,
          delivered_count,
          failed_count,
          blocked_count
        FROM admin_messages 
        WHERE message_type = 'test_message'
        ORDER BY sent_at DESC
        LIMIT ?
      `;

      const history = this.getMany(query, [limit]);
      
      // Форматируем данные для отображения
      const formattedHistory = history.map(message => {
        const deliveryRate = message.total_recipients > 0 
          ? ((message.delivered_count / message.total_recipients) * 100).toFixed(1)
          : 0;

        return {
          messageId: message.id,
          messageText: message.message_text,
          sentBy: message.sent_by,
          sentAt: message.sent_at,
          deliveryStats: {
            total: message.total_recipients,
            delivered: message.delivered_count,
            failed: message.failed_count,
            blocked: message.blocked_count,
            deliveryRate: parseFloat(deliveryRate)
          }
        };
      });

      return {
        success: true,
        history: formattedHistory,
        count: formattedHistory.length
      };
    } catch (error) {
      console.error('❌ Ошибка получения истории сообщений:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Получение общей статистики системы
   * [EN] Get overall system statistics
   */
  async getSystemStatistics() {
    try {
      const userStats = await this.getUserStatistics();
      const attendanceStats = await this.getAttendanceStatistics();
      
      // Получаем статистику ответов
      const responsesQuery = `SELECT COUNT(*) as total FROM user_responses`;
      const responsesResult = this.getOne(responsesQuery);
      
      // Получаем статистику сообщений
      const messagesQuery = `SELECT COUNT(*) as total FROM scheduled_messages`;
      const messagesResult = this.getOne(messagesQuery);

      const systemStats = {
        users: userStats.success ? userStats.stats : { total: 0, recent: 0 },
        attendance: attendanceStats.success ? attendanceStats.stats : { attending: 0, not_attending: 0, maybe: 0, total: 0 },
        responses: responsesResult.total || 0,
        messages: messagesResult.total || 0,
        timestamp: new Date().toISOString()
      };

      return { success: true, stats: systemStats };
    } catch (error) {
      console.error('❌ Ошибка получения системной статистики:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Логирование админского сообщения
   * [EN] Log admin message
   */
  logAdminMessage(messageText, adminUserId, deliveryStats, messageType = 'test_message') {
    try {
      const insertQuery = `
        INSERT INTO admin_messages (
          message_text, 
          message_type, 
          sent_by, 
          total_recipients, 
          delivered_count, 
          failed_count, 
          blocked_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      this.executeQuery(insertQuery, [
        messageText,
        messageType,
        adminUserId,
        deliveryStats.total,
        deliveryStats.delivered,
        deliveryStats.failed,
        deliveryStats.blocked
      ]);
      
      console.log(`📋 Админское сообщение залогировано`);
    } catch (error) {
      console.error('❌ Ошибка логирования админского сообщения:', error.message);
    }
  }

  /**
   * [RU] Логирование улучшенного админского сообщения
   * [EN] Log enhanced admin message
   */
  logEnhancedAdminMessage(messageText, adminUserId, enhancedStats, messageId, messageType = 'enhanced_broadcast') {
    try {
      const insertQuery = `
        INSERT INTO admin_messages (
          message_text, 
          message_type, 
          sent_by, 
          total_recipients, 
          delivered_count, 
          failed_count, 
          blocked_count,
          enhanced_mode,
          sequence_completion_rate,
          eligible_users_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.executeQuery(insertQuery, [
        messageText,
        messageType,
        adminUserId,
        enhancedStats.total || 0,
        enhancedStats.standardDelivered || 0,
        enhancedStats.sequenceFailures || 0,
        0, // blocked_count - для совместимости
        true, // enhanced_mode
        enhancedStats.completionRate || 0,
        enhancedStats.eligibleForEnhanced || 0
      ]);
      
      console.log(`📋 Улучшенное админское сообщение залогировано`);
    } catch (error) {
      console.error('❌ Ошибка логирования улучшенного админского сообщения:', error.message);
    }
  }

  /**
   * [RU] Логирование последовательности доставки
   * [EN] Log delivery sequence
   */
  async logEnhancedDeliverySequence(userId, adminMessageId, sequenceResult) {
    try {
      if (!sequenceResult || !sequenceResult.results) {
        console.warn(`⚠️ Нет результатов последовательности для пользователя ${userId}`);
        return;
      }

      const { results } = sequenceResult;
      const { sequenceId, steps } = results;
      
      // Получаем внутренний ID пользователя
      const userQuery = `SELECT id FROM users WHERE telegram_id = ?`;
      const userResult = this.getOne(userQuery, [userId]);
      
      if (!userResult) {
        console.warn(`⚠️ Пользователь ${userId} не найден в базе данных`);
        return;
      }

      const internalUserId = userResult.id;
      const completionRate = sequenceResult.completionRate || 0;

      // Логируем каждый шаг последовательности
      const insertQuery = `
        INSERT INTO enhanced_delivery_logs (
          user_id,
          admin_message_id,
          sequence_step,
          delivery_status,
          sequence_id,
          completion_rate,
          error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      // Логируем каждый шаг
      for (const [stepName, stepData] of Object.entries(steps)) {
        if (stepData.attempted) {
          const status = stepData.success ? 'delivered' : 'failed';
          const errorMessage = stepData.success ? null : (
            results.errors.find(err => err.step === stepName)?.error || 'Неизвестная ошибка'
          );

          this.executeQuery(insertQuery, [
            internalUserId,
            adminMessageId,
            stepName,
            status,
            sequenceId,
            completionRate,
            errorMessage
          ]);
        }
      }
      
      console.log(`📋 Последовательность доставки для пользователя ${userId} залогирована`);
    } catch (error) {
      console.error(`❌ Ошибка логирования последовательности для пользователя ${userId}:`, error.message);
    }
  }

  /**
   * [RU] Задержка выполнения
   * [EN] Execution delay
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = {
  AdminAPI
};