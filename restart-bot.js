#!/usr/bin/env node
/**
 * [RU] Скрипт для чистого перезапуска бота
 * [EN] Script for clean bot restart
 */

// Очищаем require cache
Object.keys(require.cache).forEach(function(key) {
  delete require.cache[key];
});

console.log('🧹 Module cache cleared');

try {
  console.log('🚀 Starting clean bot instance...');
  
  // Инициализируем бота
  const { TelegramBot } = require('./bot/index');
  
  const bot = new TelegramBot();
  
  bot.start().then(result => {
    if (result.success) {
      console.log('✅ Bot started successfully!');
    } else {
      console.error('❌ Bot startup failed:', result.error);
      process.exit(1);
    }
  }).catch(error => {
    console.error('❌ Critical error during startup:', error);
    process.exit(1);
  });
  
} catch (error) {
  console.error('❌ Error initializing bot:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}