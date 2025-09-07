/**
 * [RU] Тест исправления функциональности главного меню
 * [EN] Test for main menu functionality fix
 */

const { DatabaseConnection } = require('./database/connection');
const { MainMenu } = require('./interface/main-menu');
const { createInlineKeyboard } = require('./utils/message-helpers');

async function testMenuGeneration() {
  console.log("🧪 Тестирование генерации меню...")

  try {
    // Инициализация базы данных
    const database = new DatabaseConnection('./data/events.db');
    const db = database.connect();

    const mainMenu = new MainMenu(database);

    // Тест для обычного пользователя
    console.log("\n👤 Тестирование меню для обычного пользователя:")
    const regularUserItems = mainMenu.generateMenuItems("123456789");
    console.log(`   Количество кнопок: ${regularUserItems.length}`);
    
    // Проверка структуры кнопок
    let hasErrors = false;
    regularUserItems.forEach((item, index) => {
      console.log(`   Кнопка ${index + 1}: "${item.text}" -> callback_data: "${item.callback_data}"`);
      
      if (!item.text || (!item.callback_data && !item.callback)) {
        console.error(`   ❌ Ошибка в кнопке ${index + 1}:`, item);
        hasErrors = true;
      }
    });

    // Тест создания клавиатуры
    console.log("\n⌨️ Тестирование создания клавиатуры:")
    const keyboard = createInlineKeyboard(regularUserItems, 2);
    console.log("   Клавиатура создана:", keyboard ? "✅ успешно" : "❌ ошибка");

    // Тест для администратора (если настроен ADMIN_ID)
    if (process.env.ADMIN_ID) {
      console.log("\n👑 Тестирование меню для администратора:")
      const adminItems = mainMenu.generateMenuItems(process.env.ADMIN_ID);
      console.log(`   Количество кнопок: ${adminItems.length}`);
      
      adminItems.forEach((item, index) => {
        console.log(`   Кнопка ${index + 1}: "${item.text}" -> callback_data: "${item.callback_data}"`);
      });
      
      const adminKeyboard = createInlineKeyboard(adminItems, 2);
      console.log("   Админская клавиатура создана:", adminKeyboard ? "✅ успешно" : "❌ ошибка");
    }

    // Итоговый результат
    if (!hasErrors) {
      console.log("\n✅ Все тесты пройдены успешно! Меню должно работать корректно.");
    } else {
      console.log("\n❌ Обнаружены ошибки в структуре кнопок.");
    }

    database.close();
    
  } catch (error) {
    console.error("❌ Ошибка тестирования:", error.message);
    console.error("   Стек ошибки:", error.stack);
  }
}

// Тест структуры кнопок на базовом уровне
function testButtonStructure() {
  console.log("\n🔍 Базовое тестирование структуры кнопок:");
  
  // Тестовые данные с правильной структурой
  const testButtons = [
    { text: "Тест 1", callback_data: "test1" },
    { text: "Тест 2", callback_data: "test2" }
  ];
  
  console.log("   Исходные кнопки:", testButtons);
  
  const testKeyboard = createInlineKeyboard(testButtons, 2);
  console.log("   Тестовая клавиатура создана:", testKeyboard ? "✅ успешно" : "❌ ошибка");
  
  // Тестирование с неправильной структурой (старый формат)
  const wrongButtons = [
    { text: "Тест 3", callback: "test3" }, // старый формат
    { text: "Тест 4", callback_data: "test4" } // правильный формат
  ];
  
  console.log("   Смешанные кнопки:", wrongButtons);
  
  const mixedKeyboard = createInlineKeyboard(wrongButtons, 2);
  console.log("   Смешанная клавиатура создана:", mixedKeyboard ? "✅ успешно" : "❌ ошибка");
}

// Запуск тестов
async function runTests() {
  console.log("🚀 Запуск тестов исправления меню\n");
  
  // Базовое тестирование
  testButtonStructure();
  
  // Полное тестирование с базой данных
  await testMenuGeneration();
  
  console.log("\n🏁 Тестирование завершено");
}

// Запуск при прямом вызове файла
if (require.main === module) {
  runTests().catch(error => {
    console.error("💥 Критическая ошибка:", error);
    process.exit(1);
  });
}

module.exports = {
  testMenuGeneration,
  testButtonStructure,
  runTests
};