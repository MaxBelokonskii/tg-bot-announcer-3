/**
 * [RU] Маршрутизатор сообщений бота
 * [EN] Bot message router
 */

const { OnboardingLogic } = require('../features/onboarding/logic');
const { MainMenu } = require('../interface/main-menu');
const { WelcomeScreen } = require('../interface/welcome-screen');
const { UserResponse } = require('../interface/user-response');
const { AttendanceLogic } = require('../features/attendance/logic');
const { EventInfoLogic } = require('../features/event-info/logic');
const { AdminLogic } = require('../features/admin/logic');
const texts = require('./texts');

/**
 * [RU] Класс для маршрутизации сообщений
 * [EN] Message routing class
 */
class MessageRouter {
  constructor(database, schedulerLogic, deliveryLogic, bot = null) {
    this.database = database;
    this.schedulerLogic = schedulerLogic;
    this.deliveryLogic = deliveryLogic;
    this.bot = bot; // Сохраняем ссылку на экземпляр бота
    
    // Инициализируем компоненты
    this.onboarding = new OnboardingLogic(database);
    this.mainMenu = new MainMenu(database);
    this.welcomeScreen = new WelcomeScreen();
    this.userResponse = new UserResponse(database);
    this.attendanceLogic = new AttendanceLogic(database);
    this.eventInfoLogic = new EventInfoLogic(database);
    this.adminLogic = new AdminLogic(database);
  }

  /**
   * [RU] Установка экземпляра бота (если не был передан в конструкторе)
   * [EN] Set bot instance (if not passed in constructor)
   */
  setBotInstance(bot) {
    this.bot = bot;
  }

