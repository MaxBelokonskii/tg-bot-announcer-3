/**
 * [RU] Конфигурация для улучшенной админской рассылки
 * [EN] Configuration for enhanced admin broadcasts
 */

/**
 * [RU] Конфигурация улучшенной админской рассылки
 * [EN] Enhanced admin broadcast configuration
 */
const enhancedAdminConfig = {
  // Основные настройки
  enabled: process.env.ENHANCED_BROADCAST_ENABLED === 'true' || false,
  
  // Временные интервалы (в миллисекундах)
  delays: {
    betweenMessages: parseInt(process.env.DEFAULT_SEQUENCE_DELAY) || 2000,
    betweenUsers: parseInt(process.env.USER_PROCESSING_DELAY) || 100,
    networkTimeout: parseInt(process.env.ENHANCED_DELIVERY_TIMEOUT) || 30000
  },
  
  // Пакетная обработка
  batching: {
    maxUsersPerBatch: parseInt(process.env.MAX_ENHANCED_USERS_PER_BATCH) || 10,
    batchProcessingDelay: parseInt(process.env.BATCH_PROCESSING_DELAY) || 1000
  },
  
  // Настройки последовательности сообщений
  sequence: {
    includeUsefulInfo: process.env.ENHANCED_INCLUDE_USEFUL_INFO !== 'false',
    includeEventDetails: process.env.ENHANCED_INCLUDE_EVENT_DETAILS !== 'false',
    triggerMenu: process.env.ENHANCED_TRIGGER_MENU !== 'false'
  },
  
  // Настройки повторных попыток
  retry: {
    maxAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.RETRY_DELAY) || 1000,
    exponentialBackoff: process.env.USE_EXPONENTIAL_BACKOFF === 'true' || false
  },
  
  // Настройки логирования
  logging: {
    enableDetailedLogs: process.env.ENHANCED_DETAILED_LOGS === 'true' || true,
    logSequenceSteps: process.env.LOG_SEQUENCE_STEPS !== 'false',
    logUserEligibility: process.env.LOG_USER_ELIGIBILITY === 'true' || false
  },
  
  // Критерии подходящих пользователей
  eligibility: {
    requireFullName: process.env.REQUIRE_FULL_NAME !== 'false',
    requireAttendanceStatus: process.env.REQUIRE_ATTENDANCE_STATUS !== 'false',
    minimumDataCompleteness: parseInt(process.env.MIN_DATA_COMPLETENESS) || 50, // процент
    minimumEligibilityScore: parseInt(process.env.MIN_ELIGIBILITY_SCORE) || 40 // из 100
  },
  
  // Ограничения производительности
  performance: {
    maxConcurrentSequences: parseInt(process.env.MAX_CONCURRENT_SEQUENCES) || 5,
    sequenceTimeoutMs: parseInt(process.env.SEQUENCE_TIMEOUT_MS) || 60000,
    enableMemoryOptimization: process.env.ENABLE_MEMORY_OPTIMIZATION === 'true' || true
  },
  
  // Fallback настройки
  fallback: {
    useStandardBroadcastOnError: process.env.FALLBACK_TO_STANDARD === 'true' || true,
    skipFailedUsers: process.env.SKIP_FAILED_USERS === 'true' || true,
    continueOnPartialFailure: process.env.CONTINUE_ON_PARTIAL_FAILURE !== 'false'
  }
};

/**
 * [RU] Проверяет валидность конфигурации
 * [EN] Validates configuration
 */
