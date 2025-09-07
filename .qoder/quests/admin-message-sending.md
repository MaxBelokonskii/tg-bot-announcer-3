# Функция отправки сообщений администратором

## Обзор

Данная функция добавляет возможность для администратора отправлять заранее подготовленные сообщения всем пользователям в базе данных. Функция будет интегрирована в существующую админскую панель и использовать текущую архитектуру системы доставки сообщений.

**Основные требования:**

- Команда для администратора для отправки тестового сообщения
- Кнопка в админской панели для быстрого доступа
- Отправка сообщения "Это тестовое сообщение. Если ты его видишь, то напиши Максиму" всем пользователям
- Использование существующей системы message-delivery
- Логирование результатов доставки

## Технологический стек

- **Backend**: Node.js с Express-подобным роутингом
- **Bot Framework**: Telegraf.js для Telegram Bot API
- **База данных**: SQLite с существующими таблицами users и delivery_logs
- **Архитектурный паттерн**: Feature-based модульная архитектура

## Архитектура компонентов

### Диаграмма взаимодействия компонентов

``mermaid
graph TD
A[Администратор] -->|/admin_message или кнопка| B[MessageRouter]
B --> C[AdminLogic]
C --> D[AdminAPI]
D --> E[MessageDeliveryAPI]
E --> F[Telegram Bot API]
E --> G[Database - delivery_logs]

    D --> H[Database - users]

    I[Существующая админская панель] --> J[Новая кнопка]
    J --> C

    style A fill:#ff9999
    style E fill:#99ff99
    style H fill:#9999ff
    style G fill:#9999ff

```

### Последовательность действий

``mermaid
sequenceDiagram
    participant Admin as Администратор
    participant Router as MessageRouter
    participant AdminLogic as AdminLogic
    participant AdminAPI as AdminAPI
    participant MessageAPI as MessageDeliveryAPI
    participant DB as База данных
    participant TG as Telegram API

    Admin->>Router: /admin_message или callback
    Router->>AdminLogic: handleAdminMessage()
    AdminLogic->>AdminLogic: Проверка прав администратора
    AdminLogic->>AdminAPI: sendTestMessage()
    AdminAPI->>DB: Получение списка всех пользователей
    DB-->>AdminAPI: Список пользователей
    AdminAPI->>MessageAPI: broadcastMessage()

    loop Для каждого пользователя
        MessageAPI->>TG: sendMessage()
        TG-->>MessageAPI: Результат доставки
        MessageAPI->>DB: logDelivery()
    end

    MessageAPI-->>AdminAPI: Статистика доставки
    AdminAPI-->>AdminLogic: Результат операции
    AdminLogic-->>Admin: Отчет о доставке
```

## API Reference

### AdminAPI - Новые методы

#### `sendTestMessage(adminUserId)`

Отправляет тестовое сообщение всем пользователям в базе данных.

**Параметры:**

- `adminUserId` (string): ID администратора, инициировавшего отправку

**Возвращает:**

```javascript
{
  success: boolean,
  messageId: string,
  deliveryStats: {
    total: number,
    delivered: number,
    failed: number,
    blocked: number
  },
  startTime: string,
  endTime: string
}
```

#### `getTestMessageHistory(limit = 50)`

Получает историю отправленных тестовых сообщений.

**Возвращает:**

```javascript
{
  success: boolean,
  history: Array<{
    messageId: string,
    sentBy: string,
    sentAt: string,
    deliveryStats: object
  }>
}
```

### AdminLogic - Новые методы

#### `handleAdminMessage(ctx)`

Обрабатывает команду или callback для отправки админского сообщения.

#### `showMessageSendingPanel(ctx)`

Показывает панель управления отправкой сообщений с подтверждением.

## Архитектура данных

### Использование существующих таблиц

#### Таблица `users`

```sql
SELECT telegram_id, full_name
FROM users
WHERE attendance_status IS NOT NULL
```

#### Таблица `delivery_logs`

```sql
INSERT INTO delivery_logs (
  user_id,
  message_id,
  status,
  error_message,
  sent_at
) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
```

### Новая таблица `admin_messages`

```sql
CREATE TABLE IF NOT EXISTS admin_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_text TEXT NOT NULL,
  message_type TEXT DEFAULT 'test_message',
  sent_by TEXT NOT NULL,  -- telegram_id администратора
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_recipients INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  blocked_count INTEGER DEFAULT 0
);
```

## Интеграция с интерфейсом

### Новая команда `/admin_message`

```mermaid
graph LR
    A[/admin_message] --> B{Проверка прав}
    B -->|Администратор| C[Показать панель подтверждения]
    B -->|Не администратор| D[Ошибка доступа]
    C --> E[Кнопка подтверждения]
    E --> F[Отправка сообщений]
    F --> G[Отчет о доставке]
```

