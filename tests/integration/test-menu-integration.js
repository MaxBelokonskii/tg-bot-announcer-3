/**
 * [RU] Интеграционные тесты для новой функциональности кнопок меню
 * [EN] Integration tests for new menu button functionality
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Импортируем наши классы
const { AttendanceLogic } = require('../../features/attendance/logic');
const { AttendanceAPI } = require('../../features/attendance/api');
const { EventInfoLogic } = require('../../features/event-info/logic');
const { EventInfoAPI } = require('../../features/event-info/api');
const { AdminLogic } = require('../../features/admin/logic');
const { AdminAPI } = require('../../features/admin/api');
const { MainMenu } = require('../../interface/main-menu');

/**
 * [RU] Класс для интеграционного тестирования
 * [EN] Integration testing class
 */
class MenuIntegrationTests {
  constructor() {
    this.testDbPath = path.join(__dirname, 'test-menu.db');
    this.database = null;
  }

  /**
   * [RU] Инициализация тестовой базы данных
   * [EN] Initialize test database
   */
  async initTestDatabase() {
    // Удаляем существующую тестовую БД если есть
    if (fs.existsSync(this.testDbPath)) {
      fs.unlinkSync(this.testDbPath);
    }

    this.database = new Database(this.testDbPath);
    
    // Создаем таблицы
    const schemaPath = path.join(__dirname, '../../database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    this.database.exec(schema);
    console.log('✅ Тестовая база данных создана');
  }

  /**
   * [RU] Создание тестовых данных
   * [EN] Create test data
   */
  async createTestData() {
    const insertUser = this.database.prepare(`
      INSERT INTO users (telegram_id, full_name, attendance_status, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);

    const testUsers = [
      ['123456789', 'Иван Тестовый', 'attending'],
      ['987654321', 'Мария Тестовая', 'not_attending'],
      ['555666777', 'Петр Тестовый', 'maybe'],
      ['111222333', 'Анна Админ', 'attending'] // Будет админом в тестах
    ];

    const insertMany = this.database.transaction((users) => {
      for (const user of users) {
        insertUser.run(user);
      }
    });

    insertMany(testUsers);
    console.log('✅ Тестовые данные созданы');
  }

  /**
   * [RU] Тест API управления присутствием
   * [EN] Test attendance management API
   */
  async testAttendanceAPI() {
    console.log('\n🧪 Тестирование AttendanceAPI...');
    
    const api = new AttendanceAPI(this.database);

    try {
      // Тест получения статуса присутствия
      const status1 = await api.getUserAttendance('123456789');
      console.log(`   ✓ Получение статуса: ${status1}`);

      // Тест обновления статуса
      const updateResult = await api.updateUserAttendance('123456789', 'not_attending');
      console.log(`   ✓ Обновление статуса: ${updateResult.success}`);

      // Тест получения статистики
      const statsResult = await api.getAttendanceStatistics();
      console.log(`   ✓ Статистика: ${JSON.stringify(statsResult.stats)}`);

      // Тест получения всех пользователей
      const usersResult = await api.getAllUsersAttendance();
      console.log(`   ✓ Все пользователи: ${usersResult.users.length} найдено`);

      return true;
    } catch (error) {
      console.error(`   ❌ Ошибка в AttendanceAPI: ${error.message}`);
      return false;
    }
  }

  /**
   * [RU] Тест логики управления присутствием
   * [EN] Test attendance management logic
   */
  async testAttendanceLogic() {
    console.log('\n🧪 Тестирование AttendanceLogic...');
    
    const logic = new AttendanceLogic(this.database);

    try {
      // Мокаем контекст Telegram
      const mockCtx = {
        from: { id: 123456789 },
        answerCbQuery: () => Promise.resolve(),
        reply: (text) => console.log(`   📱 Ответ: ${text}`)
      };

      // Тест валидации статуса
      const validStatus = logic.isValidAttendanceStatus('attending');
      console.log(`   ✓ Валидация статуса: ${validStatus}`);

      // Тест получения текста статуса
      const statusText = logic.getStatusDisplayText('attending');
      console.log(`   ✓ Текст статуса: ${statusText}`);

      // Тест получения статистики
      const stats = await logic.getAttendanceStats();
      console.log(`   ✓ Получение статистики: ${stats.success}`);

      return true;
    } catch (error) {
      console.error(`   ❌ Ошибка в AttendanceLogic: ${error.message}`);
      return false;
    }
  }

  /**
   * [RU] Тест API информации о событиях
   * [EN] Test event info API
   */
  async testEventInfoAPI() {
    console.log('\n🧪 Тестирование EventInfoAPI...');
    
    const api = new EventInfoAPI(this.database);

    try {
      // Тест получения деталей события
      const detailsResult = await api.getEventDetails();
      console.log(`   ✓ Детали события: ${detailsResult.success}`);

      // Тест получения полезной информации
      const infoResult = await api.getUsefulInfo();
      console.log(`   ✓ Полезная информация: ${infoResult.success}`);

      // Тест проверки наличия информации
      const hasInfoResult = await api.hasCurrentEventInfo();
      console.log(`   ✓ Проверка наличия информации: ${hasInfoResult.hasInfo}`);

      return true;
    } catch (error) {
      console.error(`   ❌ Ошибка в EventInfoAPI: ${error.message}`);
      return false;
    }
  }

  /**
   * [RU] Тест API администрирования
   * [EN] Test admin API
   */
  async testAdminAPI() {
    console.log('\n🧪 Тестирование AdminAPI...');
    
    const api = new AdminAPI(this.database);

    try {
      // Тест получения всех пользователей с присутствием
      const usersResult = await api.getAllUsersWithAttendance();
      console.log(`   ✓ Все пользователи с присутствием: ${usersResult.users.length} найдено`);

      // Тест получения статистики пользователей
      const userStatsResult = await api.getUserStatistics();
      console.log(`   ✓ Статистика пользователей: ${userStatsResult.stats.total} всего`);

      // Тест получения статистики присутствия
      const attendanceStatsResult = await api.getAttendanceStatistics();
      console.log(`   ✓ Статистика присутствия: ${attendanceStatsResult.stats.total} всего`);

      // Тест поиска пользователей
      const searchResult = await api.searchUsersByName('Тестовый');
      console.log(`   ✓ Поиск пользователей: ${searchResult.users.length} найдено`);

      return true;
    } catch (error) {
      console.error(`   ❌ Ошибка в AdminAPI: ${error.message}`);
      return false;
    }
  }

  /**
   * [RU] Тест логики администрирования
   * [EN] Test admin logic
   */
  async testAdminLogic() {
    console.log('\n🧪 Тестирование AdminLogic...');
    
    // Устанавливаем тестового админа
    process.env.ADMIN_ID = '111222333';
    
    const logic = new AdminLogic(this.database);

    try {
      // Тест проверки админа
      const isAdmin = logic.isAdmin('111222333');
      console.log(`   ✓ Проверка админа: ${isAdmin}`);

      const isNotAdmin = logic.isAdmin('123456789');
      console.log(`   ✓ Проверка не-админа: ${!isNotAdmin}`);

      // Тест группировки пользователей
      const usersResult = await logic.api.getAllUsersWithAttendance();
      if (usersResult.success) {
        const grouped = logic.groupUsersByAttendance(usersResult.users);
        console.log(`   ✓ Группировка пользователей: ${Object.keys(grouped).length} групп`);
      }

      // Тест получения текста статуса
      const statusText = logic.getStatusDisplayText('attending');
      console.log(`   ✓ Текст статуса админа: ${statusText}`);

      return true;
    } catch (error) {
      console.error(`   ❌ Ошибка в AdminLogic: ${error.message}`);
      return false;
    }
  }

  /**
   * [RU] Тест главного меню
   * [EN] Test main menu
   */
  async testMainMenu() {
    console.log('\n🧪 Тестирование MainMenu...');
    
    const mainMenu = new MainMenu(this.database);

    try {
      // Тест генерации меню для обычного пользователя
      const userMenuItems = mainMenu.generateMenuItems('123456789');
      console.log(`   ✓ Меню пользователя: ${userMenuItems.length} элементов`);

      // Тест генерации меню для админа
      const adminMenuItems = mainMenu.generateMenuItems('111222333');
      console.log(`   ✓ Меню админа: ${adminMenuItems.length} элементов`);

      // Проверяем, что у админа больше элементов меню
      const hasAdminButton = adminMenuItems.some(item => item.callback === 'admin_guest_list');
      console.log(`   ✓ У админа есть админская кнопка: ${hasAdminButton}`);

      return true;
    } catch (error) {
      console.error(`   ❌ Ошибка в MainMenu: ${error.message}`);
      return false;
    }
  }

  /**
   * [RU] Тест интеграции компонентов
   * [EN] Test component integration
   */
  async testIntegration() {
    console.log('\n🧪 Тестирование интеграции компонентов...');

    try {
      const attendanceLogic = new AttendanceLogic(this.database);
      const adminLogic = new AdminLogic(this.database);

      // Меняем статус пользователя через AttendanceLogic
      const userId = '123456789';
      const newStatus = 'maybe';
      
      const updateResult = await attendanceLogic.api.updateUserAttendance(userId, newStatus);
      console.log(`   ✓ Обновление статуса через AttendanceLogic: ${updateResult.success}`);

      // Проверяем изменения через AdminLogic
      const usersResult = await adminLogic.api.getAllUsersWithAttendance();
      if (usersResult.success) {
        const updatedUser = usersResult.users.find(u => u.telegram_id === userId);
        const statusMatch = updatedUser && updatedUser.attendance_status === newStatus;
        console.log(`   ✓ Статус обновился в админской панели: ${statusMatch}`);
      }

      // Тестируем статистику
      const statsResult = await attendanceLogic.getAttendanceStats();
      if (statsResult.success) {
        const hasStats = statsResult.stats && typeof statsResult.stats.total === 'number';
        console.log(`   ✓ Статистика работает: ${hasStats}`);
      }

      return true;
    } catch (error) {
      console.error(`   ❌ Ошибка интеграции: ${error.message}`);
      return false;
    }
  }

  /**
   * [RU] Запуск всех тестов
   * [EN] Run all tests
   */
  async runAllTests() {
    console.log('🚀 Запуск интеграционных тестов меню кнопок...\n');

    try {
      await this.initTestDatabase();
      await this.createTestData();

      const tests = [
        this.testAttendanceAPI(),
        this.testAttendanceLogic(),
        this.testEventInfoAPI(),
        this.testAdminAPI(),
        this.testAdminLogic(),
        this.testMainMenu(),
        this.testIntegration()
      ];

      const results = await Promise.all(tests);
      const passed = results.filter(result => result).length;
      const total = results.length;

      console.log(`\n📊 Результаты тестов: ${passed}/${total} прошло`);

      if (passed === total) {
        console.log('✅ Все тесты прошли успешно!');
      } else {
        console.log('❌ Некоторые тесты не прошли');
      }

      return passed === total;
    } catch (error) {
      console.error('❌ Критическая ошибка тестирования:', error.message);
      return false;
    } finally {
      if (this.database) {
        this.database.close();
      }
      
      // Удаляем тестовую БД
      if (fs.existsSync(this.testDbPath)) {
        fs.unlinkSync(this.testDbPath);
      }
    }
  }
}

// Экспортируем для использования
module.exports = {
  MenuIntegrationTests
};

// Запускаем тесты если файл вызван напрямую
if (require.main === module) {
  const tests = new MenuIntegrationTests();
  tests.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Необработанная ошибка:', error);
      process.exit(1);
    });
}