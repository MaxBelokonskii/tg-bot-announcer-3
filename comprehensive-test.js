#!/usr/bin/env node
/**
 * [RU] Тест с максимальной детализацией ошибок
 * [EN] Test with maximum error detail
 */

console.log('🚀 Starting comprehensive bot test...');

// Set up error handlers first
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

try {
  // Load environment variables
  console.log('📋 Loading environment...');
  require('dotenv').config();
  console.log('✅ Environment loaded');

  // Test Telegraf
  console.log('📡 Testing Telegraf...');
  const { Telegraf } = require('telegraf');
  console.log('✅ Telegraf loaded');

  // Test database
  console.log('💾 Testing database...');
  const { getDatabaseConnection } = require('./database/connection');
  console.log('✅ Database connection loaded');

  // Test MainMenu import
  console.log('🔍 Testing MainMenu import...');
  const mainMenuModule = require('./interface/main-menu');
  console.log('✅ MainMenu module loaded:', Object.keys(mainMenuModule));
  
  const { MainMenu } = mainMenuModule;
  console.log('✅ MainMenu extracted, type:', typeof MainMenu);
  
  if (typeof MainMenu !== 'function') {
    throw new Error(`MainMenu is not a constructor. Type: ${typeof MainMenu}`);
  }

  // Test dependency loading
  console.log('🔗 Testing dependencies...');
  const { AttendanceLogic } = require('./features/attendance/logic');
  const { EventInfoLogic } = require('./features/event-info/logic');
  const { AdminLogic } = require('./features/admin/logic');
  console.log('✅ All logic classes loaded');

  // Test instance creation
  console.log('🏗️ Testing instance creation...');
  const mockDb = { getDatabase: () => ({}) };
  
  const mainMenu = new MainMenu(mockDb);
  console.log('✅ MainMenu instance created successfully');

  // Test router
  console.log('🔀 Testing router...');
  const { MessageRouter } = require('./bot/router');
  const router = new MessageRouter(mockDb, null, null, null);
  console.log('✅ MessageRouter instance created');

  console.log('🎉 All tests passed! The bot components are working correctly.');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('❌ Stack trace:', error.stack);
  process.exit(1);
}