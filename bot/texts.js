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
      myResponses: "💬 Мои ответы",
      settings: "⚙️ Настройки",
      changeAttendance: "🎉 Изменить присутствие",
      eventDetails: "📋 Подробная информация о торжестве",
      usefulInfo: "💡 Полезная информация",
      adminGuestList: "👥 Отобразить список гостей"
    }
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



  // Ошибки
  errors: {
    general: "😔 Произошла ошибка. Попробуй еще раз.",
    database: "💾 Ошибка базы данных. Обратись к администратору.",
    notRegistered: "❌ Сначала нужно зарегистрироваться. Нажми /start",
    invalidCommand: "🤷‍♀️ Не понимаю команду. Используй главное меню.",
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
    },
    message: {
      title: "📢 Отправка тестового сообщения",
      testMessage: "Это тестовое сообщение. Если ты его видишь, то напиши Максиму",
      confirmPanel: "📢 Отправка тестового сообщения\n\nСообщение: \"{message}\"\n\n👥 Получателей: {count} пользователей\n\n⚠️ Вы уверены, что хотите отправить это сообщение всем пользователям?",
      sending: "⏳ Отправка сообщений...\n\n📊 Прогресс: {completed}/{total}\n✅ Доставлено: {delivered}\n❌ Ошибки: {failed}\n\nПожалуйста, подождите...",
      completed: "✅ Отправка завершена!\n\n📊 Статистика:\n👥 Всего получателей: {total}\n✅ Успешно доставлено: {delivered}\n❌ Ошибки доставки: {failed}\n🚫 Заблокировано ботом: {blocked}\n\n⏱️ Время выполнения: {duration}",
      cancelled: "❌ Отправка сообщения отменена",
      noUsers: "❌ Нет пользователей для отправки сообщений",
      error: "❌ Ошибка при отправке сообщений: {error}",
      buttons: {
        send: "📢 Отправить тестовое сообщение",
        confirm: "✅ Подтвердить отправку",
        cancel: "❌ Отмена",
        history: "📊 История сообщений",
        backToMenu: "🔙 Назад в меню"
      }
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