/**
 * [RU] Основной файл для запуска Telegram бота
 * [EN] Main bot initialization file
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');
const { getDatabaseConnection } = require('../database/connection');
const { MessageRouter } = require('./router');
const { ReminderSchedulerLogic } = require('../features/reminder-scheduler/logic');
const { MessageDeliveryLogic } = require('../features/message-delivery/logic');

/**
 * [RU] Основной класс бота
 * [EN] Main bot class
 */
class TelegramBot {
  constructor() {
    this.bot = null;
    this.database = null;
    this.router = null;
    this.scheduler = null;
    this.delivery = null;
    this.isRunning = false;
  }

  /**
   * [RU] Инициализация бота и всех компонентов
   * [EN] Initialize bot and all components
   */
  async initialize() {
    try {
      console.log('🚀 Инициализация Telegram бота...');

      // Проверяем наличие токена
      if (!process.env.BOT_TOKEN) {
        throw new Error('BOT_TOKEN не найден в переменных окружения');
      }

      // Создаем экземпляр бота
      this.bot = new Telegraf(process.env.BOT_TOKEN);
      console.log('✅ Telegraf инициализирован');

      // Инициализируем базу данных
      this.database = getDatabaseConnection(process.env.DATABASE_PATH || './database/bot_database.db');
      await this.database.connect();
      console.log('✅ База данных подключена');

      // Валидация базы данных
      await this.validateDatabase();
      console.log('✅ База данных валидирована');

      // Инициализируем планировщик напоминаний
      this.scheduler = new ReminderSchedulerLogic(this.database.getDatabase(), this.bot);
      console.log('✅ Планировщик напоминаний инициализирован');

      // Инициализируем систему доставки сообщений
      this.delivery = new MessageDeliveryLogic(this.database.getDatabase());
      console.log('✅ Система доставки сообщений инициализирована');

      // Инициализируем маршрутизатор
      this.router = new MessageRouter(
        this.database.getDatabase(),
        this.scheduler,
        this.delivery,
        this.bot
      );
      console.log('✅ Маршрутизатор сообщений инициализирован');

      // Настраиваем обработчики событий
      this.setupEventHandlers();
      console.log('✅ Обработчики событий настроены');

      // Настраиваем middleware
      this.setupMiddleware();
      console.log('✅ Middleware настроен');

      // Запускаем планировщик
      if (process.env.SCHEDULER_ENABLED !== 'false') {
        this.scheduler.start();
        console.log('✅ Планировщик напоминаний запущен');
      }

      console.log('🎉 Инициализация завершена успешно!');
      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка инициализации бота:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Валидация базы данных при старте
   * [EN] Database validation at startup
   */
  async validateDatabase() {
    try {
      const db = this.database.getDatabase();
      
      // Проверяем существование ключевых таблиц
      const requiredTables = ['users', 'admin_messages', 'scheduled_messages', 'delivery_logs', 'user_responses'];
      
      for (const tableName of requiredTables) {
        const table = db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name=?
        `).get(tableName);
        
        if (!table) {
          throw new Error(`Таблица ${tableName} не найдена`);
        }
        
        console.log(`✅ Таблица ${tableName} проверена`);
      }
      
      // Проверяем структуру таблицы admin_messages
      const adminMessageColumns = db.prepare(`PRAGMA table_info(admin_messages)`).all();
      const requiredColumns = [
        'id', 'message_text', 'message_type', 'sent_by', 'sent_at',
        'total_recipients', 'delivered_count', 'failed_count', 'blocked_count'
      ];
      
      const existingColumns = adminMessageColumns.map(col => col.name);
      for (const columnName of requiredColumns) {
        if (!existingColumns.includes(columnName)) {
          throw new Error(`Колонка ${columnName} отсутствует в таблице admin_messages`);
        }
      }
      
      console.log('✅ Структура таблицы admin_messages корректна');
      
      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка валидации базы данных:', error.message);
      throw error;
    }
  }

  /**
   * [RU] Настройка middleware
   * [EN] Setup middleware
   */
  setupMiddleware() {
    // Логирование всех сообщений
    this.bot.use(async (ctx, next) => {
      const start = Date.now();
      const user = ctx.from;
      
      console.log(`📨 Сообщение от пользователя ${user.id} (@${user.username || 'unknown'}): ${ctx.message?.text || ctx.callbackQuery?.data || 'callback/action'}`);
      
      try {
        await next();
        const duration = Date.now() - start;
        console.log(`⏱️ Обработано за ${duration}мс`);
      } catch (error) {
        const duration = Date.now() - start;
        console.error(`❌ Ошибка обработки (${duration}мс):`, error.message);
        
        // Отправляем общее сообщение об ошибке
        try {
          await ctx.reply('😔 Произошла ошибка. Попробуйте еще раз или обратитесь к администратору.');
        } catch (replyError) {
          console.error('❌ Не удалось отправить сообщение об ошибке:', replyError.message);
        }
      }
    });

    // Ограничение частоты запросов
    const userLastAction = new Map();
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from.id;
      const now = Date.now();
      const lastAction = userLastAction.get(userId) || 0;
      
      // Минимальный интервал между действиями - 500мс
      if (now - lastAction < 500) {
        console.log(`⚠️ Слишком частые запросы от пользователя ${userId}`);
        return;
      }
      
      userLastAction.set(userId, now);
      await next();
    });
  }

  /**
   * [RU] Настройка обработчиков событий
   * [EN] Setup event handlers
   */
  setupEventHandlers() {
    // Команда /start
    this.bot.start(async (ctx) => {
      await this.router.handleStart(ctx);
    });

    // Команда /menu
    this.bot.command('menu', async (ctx) => {
      await this.router.handleMenu(ctx);
    });

    // Команда /responses
    this.bot.command('responses', async (ctx) => {
      await this.router.handleResponses(ctx);
    });

    // Команда /stats (для администратора)
    this.bot.command('stats', async (ctx) => {
      await this.router.handleStats(ctx);
    });

    // Команда /admin_message (для администратора)
    this.bot.command('admin_message', async (ctx) => {
      await this.router.handleAdminMessage(ctx, this.bot);
    });

    // Обработка callback queries (нажатия кнопок)
    this.bot.on('callback_query', async (ctx) => {
      await this.router.handleCallback(ctx);
    });

    // Обработка текстовых сообщений
    this.bot.on('text', async (ctx) => {
      await this.router.handleText(ctx);
    });

    // Обработка ошибок бота
    this.bot.catch(async (err, ctx) => {
      console.error('❌ Необработанная ошибка бота:', err);
      
      if (ctx) {
        try {
          await ctx.reply('😔 Произошла техническая ошибка. Мы работаем над её устранением.');
        } catch (replyError) {
          console.error('❌ Не удалось отправить сообщение об ошибке:', replyError.message);
        }
      }
    });
  }

  /**
   * [RU] Запуск бота
   * [EN] Start bot
   */
  async start() {
    try {
      if (this.isRunning) {
        console.log('⚠️ Бот уже запущен');
        return { success: false, error: 'Bot already running' };
      }

      // Инициализируем если еще не инициализирован
      if (!this.bot) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          throw new Error(initResult.error);
        }
      }

      console.log('🚀 Запуск Telegram бота...');
      
      // Запускаем бота
      await this.bot.launch();
      this.isRunning = true;
      
      console.log('✅ Бот успешно запущен и готов к работе!');
      
      // Уведомляем администратора о запуске
      if (process.env.ADMIN_ID) {
        try {
          await this.delivery.sendAdminNotification(
            this.bot,
            process.env.ADMIN_ID,
            '🚀 Бот запущен и готов к работе!',
            false
          );
        } catch (error) {
          console.log('⚠️ Не удалось отправить уведомление администратору о запуске');
        }
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка запуска бота:', error.message);
      this.isRunning = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Остановка бота
   * [EN] Stop bot
   */
  async stop() {
    try {
      if (!this.isRunning) {
        console.log('⚠️ Бот не запущен');
        return { success: false, error: 'Bot not running' };
      }

      console.log('🛑 Остановка бота...');

      // Останавливаем планировщик
      if (this.scheduler) {
        this.scheduler.stop();
        console.log('✅ Планировщик остановлен');
      }

      // Останавливаем бота
      if (this.bot) {
        this.bot.stop();
        console.log('✅ Бот остановлен');
      }

      // Закрываем соединение с базой данных
      if (this.database) {
        this.database.close();
        console.log('✅ База данных отключена');
      }

      this.isRunning = false;
      console.log('🏁 Остановка завершена');

      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка остановки бота:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение статуса бота
   * [EN] Get bot status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasBot: !!this.bot,
      hasDatabase: !!this.database,
      hasScheduler: !!this.scheduler,
      hasDelivery: !!this.delivery,
      hasRouter: !!this.router,
      schedulerStatus: this.scheduler ? this.scheduler.getStatus() : null
    };
  }
}

// Обработка сигналов завершения
process.once('SIGINT', async () => {
  console.log('📡 Получен сигнал SIGINT');
  if (botInstance) {
    await botInstance.stop();
  }
  process.exit(0);
});

process.once('SIGTERM', async () => {
  console.log('📡 Получен сигнал SIGTERM');
  if (botInstance) {
    await botInstance.stop();
  }
  process.exit(0);
});

// Создаем и запускаем экземпляр бота
const botInstance = new TelegramBot();

// Автозапуск если файл запущен напрямую
if (require.main === module) {
  (async () => {
    try {
      const result = await botInstance.start();
      if (!result.success) {
        console.error('❌ Не удалось запустить бота:', result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Критическая ошибка:', error);
      process.exit(1);
    }
  })();
}

module.exports = {
  TelegramBot,
  botInstance
};