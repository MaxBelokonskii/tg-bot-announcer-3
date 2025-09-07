/**
 * [RU] Юнит-тесты для UserDataValidator
 * [EN] Unit tests for UserDataValidator
 */

const { UserDataValidator } = require('../../utils/user-data-validator');

// Мок-объекты
const mockDatabase = {
  prepare: jest.fn(),
  exec: jest.fn()
};

describe('UserDataValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new UserDataValidator(mockDatabase);
    
    // Мокаем методы DatabaseUtils
    validator.getOne = jest.fn();
    validator.getMany = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('hasUserData', () => {
    it('должен возвращать true для пользователя с полными данными', () => {
      validator.getOne.mockReturnValue({
        id: 1,
        telegram_id: '123456789',
        full_name: 'Тестовый Пользователь',
        attendance_status: 'attending',
        created_at: '2025-01-01'
      });

      const result = validator.hasUserData('123456789');

      expect(result.hasData).toBe(true);
      expect(result.reason).toContain('необходимые данные');
    });

    it('должен возвращать false для несуществующего пользователя', () => {
      validator.getOne.mockReturnValue(null);

      const result = validator.hasUserData('999999999');

      expect(result.hasData).toBe(false);
      expect(result.reason).toContain('не найден в базе данных');
    });

    it('должен возвращать false для пользователя с неполными данными', () => {
      validator.getOne.mockReturnValue({
        id: 1,
        telegram_id: '123456789',
        full_name: null, // Неполные данные
        attendance_status: 'attending'
      });

      const result = validator.hasUserData('123456789');

      expect(result.hasData).toBe(false);
      expect(result.reason).toContain('Неполные данные');
    });
  });

  describe('getUserDataSummary', () => {
    it('должен возвращать подробную сводку для существующего пользователя', () => {
      validator.getOne
        .mockReturnValueOnce({
          id: 1,
          telegram_id: '123456789',
          username: 'test_user',
          full_name: 'Тестовый Пользователь',
          phone_number: '+7123456789',
          attendance_status: 'attending',
          created_at: '2025-01-01'
        })
        .mockReturnValueOnce({ response_count: 5 })
        .mockReturnValueOnce({ last_activity: '2025-01-10' });

      const result = validator.getUserDataSummary('123456789');

      expect(result.success).toBe(true);
      expect(result.summary.fullName).toBe('Тестовый Пользователь');
      expect(result.summary.responseCount).toBe(5);
      expect(result.summary.dataCompleteness).toBeGreaterThan(70);
      expect(result.summary.eligibilityScore).toBeGreaterThan(50);
    });

    it('должен обрабатывать ошибки получения сводки', () => {
      validator.getOne.mockImplementation(() => {
        throw new Error('Ошибка базы данных');
      });

      const result = validator.getUserDataSummary('123456789');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Ошибка');
    });
  });

  describe('filterEligibleUsers', () => {
    it('должен корректно фильтровать подходящих пользователей', () => {
      const testUsers = [
        { telegram_id: '111', full_name: 'Пользователь 1' },
        { telegram_id: '222', full_name: 'Пользователь 2' },
        { telegram_id: '333', full_name: null }
      ];

      // Мокаем hasUserData для разных пользователей
      validator.hasUserData = jest.fn()
        .mockReturnValueOnce({ hasData: true, reason: 'Подходящий' })
        .mockReturnValueOnce({ hasData: true, reason: 'Подходящий' })
        .mockReturnValueOnce({ hasData: false, reason: 'Неполные данные' });

      const result = validator.filterEligibleUsers(testUsers);

      expect(result.success).toBe(true);
      expect(result.eligible).toHaveLength(2);
      expect(result.ineligible).toHaveLength(1);
      expect(result.stats.eligibilityRate).toBeCloseTo(66.7, 1);
    });

    it('должен обрабатывать пустой список пользователей', () => {
      const result = validator.filterEligibleUsers([]);

      expect(result.success).toBe(true);
      expect(result.eligible).toHaveLength(0);
      expect(result.stats.eligibilityRate).toBe(0);
    });

    it('должен обрабатывать некорректные входные данные', () => {
      const result = validator.filterEligibleUsers(null);

      expect(result.success).toBe(true);
      expect(result.eligible).toHaveLength(0);
    });
  });

  describe('getEligibleUsersForEnhancedBroadcast', () => {
    it('должен возвращать список подходящих пользователей', () => {
      const mockUsers = [
        {
          id: 1,
          telegram_id: '111',
          full_name: 'Пользователь 1',
          attendance_status: 'attending'
        },
        {
          id: 2,
          telegram_id: '222',
          full_name: 'Пользователь 2',
          attendance_status: 'maybe'
        }
      ];

      validator.getMany.mockReturnValue(mockUsers);
      validator.filterEligibleUsers = jest.fn().mockReturnValue({
        success: true,
        eligible: mockUsers,
        stats: {
          total: 2,
          eligible: 2,
          ineligible: 0,
          eligibilityRate: 100
        }
      });

      const result = validator.getEligibleUsersForEnhancedBroadcast();

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(2);
      expect(result.eligibleCount).toBe(2);
    });
  });

  describe('calculateDataCompleteness', () => {
    it('должен корректно рассчитывать полноту данных', () => {
      const fullUser = {
        full_name: 'Полный Пользователь',
        username: 'full_user',
        phone_number: '+7123456789',
        attendance_status: 'attending'
      };

      const partialUser = {
        full_name: 'Частичный Пользователь',
        username: null,
        phone_number: null,
        attendance_status: 'attending'
      };

      expect(validator.calculateDataCompleteness(fullUser)).toBe(100);
      expect(validator.calculateDataCompleteness(partialUser)).toBe(50);
    });
  });

  describe('calculateEligibilityScore', () => {
    it('должен правильно рассчитывать оценку подходящности', () => {
      const highScoreUser = {
        full_name: 'Активный Пользователь',
        username: 'active_user',
        phone_number: '+7123456789',
        attendance_status: 'attending',
        updated_at: new Date().toISOString()
      };

      const lowScoreUser = {
        full_name: 'Минимальный Пользователь',
        username: null,
        phone_number: null,
        attendance_status: null,
        updated_at: null
      };

      const highScore = validator.calculateEligibilityScore(highScoreUser, 5);
      const lowScore = validator.calculateEligibilityScore(lowScoreUser, 0);

      expect(highScore).toBeGreaterThan(80);
      expect(lowScore).toBeLessThan(30);
    });

    it('должен учитывать недавнюю активность', () => {
      const recentUser = {
        full_name: 'Недавний Пользователь',
        username: 'recent_user',
        attendance_status: 'attending',
        updated_at: new Date().toISOString() // Сегодня
      };

      const oldUser = {
        full_name: 'Старый Пользователь',
        username: 'old_user',
        attendance_status: 'attending',
        updated_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() // 60 дней назад
      };

      const recentScore = validator.calculateEligibilityScore(recentUser, 0);
      const oldScore = validator.calculateEligibilityScore(oldUser, 0);

      expect(recentScore).toBeGreaterThan(oldScore);
    });
  });

  describe('getEligibilityStatistics', () => {
    it('должен возвращать подробную статистику подходящих пользователей', () => {
      validator.getOne
        .mockReturnValueOnce({ total: 100 })
        .mockReturnValueOnce({ eligible: 75 })
        .mockReturnValueOnce({ active_users: 50 });

      validator.getMany.mockReturnValue([
        { attendance_status: 'attending', count: 40 },
        { attendance_status: 'maybe', count: 25 },
        { attendance_status: 'not_attending', count: 10 }
      ]);

      const result = validator.getEligibilityStatistics();

      expect(result.success).toBe(true);
      expect(result.stats.total).toBe(100);
      expect(result.stats.eligible).toBe(75);
      expect(result.stats.eligibilityRate).toBe(75);
      expect(result.stats.activeUsers).toBe(50);
      expect(result.stats.attendanceBreakdown.attending).toBe(40);
    });
  });
});

module.exports = {
  UserDataValidator
};