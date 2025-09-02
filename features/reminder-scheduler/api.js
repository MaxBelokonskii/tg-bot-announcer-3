/**
 * [RU] API для планировщика напоминаний
 * [EN] Reminder scheduler API
 */

const { MessageUtils } = require('../../utils/db-utils');
const { isValidDate, parseDate, getReminderTimes } = require('../../utils/date-utils');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'reminder-scheduler' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/scheduler-error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/scheduler.log' 
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * [RU] Класс для работы с API планировщика напоминаний
 * [EN] Reminder scheduler API class
 */
class ReminderSchedulerAPI {
  constructor(database) {
    this.db = database;
    this.messageUtils = new MessageUtils(database);
  }

  /**
   * [RU] Создание запланированного напоминания
   * [EN] Create scheduled reminder
   */
  async createReminder(messageText, sendDate, options = {}) {
    try {
      const { eventType = 'general', priority = 'normal' } = options;

      // Валидация входных данных
      if (!messageText || messageText.trim().length === 0) {
        throw new Error('Текст сообщения не может быть пустым');
      }

      if (messageText.length > 4000) {
        throw new Error('Текст сообщения слишком длинный (максимум 4000 символов)');
      }

      // Валидация и парсинг даты
      let parsedDate;
      if (typeof sendDate === 'string') {
        parsedDate = parseDate(sendDate);
      } else {
        parsedDate = new Date(sendDate);
      }

      if (!isValidDate(parsedDate)) {
        throw new Error('Неверный формат даты');
      }

      if (parsedDate <= new Date()) {
        throw new Error('Дата отправки должна быть в будущем');
      }

      // Создаем напоминание
      const result = this.messageUtils.createScheduledMessage(
        messageText.trim(), 
        parsedDate.toISOString()
      );

      if (!result.success) {
        throw new Error('Не удалось создать напоминание в базе данных');
      }

      logger.info('Reminder created successfully', {
        messageId: result.id,
        sendDate: parsedDate.toISOString(),
        messageLength: messageText.length,
        eventType,
        priority
      });

      return {
        success: true,
        reminderId: result.id,
        sendDate: parsedDate,
        message: 'Напоминание успешно запланировано'
      };
    } catch (error) {
      logger.error('Error creating reminder', {
        messageText: messageText?.substring(0, 100),
        sendDate,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Получение готовых к отправке напоминаний
   * [EN] Get due reminders
   */
  async getDueReminders() {
    try {
      const dueMessages = this.messageUtils.getDueMessages();
      
      logger.info('Retrieved due reminders', {
        count: dueMessages.length
      });

      return {
        success: true,
        reminders: dueMessages
      };
    } catch (error) {
      logger.error('Error retrieving due reminders', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Обновление статуса напоминания
   * [EN] Update reminder status
   */
  async updateReminderStatus(reminderId, status) {
    try {
      const validStatuses = ['pending', 'sent', 'failed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Недопустимый статус: ${status}`);
      }

      const result = this.messageUtils.updateMessageStatus(reminderId, status);
      
      if (!result.success) {
        throw new Error('Не удалось обновить статус напоминания');
      }

      logger.info('Reminder status updated', {
        reminderId,
        status,
        changes: result.changes
      });

      return {
        success: true,
        reminderId,
        status,
        message: 'Статус напоминания обновлен'
      };
    } catch (error) {
      logger.error('Error updating reminder status', {
        reminderId,
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
   * [RU] Получение всех напоминаний с фильтрацией
   * [EN] Get all reminders with filtering
   */
  async getReminders(options = {}) {
    try {
      const {
        status = null,
        fromDate = null,
        toDate = null,
        limit = 50,
        offset = 0
      } = options;

      let query = 'SELECT * FROM scheduled_messages WHERE 1=1';
      const params = [];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      if (fromDate) {
        query += ' AND send_date >= ?';
        params.push(new Date(fromDate).toISOString());
      }

      if (toDate) {
        query += ' AND send_date <= ?';
        params.push(new Date(toDate).toISOString());
      }

      query += ' ORDER BY send_date ASC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const reminders = this.messageUtils.getMany(query, params);

      logger.info('Retrieved reminders list', {
        count: reminders.length,
        filters: options
      });

      return {
        success: true,
        reminders,
        pagination: {
          limit,
          offset,
          count: reminders.length
        }
      };
    } catch (error) {
      logger.error('Error retrieving reminders', {
        options,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Удаление напоминания
   * [EN] Delete reminder
   */
  async deleteReminder(reminderId, reason = 'Manual deletion') {
    try {
      // Сначала получаем информацию о напоминании
      const reminder = this.messageUtils.getOne(
        'SELECT * FROM scheduled_messages WHERE id = ?',
        [reminderId]
      );

      if (!reminder) {
        return {
          success: false,
          error: 'Напоминание не найдено'
        };
      }

      // Удаляем напоминание
      const result = this.messageUtils.deleteRecords(
        'DELETE FROM scheduled_messages WHERE id = ?',
        [reminderId]
      );

      if (!result.success) {
        throw new Error('Не удалось удалить напоминание');
      }

      logger.warn('Reminder deleted', {
        reminderId,
        messageText: reminder.message_text.substring(0, 100),
        sendDate: reminder.send_date,
        reason
      });

      return {
        success: true,
        reminderId,
        message: 'Напоминание удалено',
        deletedReminder: reminder
      };
    } catch (error) {
      logger.error('Error deleting reminder', {
        reminderId,
        reason,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Создание серии напоминаний для события
   * [EN] Create reminder series for event
   */
  async createEventReminderSeries(eventText, eventDate, options = {}) {
    try {
      const {
        weekBefore = true,
        dayBefore = true,
        hourBefore = true,
        customTimes = []
      } = options;

      const reminderTimes = getReminderTimes(eventDate);
      const createdReminders = [];

      // Напоминание за неделю
      if (weekBefore && reminderTimes.weekBefore > new Date()) {
        const weekBeforeText = `⏰ Напоминание: через неделю состоится событие\n\n${eventText}`;
        const result = await this.createReminder(weekBeforeText, reminderTimes.weekBefore);
        if (result.success) {
          createdReminders.push({ type: 'week_before', ...result });
        }
      }

      // Напоминание за день
      if (dayBefore && reminderTimes.dayBefore > new Date()) {
        const dayBeforeText = `⚠️ Завтра важное событие!\n\n${eventText}`;
        const result = await this.createReminder(dayBeforeText, reminderTimes.dayBefore);
        if (result.success) {
          createdReminders.push({ type: 'day_before', ...result });
        }
      }

      // Напоминание за час
      if (hourBefore && reminderTimes.hourBefore > new Date()) {
        const hourBeforeText = `🚨 Через час начинается:\n\n${eventText}`;
        const result = await this.createReminder(hourBeforeText, reminderTimes.hourBefore);
        if (result.success) {
          createdReminders.push({ type: 'hour_before', ...result });
        }
      }

      // Кастомные напоминания
      for (const customTime of customTimes) {
        if (new Date(customTime.date) > new Date()) {
          const result = await this.createReminder(customTime.text, customTime.date);
          if (result.success) {
            createdReminders.push({ type: 'custom', ...result });
          }
        }
      }

      logger.info('Event reminder series created', {
        eventDate,
        totalReminders: createdReminders.length,
        reminderTypes: createdReminders.map(r => r.type)
      });

      return {
        success: true,
        eventDate,
        reminders: createdReminders,
        message: `Создано ${createdReminders.length} напоминаний для события`
      };
    } catch (error) {
      logger.error('Error creating event reminder series', {
        eventText: eventText?.substring(0, 100),
        eventDate,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Получение статистики планировщика
   * [EN] Get scheduler statistics
   */
  async getSchedulerStats() {
    try {
      const totalReminders = this.messageUtils.getCount('scheduled_messages');
      const pendingReminders = this.messageUtils.getCount(
        'scheduled_messages',
        'WHERE status = "pending"'
      );
      const sentReminders = this.messageUtils.getCount(
        'scheduled_messages',
        'WHERE status = "sent"'
      );
      const failedReminders = this.messageUtils.getCount(
        'scheduled_messages',
        'WHERE status = "failed"'
      );

      const upcomingReminders = this.messageUtils.getCount(
        'scheduled_messages',
        'WHERE status = "pending" AND send_date > datetime("now")'
      );

      const overdueReminders = this.messageUtils.getCount(
        'scheduled_messages',
        'WHERE status = "pending" AND send_date <= datetime("now")'
      );

      const stats = {
        total: totalReminders,
        pending: pendingReminders,
        sent: sentReminders,
        failed: failedReminders,
        upcoming: upcomingReminders,
        overdue: overdueReminders,
        timestamp: new Date().toISOString()
      };

      logger.info('Scheduler statistics retrieved', stats);

      return {
        success: true,
        stats
      };
    } catch (error) {
      logger.error('Error retrieving scheduler statistics', {
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
  ReminderSchedulerAPI
};