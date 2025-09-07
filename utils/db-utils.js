/**
 * [RU] Вспомогательные функции для работы с базой данных
 * [EN] Database utility functions
 */

/**
 * [RU] Базовый класс для операций с базой данных
 * [EN] Base class for database operations
 */
class DatabaseUtils {
  constructor(database) {
    this.db = database;
  }

  /**
   * [RU] Выполнение SQL запроса с параметрами
   * [EN] Execute SQL query with parameters
   */
  executeQuery(query, params = []) {
    try {
      const stmt = this.db.prepare(query);
      return stmt.run(...params);
    } catch (error) {
      console.error('❌ Ошибка выполнения запроса:', error.message);
      console.error('SQL:', query);
      console.error('Параметры:', params);
      throw error;
    }
  }

  /**
   * [RU] Получение одной записи
   * [EN] Get single record
   */
  getOne(query, params = []) {
    try {
      const stmt = this.db.prepare(query);
      return stmt.get(...params);
    } catch (error) {
      console.error('❌ Ошибка получения записи:', error.message);
      throw error;
    }
  }

  /**
   * [RU] Получение множественных записей
   * [EN] Get multiple records
   */
  getMany(query, params = []) {
    try {
      const stmt = this.db.prepare(query);
      return stmt.all(...params);
    } catch (error) {
      console.error('❌ Ошибка получения записей:', error.message);
      throw error;
    }
  }

  /**
   * [RU] Проверка существования таблицы
   * [EN] Check if table exists
   */
  tableExists(tableName) {
    const query = `
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `;
    const result = this.getOne(query, [tableName]);
    return !!result;
  }

  /**
   * [RU] Получение количества записей в таблице
   * [EN] Get record count in table
   */
  getCount(tableName, whereClause = '', params = []) {
    const query = `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`;
    const result = this.getOne(query, params);
    return result ? result.count : 0;
  }

  /**
   * [RU] Проверка существования записи
   * [EN] Check if record exists
   */
  recordExists(tableName, whereClause, params = []) {
    const query = `SELECT 1 FROM ${tableName} WHERE ${whereClause} LIMIT 1`;
    const result = this.getOne(query, params);
    return !!result;
  }

  /**
   * [RU] Обновление записи с возвратом информации об изменениях
   * [EN] Update record with change information
   */
  updateRecord(query, params = []) {
    const result = this.executeQuery(query, params);
    return {
      success: result.changes > 0,
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    };
  }

  /**
   * [RU] Вставка записи с возвратом ID
   * [EN] Insert record with ID return
   */
  insertRecord(query, params = []) {
    const result = this.executeQuery(query, params);
    return {
      success: result.changes > 0,
      id: result.lastInsertRowid,
      changes: result.changes
    };
  }

  /**
   * [RU] Удаление записей с подтверждением
   * [EN] Delete records with confirmation
   */
  deleteRecords(query, params = []) {
    const result = this.executeQuery(query, params);
    return {
      success: result.changes > 0,
      deletedCount: result.changes
    };
  }

  /**
   * [RU] Получение информации о схеме таблицы
   * [EN] Get table schema information
   */
  getTableSchema(tableName) {
    const query = `PRAGMA table_info(${tableName})`;
    return this.getMany(query);
  }

  /**
   * [RU] Выполнение транзакции
   * [EN] Execute transaction
   */
  executeTransaction(operations) {
    const transaction = this.db.transaction(() => {
      const results = [];
      for (const operation of operations) {
        const result = this.executeQuery(operation.query, operation.params || []);
        results.push(result);
      }
      return results;
    });

    try {
      return transaction();
    } catch (error) {
      console.error('❌ Ошибка транзакции:', error.message);
      throw error;
    }
  }

  /**
   * [RU] Очистка таблицы с сохранением структуры
   * [EN] Clear table while preserving structure
   */
  clearTable(tableName) {
    const query = `DELETE FROM ${tableName}`;
    return this.executeQuery(query);
  }

  /**
   * [RU] Получение статистики по таблице
   * [EN] Get table statistics
   */
  getTableStats(tableName) {
    return {
      totalRecords: this.getCount(tableName),
      schema: this.getTableSchema(tableName),
      exists: this.tableExists(tableName)
    };
  }
}

/**
 * [RU] Специализированные утилиты для каждой таблицы
 * [EN] Specialized utilities for each table
 */

class UserUtils extends DatabaseUtils {
  /**
   * [RU] Создание пользователя
   * [EN] Create user
   */
  createUser(telegramId, fullName, username = null) {
    const query = `
      INSERT INTO users (telegram_id, full_name, username) 
      VALUES (?, ?, ?)
    `;
    return this.insertRecord(query, [telegramId, fullName, this.validateUsername(username)]);
  }

  /**
   * [RU] Поиск пользователя по Telegram ID
   * [EN] Find user by Telegram ID
   */
  findUserByTelegramId(telegramId) {
    const query = `SELECT * FROM users WHERE telegram_id = ?`;
    return this.getOne(query, [telegramId]);
  }

