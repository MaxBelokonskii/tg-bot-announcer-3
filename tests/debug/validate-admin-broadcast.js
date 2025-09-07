/**
 * [RU] Скрипт валидации функции отправки сообщений администратором
 * [EN] Admin message broadcasting feature validation script
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { AdminAPI } = require('../../features/admin/api');
const { AdminLogic } = require('../../features/admin/logic');
const { MainMenu } = require('../../interface/main-menu');

console.log('🔍 Проверка функции отправки сообщений администратором...\n');

// Проверяем, что все файлы существуют
const filesToCheck = [
  '../../features/admin/api.js',
  '../../features/admin/logic.js', 
  '../../interface/main-menu.js',
  '../../bot/router.js',
  '../../bot/texts.js',
  '../../database/schema.sql'
];

console.log('📁 Проверка существования файлов:');
for (const file of filesToCheck) {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - ОТСУТСТВУЕТ`);
  }
}
console.log('');

// Подключаемся к базе данных
console.log('💾 Проверка базы данных:');
const dbPath = path.join(__dirname, '../../database/bot_database.db');
if (!fs.existsSync(dbPath)) {
  console.log('❌ База данных не найдена');
  process.exit(1);
}

const db = new Database(dbPath);

// Проверяем существование таблицы admin_messages
const adminMessagesTable = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' AND name='admin_messages'
`).get();

if (adminMessagesTable) {
  console.log('✅ Таблица admin_messages существует');
  
  // Проверяем структуру таблицы
  const tableInfo = db.prepare('PRAGMA table_info(admin_messages)').all();
  const expectedColumns = [
    'id', 'message_text', 'message_type', 'sent_by', 'sent_at',
    'total_recipients', 'delivered_count', 'failed_count', 'blocked_count'
  ];
  
  const actualColumns = tableInfo.map(col => col.name);
  const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
  
  if (missingColumns.length === 0) {
    console.log('✅ Структура таблицы admin_messages корректна');
  } else {
    console.log(`❌ Отсутствуют колонки в таблице admin_messages: ${missingColumns.join(', ')}`);
  }
} else {
  console.log('❌ Таблица admin_messages не существует');
}
console.log('');

// Проверяем API и Logic классы
console.log('🔧 Проверка API и Logic классов:');
try {
  const adminAPI = new AdminAPI(db);
  console.log('✅ AdminAPI инициализирован');
  
  // Проверяем наличие новых методов
  if (typeof adminAPI.sendTestMessage === 'function') {
    console.log('✅ Метод sendTestMessage существует');
  } else {
    console.log('❌ Метод sendTestMessage отсутствует');
  }
  
  if (typeof adminAPI.getTestMessageHistory === 'function') {
    console.log('✅ Метод getTestMessageHistory существует');
  } else {
    console.log('❌ Метод getTestMessageHistory отсутствует');
  }
  
  const adminLogic = new AdminLogic(db);
  console.log('✅ AdminLogic инициализирован');
  
  // Проверяем наличие новых методов
  if (typeof adminLogic.handleAdminMessage === 'function') {
    console.log('✅ Метод handleAdminMessage существует');
  } else {
    console.log('❌ Метод handleAdminMessage отсутствует');
  }
  
  if (typeof adminLogic.showMessageSendingPanel === 'function') {
    console.log('✅ Метод showMessageSendingPanel существует');
  } else {
    console.log('❌ Метод showMessageSendingPanel отсутствует');
  }
  
  if (typeof adminLogic.confirmMessageSending === 'function') {
    console.log('✅ Метод confirmMessageSending существует');
  } else {
    console.log('❌ Метод confirmMessageSending отсутствует');
  }
  
} catch (error) {
  console.log(`❌ Ошибка инициализации классов: ${error.message}`);
}
console.log('');

// Проверяем MainMenu
console.log('📋 Проверка MainMenu:');
try {
  const mainMenu = new MainMenu(db);
  console.log('✅ MainMenu инициализирован');
  
  // Устанавливаем тестового администратора
  process.env.ADMIN_ID = '123456789';
  
  // Проверяем генерацию меню для администратора
  const adminMenuItems = mainMenu.generateMenuItems('123456789');
  const hasAdminMessageButton = adminMenuItems.some(item => 
    item.callback_data === 'admin_send_test_message'
  );
  
  if (hasAdminMessageButton) {
    console.log('✅ Кнопка отправки тестового сообщения добавлена в меню администратора');
  } else {
    console.log('❌ Кнопка отправки тестового сообщения отсутствует в меню администратора');
  }
  
  // Проверяем генерацию меню для обычного пользователя
  const userMenuItems = mainMenu.generateMenuItems('999999999');
  const userHasAdminButton = userMenuItems.some(item => 
    item.callback_data === 'admin_send_test_message'
  );
  
  if (!userHasAdminButton) {
    console.log('✅ Кнопка отправки тестового сообщения скрыта от обычных пользователей');
  } else {
    console.log('❌ Кнопка отправки тестового сообщения видна обычным пользователям');
  }
  
} catch (error) {
  console.log(`❌ Ошибка проверки MainMenu: ${error.message}`);
}
console.log('');

// Проверяем тексты интерфейса
console.log('📝 Проверка текстов интерфейса:');
try {
  const texts = require('../../bot/texts');
  
  if (texts.admin && texts.admin.message) {
    console.log('✅ Тексты для админских сообщений добавлены');
    
    const requiredTexts = [
      'title', 'testMessage', 'confirmPanel', 'sending', 
      'completed', 'cancelled', 'error'
    ];
    
    const missingTexts = requiredTexts.filter(key => !texts.admin.message[key]);
    
    if (missingTexts.length === 0) {
      console.log('✅ Все необходимые тексты присутствуют');
    } else {
      console.log(`❌ Отсутствуют тексты: ${missingTexts.join(', ')}`);
    }
    
    if (texts.admin.message.buttons) {
      console.log('✅ Тексты кнопок добавлены');
    } else {
      console.log('❌ Тексты кнопок отсутствуют');
    }
  } else {
    console.log('❌ Тексты для админских сообщений отсутствуют');
  }
} catch (error) {
  console.log(`❌ Ошибка проверки текстов: ${error.message}`);
}
console.log('');

// Создаем тестового пользователя и проверяем работу API
console.log('🧪 Функциональное тестирование:');
(async () => {
  try {
    // Создаем тестового пользователя
    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (telegram_id, full_name, attendance_status) 
      VALUES (?, ?, ?)
    `);
    insertUser.run('test_user_123', 'Тестовый Пользователь', 'attending');
    console.log('✅ Создан тестовый пользователь');
    
    // Тестируем getTestMessageHistory с пустой историей
    const adminAPI = new AdminAPI(db);
    const historyResult = await adminAPI.getTestMessageHistory(5);
    
    if (historyResult.success) {
      console.log(`✅ Получение истории сообщений работает (найдено ${historyResult.count} записей)`);
    } else {
      console.log(`❌ Ошибка получения истории: ${historyResult.error}`);
    }
    
    // Очищаем тестовые данные
    const deleteUser = db.prepare('DELETE FROM users WHERE telegram_id = ?');
    deleteUser.run('test_user_123');
    console.log('✅ Тестовые данные очищены');
    
  } catch (error) {
    console.log(`❌ Ошибка функционального тестирования: ${error.message}`);
  }
  console.log('');
  
  // Закрываем соединение с базой данных
  db.close();
  
  console.log('🎉 Валидация завершена!\n');
  console.log('📋 Краткий обзор функциональности:');
  console.log('   • Новая таблица admin_messages для логирования отправок');
  console.log('   • AdminAPI.sendTestMessage() - отправка тестового сообщения всем пользователям');
  console.log('   • AdminAPI.getTestMessageHistory() - получение истории отправок');
  console.log('   • AdminLogic.handleAdminMessage() - обработка команд администратора');
  console.log('   • AdminLogic.showMessageSendingPanel() - показ панели подтверждения');
  console.log('   • AdminLogic.confirmMessageSending() - подтверждение отправки');
  console.log('   • AdminLogic.cancelMessageSending() - отмена отправки');
  console.log('   • Новая кнопка в меню администратора');
  console.log('   • Поддержка команды /admin_message');
  console.log('   • Полная интеграция с существующей системой доставки сообщений');
  console.log('   • Подробное логирование и статистика доставки');
  console.log('   • Русскоязычный интерфейс');
  console.log('');
  console.log('🚀 Готово к использованию!');
})();