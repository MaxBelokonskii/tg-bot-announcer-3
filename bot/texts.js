/**
 * [RU] Централизованное управление текстами интерфейса
 * [EN] Centralized interface text management
 */

module.exports = {
  // Приветствие и онбординг
  welcome: {
    title: "👋 Добро пожаловать!",
    greeting: "Привет! Я бот для напоминаний о событиях. Помогу тебе не пропустить важные мероприятия.",
    namePrompt: "Как тебя зовут? Напиши свое имя:",
    nameConfirm: "Приятно познакомиться, {name}! Теперь ты будешь получать уведомления о событиях.",
    registrationComplete: "✅ Регистрация завершена! Используй /menu для навигации.",
    alreadyRegistered: "Ты уже зарегистрирован! Используй /menu для доступа к функциям."
  },

  // Главное меню
  menu: {
    title: "📋 Главное меню",
    description: "Выбери нужную функцию:",
    buttons: {
      upcomingEvents: "📅 Предстоящие события",
      myResponses: "💬 Мои ответы",
      settings: "⚙️ Настройки",
      help: "❓ Помощь",
      changeAttendance: "🎉 Изменить присутствие",
      eventDetails: "📋 Подробная информация о торжестве",
      usefulInfo: "💡 Полезная информация",
      adminGuestList: "👥 Отобразить список гостей"
    }
  },

  // Предстоящие события
  events: {
    title: "📅 Предстоящие события",
    noEvents: "🤷‍♀️ Пока нет запланированных событий",
    loading: "⏳ Загружаю список событий...",
    eventTemplate: "📅 {date}\n📝 {description}",
    backToMenu: "⬅️ Вернуться в меню"
  },

  // Ответы пользователей
  responses: {
    title: "💬 Мои ответы",
    noResponses: "📭 У тебя пока нет ответов",
    prompt: "✏️ Напиши свой ответ на событие:",
    thankYou: "✅ Спасибо за ответ! Он сохранен.",
    confirmationPrompt: "Будешь участвовать в событии? Ответь:",
    options: {
      yes: "✅ Да, буду",
      no: "❌ Нет, не смогу",
      maybe: "🤔 Возможно"
    },
    responseReceived: "📝 Ответ получен: {response}",
    responseTemplate: "📅 {date}\n💭 {response}"
  },

  // Напоминания
  reminders: {
    upcoming: "⏰ Скоро событие: {event}",
    today: "📅 Сегодня запланировано: {event}",
    tomorrow: "📅 Завтра состоится: {event}",
    weekBefore: "📅 Через неделю: {event}",
    dayBefore: "⚠️ Завтра важное событие: {event}",
    hourBefore: "🚨 Через час начинается: {event}",
    pleaseRespond: "\n\n💬 Пожалуйста, сообщи, будешь ли участвовать:",
    alreadyResponded: "✅ Ты уже ответил на это событие"
  },

  // Настройки
  settings: {
    title: "⚙️ Настройки",
    notifications: "🔔 Уведомления",
    profile: "👤 Профиль",
    language: "🌐 Язык",
    timezone: "🕐 Часовой пояс",
    notificationsEnabled: "✅ Уведомления включены",
    notificationsDisabled: "🔕 Уведомления отключены",
    profileUpdated: "✅ Профиль обновлен"
  },

  // Помощь
  help: {
    title: "❓ Справка",
    description: `
🤖 **Как пользоваться ботом:**

📅 **Предстоящие события** - посмотреть список запланированных мероприятий
💬 **Мои ответы** - просмотреть свои ответы на события
⚙️ **Настройки** - настроить уведомления и профиль

🔔 **Уведомления:**
- За неделю до события
- За день до события  
- За час до события

✏️ **Ответы на события:**
Когда получишь напоминание, просто ответь сообщением:
• "Да" или "Буду" - планируешь участвовать
• "Нет" или "Не смогу" - не сможешь участвовать
• "Возможно" или "Может быть" - пока не уверен

❓ Если есть вопросы, напиши /help
    `,
    commands: {
      start: "/start - Начать работу с ботом",
      menu: "/menu - Показать главное меню",
      events: "/events - Посмотреть предстоящие события",
      responses: "/responses - Просмотреть мои ответы",
      settings: "/settings - Открыть настройки",
      help: "/help - Показать справку"
    }
  },

  // Ошибки
  errors: {
    general: "😔 Произошла ошибка. Попробуй еще раз.",
    database: "💾 Ошибка базы данных. Обратись к администратору.",
    notRegistered: "❌ Сначала нужно зарегистрироваться. Нажми /start",
    invalidCommand: "🤷‍♀️ Не понимаю команду. Используй /help для справки.",
    networkError: "🌐 Проблемы с сетью. Попробуй позже.",
    userNotFound: "👤 Пользователь не найден",
    messageNotSent: "📤 Не удалось отправить сообщение"
  },

  // Кнопки интерфейса
  buttons: {
    mainMenu: "🏠 Главное меню",
    back: "⬅️ Назад", 
    cancel: "❌ Отмена",
    confirm: "✅ Подтвердить",
    refresh: "🔄 Обновить",
    more: "➡️ Ещё",
    yes: "✅ Да",
    no: "❌ Нет",
    maybe: "🤔 Возможно"
  },

  // Статусы
  status: {
    processing: "⏳ Обрабатываю запрос...",
    saving: "💾 Сохраняю...",
    loading: "⏳ Загружаю...",
    sending: "📤 Отправляю...",
    success: "✅ Готово!",
    failed: "❌ Не удалось выполнить",
    cancelled: "🚫 Отменено"
  },

  // Форматирование дат
  dates: {
    today: "сегодня",
    tomorrow: "завтра",
    yesterday: "вчера",
    inDays: "через {days} дн.",
    inHours: "через {hours} ч.",
    inMinutes: "через {minutes} мин.",
    daysAgo: "{days} дн. назад",
    hoursAgo: "{hours} ч. назад",
    minutesAgo: "{minutes} мин. назад"
  },

  // Административные функции (для будущего расширения)
  admin: {
    title: "🔧 Панель администратора",
    createEvent: "➕ Создать событие",
    manageUsers: "👥 Управление пользователями",
    statistics: "📊 Статистика",
    broadcast: "📢 Рассылка",
    eventCreated: "✅ Событие создано и запланировано",
    broadcastSent: "📤 Рассылка отправлена {count} пользователям",
    guestList: {
      title: "👥 Список гостей",
      total: "Всего гостей: {count}",
      attending: "✅ Присутствуют ({count}):",
      notAttending: "❌ Не присутствуют ({count}):",
      maybe: "🤔 Возможно присутствуют ({count}):",
      noGuests: "📫 Список гостей пуст",
      loadError: "❌ Ошибка загрузки списка гостей"
    }
  },

  // Управление присутствием
  attendance: {
    title: "🎉 Управление присутствием",
    currentStatus: "Текущий статус: {status}",
    changePrompt: "Выберите ваш статус присутствия:",
    confirmChange: "✅ Статус изменен на: {status}",
    options: {
      attending: "✅ Буду присутствовать",
      notAttending: "❌ Не смогу присутствовать",
      maybe: "🤔 Возможно присутствую"
    }
  },

  // Детали события
  eventDetails: {
    title: "📋 Подробная информация о торжестве",
    content: "Здесь будет подробная информация о событии..."
  },

  // Полезная информация
  usefulInfo: {
    title: "💡 Полезная информация",
    content: "Здесь будет полезная информация для гостей..."
  }
};

/**
 * [RU] Функция для форматирования текста с подстановкой переменных
 * [EN] Function for text formatting with variable substitution
 */
function formatText(template, variables = {}) {
  return template.replace(/{(\w+)}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

module.exports.formatText = formatText;