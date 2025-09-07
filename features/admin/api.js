/**
 * [RU] API для администрирования и управления списком гостей
 * [EN] Administration and guest list management API
 */

const { DatabaseUtils } = require('../../utils/db-utils');

/**
 * [RU] Класс API для администрирования
 * [EN] Administration API class
 */
class AdminAPI extends DatabaseUtils {
  constructor(database) {
    super(database);
  }

  /**
   * [RU] Получение всех пользователей с их статусами присутствия
   * [EN] Get all users with their attendance statuses
   */
  async getAllUsersWithAttendance() {
    try {
      const query = `
        SELECT 
          id,
          telegram_id,
          full_name,
          attendance_status,
          attendance_updated_at,
          created_at
        FROM users 
        ORDER BY attendance_status, full_name
      `;

      const users = this.getMany(query);
      
      console.log(`📊 Получен список из ${users.length} пользователей`);
      
      return { success: true, users };
    } catch (error) {
      console.error('❌ Ошибка получения списка пользователей с присутствием:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение статистики пользователей
   * [EN] Get user statistics
   */
  async getUserStatistics() {
    try {
      const totalQuery = `SELECT COUNT(*) as total FROM users`;
      const totalResult = this.getOne(totalQuery);
      
      const recentQuery = `
        SELECT COUNT(*) as recent 
        FROM users 
        WHERE created_at >= datetime('now', '-30 days')
      `;
      const recentResult = this.getOne(recentQuery);

      const stats = {
        total: totalResult.total || 0,
        recent: recentResult.recent || 0
      };

      return { success: true, stats };
    } catch (error) {
      console.error('❌ Ошибка получения статистики пользователей:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение статистики присутствия
   * [EN] Get attendance statistics
   */
  async getAttendanceStatistics() {
    try {
      const query = `
        SELECT 
          attendance_status,
          COUNT(*) as count
        FROM users 
        GROUP BY attendance_status
      `;

      const results = this.getMany(query);
      
      // Инициализируем статистику с нулевыми значениями
      const stats = {
        attending: 0,
        not_attending: 0,
        maybe: 0,
        total: 0
      };

      // Заполняем реальными данными
      results.forEach(row => {
        const status = row.attendance_status || 'attending';
        if (stats.hasOwnProperty(status)) {
          stats[status] = row.count;
        }
        stats.total += row.count;
      });

      return { success: true, stats };
    } catch (error) {
      console.error('❌ Ошибка получения статистики присутствия:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение пользователей по статусу присутствия
   * [EN] Get users by attendance status
   */
  async getUsersByAttendanceStatus(status) {
    try {
      const validStatuses = ['attending', 'not_attending', 'maybe'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid attendance status: ${status}`);
      }

      const query = `
        SELECT 
          id,
          telegram_id,
          full_name,
          attendance_updated_at,
          created_at
        FROM users 
        WHERE attendance_status = ?
        ORDER BY full_name
      `;

      const users = await this.database.all(query, [status]);
      
      return { success: true, users, status, count: users.length };
    } catch (error) {
      console.error(`❌ Ошибка получения пользователей со статусом ${status}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение детальной информации о пользователе
   * [EN] Get detailed user information
   */
  async getUserDetails(userId) {
    try {
      const userQuery = `
        SELECT 
          id,
          telegram_id,
          full_name,
          attendance_status,
          attendance_updated_at,
          created_at,
          updated_at
        FROM users 
        WHERE telegram_id = ?
      `;

      const user = await this.database.get(userQuery, [userId]);
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Получаем количество ответов пользователя
      const responsesQuery = `
        SELECT COUNT(*) as response_count 
        FROM user_responses 
        WHERE user_id = ?
      `;
      
      const responsesResult = await this.database.get(responsesQuery, [user.id]);
      
      user.response_count = responsesResult.response_count || 0;

      return { success: true, user };
    } catch (error) {
      console.error('❌ Ошибка получения детальной информации о пользователе:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение активности пользователей за период
   * [EN] Get user activity for period
   */
  async getUserActivity(days = 30) {
    try {
      const query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as registrations
        FROM users 
        WHERE created_at >= datetime('now', '-${days} days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

      const activity = await this.database.all(query);
      
      return { success: true, activity, period: days };
    } catch (error) {
      console.error('❌ Ошибка получения активности пользователей:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Поиск пользователей по имени
   * [EN] Search users by name
   */
  async searchUsersByName(searchTerm) {
    try {
      const query = `
        SELECT 
          id,
          telegram_id,
          full_name,
          attendance_status,
          created_at
        FROM users 
        WHERE full_name LIKE ?
        ORDER BY full_name
        LIMIT 50
      `;

      const users = await this.database.all(query, [`%${searchTerm}%`]);
      
      return { success: true, users, searchTerm, count: users.length };
    } catch (error) {
      console.error('❌ Ошибка поиска пользователей по имени:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обновление статуса присутствия администратором
   * [EN] Update attendance status by admin
   */
  async adminUpdateUserAttendance(targetUserId, status, adminUserId) {
    try {
      const validStatuses = ['attending', 'not_attending', 'maybe'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid attendance status: ${status}`);
      }

      const query = `
        UPDATE users 
        SET attendance_status = ?, 
            attendance_updated_at = CURRENT_TIMESTAMP 
        WHERE telegram_id = ?
      `;

      const result = await this.database.run(query, [status, targetUserId]);
      
      if (result.changes === 0) {
        throw new Error(`User ${targetUserId} not found`);
      }

      console.log(`✅ Администратор ${adminUserId} изменил статус пользователя ${targetUserId} на: ${status}`);
      
      return { 
        success: true, 
        status,
        targetUserId,
        adminUserId,
        updated_at: new Date().toISOString() 
      };
    } catch (error) {
      console.error('❌ Ошибка административного обновления статуса:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение логов изменений статуса присутствия
   * [EN] Get attendance status change logs
   */
  async getAttendanceChangeLogs(limit = 100) {
    try {
      // В будущем можно создать отдельную таблицу для логов
      // Пока используем информацию об обновлениях из таблицы users
      const query = `
        SELECT 
          telegram_id,
          full_name,
          attendance_status,
          attendance_updated_at
        FROM users 
        WHERE attendance_updated_at IS NOT NULL
        ORDER BY attendance_updated_at DESC
        LIMIT ?
      `;

      const logs = await this.database.all(query, [limit]);
      
      return { success: true, logs, count: logs.length };
    } catch (error) {
      console.error('❌ Ошибка получения логов изменений присутствия:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение общей статистики системы
   * [EN] Get overall system statistics
   */
  async getSystemStatistics() {
    try {
      const userStats = await this.getUserStatistics();
      const attendanceStats = await this.getAttendanceStatistics();
      
      // Получаем статистику ответов
      const responsesQuery = `SELECT COUNT(*) as total FROM user_responses`;
      const responsesResult = await this.database.get(responsesQuery);
      
      // Получаем статистику сообщений
      const messagesQuery = `SELECT COUNT(*) as total FROM scheduled_messages`;
      const messagesResult = await this.database.get(messagesQuery);

      const systemStats = {
        users: userStats.success ? userStats.stats : { total: 0, recent: 0 },
        attendance: attendanceStats.success ? attendanceStats.stats : { attending: 0, not_attending: 0, maybe: 0, total: 0 },
        responses: responsesResult.total || 0,
        messages: messagesResult.total || 0,
        timestamp: new Date().toISOString()
      };

      return { success: true, stats: systemStats };
    } catch (error) {
      console.error('❌ Ошибка получения системной статистики:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = {
  AdminAPI
};