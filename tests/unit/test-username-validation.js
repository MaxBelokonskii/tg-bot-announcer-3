/**
 * [RU] Комплексные тесты для поля username в схеме базы данных
 * [EN] Comprehensive tests for username field in database schema
 */

const { getDatabaseConnection } = require('../../database/connection');
const { UserUtils } = require('../../utils/db-utils');
const fs = require('fs');

/**
 * [RU] Тест-сьют для валидации username
 * [EN] Test suite for username validation
 */
class UsernameValidationTests {
  constructor() {
    this.testDbPath = './test_username_database.db';
    this.db = null;
    this.userUtils = null;
    this.testResults = [];
  }

  /**
   * [RU] Инициализация тестовой базы данных
   * [EN] Initialize test database
   */
  async setupTestDatabase() {
    // Удаляем тестовую базу если существует
    if (fs.existsSync(this.testDbPath)) {
      fs.unlinkSync(this.testDbPath);
    }

    // Создаем новое подключение
    const dbConnection = getDatabaseConnection(this.testDbPath);
    this.db = dbConnection.connect();
    this.userUtils = new UserUtils(this.db);

    console.log('✅ Тестовая база данных создана');
  }

  /**
   * [RU] Очистка тестовой базы данных
   * [EN] Cleanup test database
   */
  async cleanupTestDatabase() {
    if (this.db) {
      this.db.close();
    }
    
    if (fs.existsSync(this.testDbPath)) {
      fs.unlinkSync(this.testDbPath);
    }

    console.log('🧹 Тестовая база данных очищена');
  }

