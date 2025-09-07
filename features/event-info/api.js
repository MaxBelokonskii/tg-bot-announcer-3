/**
 * [RU] API для управления информацией о событиях
 * [EN] Event information management API
 */

/**
 * [RU] Класс API для управления информацией о событиях
 * [EN] Event information management API class
 */
class EventInfoAPI {
  constructor(database) {
    this.database = database;
  }

  /**
   * [RU] Получение деталей события
   * [EN] Get event details
   */
  async getEventDetails() {
    try {
      // Пока используем статическую информацию
      // В будущем можно добавить таблицу events в базу данных
      const eventDetails = {
        name: "Свадебное торжество Даши и Максима",
        date: "13 сентября 2025",
        time: "17:00",
        location: "Лофт 'Современник'",
        address: "ул. Налбандяна, д. 63, Ростов-на-Дону",
        dressCode: "Быть красивыми",
        contact: "@Max1Bel (Максим), @daryadanilidi (Даша)",
        description: "Отпразднуем нашу свадьбу с нами вместе! Будем вкусно кушать, веселиться и общаться!",
        specialInstructions: "",
      };

      return { success: true, details: eventDetails };
    } catch (error) {
      console.error('❌ Ошибка получения деталей события:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение полезной информации
   * [EN] Get useful information
   */
  async getUsefulInfo() {
    try {
      // Статическая полезная информация
      const usefulInfo = [
          "Просьба не дарить букеты цветов. Если вы хотели подарить букет цветочков, то вместо этого на велком зоне вы сможете сделать пожертвование для приюта!",
        ];

      return { success: true, info: usefulInfo };
    } catch (error) {
      console.error('❌ Ошибка получения полезной информации:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обновление деталей события
   * [EN] Update event details
   */
  async updateEventDetails(details) {
    try {
      // В будущем здесь будет запись в базу данных
      // Пока просто возвращаем успех
      console.log('📝 Обновление деталей события:', details);
      
      return { 
        success: true, 
        message: 'Детали события обновлены',
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Ошибка обновления деталей события:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Обновление полезной информации
   * [EN] Update useful information
   */
  async updateUsefulInfo(info) {
    try {
      // В будущем здесь будет запись в базу данных
      // Пока просто возвращаем успех
      console.log('📝 Обновление полезной информации:', info);
      
      return { 
        success: true, 
        message: 'Полезная информация обновлена',
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Ошибка обновления полезной информации:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Проверка наличия актуальной информации о событии
   * [EN] Check if current event information exists
   */
  async hasCurrentEventInfo() {
    try {
      // Пока всегда возвращаем true, так как используем статическую информацию
      return { success: true, hasInfo: true };
    } catch (error) {
      console.error('❌ Ошибка проверки наличия информации о событии:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * [RU] Получение краткой информации о событии
   * [EN] Get brief event information
   */
  async getBriefEventInfo() {
    try {
      const briefInfo = {
        name: "",
        date: "",
        time: "",
        location: ""
      };

      return { success: true, info: briefInfo };
    } catch (error) {
      console.error('❌ Ошибка получения краткой информации о событии:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = {
  EventInfoAPI
};