function validateConfig(config = enhancedAdminConfig) {
  const errors = [];
  
  // Проверяем временные интервалы
  if (config.delays.betweenMessages < 100) {
    errors.push('Задержка между сообщениями слишком мала (минимум 100ms)');
  }
  
  if (config.delays.betweenMessages > 10000) {
    errors.push('Задержка между сообщениями слишком велика (максимум 10s)');
  }
  
  // Проверяем настройки пакетной обработки
  if (config.batching.maxUsersPerBatch < 1) {
    errors.push('Размер пакета должен быть больше 0');
  }
  
  if (config.batching.maxUsersPerBatch > 100) {
    errors.push('Размер пакета слишком велик (максимум 100)');
  }
  
  // Проверяем настройки повторных попыток
  if (config.retry.maxAttempts < 1 || config.retry.maxAttempts > 10) {
    errors.push('Количество повторных попыток должно быть от 1 до 10');
  }
  
  // Проверяем критерии подходящих пользователей
  if (config.eligibility.minimumDataCompleteness < 0 || config.eligibility.minimumDataCompleteness > 100) {
    errors.push('Минимальная полнота данных должна быть от 0 до 100%');
  }
  
  if (config.eligibility.minimumEligibilityScore < 0 || config.eligibility.minimumEligibilityScore > 100) {
    errors.push('Минимальная оценка подходящности должна быть от 0 до 100');
  }
  
  // Проверяем настройки производительности
  if (config.performance.maxConcurrentSequences < 1) {
    errors.push('Максимальное количество одновременных последовательностей должно быть больше 0');
  }
  
  if (config.performance.sequenceTimeoutMs < 10000) {
    errors.push('Тайм-аут последовательности слишком мал (минимум 10s)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * [RU] Получает конфигурацию с применением переопределений
 * [EN] Gets configuration with overrides applied
 */
function getConfig(overrides = {}) {
  const baseConfig = { ...enhancedAdminConfig };
  
  // Применяем переопределения
  const mergedConfig = mergeDeep(baseConfig, overrides);
  
  // Валидируем результирующую конфигурацию
  const validation = validateConfig(mergedConfig);
  
  if (!validation.valid) {
    console.warn('⚠️ Обнаружены проблемы с конфигурацией:', validation.errors);
  }
  
  return {
    config: mergedConfig,
    validation,
    timestamp: new Date().toISOString()
  };
}

/**
 * [RU] Глубокое слияние объектов
 * [EN] Deep merge objects
 */
function mergeDeep(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = mergeDeep(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * [RU] Получает конфигурацию для разработки
 * [EN] Gets development configuration
 */
function getDevelopmentConfig() {
  return getConfig({
    delays: {
      betweenMessages: 500,  // Быстрее для тестирования
      betweenUsers: 50
    },
    batching: {
      maxUsersPerBatch: 3    // Меньшие пакеты для тестирования
    },
    logging: {
      enableDetailedLogs: true,
      logSequenceSteps: true,
      logUserEligibility: true
    },
    performance: {
      sequenceTimeoutMs: 30000  // Короче для тестирования
    }
  });
}

/**
 * [RU] Получает производственную конфигурацию
 * [EN] Gets production configuration
 */
function getProductionConfig() {
  return getConfig({
    delays: {
      betweenMessages: 2000,
      betweenUsers: 150
    },
    batching: {
      maxUsersPerBatch: 25
    },
    logging: {
      enableDetailedLogs: false,
      logUserEligibility: false
    },
    performance: {
      sequenceTimeoutMs: 120000,
      enableMemoryOptimization: true
    }
  });
}

/**
 * [RU] Проверяет, включена ли улучшенная рассылка
 * [EN] Checks if enhanced broadcast is enabled
 */
function isEnhancedBroadcastEnabled(config = enhancedAdminConfig) {
  return config.enabled && validateConfig(config).valid;
}

/**
 * [RU] Выводит текущую конфигурацию
 * [EN] Prints current configuration
 */
function printConfig(config = enhancedAdminConfig) {
  console.log('📋 Конфигурация улучшенной админской рассылки:');
  console.log(`  🔧 Включена: ${config.enabled ? '✅' : '❌'}`);
  console.log(`  ⏱️ Задержка между сообщениями: ${config.delays.betweenMessages}ms`);
  console.log(`  📦 Размер пакета: ${config.batching.maxUsersPerBatch} пользователей`);
  console.log(`  🔄 Макс. попыток: ${config.retry.maxAttempts}`);
  console.log(`  📊 Мин. полнота данных: ${config.eligibility.minimumDataCompleteness}%`);
  console.log(`  ⚡ Макс. одновременных последовательностей: ${config.performance.maxConcurrentSequences}`);
  
  const validation = validateConfig(config);
  if (!validation.valid) {
    console.log('  ⚠️ Проблемы с конфигурацией:');
    validation.errors.forEach(error => console.log(`    - ${error}`));
  }
}

module.exports = {
  enhancedAdminConfig,
  validateConfig,
  getConfig,
  getDevelopmentConfig,
  getProductionConfig,
  isEnhancedBroadcastEnabled,
  printConfig,
  mergeDeep
};