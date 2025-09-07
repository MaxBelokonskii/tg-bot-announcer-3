#!/usr/bin/env node
/**
 * [RU] Детальный отладочный скрипт для определения проблемы
 * [EN] Detailed debug script to identify the issue
 */

require('dotenv').config();

console.log('🔍 Starting detailed debugging...');

try {
  console.log('Step 1: Loading basic dependencies');
  const { Telegraf } = require('telegraf');
  console.log('✅ Telegraf loaded');

  console.log('Step 2: Loading database connection');
  const { getDatabaseConnection } = require('./database/connection');
  console.log('✅ Database connection loaded');

  console.log('Step 3: Testing database connection');
  const database = getDatabaseConnection('./database/bot_database.db');
  console.log('✅ Database instance created');

  console.log('Step 4: Loading MainMenu');
  const { MainMenu } = require('./interface/main-menu');
  console.log('✅ MainMenu loaded:', typeof MainMenu);

  console.log('Step 5: Creating MainMenu instance');
  const mainMenu = new MainMenu(database);
  console.log('✅ MainMenu instance created');

  console.log('Step 6: Loading MessageRouter');
  const { MessageRouter } = require('./bot/router');
  console.log('✅ MessageRouter loaded');

  console.log('Step 7: Creating MessageRouter instance');
  const router = new MessageRouter(database, null, null, null);
  console.log('✅ MessageRouter instance created');

  console.log('Step 8: Loading TelegramBot');
  const { TelegramBot } = require('./bot/index');
  console.log('✅ TelegramBot loaded');

  console.log('Step 9: Creating TelegramBot instance');
  const bot = new TelegramBot();
  console.log('✅ TelegramBot instance created');

  console.log('🎉 All components loaded successfully!');

} catch (error) {
  console.error('❌ Error at step:', error.message);
  console.error('Stack trace:', error.stack);
  
  // Попробуем дополнительную диагностику
  console.log('\n🔍 Additional diagnostics:');
  
  try {
    const mainMenuModule = require('./interface/main-menu');
    console.log('main-menu module keys:', Object.keys(mainMenuModule));
    console.log('MainMenu type:', typeof mainMenuModule.MainMenu);
    console.log('MainMenu constructor:', !!mainMenuModule.MainMenu?.prototype);
  } catch (diagError) {
    console.error('❌ Diagnostic error:', diagError.message);
  }
}