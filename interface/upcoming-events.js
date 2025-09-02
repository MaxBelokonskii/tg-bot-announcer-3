/**
 * [RU] Интерфейс для отображения предстоящих событий
 * [EN] Upcoming events display interface
 */

const texts = require('../bot/texts');
const { createInlineKeyboard, safeSendMessage, standardButtons, createPaginatedList } = require('../utils/message-helpers');
const { formatDate, getRelativeTime, isToday, isTomorrow } = require('../utils/date-utils');

/**
 * [RU] Класс для управления отображением предстоящих событий
 * [EN] Upcoming events display management class
 */
class UpcomingEvents {
  constructor(schedulerLogic) {
    this.schedulerLogic = schedulerLogic;
  }

  /**
   * [RU] Показ списка предстоящих событий
   * [EN] Show upcoming events list
   */
  async showEvents(ctx, page = 1, limit = 5) {
    try {
      await safeSendMessage(ctx, texts.events.loading);

      // Получаем предстоящие события из планировщика
      const eventsResult = await this.schedulerLogic.getUpcomingEvents(20);

      if (!eventsResult.success) {
        throw new Error(eventsResult.error);
      }

      const events = eventsResult.events;

      if (!events || events.length === 0) {
        return await this.showNoEvents(ctx);
      }

      // Форматируем события для отображения
      const formattedEvents = events.map(event => this.formatEventForDisplay(event));

      // Создаем пагинированный список
      const paginatedMessage = createPaginatedList(
        formattedEvents,
        page,
        limit,
        'events_page'
      );

      // Добавляем дополнительные кнопки
      const additionalButtons = [
        { text: '🔄 Обновить', callback_data: 'upcoming_events' },
        standardButtons.mainMenu
      ];

      // Объединяем с кнопками пагинации
      const existingButtons = paginatedMessage.options.reply_markup.inline_keyboard;
      const lastRow = existingButtons[existingButtons.length - 1];
      
      // Добавляем дополнительные кнопки в последний ряд или создаем новый
      if (lastRow.length === 1 && lastRow[0].text === standardButtons.mainMenu.text) {
        existingButtons[existingButtons.length - 1] = [
          additionalButtons[0],
          lastRow[0]
        ];
      } else {
        existingButtons.push(additionalButtons);
      }

      await safeSendMessage(ctx, paginatedMessage.text, paginatedMessage.options.reply_markup);

      return {
        success: true,
        eventCount: events.length,
        displayedCount: Math.min(events.length, limit),
        page
      };
    } catch (error) {
      console.error('❌ Ошибка отображения предстоящих событий:', error.message);
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Показ сообщения об отсутствии событий
   * [EN] Show no events message
   */
  async showNoEvents(ctx) {
    const noEventsText = `${texts.events.title}\n\n${texts.events.noEvents}`;
    
    const buttons = [
      { text: '🔄 Обновить', callback_data: 'upcoming_events' },
      standardButtons.mainMenu
    ];

    const keyboard = createInlineKeyboard(buttons, 2);

    await safeSendMessage(ctx, noEventsText, keyboard);

    return { success: true, eventCount: 0 };
  }

  /**
   * [RU] Форматирование события для отображения
   * [EN] Format event for display
   */
  formatEventForDisplay(event) {
    const eventDate = new Date(event.date);
    let dateDisplay;
    let timeIcon;

    // Определяем иконку и формат даты в зависимости от времени
    if (isToday(eventDate)) {
      dateDisplay = `Сегодня, ${eventDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
      timeIcon = '🔥';
    } else if (isTomorrow(eventDate)) {
      dateDisplay = `Завтра, ${eventDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
      timeIcon = '⚠️';
    } else {
      dateDisplay = formatDate(eventDate, { includeTime: true });
      timeIcon = '📅';
    }

    const relativeTime = getRelativeTime(eventDate);
    
    // Извлекаем основной текст события (убираем служебные части)
    let eventText = event.text;
    
    // Убираем префиксы напоминаний
    eventText = eventText
      .replace(/^⏰ Напоминание: через неделю состоится событие\n\n/, '')
      .replace(/^⚠️ Завтра важное событие!\n\n/, '')
      .replace(/^🚨 Через час начинается:\n\n/, '')
      .replace(/^⏰ Скоро событие: /, '');

    // Ограничиваем длину текста для списка
    if (eventText.length > 100) {
      eventText = eventText.substring(0, 97) + '...';
    }

    return `${timeIcon} **${dateDisplay}**\n📝 ${eventText}\n⏱️ ${relativeTime}`;
  }

  /**
   * [RU] Показ детальной информации о событии
   * [EN] Show detailed event information
   */
  async showEventDetails(ctx, eventId) {
    try {
      // Здесь можно получить подробную информацию о событии
      // Пока что показываем заглушку
      const detailsText = `📋 **Подробности события**\n\nДетальная информация о событии будет доступна в следующих версиях.`;
      
      const buttons = [
        { text: '✅ Буду участвовать', callback_data: `event_response_yes_${eventId}` },
        { text: '❌ Не смогу', callback_data: `event_response_no_${eventId}` },
        { text: '🤔 Возможно', callback_data: `event_response_maybe_${eventId}` },
        { text: '⬅️ К списку событий', callback_data: 'upcoming_events' },
        standardButtons.mainMenu
      ];

      const keyboard = createInlineKeyboard(buttons, 3);

      await safeSendMessage(ctx, detailsText, keyboard, { parseMode: 'Markdown' });

      return { success: true, eventId };
    } catch (error) {
      console.error(`❌ Ошибка отображения деталей события ${eventId}:`, error.message);
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обработка пагинации событий
   * [EN] Handle event pagination
   */
  async handlePagination(ctx, page) {
    try {
      const pageNum = parseInt(page) || 1;
      return await this.showEvents(ctx, pageNum);
    } catch (error) {
      console.error(`❌ Ошибка обработки пагинации (страница ${page}):`, error.message);
      
      await ctx.answerCbQuery(texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Показ статистики событий (для администраторов)
   * [EN] Show event statistics (for administrators)
   */
  async showEventStats(ctx) {
    try {
      const statsResult = await this.schedulerLogic.getStats();
      
      if (!statsResult.success) {
        throw new Error(statsResult.error);
      }

      const stats = statsResult.stats;
      
      const statsText = `📊 **Статистика событий**

📋 Всего напоминаний: ${stats.total}
⏳ Ожидающих отправки: ${stats.pending}
✅ Отправлено: ${stats.sent}
❌ Неудачных: ${stats.failed}
📅 Предстоящих: ${stats.upcoming}
⚠️ Просроченных: ${stats.overdue}

🤖 Планировщик: ${stats.isRunning ? '✅ Работает' : '❌ Остановлен'}
🔄 В обработке: ${stats.processingQueue}`;

      const keyboard = createInlineKeyboard([standardButtons.mainMenu], 1);

      await safeSendMessage(ctx, statsText, keyboard, { parseMode: 'Markdown' });

      return { success: true, stats };
    } catch (error) {
      console.error('❌ Ошибка отображения статистики событий:', error.message);
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Фильтрация событий по типу
   * [EN] Filter events by type
   */
  async showFilteredEvents(ctx, filter = 'all') {
    try {
      // Получаем все события
      const eventsResult = await this.schedulerLogic.getUpcomingEvents(50);
      
      if (!eventsResult.success) {
        throw new Error(eventsResult.error);
      }

      let events = eventsResult.events;

      // Применяем фильтр
      switch (filter) {
        case 'today':
          events = events.filter(event => isToday(new Date(event.date)));
          break;
        case 'tomorrow':
          events = events.filter(event => isTomorrow(new Date(event.date)));
          break;
        case 'week':
          const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          events = events.filter(event => new Date(event.date) <= weekFromNow);
          break;
        default:
          // Показываем все события
          break;
      }

      if (events.length === 0) {
        const filterTexts = {
          today: 'на сегодня',
          tomorrow: 'на завтра',
          week: 'на эту неделю',
          all: ''
        };

        const noEventsText = `${texts.events.title}\n\nНет событий ${filterTexts[filter] || ''}`;
        
        const keyboard = createInlineKeyboard([
          { text: '📅 Все события', callback_data: 'upcoming_events' },
          standardButtons.mainMenu
        ], 2);

        await safeSendMessage(ctx, noEventsText, keyboard);
        
        return { success: true, eventCount: 0, filter };
      }

      // Показываем отфильтрованные события
      const formattedEvents = events.map(event => this.formatEventForDisplay(event));
      const eventsText = `${texts.events.title} (${filter})\n\n${formattedEvents.join('\n\n')}`;

      const buttons = [
        { text: '📅 Все события', callback_data: 'upcoming_events' },
        { text: '🔄 Обновить', callback_data: `filter_events_${filter}` },
        standardButtons.mainMenu
      ];

      const keyboard = createInlineKeyboard(buttons, 2);

      await safeSendMessage(ctx, eventsText, keyboard, { parseMode: 'Markdown' });

      return {
        success: true,
        eventCount: events.length,
        filter
      };
    } catch (error) {
      console.error(`❌ Ошибка фильтрации событий (${filter}):`, error.message);
      
      await safeSendMessage(ctx, texts.errors.general);
      
      return { success: false, error: error.message };
    }
  }
}

module.exports = {
  UpcomingEvents
};