/**
 * [RU] API для управления присутствием пользователей
 * [EN] User attendance management API
 */

const { DatabaseUtils } = require('../../utils/db-utils');

/**
 * [RU] Класс API для управления присутствием
 * [EN] Attendance management API class
 */
class AttendanceAPI extends DatabaseUtils {
  constructor(database) {
    super(database);
  }

  /**
   * [RU] Получение статуса присутствия пользователя
   * [EN] Get user attendance status
   */
  async getUserAttendance(userId) {
    try {
      const query = `
        SELECT attendance_status, attendance_updated_at 
        FROM users 
        WHERE telegram_id = ?
      `;

      const result = this.getOne(query, [userId]);
      
      if (!result) {
        return 'attending'; // По умолчанию все присутствуют
      }

      return result.attendance_status || 'attending';
    } catch (error) {
      console.error('❌ Ошибка получения статуса присутствия:', error.message);
      throw error;
    }
  }

  /**
   * [RU] Обновление статуса присутствия пользователя
   * [EN] Update user attendance status
   */
  async updateUserAttendance(userId, status) {
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

      const result = this.updateRecord(query, [status, userId]);
      
      if (!result.success) {
        throw new Error(`User ${userId} not found`);
      }

      console.log(`✅ Статус присутствия пользователя ${userId} обновлен на: ${status}`);
      
      return { 
        success: true, 
        status,
        updated_at: new Date().toISOString() 
      };
    } catch (error) {
      console.error('❌ Ошибка обновления статуса присутствия:', error.message);
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
        stats[row.attendance_status] = row.count;
        stats.total += row.count;
      });

      return { success: true, stats };
    } catch (error) {
      console.error('❌ Ошибка получения статистики присутствия:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение всех пользователей с их статусами присутствия
   * [EN] Get all users with their attendance statuses
   */
  async getAllUsersAttendance() {
    try {
      const query = `
        SELECT 
          telegram_id,
          full_name,
          attendance_status,
          attendance_updated_at
        FROM users 
        ORDER BY attendance_status, full_name
      `;

      const users = this.getMany(query);
      
      return { success: true, users };
    } catch (error) {
      console.error('❌ Ошибка получения списка пользователей с присутствием:', error.message);
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
          telegram_id,
          full_name,
          attendance_updated_at
        FROM users 
        WHERE attendance_status = ?
        ORDER BY full_name
      `;

      const users = this.getMany(query, [status]);
      
      return { success: true, users, status };
    } catch (error) {
      console.error(`❌ Ошибка получения пользователей со статусом ${status}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Проверка существования пользователя
   * [EN] Check if user exists
   */
  async userExists(userId) {
    try {
      const result = this.getOne(query, [userId]);
      
      return !!result;
    } catch (error) {
      console.error('❌ Ошибка проверки существования пользователя:', error.message);
      return false;
    }
  }

  /**
   * [RU] Получение информации о пользователе с присутствием
   * [EN] Get user info with attendance
   */
  async getUserWithAttendance(userId) {
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
        WHERE telegram_id = ?
      `;

      const user = this.getOne(query, [userId]);
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      return { success: true, user };
    } catch (error) {
      console.error('❌ Ошибка получения информации о пользователе:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = {
  AttendanceAPI
};