/**
 * [RU] Валидатор данных пользователей для улучшенной админской рассылки
 * [EN] User data validator for enhanced admin broadcasts
 */

const { DatabaseUtils } = require('./db-utils');

/**
 * [RU] Класс для валидации и фильтрации пользователей для улучшенных сообщений
 * [EN] Class for validating and filtering users for enhanced messages
 */
class UserDataValidator extends DatabaseUtils {
  constructor(database) {
    super(database);
  }

  /**
   * [RU] Проверяет наличие данных пользователя в базе данных
   * [EN] Checks if user data exists in database
   */
  hasUserData(userId) {
    try {
      const query = `
        SELECT 
          id,
          telegram_id,
          full_name,
          attendance_status,
          created_at,
          updated_at
        FROM users 
        WHERE telegram_id = ?
      `;

      const user = this.getOne(query, [userId]);
      
      if (!user) {
        return {
          hasData: false,
          reason: 'Пользователь не найден в базе данных'
        };
      }

      // Проверяем основные критерии наличия данных
      const hasBasicData = !!(user.full_name && user.attendance_status);
      
      return {
        hasData: hasBasicData,
        user: user,
        reason: hasBasicData ? 'Пользователь имеет необходимые данные' : 'Неполные данные пользователя'
      };
    } catch (error) {
      console.error(`❌ Ошибка проверки данных пользователя ${userId}:`, error.message);
      return {
        hasData: false,
        reason: `Ошибка запроса: ${error.message}`
      };
    }
  }

  /**
   * [RU] Получает сводку данных пользователя
   * [EN] Gets user data summary
   */
  getUserDataSummary(userId) {
    try {
      const userQuery = `
        SELECT 
          id,
          telegram_id,
          username,
          full_name,
          attendance_status,
          attendance_updated_at,
          created_at,
          updated_at
        FROM users 
        WHERE telegram_id = ?
      `;

      const user = this.getOne(userQuery, [userId]);
      
      if (!user) {
        return {
          success: false,
          summary: null,
          reason: 'Пользователь не найден'
        };
      }

      // Получаем количество ответов пользователя
      const responsesQuery = `
        SELECT COUNT(*) as response_count 
        FROM user_responses 
        WHERE user_id = ?
      `;
      
      const responsesResult = this.getOne(responsesQuery, [user.id]);

      // Получаем последнюю активность пользователя
      const lastActivityQuery = `
        SELECT MAX(created_at) as last_activity
        FROM (
          SELECT created_at FROM user_responses WHERE user_id = ?
          UNION ALL
          SELECT updated_at FROM users WHERE id = ?
        )
      `;
      
      const lastActivityResult = this.getOne(lastActivityQuery, [user.id, user.id]);

      const summary = {
        userId: user.telegram_id,
        internalId: user.id,
        username: user.username,
        fullName: user.full_name,
        attendanceStatus: user.attendance_status,
        attendanceUpdated: user.attendance_updated_at,
        registrationDate: user.created_at,
        lastUpdate: user.updated_at,
        responseCount: responsesResult?.response_count || 0,
        lastActivity: lastActivityResult?.last_activity,
        dataCompleteness: this.calculateDataCompleteness(user),
        eligibilityScore: this.calculateEligibilityScore(user, responsesResult?.response_count || 0)
      };

      return {
        success: true,
        summary,
        reason: 'Сводка данных получена успешно'
      };
    } catch (error) {
      console.error(`❌ Ошибка получения сводки данных пользователя ${userId}:`, error.message);
      return {
        success: false,
        summary: null,
        reason: `Ошибка: ${error.message}`
      };
    }
  }

  /**
   * [RU] Фильтрует пользователей, подходящих для улучшенных сообщений
   * [EN] Filters users eligible for enhanced messages
   */
  filterEligibleUsers(userList) {
    try {
      if (!Array.isArray(userList) || userList.length === 0) {
        return {
          success: true,
          eligible: [],
          ineligible: [],
          stats: {
            total: 0,
            eligible: 0,
            ineligible: 0,
            eligibilityRate: 0
          }
        };
      }

      const eligible = [];
      const ineligible = [];

      for (const user of userList) {
        const userId = user.telegram_id || user.id;
        const dataCheck = this.hasUserData(userId);
        
        if (dataCheck.hasData) {
          eligible.push({
            ...user,
            eligibilityReason: dataCheck.reason,
            dataValidation: dataCheck
          });
        } else {
          ineligible.push({
            ...user,
            ineligibilityReason: dataCheck.reason,
            dataValidation: dataCheck
          });
        }
      }

      const stats = {
        total: userList.length,
        eligible: eligible.length,
        ineligible: ineligible.length,
        eligibilityRate: userList.length > 0 ? (eligible.length / userList.length) * 100 : 0
      };

      console.log(`📊 Фильтрация пользователей: ${stats.eligible}/${stats.total} подходящих (${stats.eligibilityRate.toFixed(1)}%)`);

      return {
        success: true,
        eligible,
        ineligible,
        stats
      };
    } catch (error) {
      console.error('❌ Ошибка фильтрации пользователей:', error.message);
      return {
        success: false,
        eligible: [],
        ineligible: userList || [],
        stats: { total: 0, eligible: 0, ineligible: 0, eligibilityRate: 0 },
        error: error.message
      };
    }
  }

