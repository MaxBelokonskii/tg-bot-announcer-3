/**
 * [RU] Главное меню бота
 * [EN] Bot main menu
 */

const texts = require('../bot/texts');
const { createInlineKeyboard, safeSendMessage, standardButtons } = require('../utils/message-helpers');

/**
 * [RU] Класс для управления главным меню
 * [EN] Main menu management class
 */
class MainMenu {
  constructor() {
    this.menuItems = [
      { text: texts.menu.buttons.upcomingEvents, callback: 'upcoming_events' },
      { text: texts.menu.buttons.myResponses, callback: 'my_responses' },
      { text: texts.menu.buttons.settings, callback: 'settings' },
      { text: texts.menu.buttons.help, callback: 'help' }
    ];
  }

  /**
   * [RU] Отображение главного меню
   * [EN] Display main menu
   */
  async show(ctx, user = null) {
    try {
      const userName = user ? user.full_name : (ctx.from.first_name || 'Пользователь');
      
      const menuText = `${texts.menu.title}\n\nПривет, ${userName}! ${texts.menu.description}`;

      const keyboard = createInlineKeyboard(this.menuItems, 2);

      await safeSendMessage(ctx, menuText, keyboard, { parseMode: 'HTML' });

      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка отображения главного меню:', error.message);
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обработка нажатий кнопок меню
   * [EN] Handle menu button presses
   */
  async handleCallback(ctx, callback) {
    try {
      switch (callback) {
        case 'upcoming_events':
          return await this.showUpcomingEvents(ctx);
        
        case 'my_responses':
          return await this.showMyResponses(ctx);
        
        case 'settings':
          return await this.showSettings(ctx);
        
        case 'help':
          return await this.showHelp(ctx);
        
        case 'main_menu':
          return await this.show(ctx);
        
        default:
          await ctx.answerCbQuery('Неизвестная команда');
          return { success: false, error: 'Unknown callback' };
      }
    } catch (error) {
      console.error(`❌ Ошибка обработки callback ${callback}:`, error.message);
      
      await ctx.answerCbQuery(texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Показ предстоящих событий (заглушка)
   * [EN] Show upcoming events (placeholder)
   */
  async showUpcomingEvents(ctx) {
    const text = `${texts.events.title}\n\n${texts.events.noEvents}`;
    const keyboard = createInlineKeyboard([standardButtons.mainMenu], 1);

    await safeSendMessage(ctx, text, keyboard);
    await ctx.answerCbQuery();

    return { success: true };
  }

  /**
   * [RU] Показ ответов пользователя (заглушка)
   * [EN] Show user responses (placeholder)
   */
  async showMyResponses(ctx) {
    const text = `${texts.responses.title}\n\n${texts.responses.noResponses}`;
    const keyboard = createInlineKeyboard([standardButtons.mainMenu], 1);

    await safeSendMessage(ctx, text, keyboard);
    await ctx.answerCbQuery();

    return { success: true };
  }

  /**
   * [RU] Показ настроек (заглушка)
   * [EN] Show settings (placeholder)
   */
  async showSettings(ctx) {
    const text = `${texts.settings.title}\n\nФункции настроек будут добавлены в следующих версиях.`;
    const keyboard = createInlineKeyboard([standardButtons.mainMenu], 1);

    await safeSendMessage(ctx, text, keyboard);
    await ctx.answerCbQuery();

    return { success: true };
  }

  /**
   * [RU] Показ справки
   * [EN] Show help
   */
  async showHelp(ctx) {
    const text = texts.help.description;
    const keyboard = createInlineKeyboard([standardButtons.mainMenu], 1);

    await safeSendMessage(ctx, text, keyboard);
    await ctx.answerCbQuery();

    return { success: true };
  }
}

module.exports = {
  MainMenu
};