### Обновление главного меню администратора

В `MainMenu.generateMenuItems()` добавится новая кнопка:

``javascript
if (isAdmin) {
menuItems.push({
text: "📢 Отправить тестовое сообщение",
callback_data: "admin_send_test_message"
});
}

````

### Панель подтверждения

```mermaid
graph TD
    A[Админская кнопка] --> B[Панель подтверждения]
    B --> C["📢 Отправить тестовое сообщение?<br/>Сообщение: 'Это тестовое сообщение...'<br/>Получателей: X пользователей"]
    C --> D[✅ Отправить]
    C --> E[❌ Отмена]
    D --> F[Процесс отправки]
    E --> G[Возврат в меню]
````

## Обработка ошибок и логирование

### Типы ошибок

- **Unauthorized**: Пользователь не является администратором
- **Database Error**: Ошибка при получении списка пользователей
- **Delivery Error**: Ошибка отправки сообщения конкретному пользователю
- **Rate Limit**: Превышение лимитов Telegram API

### Логирование

```
// Начало операции
console.log(`📢 Администратор ${adminId} начал отправку тестового сообщения`);

// Процесс отправки
console.log(`📤 Отправка сообщения пользователю ${userId}: ${status}`);

// Завершение операции
console.log(`✅ Отправка завершена. Доставлено: ${delivered}/${total}`);
```

## Интеграция с существующей системой доставки

### Использование MessageDeliveryAPI

```javascript
const messageId = `admin_test_${Date.now()}`
const messageText =
  "Это тестовое сообщение. Если ты его видишь, то напиши Максиму"

const result = await this.messageDeliveryAPI.broadcastMessage(
  bot,
  messageText,
  messageId,
  {
    batchSize: 25,
    delay: 150,
    parseMode: "HTML",
    onProgress: (stats) => {
      console.log(`Прогресс: ${stats.completed}/${stats.total}`)
    },
  }
)
```

### Настройки доставки

- **Размер пакета**: 25 пользователей за раз
- **Задержка**: 150ms между пакетами
- **Retry**: Автоматические повторы для неудачных отправок
- **Мониторинг**: Детальное логирование статуса каждой доставки

## Пользовательский интерфейс

### Текстовые сообщения

#### Панель подтверждения

```
📢 Отправка тестового сообщения

Сообщение: "Это тестовое сообщение. Если ты его видишь, то напиши Максиму"

👥 Получателей: {count} пользователей

⚠️ Вы уверены, что хотите отправить это сообщение всем пользователям?
```

#### Процесс отправки

```
⏳ Отправка сообщений...

📊 Прогресс: {completed}/{total}
✅ Доставлено: {delivered}
❌ Ошибки: {failed}

Пожалуйста, подождите...
```

#### Отчет о завершении

```
✅ Отправка завершена!

📊 Статистика:
👥 Всего получателей: {total}
✅ Успешно доставлено: {delivered}
❌ Ошибки доставки: {failed}
🚫 Заблокировано ботом: {blocked}

⏱️ Время выполнения: {duration}
```

### Кнопки интерфейса

| Кнопка                  | Callback                  | Описание                      |
| ----------------------- | ------------------------- | ----------------------------- |
| 📢 Отправить тестовое   | `admin_send_test_message` | Показать панель подтверждения |
| ✅ Подтвердить отправку | `admin_confirm_send`      | Начать отправку сообщений     |
| ❌ Отмена               | `admin_cancel_send`       | Отменить операцию             |
| 📊 История сообщений    | `admin_message_history`   | Показать историю отправок     |
| 🔙 Назад в меню         | `main_menu`               | Вернуться в главное меню      |

## Модификации файлов

### `/features/admin/api.js`

- Добавить методы `sendTestMessage()` и `getTestMessageHistory()`
- Интеграция с MessageDeliveryAPI

### `/features/admin/logic.js`

- Добавить методы `handleAdminMessage()` и `showMessageSendingPanel()`
- Логика подтверждения и отчетности

### `/interface/main-menu.js`

- Добавить новую кнопку в `generateMenuItems()`
- Обработка callback `admin_send_test_message`

### `/bot/router.js`

- Добавить команду `/admin_message`
- Маршрутизация новых admin callback'ов

### `/bot/texts.js`

- Добавить тексты для новой функциональности

### `/database/schema.sql`

- Добавить таблицу `admin_messages`
- Индексы для оптимизации

## Тестирование

### Unit тесты

- Проверка прав администратора
- Валидация входных данных
- Обработка ошибок базы данных

### Integration тесты

- Полный цикл отправки сообщения
- Интеграция с MessageDeliveryAPI
- Сохранение логов доставки

### Manual тесты

- Тестирование команды `/admin_message`
- Проверка кнопок в админской панели
- Валидация прав доступа
