/**
 * [RU] Интерфейс для сбора ответов пользователей
 * [EN] User response collection interface
 */

const texts = require('../bot/texts');
const { createInlineKeyboard, safeSendMessage, standardButtons } = require('../utils/message-helpers');
const { ResponseUtils } = require('../utils/db-utils');

/**
 * [RU] Класс для управления ответами пользователей
 * [EN] User response management class
 */
class UserResponse {
  constructor(database) {
    this.responseUtils = new ResponseUtils(database);
  }

  /**
   * [RU] Показ интерфейса для ответа на событие
   * [EN] Show event response interface
   */
  async showEventResponse(ctx, eventText, eventId = null) {
    try {
      const responseText = `${eventText}\n\n${texts.responses.confirmationPrompt}`;

      const buttons = [
        standardButtons.yes,
        standardButtons.no,
        standardButtons.maybe,
        standardButtons.mainMenu
      ];

      const keyboard = createInlineKeyboard(buttons, 3);

      await safeSendMessage(ctx, responseText, keyboard, { parseMode: 'HTML' });

      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка отображения интерфейса ответа:', error.message);
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обработка ответа пользователя на событие
   * [EN] Handle user response to event
   */
  async handleEventResponse(ctx, responseType, userId, eventId = null) {
    try {
      let responseText;
      let responseEmoji;

      switch (responseType) {
        case 'response_yes':
          responseText = 'Да, буду участвовать';
          responseEmoji = '✅';
          break;
        case 'response_no':
          responseText = 'Нет, не смогу участвовать';
          responseEmoji = '❌';
          break;
        case 'response_maybe':
          responseText = 'Возможно, участвую';
          responseEmoji = '🤔';
          break;
        default:
          throw new Error('Неизвестный тип ответа');
      }

      // Сохраняем ответ в базе данных
      const saveResult = this.responseUtils.saveUserResponse(userId, responseText);

      if (!saveResult.success) {
        throw new Error('Не удалось сохранить ответ');
      }

      // Отправляем подтверждение
      const confirmationText = texts.formatText(texts.responses.responseReceived, {
        response: `${responseEmoji} ${responseText}`
      });

      const thankYouText = `${confirmationText}\n\n${texts.responses.thankYou}`;
      
      const keyboard = createInlineKeyboard([
        { text: '📅 Другие события', callback_data: 'upcoming_events' },
        standardButtons.mainMenu
      ], 2);

      await safeSendMessage(ctx, thankYouText, keyboard, { parseMode: 'HTML' });
      await ctx.answerCbQuery(`${responseEmoji} Ответ сохранен!`);

      console.log(`📝 Ответ пользователя ${userId} сохранен: ${responseText}`);

      return {
        success: true,
        response: responseText,
        responseId: saveResult.id
      };
    } catch (error) {
      console.error(`❌ Ошибка обработки ответа пользователя ${userId}:`, error.message);
      
      await safeSendMessage(ctx, texts.errors.general);
      await ctx.answerCbQuery(texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Показ всех ответов пользователя
   * [EN] Show all user responses
   */
  async showUserResponses(ctx, userId) {
    try {
      const responses = this.responseUtils.getUserResponses(userId);

      if (!responses || responses.length === 0) {
        const noResponsesText = `${texts.responses.title}\n\n${texts.responses.noResponses}`;
        const keyboard = createInlineKeyboard([standardButtons.mainMenu], 1);

        await safeSendMessage(ctx, noResponsesText, keyboard);
        return { success: true, responseCount: 0 };
      }

      // Форматируем ответы для отображения
      const formattedResponses = responses.slice(0, 10).map((response, index) => {
        const date = new Date(response.created_at).toLocaleDateString('ru-RU');
        return `${index + 1}. ${response.message}\n   📅 ${date}`;
      }).join('\n\n');

      const responseText = `${texts.responses.title}\n\n${formattedResponses}`;

      if (responses.length > 10) {
        responseText += `\n\n... и ещё ${responses.length - 10} ответов`;
      }

      const buttons = [
        { text: '🔄 Обновить', callback_data: 'my_responses' },
        standardButtons.mainMenu
      ];

      const keyboard = createInlineKeyboard(buttons, 2);

      await safeSendMessage(ctx, responseText, keyboard, { parseMode: 'HTML' });

      return {
        success: true,
        responseCount: responses.length,
        displayedCount: Math.min(responses.length, 10)
      };
    } catch (error) {
      console.error(`❌ Ошибка отображения ответов пользователя ${userId}:`, error.message);
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обработка текстового ответа пользователя
   * [EN] Handle text response from user
   */
  async handleTextResponse(ctx, userId, messageText) {
    try {
      // Проверяем, не является ли это командой
      if (messageText.startsWith('/')) {
        return { success: false, error: 'Command received instead of response' };
      }

      // Валидируем текст ответа
      if (!messageText || messageText.trim().length === 0) {
        await safeSendMessage(ctx, 'Пожалуйста, напишите ваш ответ:');
        return { success: false, error: 'Empty response' };
      }

      if (messageText.length > 1000) {
        await safeSendMessage(ctx, 'Ответ слишком длинный. Пожалуйста, сократите до 1000 символов:');
        return { success: false, error: 'Response too long' };
      }

      // Сохраняем ответ
      const saveResult = this.responseUtils.saveUserResponse(userId, messageText.trim());

      if (!saveResult.success) {
        throw new Error('Не удалось сохранить ответ');
      }

      // Отправляем подтверждение
      const confirmationText = `${texts.responses.thankYou}\n\n📝 Ваш ответ: "${messageText.trim()}"`;
      
      const keyboard = createInlineKeyboard([
        { text: '💬 Мои ответы', callback_data: 'my_responses' },
        standardButtons.mainMenu
      ], 2);

      await safeSendMessage(ctx, confirmationText, keyboard, { parseMode: 'HTML' });

      console.log(`📝 Текстовый ответ пользователя ${userId} сохранен`);

      return {
        success: true,
        response: messageText.trim(),
        responseId: saveResult.id
      };
    } catch (error) {
      console.error(`❌ Ошибка обработки текстового ответа пользователя ${userId}:`, error.message);
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Запрос произвольного ответа от пользователя
   * [EN] Request custom response from user
   */
  async requestCustomResponse(ctx, prompt = null) {
    try {
      const requestText = prompt || texts.responses.prompt;
      
      const keyboard = createInlineKeyboard([
        { text: '❌ Отмена', callback_data: 'cancel_response' },
        standardButtons.mainMenu
      ], 2);

      await safeSendMessage(ctx, requestText, keyboard, { parseMode: 'HTML' });

      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка запроса произвольного ответа:', error.message);
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение статистики ответов (для администраторов)
   * [EN] Get response statistics (for administrators)
   */
  async getResponseStats() {
    try {
      const allResponses = this.responseUtils.getAllResponses();
      
      const stats = {
        totalResponses: allResponses.length,
        uniqueUsers: new Set(allResponses.map(r => r.user_id)).size,
        recentResponses: allResponses.filter(r => {
          const responseDate = new Date(r.created_at);
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return responseDate > dayAgo;
        }).length
      };

      return {
        success: true,
        stats
      };
    } catch (error) {
      console.error('❌ Ошибка получения статистики ответов:', error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = {
  UserResponse
};