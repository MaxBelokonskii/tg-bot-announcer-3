/**
 * [RU] Экран приветствия для новых пользователей
 * [EN] Welcome screen for new users
 */

const texts = require('../bot/texts');
const { createInlineKeyboard, safeSendMessage } = require('../utils/message-helpers');

/**
 * [RU] Класс для управления экраном приветствия
 * [EN] Welcome screen management class
 */
class WelcomeScreen {
  /**
   * [RU] Отображение экрана приветствия
   * [EN] Display welcome screen
   */
  async show(ctx) {
    try {
      const userName = ctx.from.first_name || ctx.from.username || 'Друг';
      
      const welcomeText = `${texts.welcome.title}\n\n${texts.welcome.greeting}`;

      // Создаем кнопки для быстрого доступа
      const buttons = [
        { text: '📋 Главное меню', callback_data: 'main_menu' },
        { text: '❓ Как пользоваться', callback_data: 'help' }
      ];

      const keyboard = createInlineKeyboard(buttons, 2);

      await safeSendMessage(ctx, welcomeText, keyboard, { parseMode: 'HTML' });

      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка отображения экрана приветствия:', error.message);
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Показ расширенного приветствия с инструкциями
   * [EN] Show extended welcome with instructions
   */
  async showDetailed(ctx, user) {
    try {
      const welcomeText = texts.formatText(texts.welcome.nameConfirm, {
        name: user.full_name
      });

      const instructionsText = `
${welcomeText}

🎯 **Что умеет этот бот:**

📅 **Напоминания о событиях** - получайте уведомления о важных мероприятиях
💬 **Сбор ответов** - сообщайте о своем участии в событиях  
📊 **Отслеживание** - администраторы видят, кто планирует участвовать

🚀 **Начни с команды /menu** для доступа ко всем функциям!
      `;

      const buttons = [
        { text: '📋 Открыть меню', callback_data: 'main_menu' },
        { text: '❓ Подробная справка', callback_data: 'help' }
      ];

      const keyboard = createInlineKeyboard(buttons, 2);

      await safeSendMessage(ctx, instructionsText, keyboard, { parseMode: 'HTML' });

      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка отображения расширенного приветствия:', error.message);
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Показ краткой инструкции для существующих пользователей
   * [EN] Show brief instructions for existing users
   */
  async showReturning(ctx, user) {
    try {
      const welcomeBackText = `👋 С возвращением, ${user.full_name}!

Используй /menu для доступа ко всем функциям бота.

📅 Проверь предстоящие события
💬 Посмотри свои ответы
⚙️ Настрой уведомления`;

      const buttons = [
        { text: '📋 Главное меню', callback_data: 'main_menu' },
        { text: '📅 События', callback_data: 'upcoming_events' }
      ];

      const keyboard = createInlineKeyboard(buttons, 2);

      await safeSendMessage(ctx, welcomeBackText, keyboard, { parseMode: 'HTML' });

      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка отображения приветствия для возвращающегося пользователя:', error.message);
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }
}

module.exports = {
  WelcomeScreen
};