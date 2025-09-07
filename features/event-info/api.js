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
        name: "Празднование Нового года 2024",
        date: "31 декабря 2023",
        time: "20:00",
        location: "Ресторан 'Праздничный'",
        address: "ул. Праздничная, д. 1, Москва",
        dressCode: "Нарядная одежда, новогодняя тематика приветствуется",
        contact: "+7 (999) 123-45-67 (организатор)",
        description: "Встретим Новый год в теплой компании! Программа включает праздничный ужин, развлекательную программу, живую музыку и фейерверк в полночь.",
        specialInstructions: "Просьба подтвердить участие до 28 декабря. При себе иметь паспорт для входа в ресторан."
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
      const usefulInfo = {
        transport: [
          "🚇 Метро: станция 'Праздничная', выход №2",
          "🚌 Автобус: маршруты 15, 23, 45 до остановки 'Ресторан'",
          "🚗 На машине: есть подземная парковка",
          "🚕 Такси: заказ через приложения Яндекс.Такси, Uber"
        ],
        parking: "Бесплатная парковка в подземном гараже ресторана. Вход со стороны ул. Боковой.",
        accommodation: [
          "🏨 Отель 'Комфорт' - 500м от ресторана",
          "🏠 Гостевой дом 'Уют' - 800м от ресторана",
          "🏩 Хостел 'Бюджетный' - 1км от ресторана"
        ],
        attractions: [
          "🏛️ Музей истории города - 10 минут пешком",
          "🎡 Парк аттракционов - 15 минут на транспорте",
          "🛍️ Торговый центр 'Праздничный' - рядом с рестораном"
        ],
        emergency: "🚨 Служба экстренного вызова: 112, Организатор: +7 (999) 123-45-67",
        weather: "🌤️ Ожидается: -5°C, небольшой снег. Рекомендуем теплую одежду для прогулки.",
        additionalInfo: [
          "💳 Принимаются карты всех банков",
          "📱 Бесплатный Wi-Fi в ресторане",
          "🚭 Ресторан полностью некурящий",
          "🎁 Будет розыгрыш призов среди гостей",
          "📸 Фотограф будет работать весь вечер"
        ]
      };

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
        name: "Празднование Нового года 2024",
        date: "31 декабря 2023",
        time: "20:00",
        location: "Ресторан 'Праздничный'"
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