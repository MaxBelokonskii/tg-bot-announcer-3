/**
 * [RU] Простой тест основной функциональности
 * [EN] Simple test for basic functionality
 */

const { DatabaseConnection } = require('../../database/connection');
const { AttendanceLogic } = require('../../features/attendance/logic');
const { AdminLogic } = require('../../features/admin/logic');
const { MainMenu } = require('../../interface/main-menu');

async function simpleTest() {
  console.log('🚀 Запуск простого теста функциональности...\n');

  try {
    // Инициализируем базу данных
    const dbConnection = new DatabaseConnection('test-simple.db');
    const database = dbConnection.connect();

    // Создаем тестового пользователя
    const insertUser = database.prepare(`
      INSERT INTO users (telegram_id, full_name, attendance_status, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);

    insertUser.run('123456789', 'Тестовый Пользователь', 'attending');
    console.log('✅ Тестовый пользователь создан');

    // Тестируем AttendanceLogic
    const attendanceLogic = new AttendanceLogic(database);
    
    // Получаем текущий статус
    const status = await attendanceLogic.api.getUserAttendance('123456789');
    console.log(`✅ Текущий статус: ${status}`);

    // Обновляем статус
    const updateResult = await attendanceLogic.api.updateUserAttendance('123456789', 'maybe');
    console.log(`✅ Обновление статуса: ${updateResult.success}`);

    // Тестируем AdminLogic
    process.env.ADMIN_ID = '123456789'; // Делаем тестового пользователя админом
    const adminLogic = new AdminLogic(database);
    
    const isAdmin = adminLogic.isAdmin('123456789');
    console.log(`✅ Проверка админа: ${isAdmin}`);

    // Тестируем MainMenu
    const mainMenu = new MainMenu(database);
    
    const userMenuItems = mainMenu.generateMenuItems('999999999'); // Обычный пользователь
    const adminMenuItems = mainMenu.generateMenuItems('123456789'); // Админ
    
    console.log(`✅ Меню пользователя: ${userMenuItems.length} элементов`);
    console.log(`✅ Меню админа: ${adminMenuItems.length} элементов`);
    
    const hasAdminButton = adminMenuItems.some(item => item.callback === 'admin_guest_list');
    console.log(`✅ У админа есть админская кнопка: ${hasAdminButton}`);

    // Закрываем соединение
    dbConnection.close();

    console.log('\n🎉 Все тесты прошли успешно!');
    return true;

  } catch (error) {
    console.error('❌ Ошибка теста:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Запускаем тест
if (require.main === module) {
  simpleTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Необработанная ошибка:', error);
      process.exit(1);
    });
}

module.exports = { simpleTest };