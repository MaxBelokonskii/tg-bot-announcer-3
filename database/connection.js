const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * [RU] Управление подключением к SQLite базе данных
 * [EN] SQLite database connection management
 */
class DatabaseConnection {
  constructor(dbPath = 'bot_database.db') {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * [RU] Инициализация подключения к базе данных
   * [EN] Initialize database connection
   */
  connect() {
    try {
      // Создаем подключение к SQLite
      this.db = new Database(this.dbPath, { 
        verbose: process.env.NODE_ENV === 'development' ? console.log : null 
      });

      // Включаем поддержку внешних ключей
      this.db.pragma('foreign_keys = ON');
      
      // Инициализируем схему если база данных пустая
      this.initializeSchema();

      console.log(`✅ Подключение к базе данных установлено: ${this.dbPath}`);
      return this.db;
    } catch (error) {
      console.error('❌ Ошибка подключения к базе данных:', error.message);
      throw error;
    }
  }

  /**
   * [RU] Инициализация схемы базы данных
   * [EN] Initialize database schema
   */
  initializeSchema() {
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      
      if (!fs.existsSync(schemaPath)) {
        throw new Error(`Файл схемы не найден: ${schemaPath}`);
      }

      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Выполняем SQL команды для создания таблиц
      this.db.exec(schema);
      
      console.log('📊 Схема базы данных инициализирована');
    } catch (error) {
      console.error('❌ Ошибка инициализации схемы:', error.message);
      throw error;
    }
  }

  /**
   * [RU] Получение экземпляра базы данных
   * [EN] Get database instance
   */
  getDatabase() {
    if (!this.db) {
      throw new Error('База данных не инициализирована. Вызовите connect() сначала.');
    }
    return this.db;
  }

  /**
   * [RU] Закрытие подключения к базе данных
   * [EN] Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('🔒 Подключение к базе данных закрыто');
    }
  }

  /**
   * [RU] Проверка состояния подключения
   * [EN] Check connection status
   */
  isConnected() {
    return this.db && this.db.open;
  }

  /**
   * [RU] Выполнение транзакции
   * [EN] Execute transaction
   */
  transaction(callback) {
    if (!this.db) {
      throw new Error('База данных не инициализирована');
    }

    const transaction = this.db.transaction(callback);
    return transaction;
  }

  /**
   * [RU] Создание резервной копии базы данных
   * [EN] Create database backup
   */
  backup(backupPath) {
    if (!this.db) {
      throw new Error('База данных не инициализирована');
    }

    try {
      this.db.backup(backupPath);
      console.log(`💾 Резервная копия создана: ${backupPath}`);
    } catch (error) {
      console.error('❌ Ошибка создания резервной копии:', error.message);
      throw error;
    }
  }
}

// Singleton экземпляр для глобального использования
let dbConnection = null;

/**
 * [RU] Получение singleton экземпляра подключения к БД
 * [EN] Get singleton database connection instance
 */
function getDatabaseConnection(dbPath) {
  if (!dbConnection) {
    dbConnection = new DatabaseConnection(dbPath);
  }
  return dbConnection;
}

module.exports = {
  DatabaseConnection,
  getDatabaseConnection
};