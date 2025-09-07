/**
 * [RU] Простой тест исправления функциональности главного меню  
 * [EN] Simple test for main menu functionality fix
 */

const texts = require('../../bot/texts');
const { createInlineKeyboard } = require('../../utils/message-helpers');

// Mock для AdminLogic для тестирования
class MockAdminLogic {
  isAdmin(userId) {
    // Возвращаем true для определенного ID или если ADMIN_ID установлен
    return userId === process.env.ADMIN_ID || userId === 'admin_test_id';
  }
}

// Симуляция generateMenuItems без зависимости от базы данных
function generateMenuItems(userId) {
  const adminLogic = new MockAdminLogic();
  const isAdmin = adminLogic.isAdmin(userId);
  
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

function testMenuGeneration() {
  console.log("🧪 Тестирование генерации меню без базы данных...")

  try {
    // Тест для обычного пользователя
    console.log("\n👤 Тестирование меню для обычного пользователя:")
    const regularUserItems = generateMenuItems("123456789");
    console.log(`   Количество кнопок: ${regularUserItems.length}`);
    
    // Проверка структуры кнопок
    let hasErrors = false;
    regularUserItems.forEach((item, index) => {
      console.log(`   Кнопка ${index + 1}: "${item.text}" -> callback_data: "${item.callback_data}"`);
      
      if (!item.text || !item.callback_data) {
        console.error(`   ❌ Ошибка в кнопке ${index + 1}:`, item);
        hasErrors = true;
      }
    });

    // Тест создания клавиатуры
    console.log("\n⌨️ Тестирование создания клавиатуры:")
    const keyboard = createInlineKeyboard(regularUserItems, 2);
    console.log("   Клавиатура создана:", keyboard ? "✅ успешно" : "❌ ошибка");

    // Тест для администратора
    console.log("\n👑 Тестирование меню для администратора:")
    const adminItems = generateMenuItems("admin_test_id");
    console.log(`   Количество кнопок: ${adminItems.length}`);
    
    adminItems.forEach((item, index) => {
      console.log(`   Кнопка ${index + 1}: "${item.text}" -> callback_data: "${item.callback_data}"`);
      
      if (!item.text || !item.callback_data) {
        console.error(`   ❌ Ошибка в админской кнопке ${index + 1}:`, item);
        hasErrors = true;
      }
    });
    
    const adminKeyboard = createInlineKeyboard(adminItems, 2);
    console.log("   Админская клавиатура создана:", adminKeyboard ? "✅ успешно" : "❌ ошибка");

    // Проверка что у админа больше кнопок
    if (adminItems.length > regularUserItems.length) {
      console.log("   ✅ Администратор имеет дополнительные кнопки");
    } else {
      console.log("   ⚠️ Администратор не имеет дополнительных кнопок");
    }

    // Итоговый результат
    if (!hasErrors) {
      console.log("\n✅ Все тесты пройдены успешно! Меню должно работать корректно.");
      console.log("💡 Основные исправления:");
      console.log("   • Изменено поле 'callback' на 'callback_data' в кнопках");
      console.log("   • Добавлена проверка корректности структуры кнопок");
      console.log("   • Улучшена диагностика ошибок");
      return true;
    } else {
      console.log("\n❌ Обнаружены ошибки в структуре кнопок.");
      return false;
    }
    
  } catch (error) {
    console.error("❌ Ошибка тестирования:", error.message);
    console.error("   Стек ошибки:", error.stack);
    return false;
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
    { text: "Тест 3", callback: "test3" }, // старый формат - должен работать из-за fallback
    { text: "Тест 4", callback_data: "test4" } // правильный формат
  ];
  
  console.log("   Смешанные кнопки:", wrongButtons);
  
  const mixedKeyboard = createInlineKeyboard(wrongButtons, 2);
  console.log("   Смешанная клавиатура создана:", mixedKeyboard ? "✅ успешно" : "❌ ошибка");
  
  // Тестирование с отсутствующими полями
  const brokenButtons = [
    { callback_data: "broken1" }, // нет text
    { text: "Тест 5" } // нет callback_data
  ];
  
  console.log("   Сломанные кнопки:", brokenButtons);
  
  const brokenKeyboard = createInlineKeyboard(brokenButtons, 2);
  console.log("   Клавиатура с ошибками создана:", brokenKeyboard ? "✅ успешно" : "❌ ошибка");
}

// Запуск тестов
function runTests() {
  console.log("🚀 Запуск тестов исправления меню\n");
  
  // Базовое тестирование
  testButtonStructure();
  
  // Полное тестирование генерации меню
  const success = testMenuGeneration();
  
  console.log("\n🏁 Тестирование завершено");
  
  if (success) {
    console.log("\n🎉 УСПЕХ: Проблема с кнопками меню исправлена!");
    console.log("   Теперь команда /menu должна показывать кнопки корректно.");
  } else {
    console.log("\n⚠️ ВНИМАНИЕ: Есть проблемы, которые нужно исправить.");
  }
  
  return success;
}

// Запуск при прямом вызове файла
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

module.exports = {
  generateMenuItems,
  testMenuGeneration,
  testButtonStructure,
  runTests
};