  /**
   * [RU] Обработка команды /start
   * [EN] Handle /start command
   */
  async handleStart(ctx) {
    try {
      console.log(`👤 Пользователь ${ctx.from.id} выполнил команду /start`);
      
      const result = await this.onboarding.handleStartCommand(ctx);
      
      if (result.success && result.user && !result.isNewUser) {
        // Существующий пользователь - показываем экран возвращения
        await this.welcomeScreen.showReturning(ctx, result.user);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Ошибка обработки команды /start:', error.message);
      await ctx.reply(texts.errors.general);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обработка команды /menu
   * [EN] Handle /menu command
   */
  async handleMenu(ctx) {
    try {
      console.log(`📋 Пользователь ${ctx.from.id} запросил главное меню`);
      
      // Проверяем, зарегистрирован ли пользователь
      const user = await this.onboarding.api.getUser(ctx.from.id.toString());
      
      if (!user) {
        await ctx.reply(texts.errors.notRegistered);
        return { success: false, error: 'User not registered' };
      }
      
      return await this.mainMenu.show(ctx, user);
    } catch (error) {
      console.error('❌ Ошибка обработки команды /menu:', error.message);
      await ctx.reply(texts.errors.general);
      return { success: false, error: error.message };
    }
  }



  /**
   * [RU] Обработка команды /responses
   * [EN] Handle /responses command
   */
  async handleResponses(ctx) {
    try {
      console.log(`💬 Пользователь ${ctx.from.id} запросил свои ответы`);
      
      // Проверяем, зарегистрирован ли пользователь
      const user = await this.onboarding.api.getUser(ctx.from.id.toString());
      
      if (!user) {
        await ctx.reply(texts.errors.notRegistered);
        return { success: false, error: 'User not registered' };
      }
      
      return await this.userResponse.showUserResponses(ctx, user.id);
    } catch (error) {
      console.error('❌ Ошибка обработки команды /responses:', error.message);
      await ctx.reply(texts.errors.general);
      return { success: false, error: error.message };
    }
  }



  /**
   * [RU] Обработка команды /admin_message (только для администраторов)
   * [EN] Handle /admin_message command (admin only)
   */
  async handleAdminMessage(ctx, bot) {
    try {
      const userId = ctx.from.id.toString();
      
      if (!this.adminLogic.isAdmin(userId)) {
        await ctx.reply('❌ У вас нет прав для выполнения этой команды');
        return { success: false, error: 'Unauthorized' };
      }
      
      console.log(`📢 Администратор ${ctx.from.id} выполнил команду /admin_message`);
      
      return await this.adminLogic.handleAdminMessage(ctx, bot);
    } catch (error) {
      console.error('❌ Ошибка обработки команды /admin_message:', error.message);
      await ctx.reply(texts.errors.general);
      return { success: false, error: error.message };
    }
  }



  /**
   * [RU] Обработка команды /stats (только для администраторов)
   * [EN] Handle /stats command (admin only)
   */
  async handleStats(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const adminId = process.env.ADMIN_ID;
      
      if (!adminId || userId !== adminId) {
        await ctx.reply('❌ У вас нет прав для выполнения этой команды');
        return { success: false, error: 'Unauthorized' };
      }
      
      console.log(`📊 Администратор ${ctx.from.id} запросил статистику`);
      
      return await this.adminLogic.showStats(ctx);
    } catch (error) {
      console.error('❌ Ошибка обработки команды /stats:', error.message);
      await ctx.reply(texts.errors.general);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обработка callback queries (нажатия кнопок)
   * [EN] Handle callback queries (button presses)
   */
  async handleCallback(ctx) {
    try {
      const callbackData = ctx.callbackQuery.data;
      const userId = ctx.from.id.toString();
      
      console.log(`🔘 Пользователь ${ctx.from.id} нажал кнопку: ${callbackData}`);
      
      // Проверяем, зарегистрирован ли пользователь (кроме некоторых исключений)
      const publicCallbacks = ['main_menu'];
      if (!publicCallbacks.includes(callbackData)) {
        const user = await this.onboarding.api.getUser(userId);
        if (!user) {
          await ctx.answerCbQuery(texts.errors.notRegistered);
          await ctx.reply(texts.errors.notRegistered);
          return { success: false, error: 'User not registered' };
        }
      }

      // Маршрутизация по типу callback
      if (callbackData.startsWith('response_')) {
        return await this.handleResponseCallback(ctx, callbackData, userId);
      } else if (callbackData.startsWith('attendance_')) {
        // Обработка выбора статуса присутствия
        return await this.mainMenu.handleCallback(ctx, callbackData);
      } else if (callbackData.startsWith('admin_')) {
        // Проверяем права администратора
        await this.adminLogic.validateAdminCallback(ctx, callbackData);
        
        // Обрабатываем специальные админские команды
        if (callbackData === 'admin_confirm_send') {
          if (!this.bot) {
            throw new Error('Bot instance not available for admin message sending');
          }
          return await this.adminLogic.confirmMessageSending(ctx, this.bot);
        } else if (callbackData === 'admin_cancel_send') {
          return await this.adminLogic.cancelMessageSending(ctx);
        } else {
          return await this.mainMenu.handleCallback(ctx, callbackData);
        }
      } else {
        // Общие callbacks для меню
        return await this.mainMenu.handleCallback(ctx, callbackData);
      }
    } catch (error) {
      console.error('❌ Ошибка обработки callback:', error.message);
      await ctx.answerCbQuery(texts.errors.general);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обработка callback'ов ответов на события
   * [EN] Handle event response callbacks
   */
  async handleResponseCallback(ctx, callbackData, userId) {
    try {
      // Получаем пользователя из базы данных
      const user = await this.onboarding.api.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return await this.userResponse.handleEventResponse(ctx, callbackData, user.id);
    } catch (error) {
      console.error(`❌ Ошибка обработки response callback (${callbackData}):`, error.message);
      await ctx.answerCbQuery(texts.errors.general);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обработка текстовых сообщений
   * [EN] Handle text messages
   */
  async handleText(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const messageText = ctx.message.text;
      
      console.log(`💬 Пользователь ${ctx.from.id} отправил сообщение: ${messageText.substring(0, 50)}...`);
      
      // Проверяем, находится ли пользователь в процессе онбординга
      if (this.onboarding.isUserOnboarding(userId)) {
        return await this.onboarding.handleOnboardingMessage(ctx);
      }
      
      // Проверяем, зарегистрирован ли пользователь
      const user = await this.onboarding.api.getUser(userId);
      if (!user) {
        await ctx.reply(texts.errors.notRegistered);
        return { success: false, error: 'User not registered' };
      }
      
      // Обрабатываем как потенциальный ответ на событие
      const result = await this.userResponse.handleTextResponse(ctx, user.id, messageText);
      
      if (!result.success) {
        // Если это не ответ, показываем подсказку
        await ctx.reply(`
Не понимаю сообщение. Используйте команды:

📋 /menu - главное меню
💬 /responses - мои ответы

Или отвечайте на события, которые получаете в уведомлениях.
        `);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Ошибка обработки текстового сообщения:', error.message);
      await ctx.reply(texts.errors.general);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обработка неизвестных команд
   * [EN] Handle unknown commands
   */
  async handleUnknownCommand(ctx) {
    try {
      console.log(`❓ Пользователь ${ctx.from.id} отправил неизвестную команду`);
      
      await ctx.reply(texts.errors.invalidCommand);
      
      return { success: false, error: 'Unknown command' };
    } catch (error) {
      console.error('❌ Ошибка обработки неизвестной команды:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Периодическая очистка старых состояний
   * [EN] Periodic cleanup of old states
   */
  scheduleCleanup() {
    // Очищаем старые состояния онбординга каждые 30 минут
    setInterval(() => {
      try {
        this.onboarding.cleanupOldStates();
        this.deliveryLogic.cleanupCompletedDeliveries();
        console.log('🧹 Выполнена периодическая очистка состояний');
      } catch (error) {
        console.error('❌ Ошибка периодической очистки:', error.message);
      }
    }, 30 * 60 * 1000); // 30 минут
  }

  /**
   * [RU] Получение статистики маршрутизатора
   * [EN] Get router statistics
   */
  async getRouterStats() {
    try {
      const onboardingStats = this.onboarding.getOnboardingStats();
      const deliveryStats = await this.deliveryLogic.getOverallStats();
      const schedulerStats = await this.schedulerLogic.getStats();
      
      return {
        success: true,
        stats: {
          onboarding: onboardingStats,
          delivery: deliveryStats.success ? deliveryStats.stats : null,
          scheduler: schedulerStats.success ? schedulerStats.stats : null,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Ошибка получения статистики маршрутизатора:', error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = {
  MessageRouter
};