  /**
   * [RU] Получает всех пользователей, подходящих для улучшенной рассылки
   * [EN] Gets all users eligible for enhanced broadcast
   */
  getEligibleUsersForEnhancedBroadcast() {
    try {
      const query = `
        SELECT 
          id,
          telegram_id,
          username,
          full_name,
          attendance_status,
          created_at,
          updated_at
        FROM users 
        WHERE full_name IS NOT NULL 
          AND attendance_status IS NOT NULL
        ORDER BY created_at DESC
      `;

      const allUsers = this.getMany(query);
      
      const filterResult = this.filterEligibleUsers(allUsers);
      
      if (!filterResult.success) {
        throw new Error(`Ошибка фильтрации: ${filterResult.error}`);
      }

      return {
        success: true,
        users: filterResult.eligible,
        stats: filterResult.stats,
        eligibleCount: filterResult.eligible.length,
        totalCount: filterResult.stats.total
      };
    } catch (error) {
      console.error('❌ Ошибка получения подходящих пользователей:', error.message);
      return {
        success: false,
        users: [],
        stats: { total: 0, eligible: 0, ineligible: 0, eligibilityRate: 0 },
        error: error.message
      };
    }
  }

  /**
   * [RU] Получает детальную статистику подходящих пользователей
   * [EN] Gets detailed statistics for eligible users
   */
  getEligibilityStatistics() {
    try {
      // Общая статистика пользователей
      const totalUsersQuery = `SELECT COUNT(*) as total FROM users`;
      const totalUsersResult = this.getOne(totalUsersQuery);

      // Пользователи с полными данными
      const eligibleUsersQuery = `
        SELECT COUNT(*) as eligible 
        FROM users 
        WHERE full_name IS NOT NULL 
          AND attendance_status IS NOT NULL
      `;
      const eligibleUsersResult = this.getOne(eligibleUsersQuery);

      // Статистика по статусам присутствия среди подходящих пользователей
      const attendanceStatsQuery = `
        SELECT 
          attendance_status,
          COUNT(*) as count
        FROM users 
        WHERE full_name IS NOT NULL 
          AND attendance_status IS NOT NULL
        GROUP BY attendance_status
      `;
      const attendanceStats = this.getMany(attendanceStatsQuery);

      // Статистика активности (пользователи с ответами)
      const activeUsersQuery = `
        SELECT COUNT(DISTINCT u.id) as active_users
        FROM users u
        INNER JOIN user_responses ur ON u.id = ur.user_id
        WHERE u.full_name IS NOT NULL 
          AND u.attendance_status IS NOT NULL
      `;
      const activeUsersResult = this.getOne(activeUsersQuery);

      const stats = {
        total: totalUsersResult.total || 0,
        eligible: eligibleUsersResult.eligible || 0,
        ineligible: (totalUsersResult.total || 0) - (eligibleUsersResult.eligible || 0),
        eligibilityRate: totalUsersResult.total > 0 
          ? ((eligibleUsersResult.eligible || 0) / totalUsersResult.total) * 100 
          : 0,
        activeUsers: activeUsersResult.active_users || 0,
        attendanceBreakdown: attendanceStats.reduce((acc, stat) => {
          acc[stat.attendance_status] = stat.count;
          return acc;
        }, {}),
        timestamp: new Date().toISOString()
      };

      return { success: true, stats };
    } catch (error) {
      console.error('❌ Ошибка получения статистики подходящих пользователей:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Вычисляет полноту данных пользователя (в процентах)
   * [EN] Calculates user data completeness (in percentage)
   */
  calculateDataCompleteness(user) {
    const fields = [
      'full_name',
      'username', 
      'attendance_status'
    ];

    const completedFields = fields.filter(field => {
      const value = user[field];
      return value !== null && value !== undefined && value !== '';
    });

    return Math.round((completedFields.length / fields.length) * 100);
  }

  /**
   * [RU] Вычисляет оценку подходящности пользователя для улучшенной рассылки
   * [EN] Calculates user eligibility score for enhanced broadcast
   */
  calculateEligibilityScore(user, responseCount = 0) {
    let score = 0;

    // Базовые требования (40 баллов)
    if (user.full_name) score += 20;
    if (user.attendance_status) score += 20;

    // Дополнительные данные (30 баллов)
    if (user.username) score += 15;
    // if (user.phone_number) score += 15; // Поле не существует в текущей схеме
    score += 15; // Даем бонус за другие критерии

    // Активность пользователя (30 баллов)
    if (responseCount > 0) score += 15;
    if (responseCount > 3) score += 15; // Очень активный пользователь

    // Бонус за недавнюю активность (до 10 баллов)
    if (user.updated_at) {
      const lastUpdate = new Date(user.updated_at);
      const now = new Date();
      const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUpdate <= 7) score += 10;      // Очень недавно
      else if (daysSinceUpdate <= 30) score += 5; // Недавно
    }

    return Math.min(score, 100); // Максимум 100 баллов
  }
}

module.exports = {
  UserDataValidator
};