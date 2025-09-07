#!/usr/bin/env node

/**
 * [RU] CLI скрипт для создания новых тестов
 * [EN] CLI script for creating new tests
 */

const fs = require('fs');
const path = require('path');

// Конфигурация типов тестов
const TEST_TYPES = {
  unit: {
    template: 'unit-test.template.js',
    directory: 'unit',
    placeholders: ['MODULE_NAME'],
    description: 'Модульные тесты отдельных функций и модулей'
  },
  integration: {
    template: 'integration-test.template.js',
    directory: 'integration',
    placeholders: ['FEATURE_NAME'],
    description: 'Интеграционные тесты взаимодействия компонентов'
  },
  debug: {
    template: 'debug-test.template.js',
    directory: 'debug',
    placeholders: ['DEBUG_NAME'],
    description: 'Отладочные тесты для диагностики проблем'
  },
  isolated: {
    template: 'isolated-test.template.js',
    directory: 'isolated',
    placeholders: ['ISOLATED_NAME'],
    description: 'Изолированные тесты компонентов'
  }
};

/**
 * [RU] Отображение справки по использованию
 * [EN] Display usage help
 */
function showHelp() {
  console.log('🧪 Создание нового теста\n');
  console.log('Использование: npm run create-test <type> <name>\n');
  console.log('Типы тестов:');
  
  Object.entries(TEST_TYPES).forEach(([type, config]) => {
    console.log(`  ${type.padEnd(12)} - ${config.description}`);
  });
  
  console.log('\nПримеры:');
  console.log('  npm run create-test unit user-validation');
  console.log('  npm run create-test integration attendance-flow');
  console.log('  npm run create-test debug menu-buttons');
  console.log('  npm run create-test isolated simple-functions');
  
  console.log('\nСоздаваемые файлы размещаются в директории tests/<type>/');
}

/**
 * [RU] Создание теста на основе шаблона
 * [EN] Create test from template
 */
function createTest(type, name) {
  // Проверяем валидность типа
  if (!TEST_TYPES[type]) {
    console.error(`❌ Неизвестный тип теста: ${type}`);
    console.log('Доступные типы:', Object.keys(TEST_TYPES).join(', '));
    return false;
  }
  
  const config = TEST_TYPES[type];
  const templatePath = path.join(__dirname, 'templates', config.template);
  const testDir = path.join(__dirname, '..', config.directory);
  const testPath = path.join(testDir, `test-${name}.js`);
  
  // Проверяем существование шаблона
  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Шаблон не найден: ${templatePath}`);
    return false;
  }
  
  // Убеждаемся что директория существует
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
    console.log(`📁 Создана директория: ${testDir}`);
  }
  
  // Проверяем существование файла
  if (fs.existsSync(testPath)) {
    console.error(`❌ Файл уже существует: ${testPath}`);
    return false;
  }
  
  try {
    // Читаем шаблон и заменяем плейсхолдеры
    let template = fs.readFileSync(templatePath, 'utf8');
    
    // Заменяем плейсхолдеры в зависимости от типа теста
    config.placeholders.forEach(placeholder => {
      const regex = new RegExp(placeholder, 'g');
      template = template.replace(regex, name);
    });
    
    // Записываем новый тест
    fs.writeFileSync(testPath, template);
    
    console.log(`✅ Создан тест: ${testPath}`);
    console.log(`📝 Тип: ${config.description}`);
    console.log(`🎯 Шаблон: ${config.template}`);
    
    // Показываем следующие шаги
    console.log('\n📋 Следующие шаги:');
    console.log(`1. Отредактируйте файл: ${testPath}`);
    console.log(`2. Добавьте необходимые импорты и логику тестирования`);
    console.log(`3. Запустите тест: npm run test:${type}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка создания теста:', error.message);
    return false;
  }
}

/**
 * [RU] Создание временной директории для тестов
 * [EN] Create temporary directory for tests
 */
function ensureTmpDirectory() {
  const tmpDir = path.join(__dirname, '..', 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
    console.log(`📁 Создана временная директория: ${tmpDir}`);
  }
}

/**
 * [RU] Основная функция
 * [EN] Main function
 */
function main() {
  const [, , type, name] = process.argv;
  
  // Проверяем аргументы
  if (!type || !name) {
    showHelp();
    process.exit(1);
  }
  
  // Создаем временную директорию если нужно
  ensureTmpDirectory();
  
  // Создаем тест
  const success = createTest(type, name);
  process.exit(success ? 0 : 1);
}

// Запуск если вызван напрямую
if (require.main === module) {
  main();
}

module.exports = {
  createTest,
  TEST_TYPES,
  showHelp
};