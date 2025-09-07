/**
 * [RU] API для операций онбординга пользователей
 * [EN] API for user onboarding operations
 */

const { UserUtils } = require('../../utils/db-utils');
const winston = require('winston');

// Настройка логгера для модуля онбординга
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'onboarding' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/onboarding-error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/onboarding.log' 
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * [RU] Класс для работы с API онбординга
 * [EN] Onboarding API class
 */
class OnboardingAPI {
  constructor(database) {
    this.db = database;
    this.userUtils = new UserUtils(database);
  }

  /**
   * [RU] Проверка существования пользователя по Telegram ID
   * [EN] Check if user exists by Telegram ID
   */
  async userExists(telegramId) {
    try {
      const user = this.userUtils.findUserByTelegramId(telegramId);
      
      logger.info('User existence check', {
        telegramId,
        exists: !!user
      });
      
      return !!user;
    } catch (error) {
      logger.error('Error checking user existence', {
        telegramId,
        error: error.message
      });
      
      throw new Error(`Ошибка проверки пользователя: ${error.message}`);
    }
  }

  /**
   * [RU] Получение пользователя по Telegram ID
   * [EN] Get user by Telegram ID
   */
  async getUser(telegramId) {
    try {
      const user = this.userUtils.findUserByTelegramId(telegramId);
      
      if (user) {
        logger.info('User retrieved', {
          userId: user.id,
          telegramId: user.telegram_id,
          fullName: user.full_name
        });
      }
      
      return user;
    } catch (error) {
      logger.error('Error retrieving user', {
        telegramId,
        error: error.message
      });
      
      throw new Error(`Ошибка получения пользователя: ${error.message}`);
    }
  }

  /**
   * [RU] Создание нового пользователя
   * [EN] Create new user
   */
  async createUser(telegramId, fullName, username = null) {
    try {
      // Проверяем, не существует ли уже пользователь
      const existingUser = await this.getUser(telegramId);
      if (existingUser) {
        logger.warn('Attempted to create existing user', {
          telegramId,
          existingUserId: existingUser.id
        });
        
        return {
          success: false,
          error: 'Пользователь уже существует',
          user: existingUser
        };
      }

      // Валидация входных данных
      if (!telegramId || !fullName || fullName.trim().length === 0) {
        throw new Error('Некорректные данные пользователя');
      }

      // Создаем пользователя с username
      const result = this.userUtils.createUser(telegramId, fullName.trim(), username);
      
      if (!result.success) {
        throw new Error('Не удалось создать пользователя в базе данных');
      }

      // Получаем созданного пользователя
      const newUser = await this.getUser(telegramId);
      
      logger.info('New user created successfully', {
        userId: newUser.id,
        telegramId: newUser.telegram_id,
        username: newUser.username,
        fullName: newUser.full_name
      });

      return {
        success: true,
        user: newUser,
        message: 'Пользователь успешно зарегистрирован'
      };
    } catch (error) {
      logger.error('Error creating user', {
        telegramId,
        fullName,
        username,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Обновление информации пользователя
   * [EN] Update user information
   */
  async updateUser(telegramId, updateData) {
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        throw new Error('Пользователь не найден');
      }

      // Фильтруем разрешенные поля для обновления
      const allowedFields = ['full_name', 'username'];
      const filteredData = {};
      
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key) && value !== undefined) {
          filteredData[key] = value;
        }
      }

      if (Object.keys(filteredData).length === 0) {
        return {
          success: false,
          error: 'Нет данных для обновления'
        };
      }

      const result = this.userUtils.updateUser(user.id, filteredData);
      
      if (!result.success) {
        throw new Error('Не удалось обновить пользователя');
      }

      // Получаем обновленного пользователя
      const updatedUser = await this.getUser(telegramId);
      
      logger.info('User updated successfully', {
        userId: user.id,
        telegramId,
        updateData: filteredData
      });

      return {
        success: true,
        user: updatedUser,
        message: 'Информация пользователя обновлена'
      };
    } catch (error) {
      logger.error('Error updating user', {
        telegramId,
        updateData,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Получение статистики пользователей
   * [EN] Get user statistics
   */
  async getUserStats() {
    try {
      const totalUsers = this.userUtils.getCount('users');
      const recentUsers = this.userUtils.getCount(
        'users', 
        'WHERE created_at >= datetime("now", "-7 days")'
      );
      
      const stats = {
        total: totalUsers,
        recentWeek: recentUsers,
        timestamp: new Date().toISOString()
      };

      logger.info('User statistics retrieved', stats);
      
      return {
        success: true,
        stats
      };
    } catch (error) {
      logger.error('Error retrieving user statistics', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Получение всех пользователей (для административных целей)
   * [EN] Get all users (for administrative purposes)
   */
  async getAllUsers(limit = 100, offset = 0) {
    try {
      const query = `
        SELECT * FROM users 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      
      const users = this.userUtils.getMany(query, [limit, offset]);
      
      logger.info('Users list retrieved', {
        count: users.length,
        limit,
        offset
      });

      return {
        success: true,
        users,
        pagination: {
          limit,
          offset,
          count: users.length
        }
      };
    } catch (error) {
      logger.error('Error retrieving users list', {
        limit,
        offset,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * [RU] Удаление пользователя (для административных целей)
   * [EN] Delete user (for administrative purposes)
   */
  async deleteUser(telegramId, reason = 'Admin deletion') {
    try {
      const user = await this.getUser(telegramId);
      if (!user) {
        return {
          success: false,
          error: 'Пользователь не найден'
        };
      }

      const query = 'DELETE FROM users WHERE telegram_id = ?';
      const result = this.userUtils.deleteRecords(query, [telegramId]);
      
      if (!result.success) {
        throw new Error('Не удалось удалить пользователя');
      }

      logger.warn('User deleted', {
        userId: user.id,
        telegramId,
        fullName: user.full_name,
        reason
      });

      return {
        success: true,
        message: 'Пользователь удален',
        deletedUser: user
      };
    } catch (error) {
      logger.error('Error deleting user', {
        telegramId,
        reason,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = {
  OnboardingAPI
};