/**
 * [RU] Процессор последовательности сообщений для улучшенной админской рассылки
 * [EN] Message sequence processor for enhanced admin broadcasts
 */

const { EventInfoAPI } = require('../features/event-info/api');
const { safeSendMessage, createInlineKeyboard, standardButtons } = require('./message-helpers');
const { formatEventDetailsMessage, formatUsefulInfoMessage } = require('./format-utils');
const texts = require('../bot/texts');

/**
 * [RU] Класс для обработки улучшенной последовательности доставки сообщений
 * [EN] Class for processing enhanced message delivery sequences
 */
class MessageSequenceProcessor {
  constructor(database) {
    this.database = database;
    this.eventInfoAPI = new EventInfoAPI(database);
  }

  /**
   * [RU] Оркестрирует полную последовательность сообщений для пользователя
   * [EN] Orchestrates the complete message sequence for a user
   */
  async processUserMessageSequence(bot, userId, adminMessage, options = {}) {
    const sequenceId = `seq_${userId}_${Date.now()}`;
    const {
      includeUsefulInfo = true,
      includeEventDetails = true,
      triggerMenu = true,
      sequenceDelay = 2000
    } = options;

    console.log(`🔄 Начинается обработка последовательности сообщений для пользователя ${userId}`);
    
    const results = {
      sequenceId,
      userId,
      steps: {
        adminMessage: { attempted: true, success: false, timestamp: null },
        usefulInfo: { attempted: includeUsefulInfo, success: false, timestamp: null },
        eventDetails: { attempted: includeEventDetails, success: false, timestamp: null },
        menuTrigger: { attempted: triggerMenu, success: false, timestamp: null }
      },
      totalSteps: 1 + (includeUsefulInfo ? 1 : 0) + (includeEventDetails ? 1 : 0) + (triggerMenu ? 1 : 0),
      completedSteps: 0,
      errors: []
    };

    try {
      // Шаг 1: Отправка админского сообщения (уже выполнено - просто логируем)
      results.steps.adminMessage.success = true;
      results.steps.adminMessage.timestamp = new Date().toISOString();
      results.completedSteps++;
      console.log(`✅ Шаг 1/4: Админское сообщение доставлено пользователю ${userId}`);

      // Шаг 2: Отправка полезной информации
      if (includeUsefulInfo) {
        await this.delay(sequenceDelay);
        const usefulInfoResult = await this.sendUsefulInformation(bot, userId);
        results.steps.usefulInfo.success = usefulInfoResult.success;
        results.steps.usefulInfo.timestamp = new Date().toISOString();
        
        if (usefulInfoResult.success) {
          results.completedSteps++;
          console.log(`✅ Шаг 2/4: Полезная информация доставлена пользователю ${userId}`);
        } else {
          results.errors.push({
            step: 'usefulInfo',
            error: usefulInfoResult.error,
            timestamp: new Date().toISOString()
          });
          console.log(`❌ Шаг 2/4: Ошибка отправки полезной информации для ${userId}: ${usefulInfoResult.error}`);
        }
      }

      // Шаг 3: Отправка деталей события
      if (includeEventDetails) {
        await this.delay(sequenceDelay);
        const eventDetailsResult = await this.sendEventDetails(bot, userId);
        results.steps.eventDetails.success = eventDetailsResult.success;
        results.steps.eventDetails.timestamp = new Date().toISOString();
        
        if (eventDetailsResult.success) {
          results.completedSteps++;
          console.log(`✅ Шаг 3/4: Детали события доставлены пользователю ${userId}`);
        } else {
          results.errors.push({
            step: 'eventDetails',
            error: eventDetailsResult.error,
            timestamp: new Date().toISOString()
          });
          console.log(`❌ Шаг 3/4: Ошибка отправки деталей события для ${userId}: ${eventDetailsResult.error}`);
        }
      }

      // Шаг 4: Вызов главного меню
      if (triggerMenu) {
        await this.delay(sequenceDelay);
        const menuResult = await this.triggerMainMenu(bot, userId);
        results.steps.menuTrigger.success = menuResult.success;
        results.steps.menuTrigger.timestamp = new Date().toISOString();
        
        if (menuResult.success) {
          results.completedSteps++;
          console.log(`✅ Шаг 4/4: Главное меню отображено для пользователя ${userId}`);
        } else {
          results.errors.push({
            step: 'menuTrigger',
            error: menuResult.error,
            timestamp: new Date().toISOString()
          });
          console.log(`❌ Шаг 4/4: Ошибка отображения меню для ${userId}: ${menuResult.error}`);
        }
      }

      const completionRate = (results.completedSteps / results.totalSteps) * 100;
      console.log(`📊 Последовательность для пользователя ${userId} завершена: ${results.completedSteps}/${results.totalSteps} шагов (${completionRate.toFixed(1)}%)`);

      return {
        success: results.completedSteps > 0, // Считаем успешным если хотя бы один шаг выполнен
        results,
        completionRate
      };

    } catch (error) {
      console.error(`❌ Критическая ошибка в последовательности для пользователя ${userId}:`, error.message);
      
      results.errors.push({
        step: 'critical',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return {
        success: false,
        results,
        completionRate: (results.completedSteps / results.totalSteps) * 100,
        criticalError: error.message
      };
    }
  }

  /**
   * [RU] Отправляет сообщение с полезной информацией
   * [EN] Sends useful information message
   */
  async sendUsefulInformation(bot, userId) {
    try {
      const usefulInfoResult = await this.eventInfoAPI.getUsefulInfo();
      
      if (!usefulInfoResult.success) {
        throw new Error(`Не удалось получить полезную информацию: ${usefulInfoResult.error}`);
      }

      if (!usefulInfoResult.info || usefulInfoResult.info.length === 0) {
        throw new Error('Полезная информация пуста');
      }

      const messageText = formatUsefulInfoMessage(usefulInfoResult.info);
      
      await bot.telegram.sendMessage(userId, messageText, { 
        parse_mode: 'HTML',
        disable_web_page_preview: true 
      });

      return { success: true };
    } catch (error) {
      console.error(`❌ Ошибка отправки полезной информации пользователю ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Отправляет сообщение с деталями события
   * [EN] Sends event details message
   */
  async sendEventDetails(bot, userId) {
    try {
      const eventDetailsResult = await this.eventInfoAPI.getEventDetails();
      
      if (!eventDetailsResult.success) {
        throw new Error(`Не удалось получить детали события: ${eventDetailsResult.error}`);
      }

      if (!eventDetailsResult.details) {
        throw new Error('Детали события пусты');
      }

      const messageText = formatEventDetailsMessage(eventDetailsResult.details);
      
      await bot.telegram.sendMessage(userId, messageText, { 
        parse_mode: 'HTML',
        disable_web_page_preview: true 
      });

      return { success: true };
    } catch (error) {
      console.error(`❌ Ошибка отправки деталей события пользователю ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Программно вызывает отображение главного меню
   * [EN] Programmatically triggers main menu display
   */
  async triggerMainMenu(bot, userId) {
    try {
      // Создаем простое меню без использования MainMenu класса для избежания циклической зависимости
      const menuText = `${texts.menu.title}\n\nПривет! ${texts.menu.description}`;
      
      // Создаем базовые кнопки меню
      const menuItems = [
        { text: texts.menu.buttons.changeAttendance, callback_data: 'change_attendance' },
        { text: texts.menu.buttons.eventDetails, callback_data: 'event_details' },
        { text: texts.menu.buttons.usefulInfo, callback_data: 'useful_info' }
      ];
      
      const keyboard = createInlineKeyboard(menuItems, 2);
      
      await bot.telegram.sendMessage(userId, menuText, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup
      });

      return { success: true };
    } catch (error) {
      console.error(`❌ Ошибка вызова главного меню для пользователя ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Проверяет завершение последовательности
   * [EN] Validates sequence completion
   */
  validateSequenceCompletion(sequenceResults) {
    if (!sequenceResults || !sequenceResults.results) {
      return { valid: false, reason: 'Отсутствуют результаты последовательности' };
    }

    const { steps, totalSteps, completedSteps } = sequenceResults.results;
    
    // Проверяем, что основное сообщение доставлено
    if (!steps.adminMessage.success) {
      return { valid: false, reason: 'Основное админское сообщение не доставлено' };
    }

    // Вычисляем минимальный порог успешности (50% от запланированных шагов)
    const minimumSuccessRate = 0.5;
    const actualSuccessRate = completedSteps / totalSteps;
    
    if (actualSuccessRate < minimumSuccessRate) {
      return { 
        valid: false, 
        reason: `Низкий процент завершения: ${(actualSuccessRate * 100).toFixed(1)}% (минимум: ${minimumSuccessRate * 100}%)` 
      };
    }

    return { 
      valid: true, 
      completionRate: actualSuccessRate * 100,
      completedSteps,
      totalSteps
    };
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
  MessageSequenceProcessor
};