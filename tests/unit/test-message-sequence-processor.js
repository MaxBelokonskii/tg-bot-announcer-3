/**
 * [RU] Юнит-тесты для MessageSequenceProcessor
 * [EN] Unit tests for MessageSequenceProcessor
 */

const { MessageSequenceProcessor } = require('../../utils/message-sequence-processor');
const { EventInfoAPI } = require('../../features/event-info/api');
const { MainMenu } = require('../../interface/main-menu');

// Мок-объекты
const mockDatabase = {
  prepare: jest.fn(),
  exec: jest.fn()
};

const mockBot = {
  telegram: {
    sendMessage: jest.fn()
  }
};

const mockEventInfoAPI = {
  getUsefulInfo: jest.fn(),
  getEventDetails: jest.fn()
};

const mockMainMenu = {
  show: jest.fn()
};

describe('MessageSequenceProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new MessageSequenceProcessor(mockDatabase);
    processor.eventInfoAPI = mockEventInfoAPI;
    processor.mainMenu = mockMainMenu;
    
    // Очищаем моки
    jest.clearAllMocks();
  });

  describe('processUserMessageSequence', () => {
    it('должен успешно обработать полную последовательность сообщений', async () => {
      // Настраиваем моки для успешного выполнения
      mockEventInfoAPI.getUsefulInfo.mockResolvedValue({
        success: true,
        info: ['Тестовая полезная информация']
      });

      mockEventInfoAPI.getEventDetails.mockResolvedValue({
        success: true,
        details: {
          name: 'Тестовое событие',
          date: '2025-01-01',
          time: '18:00'
        }
      });

      mockMainMenu.show.mockResolvedValue({ success: true });
      mockBot.telegram.sendMessage.mockResolvedValue({ message_id: 123 });

      const result = await processor.processUserMessageSequence(
        mockBot,
        '123456789',
        'Тестовое сообщение',
        {
          includeUsefulInfo: true,
          includeEventDetails: true,
          triggerMenu: true,
          sequenceDelay: 100
        }
      );

      expect(result.success).toBe(true);
      expect(result.results.completedSteps).toBe(4);
      expect(result.results.totalSteps).toBe(4);
      expect(result.completionRate).toBe(100);
    });

    it('должен корректно обрабатывать частичные сбои', async () => {
      // Настраиваем моки с частичными сбоями
      mockEventInfoAPI.getUsefulInfo.mockResolvedValue({
        success: false,
        error: 'Ошибка получения полезной информации'
      });

      mockEventInfoAPI.getEventDetails.mockResolvedValue({
        success: true,
        details: { name: 'Тестовое событие' }
      });

      mockMainMenu.show.mockResolvedValue({ success: true });
      mockBot.telegram.sendMessage.mockResolvedValue({ message_id: 123 });

      const result = await processor.processUserMessageSequence(
        mockBot,
        '123456789',
        'Тестовое сообщение'
      );

      expect(result.success).toBe(true); // Успешно, так как выполнен хотя бы один шаг
      expect(result.results.completedSteps).toBe(3); // admin_message + event_details + menu_trigger
      expect(result.results.errors.length).toBe(1);
      expect(result.results.errors[0].step).toBe('usefulInfo');
    });

    it('должен обрабатывать критические ошибки', async () => {
      // Настраиваем моки для критической ошибки
      mockBot.telegram.sendMessage.mockRejectedValue(new Error('Критическая ошибка сети'));

      const result = await processor.processUserMessageSequence(
        mockBot,
        '123456789',
        'Тестовое сообщение'
      );

      expect(result.success).toBe(false);
      expect(result.criticalError).toContain('Критическая ошибка сети');
    });
  });

  describe('sendUsefulInformation', () => {
    it('должен успешно отправить полезную информацию', async () => {
      mockEventInfoAPI.getUsefulInfo.mockResolvedValue({
        success: true,
        info: ['Полезная информация 1', 'Полезная информация 2']
      });

      mockBot.telegram.sendMessage.mockResolvedValue({ message_id: 123 });

      const result = await processor.sendUsefulInformation(mockBot, '123456789');

      expect(result.success).toBe(true);
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        '123456789',
        expect.stringContaining('📋 <b>Полезная информация</b>'),
        expect.objectContaining({
          parse_mode: 'HTML'
        })
      );
    });

    it('должен обрабатывать ошибки получения данных', async () => {
      mockEventInfoAPI.getUsefulInfo.mockResolvedValue({
        success: false,
        error: 'База данных недоступна'
      });

      const result = await processor.sendUsefulInformation(mockBot, '123456789');

      expect(result.success).toBe(false);
      expect(result.error).toContain('База данных недоступна');
    });
  });

  describe('sendEventDetails', () => {
    it('должен успешно отправить детали события', async () => {
      mockEventInfoAPI.getEventDetails.mockResolvedValue({
        success: true,
        details: {
          name: 'Свадебное торжество',
          date: '13 сентября 2025',
          time: '17:00',
          location: 'Лофт Современник'
        }
      });

      mockBot.telegram.sendMessage.mockResolvedValue({ message_id: 123 });

      const result = await processor.sendEventDetails(mockBot, '123456789');

      expect(result.success).toBe(true);
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        '123456789',
        expect.stringContaining('📅 <b>Детали события</b>'),
        expect.objectContaining({
          parse_mode: 'HTML'
        })
      );
    });
  });

  describe('triggerMainMenu', () => {
    it('должен успешно активировать главное меню', async () => {
      mockMainMenu.show.mockResolvedValue({ success: true });

      const result = await processor.triggerMainMenu(mockBot, '123456789');

      expect(result.success).toBe(true);
      expect(mockMainMenu.show).toHaveBeenCalled();
    });

    it('должен обрабатывать ошибки отображения меню', async () => {
      mockMainMenu.show.mockResolvedValue({
        success: false,
        error: 'Ошибка генерации клавиатуры'
      });

      const result = await processor.triggerMainMenu(mockBot, '123456789');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Ошибка отображения меню');
    });
  });

  describe('validateSequenceCompletion', () => {
    it('должен валидировать успешную последовательность', () => {
      const sequenceResults = {
        results: {
          steps: {
            adminMessage: { success: true },
            usefulInfo: { success: true },
            eventDetails: { success: true },
            menuTrigger: { success: true }
          },
          totalSteps: 4,
          completedSteps: 4
        }
      };

      const validation = processor.validateSequenceCompletion(sequenceResults);

      expect(validation.valid).toBe(true);
      expect(validation.completionRate).toBe(100);
    });

    it('должен обнаруживать низкий процент завершения', () => {
      const sequenceResults = {
        results: {
          steps: {
            adminMessage: { success: true },
            usefulInfo: { success: false },
            eventDetails: { success: false },
            menuTrigger: { success: false }
          },
          totalSteps: 4,
          completedSteps: 1
        }
      };

      const validation = processor.validateSequenceCompletion(sequenceResults);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('Низкий процент завершения');
    });
  });

  describe('createSyntheticContext', () => {
    it('должен создать корректный синтетический контекст', () => {
      const ctx = processor.createSyntheticContext(mockBot, '123456789');

      expect(ctx.from.id).toBe(123456789);
      expect(ctx.telegram).toBe(mockBot.telegram);
      expect(typeof ctx.reply).toBe('function');
      expect(typeof ctx.replyWithHTML).toBe('function');
    });
  });
});

module.exports = {
  MessageSequenceProcessor
};