  /**
   * [RU] Поиск пользователя по username
   * [EN] Find user by username
   */
  findUserByUsername(username) {
    if (!username) return null;
    const cleanUsername = this.validateUsername(username);
    if (!cleanUsername) return null;
    
    const query = `SELECT * FROM users WHERE username = ?`;
    return this.getOne(query, [cleanUsername]);
  }

  /**
   * [RU] Получение всех пользователей
   * [EN] Get all users
   */
  getAllUsers() {
    const query = `
      SELECT id, telegram_id, username, full_name, 
             attendance_status, attendance_updated_at, 
             created_at, updated_at 
      FROM users 
      ORDER BY created_at DESC
    `;
    return this.getMany(query);
  }

  /**
   * [RU] Обновление информации пользователя
   * [EN] Update user information
   */
  updateUser(userId, data) {
    // Валидируем username если он присутствует
    if (data.hasOwnProperty('username')) {
      data.username = this.validateUsername(data.username);
    }

    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = Object.values(data);
    values.push(userId);

    const query = `UPDATE users SET ${fields} WHERE id = ?`;
    return this.updateRecord(query, values);
  }

  /**
   * [RU] Обновление username пользователя
   * [EN] Update user username
   */
  updateUsername(telegramId, username) {
    const validatedUsername = this.validateUsername(username);
    const query = `
      UPDATE users 
      SET username = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE telegram_id = ?
    `;
    return this.updateRecord(query, [validatedUsername, telegramId]);
  }

  /**
   * [RU] Валидация username
   * [EN] Validate username
   */
  validateUsername(username) {
    if (!username || typeof username !== 'string') return null;

    // Удаляем @ префикс если он есть
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

    // Проверяем длину username
    if (cleanUsername.length < 5 || cleanUsername.length > 32) {
      return null;
    }

    // Только буквы, цифры и подчеркивания
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(cleanUsername)) {
      return null;
    }

    return cleanUsername;
  }

  /**
   * [RU] Поиск пользователей по частичному совпадению username
   * [EN] Search users by partial username match
   */
  searchUsersByUsername(partialUsername) {
    if (!partialUsername || typeof partialUsername !== 'string') return [];
    
    const searchTerm = `%${partialUsername}%`;
    const query = `
      SELECT id, telegram_id, username, full_name, attendance_status 
      FROM users 
      WHERE username LIKE ? 
      ORDER BY username ASC
      LIMIT 20
    `;
    return this.getMany(query, [searchTerm]);
  }
}

class MessageUtils extends DatabaseUtils {
  /**
   * Создание запланированного сообщения
   */
  createScheduledMessage(messageText, sendDate) {
    const query = `
      INSERT INTO scheduled_messages (message_text, send_date) 
      VALUES (?, ?)
    `;
    return this.insertRecord(query, [messageText, sendDate]);
  }

  /**
   * Получение готовых к отправке сообщений
   */
  getDueMessages() {
    const query = `
      SELECT * FROM scheduled_messages 
      WHERE send_date <= datetime('now') AND status = 'pending'
      ORDER BY send_date ASC
    `;
    return this.getMany(query);
  }

  /**
   * Обновление статуса сообщения
   */
  updateMessageStatus(messageId, status) {
    const query = `
      UPDATE scheduled_messages 
      SET status = ? 
      WHERE id = ?
    `;
    return this.updateRecord(query, [status, messageId]);
  }
}

class ResponseUtils extends DatabaseUtils {
  /**
   * Сохранение ответа пользователя
   */
  saveUserResponse(userId, message) {
    const query = `
      INSERT INTO user_responses (user_id, message) 
      VALUES (?, ?)
    `;
    return this.insertRecord(query, [userId, message]);
  }

  /**
   * Получение ответов пользователя
   */
  getUserResponses(userId) {
    const query = `
      SELECT * FROM user_responses 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `;
    return this.getMany(query, [userId]);
  }

  /**
   * Получение всех ответов
   */
  getAllResponses() {
    const query = `
      SELECT ur.*, u.full_name, u.telegram_id 
      FROM user_responses ur
      JOIN users u ON ur.user_id = u.id
      ORDER BY ur.created_at DESC
    `;
    return this.getMany(query);
  }
}

class DeliveryLogUtils extends DatabaseUtils {
  /**
   * Логирование доставки сообщения
   */
  logDelivery(userId, messageId, status, errorMessage = null) {
    const query = `
      INSERT INTO delivery_logs (user_id, message_id, status, error_message) 
      VALUES (?, ?, ?, ?)
    `;
    return this.insertRecord(query, [userId, messageId, status, errorMessage]);
  }

  /**
   * Получение статистики доставки
   */
  getDeliveryStats(messageId = null) {
    let query = `
      SELECT 
        status, 
        COUNT(*) as count 
      FROM delivery_logs
    `;
    
    const params = [];
    if (messageId) {
      query += ` WHERE message_id = ?`;
      params.push(messageId);
    }
    
    query += ` GROUP BY status`;
    return this.getMany(query, params);
  }
}

module.exports = {
  DatabaseUtils,
  UserUtils,
  MessageUtils,
  ResponseUtils,
  DeliveryLogUtils
};