  /**
   * [RU] Вспомогательная функция для добавления результата теста
   * [EN] Helper function to add test result
   */
  addTestResult(testName, passed, message = '', actualValue = null, expectedValue = null) {
    this.testResults.push({
      testName,
      passed,
      message,
      actualValue,
      expectedValue,
      timestamp: new Date().toISOString()
    });

    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${message}`);
    
    if (!passed && actualValue !== null && expectedValue !== null) {
      console.log(`   Ожидалось: ${expectedValue}`);
      console.log(`   Получено: ${actualValue}`);
    }
  }

  /**
   * [RU] Тест: Проверка существования поля username в схеме
   * [EN] Test: Check username field exists in schema
   */
  async testUsernameFieldExists() {
    try {
      const schema = this.userUtils.getTableSchema('users');
      const usernameColumn = schema.find(col => col.name === 'username');

      if (usernameColumn) {
        this.addTestResult(
          'Username Field Exists', 
          true, 
          `Поле username найдено с типом ${usernameColumn.type}`
        );

        // Проверяем что поле может быть NULL
        if (!usernameColumn.notnull) {
          this.addTestResult(
            'Username Field Nullable', 
            true, 
            'Поле username корректно разрешает NULL значения'
          );
        } else {
          this.addTestResult(
            'Username Field Nullable', 
            false, 
            'Поле username должно разрешать NULL значения'
          );
        }
      } else {
        this.addTestResult(
          'Username Field Exists', 
          false, 
          'Поле username не найдено в схеме таблицы users'
        );
      }
    } catch (error) {
      this.addTestResult(
        'Username Field Exists', 
        false, 
        `Ошибка проверки схемы: ${error.message}`
      );
    }
  }

  /**
   * [RU] Тест: Проверка индекса для поля username
   * [EN] Test: Check username index exists
   */
  async testUsernameIndexExists() {
    try {
      const indexes = this.db.prepare(`PRAGMA index_list(users)`).all();
      const usernameIndex = indexes.find(idx => idx.name === 'idx_users_username');

      if (usernameIndex) {
        this.addTestResult(
          'Username Index Exists', 
          true, 
          'Индекс idx_users_username найден'
        );
      } else {
        this.addTestResult(
          'Username Index Exists', 
          false, 
          'Индекс idx_users_username не найден'
        );
      }
    } catch (error) {
      this.addTestResult(
        'Username Index Exists', 
        false, 
        `Ошибка проверки индексов: ${error.message}`
      );
    }
  }

  /**
   * [RU] Тест: Валидация username функции
   * [EN] Test: Username validation function
   */
  async testUsernameValidation() {
    const testCases = [
      // Валидные username
      { input: 'valid_user', expected: 'valid_user', description: 'Валидный username' },
      { input: '@valid_user', expected: 'valid_user', description: 'Username с @ префиксом' },
      { input: 'user123', expected: 'user123', description: 'Username с цифрами' },
      { input: 'test_user_name', expected: 'test_user_name', description: 'Username с подчеркиваниями' },
      { input: 'User_123', expected: 'User_123', description: 'Username смешанный регистр' },

      // Невалидные username
      { input: '', expected: null, description: 'Пустая строка' },
      { input: null, expected: null, description: 'NULL значение' },
      { input: undefined, expected: null, description: 'Undefined значение' },
      { input: 'abc', expected: null, description: 'Слишком короткий username (< 5 символов)' },
      { input: 'a'.repeat(33), expected: null, description: 'Слишком длинный username (> 32 символов)' },
      { input: 'invalid-user', expected: null, description: 'Username с дефисом' },
      { input: 'invalid user', expected: null, description: 'Username с пробелом' },
      { input: 'invalid.user', expected: null, description: 'Username с точкой' },
      { input: 'invalid@user', expected: null, description: 'Username с @ в середине' },
      { input: 'user!', expected: null, description: 'Username со спецсимволами' }
    ];

    for (const testCase of testCases) {
      try {
        const result = this.userUtils.validateUsername(testCase.input);
        const passed = result === testCase.expected;
        
        this.addTestResult(
          `Username Validation: ${testCase.description}`,
          passed,
          `Вход: "${testCase.input}" -> Результат: "${result}"`,
          result,
          testCase.expected
        );
      } catch (error) {
        this.addTestResult(
          `Username Validation: ${testCase.description}`,
          false,
          `Ошибка валидации: ${error.message}`
        );
      }
    }
  }

  /**
   * [RU] Тест: Создание пользователя с username
   * [EN] Test: Create user with username
   */
  async testCreateUserWithUsername() {
    const testCases = [
      { telegramId: '12345', fullName: 'Test User 1', username: 'test_user1' },
      { telegramId: '12346', fullName: 'Test User 2', username: '@test_user2' },
      { telegramId: '12347', fullName: 'Test User 3', username: null },
      { telegramId: '12348', fullName: 'Test User 4', username: '' },
      { telegramId: '12349', fullName: 'Test User 5', username: 'invalid!' } // должен стать null
    ];

    for (const testCase of testCases) {
      try {
        const result = this.userUtils.createUser(
          testCase.telegramId, 
          testCase.fullName, 
          testCase.username
        );

        if (result.success) {
          // Проверяем что пользователь создался
          const user = this.userUtils.findUserByTelegramId(testCase.telegramId);
          
          if (user) {
            this.addTestResult(
              `Create User: ${testCase.fullName}`,
              true,
              `Пользователь создан с username: "${user.username}"`
            );

            // Проверяем корректность обработки username
            const expectedUsername = this.userUtils.validateUsername(testCase.username);
            if (user.username === expectedUsername) {
              this.addTestResult(
                `Username Processing: ${testCase.fullName}`,
                true,
                `Username корректно обработан`
              );
            } else {
              this.addTestResult(
                `Username Processing: ${testCase.fullName}`,
                false,
                `Username обработан некорректно`,
                user.username,
                expectedUsername
              );
            }
          } else {
            this.addTestResult(
              `Create User: ${testCase.fullName}`,
              false,
              'Пользователь не найден после создания'
            );
          }
        } else {
          this.addTestResult(
            `Create User: ${testCase.fullName}`,
            false,
            `Ошибка создания пользователя: ${result.error || 'неизвестная ошибка'}`
          );
        }
      } catch (error) {
        this.addTestResult(
          `Create User: ${testCase.fullName}`,
          false,
          `Исключение при создании: ${error.message}`
        );
      }
    }
  }

  /**
   * [RU] Тест: Поиск пользователя по username
   * [EN] Test: Find user by username
   */
  async testFindUserByUsername() {
    try {
      // Создаем тестового пользователя
      this.userUtils.createUser('search_test_123', 'Search Test User', 'search_test');
      
      // Тестируем поиск
      const foundUser = this.userUtils.findUserByUsername('search_test');
      
      if (foundUser && foundUser.username === 'search_test') {
        this.addTestResult(
          'Find User By Username',
          true,
          'Пользователь найден по username'
        );
      } else {
        this.addTestResult(
          'Find User By Username',
          false,
          'Пользователь не найден по username'
        );
      }

      // Тестируем поиск несуществующего username
      const notFoundUser = this.userUtils.findUserByUsername('nonexistent_user');
      
      if (!notFoundUser) {
        this.addTestResult(
          'Find Nonexistent User By Username',
          true,
          'Поиск несуществующего username возвращает null'
        );
      } else {
        this.addTestResult(
          'Find Nonexistent User By Username',
          false,
          'Поиск несуществующего username должен возвращать null'
        );
      }
    } catch (error) {
      this.addTestResult(
        'Find User By Username',
        false,
        `Ошибка поиска: ${error.message}`
      );
    }
  }

  /**
   * [RU] Тест: Обновление username
   * [EN] Test: Update username
   */
  async testUpdateUsername() {
    try {
      // Создаем пользователя
      this.userUtils.createUser('update_test_123', 'Update Test User', 'old_username');
      
      // Обновляем username
      const updateResult = this.userUtils.updateUsername('update_test_123', 'new_username');
      
      if (updateResult.success) {
        // Проверяем что username обновился
        const user = this.userUtils.findUserByTelegramId('update_test_123');
        
        if (user && user.username === 'new_username') {
          this.addTestResult(
            'Update Username',
            true,
            'Username успешно обновлен'
          );
        } else {
          this.addTestResult(
            'Update Username',
            false,
            'Username не обновился в базе данных',
            user ? user.username : 'user not found',
            'new_username'
          );
        }
      } else {
        this.addTestResult(
          'Update Username',
          false,
          'Ошибка обновления username'
        );
      }
    } catch (error) {
      this.addTestResult(
        'Update Username',
        false,
        `Исключение при обновлении: ${error.message}`
      );
    }
  }

  /**
   * [RU] Тест: Поиск пользователей по частичному username
   * [EN] Test: Search users by partial username
   */
  async testSearchUsersByUsername() {
    try {
      // Создаем тестовых пользователей
      this.userUtils.createUser('search1_123', 'Search User 1', 'searchable_user1');
      this.userUtils.createUser('search2_123', 'Search User 2', 'searchable_user2');
      this.userUtils.createUser('search3_123', 'Search User 3', 'different_name');
      
      // Тестируем поиск
      const searchResults = this.userUtils.searchUsersByUsername('searchable');
      
      if (searchResults.length === 2) {
        this.addTestResult(
          'Search Users By Username',
          true,
          `Найдено ${searchResults.length} пользователей по частичному username`
        );
      } else {
        this.addTestResult(
          'Search Users By Username',
          false,
          `Ожидалось 2 пользователя, найдено ${searchResults.length}`,
          searchResults.length,
          2
        );
      }
    } catch (error) {
      this.addTestResult(
        'Search Users By Username',
        false,
        `Ошибка поиска: ${error.message}`
      );
    }
  }

  /**
   * [RU] Тест: Обратная совместимость
   * [EN] Test: Backward compatibility
   */
  async testBackwardCompatibility() {
    try {
      // Создаем пользователя старым способом (без username)
      const oldWayResult = this.userUtils.createUser('backward_test_123', 'Backward Test User');
      
      if (oldWayResult.success) {
        const user = this.userUtils.findUserByTelegramId('backward_test_123');
        
        if (user && user.username === null) {
          this.addTestResult(
            'Backward Compatibility',
            true,
            'Создание пользователя без username работает корректно'
          );
        } else {
          this.addTestResult(
            'Backward Compatibility',
            false,
            'Username должен быть null при создании без него',
            user ? user.username : 'user not found',
            null
          );
        }
      } else {
        this.addTestResult(
          'Backward Compatibility',
          false,
          'Не удалось создать пользователя старым способом'
        );
      }
    } catch (error) {
      this.addTestResult(
        'Backward Compatibility',
        false,
        `Ошибка обратной совместимости: ${error.message}`
      );
    }
  }

  /**
   * [RU] Запуск всех тестов
   * [EN] Run all tests
   */
  async runAllTests() {
    console.log('🧪 Запуск тестов валидации username...\n');

    try {
      await this.setupTestDatabase();

      // Тесты схемы базы данных
      await this.testUsernameFieldExists();
      await this.testUsernameIndexExists();

      // Тесты валидации
      await this.testUsernameValidation();

      // Тесты операций с базой данных
      await this.testCreateUserWithUsername();
      await this.testFindUserByUsername();
      await this.testUpdateUsername();
      await this.testSearchUsersByUsername();
      await this.testBackwardCompatibility();

    } finally {
      await this.cleanupTestDatabase();
    }

    return this.generateTestReport();
  }

  /**
   * [RU] Генерация отчета о тестировании
   * [EN] Generate test report
   */
  generateTestReport() {
    const passedTests = this.testResults.filter(r => r.passed).length;
    const totalTests = this.testResults.length;
    const failedTests = totalTests - passedTests;

    const report = {
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        passRate: ((passedTests / totalTests) * 100).toFixed(1) + '%'
      },
      results: this.testResults,
      timestamp: new Date().toISOString()
    };

    console.log('\n📊 Результаты тестирования:');
    console.log(`   Всего тестов: ${totalTests}`);
    console.log(`   Пройдено: ${passedTests}`);
    console.log(`   Провалено: ${failedTests}`);
    console.log(`   Процент успеха: ${report.summary.passRate}`);

    if (failedTests > 0) {
      console.log('\n❌ Провалившиеся тесты:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(test => {
          console.log(`   - ${test.testName}: ${test.message}`);
        });
    }

    return report;
  }
}

// Запускаем тесты если файл вызван напрямую
if (require.main === module) {
  const tests = new UsernameValidationTests();
  tests.runAllTests()
    .then(report => {
      if (report.summary.failed > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Критическая ошибка тестирования:', error.message);
      process.exit(1);
    });
}

module.exports = { UsernameValidationTests };