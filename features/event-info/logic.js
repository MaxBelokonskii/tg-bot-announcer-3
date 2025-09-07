/**
 * [RU] Логика управления информацией о событиях
 * [EN] Event information management logic
 */

const { EventInfoAPI } = require('./api');
const texts = require('../../bot/texts');
const { createInlineKeyboard, safeSendMessage, standardButtons } = require('../../utils/message-helpers');

/**
 * [RU] Класс для управления логикой информации о событиях
 * [EN] Event information management logic class
 */
class EventInfoLogic {
  constructor(database) {
    this.database = database;
    this.api = new EventInfoAPI(database);
  }

  /**
   * [RU] Показ подробной информации о торжестве
   * [EN] Show detailed event information
   */
  async showEventDetails(ctx) {
    try {
      console.log(`📋 Пользователь ${ctx.from.id} запросил детали события`);

      // Здесь можно получить актуальную информацию о событии из базы данных
      // Пока используем статический контент
      const eventInfo = await this.api.getEventDetails();
      
      let messageText = `${texts.eventDetails.title}\n\n`;
      
      if (eventInfo.success && eventInfo.details) {
        messageText += this.formatEventDetails(eventInfo.details);
      } else {
        messageText += texts.eventDetails.content;
      }

      const keyboard = createInlineKeyboard([standardButtons.mainMenu], 1);

      await safeSendMessage(ctx, messageText, keyboard, { parseMode: 'HTML' });
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка показа деталей события:', error.message);
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(texts.errors.general);
      }
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Показ полезной информации
   * [EN] Show useful information
   */
  async showUsefulInfo(ctx) {
    try {
      console.log(`💡 Пользователь ${ctx.from.id} запросил полезную информацию`);

      // Получаем полезную информацию
      const usefulInfo = await this.api.getUsefulInfo();
      
      let messageText = `${texts.usefulInfo.title}\n\n`;
      
      if (usefulInfo.success && usefulInfo.info) {
        messageText += this.formatUsefulInfo(usefulInfo.info);
      } else {
        messageText += texts.usefulInfo.content;
      }

      const keyboard = createInlineKeyboard([standardButtons.mainMenu], 1);

      await safeSendMessage(ctx, messageText, keyboard, { parseMode: 'HTML' });
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка показа полезной информации:', error.message);
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(texts.errors.general);
      }
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Форматирование деталей события
   * [EN] Format event details
   */
  formatEventDetails(details) {
    let formatted = '';

    if (details.name) {
      formatted += `<b>🎉 Событие:</b> ${details.name}\n\n`;
    }

    if (details.date && details.time) {
      formatted += `<b>📅 Дата и время:</b> ${details.date} в ${details.time}\n\n`;
    }

    if (details.location) {
      formatted += `<b>📍 Место проведения:</b> ${details.location}\n\n`;
    }

    if (details.address) {
      formatted += `<b>🏠 Адрес:</b> ${details.address}\n\n`;
    }

    if (details.dressCode) {
      formatted += `<b>👔 Дресс-код:</b> ${details.dressCode}\n\n`;
    }

    if (details.contact) {
      formatted += `<b>📞 Контакты:</b> ${details.contact}\n\n`;
    }

    if (details.description) {
      formatted += `<b>📝 Описание:</b>\n${details.description}\n\n`;
    }

    if (details.specialInstructions) {
      formatted += `<b>⚠️ Особые указания:</b>\n${details.specialInstructions}\n\n`;
    }

    return formatted.trim() || 'Подробная информация будет добавлена позже.';
  }

  /**
   * [RU] Форматирование полезной информации
   * [EN] Format useful information
   */
  formatUsefulInfo(info) {
    let formatted = '';

    if (info.transport && info.transport.length > 0) {
      formatted += '<b>🚗 Транспорт:</b>\n';
      info.transport.forEach(item => {
        formatted += `• ${item}\n`;
      });
      formatted += '\n';
    }

    if (info.parking) {
      formatted += `<b>🅿️ Парковка:</b> ${info.parking}\n\n`;
    }

    if (info.accommodation && info.accommodation.length > 0) {
      formatted += '<b>🏨 Размещение:</b>\n';
      info.accommodation.forEach(item => {
        formatted += `• ${item}\n`;
      });
      formatted += '\n';
    }

    if (info.attractions && info.attractions.length > 0) {
      formatted += '<b>🏛️ Достопримечательности:</b>\n';
      info.attractions.forEach(item => {
        formatted += `• ${item}\n`;
      });
      formatted += '\n';
    }

    if (info.emergency) {
      formatted += `<b>🚨 Экстренные контакты:</b> ${info.emergency}\n\n`;
    }

    if (info.weather) {
      formatted += `<b>🌤️ Погода:</b> ${info.weather}\n\n`;
    }

    if (info.additionalInfo && info.additionalInfo.length > 0) {
      formatted += '<b>ℹ️ Дополнительная информация:</b>\n';
      info.additionalInfo.forEach(item => {
        formatted += `• ${item}\n`;
      });
    }

    return formatted.trim() || 'Полезная информация будет добавлена позже.';
  }

  /**
   * [RU] Обновление информации о событии
   * [EN] Update event information
   */
  async updateEventDetails(details) {
    try {
      return await this.api.updateEventDetails(details);
    } catch (error) {
      console.error('❌ Ошибка обновления деталей события:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обновление полезной информации
   * [EN] Update useful information
   */
  async updateUsefulInfo(info) {
    try {
      return await this.api.updateUsefulInfo(info);
    } catch (error) {
      console.error('❌ Ошибка обновления полезной информации:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = {
  EventInfoLogic
};