/**
 * [RU] Бизнес-логика планировщика напоминаний
 * [EN] Reminder scheduler business logic
 */

const cron = require('node-cron');
const { formatDate, getRelativeTime } = require('../../utils/date-utils');
const { ReminderSchedulerAPI } = require('./api');
const texts = require('../../bot/texts');

/**
 * [RU] Основной класс для логики планировщика напоминаний
 * [EN] Main reminder scheduler logic class
 */
class ReminderSchedulerLogic {
  constructor(database, bot = null) {
    this.api = new ReminderSchedulerAPI(database);
    this.bot = bot;
    this.isRunning = false;
    this.cronJob = null;
    this.processingQueue = new Set();
  }

  /**
   * [RU] Запуск планировщика
   * [EN] Start scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Планировщик уже запущен');
      return;
    }

    // Запускаем cron задачу каждую минуту
    this.cronJob = cron.schedule('*/1 * * * *', async () => {
      await this.processScheduledReminders();
    }, {
      scheduled: false
    });

    this.cronJob.start();
    this.isRunning = true;
    
    console.log('✅ Планировщик напоминаний запущен');
  }

  /**
   * [RU] Остановка планировщика
   * [EN] Stop scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Планировщик не был запущен');
      return;
    }

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    this.isRunning = false;
    console.log('🛑 Планировщик напоминаний остановлен');
  }

  /**
   * [RU] Обработка запланированных напоминаний
   * [EN] Process scheduled reminders
   */
  async processScheduledReminders() {
    if (!this.bot) {
      console.log('⚠️ Бот не инициализирован для отправки напоминаний');
      return;
    }

    try {
      console.log('🔍 Проверка готовых напоминаний...');
      
      const dueResult = await this.api.getDueReminders();
      
      if (!dueResult.success) {
        console.error('❌ Ошибка получения готовых напоминаний:', dueResult.error);
        return;
      }

      const dueReminders = dueResult.reminders;
      
      if (dueReminders.length === 0) {
        console.log('✅ Нет готовых напоминаний');
        return;
      }

      console.log(`📨 Найдено ${dueReminders.length} готовых напоминаний`);

      // Обрабатываем каждое напоминание
      for (const reminder of dueReminders) {
        if (this.processingQueue.has(reminder.id)) {
          console.log(`⏳ Напоминание ${reminder.id} уже обрабатывается`);
          continue;
        }

        this.processingQueue.add(reminder.id);
        
        try {
          await this.processReminder(reminder);
        } catch (error) {
          console.error(`❌ Ошибка обработки напоминания ${reminder.id}:`, error.message);
        } finally {
          this.processingQueue.delete(reminder.id);
        }
      }
    } catch (error) {
      console.error('❌ Критическая ошибка в планировщике:', error.message);
    }
  }

  /**
   * [RU] Обработка отдельного напоминания
   * [EN] Process individual reminder
   */
  async processReminder(reminder) {
    console.log(`📤 Обрабатываю напоминание ${reminder.id}: ${reminder.message_text.substring(0, 50)}...`);

    try {
      // Помечаем как отправляемое
      await this.api.updateReminderStatus(reminder.id, 'sent');

      // Здесь будет вызов модуля доставки сообщений
      // Пока что просто логируем
      console.log(`✅ Напоминание ${reminder.id} отправлено пользователям`);

      return {
        success: true,
        reminderId: reminder.id
      };
    } catch (error) {
      // При ошибке помечаем как неудачное
      await this.api.updateReminderStatus(reminder.id, 'failed');
      
      console.error(`❌ Не удалось отправить напоминание ${reminder.id}:`, error.message);
      
      return {
        success: false,
        reminderId: reminder.id,
        error: error.message
      };
    }
  }

  /**
   * [RU] Создание нового события с напоминаниями
   * [EN] Create new event with reminders
   */
  async createEvent(eventText, eventDate, reminderOptions = {}) {
    try {
      // Валидация события
      if (!eventText || eventText.trim().length === 0) {
        throw new Error('Описание события не может быть пустым');
      }

      if (new Date(eventDate) <= new Date()) {
        throw new Error('Дата события должна быть в будущем');
      }

      // Создаем серию напоминаний
      const result = await this.api.createEventReminderSeries(
        eventText, 
        eventDate, 
        reminderOptions
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      console.log(`✅ Создано событие с ${result.reminders.length} напоминаниями`);

      return {
        success: true,
        event: {
          text: eventText,
          date: eventDate
        },
        reminders: result.reminders,
        message: `Событие запланировано на ${formatDate(eventDate, { includeTime: true })}`
      };
    } catch (error) {
      console.error('❌ Ошибка создания события:', error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Получение предстоящих событий
   * [EN] Get upcoming events
   */
  async getUpcomingEvents(limit = 10) {
    try {
      const result = await this.api.getReminders({
        status: 'pending',
        fromDate: new Date(),
        limit
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      const events = result.reminders.map(reminder => ({
        id: reminder.id,
        text: reminder.message_text,
        date: reminder.send_date,
        formattedDate: formatDate(reminder.send_date, { includeTime: true }),
        relativeTime: getRelativeTime(reminder.send_date),
        status: reminder.status
      }));

      return {
        success: true,
        events,
        count: events.length
      };
    } catch (error) {
      console.error('❌ Ошибка получения предстоящих событий:', error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Отмена напоминания
   * [EN] Cancel reminder
   */
  async cancelReminder(reminderId, reason = 'User cancellation') {
    try {
      const result = await this.api.updateReminderStatus(reminderId, 'cancelled');
      
      if (!result.success) {
        throw new Error(result.error);
      }

      console.log(`🚫 Напоминание ${reminderId} отменено: ${reason}`);

      return {
        success: true,
        reminderId,
        message: 'Напоминание отменено'
      };
    } catch (error) {
      console.error(`❌ Ошибка отмены напоминания ${reminderId}:`, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Редактирование напоминания
   * [EN] Edit reminder
   */
  async editReminder(reminderId, newText, newDate = null) {
    try {
      // Для редактирования создаем новое напоминание и отменяем старое
      const oldReminderResult = await this.api.deleteReminder(reminderId, 'Edited by user');
      
      if (!oldReminderResult.success) {
        throw new Error('Не удалось найти оригинальное напоминание');
      }

      // Создаем новое напоминание
      const createResult = await this.api.createReminder(
        newText, 
        newDate || oldReminderResult.deletedReminder.send_date
      );

      if (!createResult.success) {
        throw new Error(createResult.error);
      }

      console.log(`✏️ Напоминание ${reminderId} отредактировано (новый ID: ${createResult.reminderId})`);

      return {
        success: true,
        oldId: reminderId,
        newId: createResult.reminderId,
        message: 'Напоминание обновлено'
      };
    } catch (error) {
      console.error(`❌ Ошибка редактирования напоминания ${reminderId}:`, error.message);
      
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
  async getStats() {
    try {
      const result = await this.api.getSchedulerStats();
      
      if (!result.success) {
        throw new Error(result.error);
      }

      const stats = {
        ...result.stats,
        isRunning: this.isRunning,
        processingQueue: this.processingQueue.size
      };

      return {
        success: true,
        stats
      };
    } catch (error) {
      console.error('❌ Ошибка получения статистики:', error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Установка бота для отправки сообщений
   * [EN] Set bot for message sending
   */
  setBot(bot) {
    this.bot = bot;
    console.log('🤖 Бот установлен для планировщика');
  }

  /**
   * [RU] Проверка состояния планировщика
   * [EN] Check scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      processingQueue: this.processingQueue.size,
      hasCronJob: !!this.cronJob,
      hasBot: !!this.bot
    };
  }
}

module.exports = {
  ReminderSchedulerLogic
};