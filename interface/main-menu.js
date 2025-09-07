/**
 * [RU] Главное меню бота
 * [EN] Bot main menu
 */

const texts = require('../bot/texts');
const { createInlineKeyboard, safeSendMessage, standardButtons } = require('../utils/message-helpers');
const { AttendanceLogic } = require('../features/attendance/logic');
const { EventInfoLogic } = require('../features/event-info/logic');
const { AdminLogic } = require('../features/admin/logic');

/**
 * [RU] Класс для управления главным меню
 * [EN] Main menu management class
 */
class MainMenu {
  constructor(database) {
    this.database = database;
    this.attendanceLogic = new AttendanceLogic(database);
    this.eventInfoLogic = new EventInfoLogic(database);
    this.adminLogic = new AdminLogic(database);
  }

  /**
   * [RU] Генерация кнопок меню на основе роли пользователя
   * [EN] Generate menu items based on user role
   */
  generateMenuItems(userId) {
    const isAdmin = this.adminLogic.isAdmin(userId);
    
    // Основные кнопки для всех пользователей
    const menuItems = [
      { text: texts.menu.buttons.changeAttendance, callback_data: 'change_attendance' },
      { text: texts.menu.buttons.eventDetails, callback_data: 'event_details' },
      { text: texts.menu.buttons.usefulInfo, callback_data: 'useful_info' },
      { text: texts.menu.buttons.upcomingEvents, callback_data: 'upcoming_events' },
      { text: texts.menu.buttons.help, callback_data: 'help' }
    ];

    // Добавляем админскую кнопку для администраторов
    if (isAdmin) {
      menuItems.splice(3, 0, { text: texts.menu.buttons.adminGuestList, callback_data: 'admin_guest_list' });
    }

    return menuItems;
  }

  /**
   * [RU] Отображение главного меню
   * [EN] Display main menu
   */
  async show(ctx, user = null) {
    try {
      console.log(`📋 Генерация меню для пользователя ${ctx.from.id}`);
      
      const userName = user ? user.full_name : (ctx.from.first_name || 'Пользователь');
      const userId = ctx.from.id.toString();
      
      const menuText = `${texts.menu.title}\n\nПривет, ${userName}! ${texts.menu.description}`;

      // Генерируем кнопки на основе роли пользователя
      const menuItems = this.generateMenuItems(userId);
      console.log('📋 Сгенерированные пункты меню (',
        menuItems.length, 'кнопок):', 
        menuItems.map(item => ({ text: item.text, callback_data: item.callback_data }))
      );
      
      // Проверка корректности данных кнопок
      if (!Array.isArray(menuItems) || menuItems.length === 0) {
        console.error('❌ Ошибка: пустой массив кнопок меню');
        await safeSendMessage(ctx, texts.errors.general);
        return { success: false, error: 'Empty menu items' };
      }

      // Проверяем структуру каждой кнопки
      for (const item of menuItems) {
        if (!item.text || !item.callback_data) {
          console.error('❌ Некорректная кнопка:', item);
        }
      }
      
      console.log('⌨️ Создание клавиатуры...');
      const keyboard = createInlineKeyboard(menuItems, 2);
      console.log('⌨️ Клавиатура создана:', !!keyboard);
      
      // Дополнительная проверка созданной клавиатуры
      if (!keyboard) {
        console.error('❌ Ошибка создания клавиатуры');
        await safeSendMessage(ctx, texts.errors.general);
        return { success: false, error: 'Keyboard creation failed' };
      }

      console.log('📤 Отправка сообщения с меню...');
      await safeSendMessage(ctx, menuText, keyboard, { parseMode: 'HTML' });
      console.log('✅ Меню успешно отправлено');

      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка отображения главного меню:', error.message);
      console.error('❌ Stack trace:', error.stack);
      
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
      const userId = ctx.from.id.toString();
      
      switch (callback) {
        case 'change_attendance':
          return await this.attendanceLogic.handleAttendanceChange(ctx, userId);
        
        case 'event_details':
          return await this.eventInfoLogic.showEventDetails(ctx);
        
        case 'useful_info':
          return await this.eventInfoLogic.showUsefulInfo(ctx);
        
        case 'admin_guest_list':
          return await this.adminLogic.showGuestList(ctx);
        
        case 'admin_refresh_guest_list':
          return await this.adminLogic.showGuestList(ctx);
        
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
        
        // Обработка callback'ов для выбора статуса присутствия
        case 'attendance_attending':
          return await this.attendanceLogic.handleAttendanceStatusSelect(ctx, userId, 'attending');
        
        case 'attendance_not_attending':
          return await this.attendanceLogic.handleAttendanceStatusSelect(ctx, userId, 'not_attending');
        
        case 'attendance_maybe':
          return await this.attendanceLogic.handleAttendanceStatusSelect(ctx, userId, 'maybe');
        
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