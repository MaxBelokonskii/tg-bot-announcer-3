/**
 * [RU] Миграция для добавления расширенного логирования доставки сообщений
 * [EN] Migration for adding enhanced message delivery logging
 */

const path = require('path');
const Database = require('better-sqlite3');

/**
 * [RU] Выполняет миграцию для создания таблицы enhanced_delivery_logs
 * [EN] Executes migration to create enhanced_delivery_logs table
 */
function runEnhancedDeliveryLogsMigration(databasePath) {
  let db;
  
  try {
    console.log('🔄 Начинается миграция enhanced_delivery_logs...');
    
    // Открываем подключение к базе данных
    db = new Database(databasePath);
    
    // Проверяем, существует ли уже таблица
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='enhanced_delivery_logs'
    `).get();
    
    if (tableExists) {
      console.log('ℹ️ Таблица enhanced_delivery_logs уже существует, пропускаем создание');
      return { success: true, message: 'Таблица уже существует' };
    }
    
    // Начинаем транзакцию
    const migration = db.transaction(() => {
      // Создаем новую таблицу enhanced_delivery_logs
      db.exec(`
        CREATE TABLE enhanced_delivery_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          admin_message_id TEXT NOT NULL,
          sequence_step TEXT NOT NULL CHECK (sequence_step IN ('admin_message', 'useful_info', 'event_details', 'menu_trigger')),
          delivery_status TEXT NOT NULL CHECK (delivery_status IN ('delivered', 'failed', 'skipped')),
          delivery_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          error_message TEXT,
          sequence_id TEXT,
          completion_rate REAL DEFAULT 0.0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      
      // Создаем индексы для оптимизации производительности
      db.exec(`
        CREATE INDEX idx_enhanced_delivery_user_message 
        ON enhanced_delivery_logs(user_id, admin_message_id);
      `);
      
      db.exec(`
        CREATE INDEX idx_enhanced_delivery_timestamp 
        ON enhanced_delivery_logs(delivery_timestamp);
      `);
      
      db.exec(`
        CREATE INDEX idx_enhanced_delivery_status 
        ON enhanced_delivery_logs(delivery_status);
      `);
      
      db.exec(`
        CREATE INDEX idx_enhanced_delivery_sequence 
        ON enhanced_delivery_logs(sequence_id);
      `);
      
      db.exec(`
        CREATE INDEX idx_enhanced_delivery_step 
        ON enhanced_delivery_logs(sequence_step);
      `);
      
      // Добавляем новые поля к таблице admin_messages
      try {
        db.exec(`
          ALTER TABLE admin_messages 
          ADD COLUMN enhanced_mode BOOLEAN DEFAULT FALSE;
        `);
        console.log('✅ Добавлено поле enhanced_mode к таблице admin_messages');
      } catch (error) {
        if (!error.message.includes('duplicate column name')) {
          throw error;
        }
        console.log('ℹ️ Поле enhanced_mode уже существует в таблице admin_messages');
      }
      
      try {
        db.exec(`
          ALTER TABLE admin_messages 
          ADD COLUMN sequence_completion_rate REAL DEFAULT 0.0;
        `);
        console.log('✅ Добавлено поле sequence_completion_rate к таблице admin_messages');
      } catch (error) {
        if (!error.message.includes('duplicate column name')) {
          throw error;
        }
        console.log('ℹ️ Поле sequence_completion_rate уже существует в таблице admin_messages');
      }
      
      try {
        db.exec(`
          ALTER TABLE admin_messages 
          ADD COLUMN eligible_users_count INTEGER DEFAULT 0;
        `);
        console.log('✅ Добавлено поле eligible_users_count к таблице admin_messages');
      } catch (error) {
        if (!error.message.includes('duplicate column name')) {
          throw error;
        }
        console.log('ℹ️ Поле eligible_users_count уже существует в таблице admin_messages');
      }
      
      console.log('✅ Таблица enhanced_delivery_logs создана успешно');
      console.log('✅ Все индексы созданы успешно');
    });
    
    // Выполняем миграцию
    migration();
    
    // Проверяем, что таблица создана корректно
    const newTableInfo = db.prepare(`
      PRAGMA table_info(enhanced_delivery_logs)
    `).all();
    
    console.log('📋 Структура таблицы enhanced_delivery_logs:');
    newTableInfo.forEach(column => {
      console.log(`  - ${column.name}: ${column.type} ${column.notnull ? 'NOT NULL' : ''}`);
    });
    
    // Проверяем индексы
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='enhanced_delivery_logs'
    `).all();
    
    console.log('📋 Созданные индексы:');
    indexes.forEach(index => {
      console.log(`  - ${index.name}`);
    });
    
    console.log('✅ Миграция enhanced_delivery_logs завершена успешно');
    
    return { 
      success: true, 
      message: 'Миграция выполнена успешно',
      tableInfo: newTableInfo,
      indexes: indexes
    };
    
  } catch (error) {
    console.error('❌ Ошибка выполнения миграции enhanced_delivery_logs:', error.message);
    return { 
      success: false, 
      error: error.message,
      stack: error.stack
    };
  } finally {
    if (db) {
      try {
        db.close();
        console.log('🔒 Подключение к базе данных закрыто');
      } catch (closeError) {
        console.error('❌ Ошибка закрытия подключения:', closeError.message);
      }
    }
  }
}

/**
 * [RU] Проверяет статус миграции
 * [EN] Checks migration status
 */
function checkMigrationStatus(databasePath) {
  let db;
  
  try {
    db = new Database(databasePath);
    
    // Проверяем существование таблицы
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='enhanced_delivery_logs'
    `).get();
    
    if (!tableExists) {
      return { migrated: false, reason: 'Таблица enhanced_delivery_logs не существует' };
    }
    
    // Проверяем структуру таблицы
    const columns = db.prepare(`PRAGMA table_info(enhanced_delivery_logs)`).all();
    const expectedColumns = [
      'id', 'user_id', 'admin_message_id', 'sequence_step', 
      'delivery_status', 'delivery_timestamp', 'error_message', 
      'sequence_id', 'completion_rate'
    ];
    
    const actualColumns = columns.map(col => col.name);
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
    
    if (missingColumns.length > 0) {
      return { 
        migrated: false, 
        reason: `Отсутствуют столбцы: ${missingColumns.join(', ')}` 
      };
    }
    
    // Проверяем индексы
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='enhanced_delivery_logs'
    `).all();
    
    return { 
      migrated: true, 
      tableColumns: actualColumns.length,
      indexCount: indexes.length,
      details: {
        columns: actualColumns,
        indexes: indexes.map(idx => idx.name)
      }
    };
    
  } catch (error) {
    return { 
      migrated: false, 
      reason: `Ошибка проверки: ${error.message}` 
    };
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Если файл запущен напрямую, выполняем миграцию
if (require.main === module) {
  const databasePath = process.argv[2] || path.join(__dirname, '../tgbot.db');
  
  console.log(`🗄️ Использование базы данных: ${databasePath}`);
  
  // Проверяем текущий статус
  const status = checkMigrationStatus(databasePath);
  
  if (status.migrated) {
    console.log('✅ Миграция уже выполнена');
    console.log(`📊 Столбцов: ${status.tableColumns}, индексов: ${status.indexCount}`);
  } else {
    console.log(`⚠️ Требуется миграция: ${status.reason}`);
    
    // Выполняем миграцию
    const result = runEnhancedDeliveryLogsMigration(databasePath);
    
    if (result.success) {
      console.log('🎉 Миграция завершена успешно!');
    } else {
      console.error('💥 Миграция не удалась:', result.error);
      process.exit(1);
    }
  }
}

module.exports = {
  runEnhancedDeliveryLogsMigration,
  checkMigrationStatus
};