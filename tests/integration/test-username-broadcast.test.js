/**
 * Integration tests for username-based admin broadcast system
 * Tests the complete workflow including database operations, username resolution, 
 * fallback mechanisms, and delivery statistics tracking
 */

const path = require('path');
const Database = require('better-sqlite3');
const { AdminAPI } = require('../../features/admin/api');
const { MessageDeliveryAPI } = require('../../features/message-delivery/api');

// Mock Telegram bot for testing
class MockTelegramBot {
  constructor() {
    this.sentMessages = [];
    this.usernameMap = new Map(); // Simulates telegram username -> chat_id mapping
    this.blockedUsers = new Set();
    this.failedUsers = new Set();
  }

  // Mock getMe method
  async getMe() {
    return {
      id: 123456789,
      username: 'test_bot',
      first_name: 'Test Bot'
    };
  }

  // Mock getChat method for username resolution
  async getChat(identifier) {
    if (identifier.startsWith('@')) {
      const username = identifier.substring(1);
      const chatId = this.usernameMap.get(username);
      
      if (chatId) {
        return { id: chatId, username };
      } else {
        throw new Error('Chat not found');
      }
    }
    
    throw new Error('Invalid identifier');
  }

  // Mock sendMessage method
  async sendMessage(chatId, text, options = {}) {
    // Simulate blocked users
    if (this.blockedUsers.has(chatId.toString())) {
      throw new Error('Forbidden: bot was blocked by the user');
    }
    
    // Simulate failed deliveries
    if (this.failedUsers.has(chatId.toString())) {
      throw new Error('Bad Request: chat not found');
    }

    this.sentMessages.push({
      chatId,
      text,
      options,
      timestamp: new Date()
    });

    return { message_id: Date.now() };
  }

  // Helper methods for test setup
  addUsernameMapping(username, chatId) {
    this.usernameMap.set(username, chatId);
  }

  blockUser(chatId) {
    this.blockedUsers.add(chatId.toString());
  }

  failUser(chatId) {
    this.failedUsers.add(chatId.toString());
  }

  reset() {
    this.sentMessages = [];
    this.usernameMap.clear();
    this.blockedUsers.clear();
    this.failedUsers.clear();
  }
}

describe('Username-based Admin Broadcast Integration Tests', () => {
  let db;
  let adminAPI;
  let messageDeliveryAPI;
  let mockBot;
  let testDbPath;

  beforeAll(() => {
    // Create test database
    testDbPath = path.join(__dirname, '../tmp/test-username-broadcast.db');
    db = new Database(testDbPath);
    
    // Initialize schema
    const schema = require('fs').readFileSync(
      path.join(__dirname, '../../database/schema.sql'),
      'utf8'
    );
    db.exec(schema);

    // Initialize APIs
    adminAPI = new AdminAPI(db);
    messageDeliveryAPI = new MessageDeliveryAPI(db);
    
    // Initialize mock bot
    mockBot = new MockTelegramBot();
    
    // Override environment variables for testing
    process.env.PREFERRED_SEND_METHOD = 'auto';
    process.env.ENABLE_FALLBACK_TO_TELEGRAM_ID = 'true';
    process.env.USERNAME_RESOLUTION_CACHE_TTL = '1000'; // 1 second for testing
  });

  afterAll(() => {
    db.close();
    // Clean up test file
    require('fs').unlinkSync(testDbPath);
  });

  beforeEach(() => {
    // Clear test data
    db.exec('DELETE FROM users');
    db.exec('DELETE FROM admin_messages');
    mockBot.reset();
  });

  test('should successfully send message using username resolution', async () => {
    // Setup test data
    const userId1 = '111111111';
    const userId2 = '222222222';
    const username1 = 'user1';
    const username2 = 'user2';

    // Insert test users with usernames
    db.exec(`
      INSERT INTO users (telegram_id, username, full_name) VALUES 
      ('${userId1}', '${username1}', 'Test User 1'),
      ('${userId2}', '${username2}', 'Test User 2')
    `);

    // Setup username mappings in mock bot
    mockBot.addUsernameMapping(username1, parseInt(userId1));
    mockBot.addUsernameMapping(username2, parseInt(userId2));

    // Create mock bot with telegram property
    const bot = { telegram: mockBot };

    // Send test message
    const result = await adminAPI.sendTestMessage(bot, 'admin123', {
      sendMethod: 'username'
    });

    // Verify results
    expect(result.success).toBe(true);
    expect(result.deliveryStats.total).toBe(2);
    expect(result.deliveryStats.delivered).toBe(2);
    expect(result.deliveryStats.usernameDelivered).toBe(2);
    expect(result.deliveryStats.telegramIdDelivered).toBe(0);
    expect(result.methodBreakdown.username.attempted).toBe(2);
    expect(result.methodBreakdown.username.successful).toBe(2);

    // Verify messages were sent
    expect(mockBot.sentMessages).toHaveLength(2);
    expect(mockBot.sentMessages[0].chatId).toBe(parseInt(userId1));
    expect(mockBot.sentMessages[1].chatId).toBe(parseInt(userId2));
  });

  test('should fallback to telegram_id when username resolution fails', async () => {
    // Setup test data
    const userId1 = '111111111';
    const userId2 = '222222222';
    const username1 = 'user1';
    const username2 = 'user2';

    // Insert test users with usernames
    db.exec(`
      INSERT INTO users (telegram_id, username, full_name) VALUES 
      ('${userId1}', '${username1}', 'Test User 1'),
      ('${userId2}', '${username2}', 'Test User 2')
    `);

    // Setup username mapping only for user1 (user2 will fail username resolution)
    mockBot.addUsernameMapping(username1, parseInt(userId1));

    const bot = { telegram: mockBot };

    // Send test message with fallback enabled
    const result = await adminAPI.sendTestMessage(bot, 'admin123', {
      sendMethod: 'auto'
    });

    // Verify results
    expect(result.success).toBe(true);
    expect(result.deliveryStats.total).toBe(2);
    expect(result.deliveryStats.delivered).toBe(2);
    expect(result.deliveryStats.usernameDelivered).toBe(1);
    expect(result.deliveryStats.telegramIdDelivered).toBe(1);

    // Verify messages were sent to both users
    expect(mockBot.sentMessages).toHaveLength(2);
    
    // user1 should receive via username resolution
    const user1Message = mockBot.sentMessages.find(m => m.chatId === parseInt(userId1));
    expect(user1Message).toBeDefined();
    
    // user2 should receive via fallback to telegram_id
    const user2Message = mockBot.sentMessages.find(m => m.chatId === userId2);
    expect(user2Message).toBeDefined();
  });

  test('should handle blocked users correctly', async () => {
    // Setup test data
    const userId1 = '111111111';
    const userId2 = '222222222';
    const username1 = 'user1';
    const username2 = 'user2';

    db.exec(`
      INSERT INTO users (telegram_id, username, full_name) VALUES 
      ('${userId1}', '${username1}', 'Test User 1'),
      ('${userId2}', '${username2}', 'Test User 2')
    `);

    // Setup username mappings
    mockBot.addUsernameMapping(username1, parseInt(userId1));
    mockBot.addUsernameMapping(username2, parseInt(userId2));
    
    // Block user2
    mockBot.blockUser(userId2);

    const bot = { telegram: mockBot };

    // Send test message
    const result = await adminAPI.sendTestMessage(bot, 'admin123', {
      sendMethod: 'username'
    });

    // Verify results
    expect(result.success).toBe(true);
    expect(result.deliveryStats.total).toBe(2);
    expect(result.deliveryStats.delivered).toBe(1);
    expect(result.deliveryStats.failed).toBe(1);
    expect(result.deliveryStats.blocked).toBe(1);

    // Verify only one message was successfully sent
    expect(mockBot.sentMessages).toHaveLength(1);
    expect(mockBot.sentMessages[0].chatId).toBe(parseInt(userId1));
  });

  test('should cache username resolutions correctly', async () => {
    // Setup test data
    const userId1 = '111111111';
    const username1 = 'user1';

    db.exec(`
      INSERT INTO users (telegram_id, username, full_name) VALUES 
      ('${userId1}', '${username1}', 'Test User 1')
    `);

    mockBot.addUsernameMapping(username1, parseInt(userId1));

    const bot = { telegram: mockBot };

    // Send first message
    await adminAPI.sendTestMessage(bot, 'admin123', {
      sendMethod: 'username'
    });

    // Track getChat calls
    const originalGetChat = mockBot.getChat.bind(mockBot);
    let getChatCallCount = 0;
    mockBot.getChat = async function(identifier) {
      getChatCallCount++;
      return originalGetChat(identifier);
    };

    // Send second message immediately (should use cache)
    await adminAPI.sendTestMessage(bot, 'admin123', {
      sendMethod: 'username'
    });

    // Verify cache was used (no additional getChat calls)
    expect(getChatCallCount).toBe(0);

    // Wait for cache to expire
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Send third message (should make new getChat call)
    await adminAPI.sendTestMessage(bot, 'admin123', {
      sendMethod: 'username'
    });

    // Verify cache expired and new call was made
    expect(getChatCallCount).toBe(1);
  });

  test('should handle users without usernames', async () => {
    // Setup test data - users without usernames
    const userId1 = '111111111';
    const userId2 = '222222222';

    db.exec(`
      INSERT INTO users (telegram_id, username, full_name) VALUES 
      ('${userId1}', NULL, 'Test User 1'),
      ('${userId2}', '', 'Test User 2')
    `);

    const bot = { telegram: mockBot };

    // Send test message
    const result = await adminAPI.sendTestMessage(bot, 'admin123', {
      sendMethod: 'auto'
    });

    // Verify results
    expect(result.success).toBe(true);
    expect(result.deliveryStats.total).toBe(2);
    expect(result.deliveryStats.delivered).toBe(2);
    expect(result.deliveryStats.usernameDelivered).toBe(0);
    expect(result.deliveryStats.telegramIdDelivered).toBe(2);

    // Verify all messages sent via telegram_id
    expect(mockBot.sentMessages).toHaveLength(2);
  });

  test('should record comprehensive delivery statistics', async () => {
    // Setup mixed scenario
    const userId1 = '111111111'; // Has username, will succeed
    const userId2 = '222222222'; // Has username, will be blocked
    const userId3 = '333333333'; // No username, will use telegram_id
    const userId4 = '444444444'; // Has username, resolution will fail, fallback succeeds
    
    const username1 = 'user1';
    const username2 = 'user2'; 
    const username4 = 'user4';

    db.exec(`
      INSERT INTO users (telegram_id, username, full_name) VALUES 
      ('${userId1}', '${username1}', 'Test User 1'),
      ('${userId2}', '${username2}', 'Test User 2'),
      ('${userId3}', NULL, 'Test User 3'),
      ('${userId4}', '${username4}', 'Test User 4')
    `);

    // Setup mock responses
    mockBot.addUsernameMapping(username1, parseInt(userId1)); // Will succeed
    mockBot.addUsernameMapping(username2, parseInt(userId2)); // Will be blocked
    // username4 not mapped - will fail resolution but fallback will work
    
    mockBot.blockUser(userId2);

    const bot = { telegram: mockBot };

    // Send test message
    const result = await adminAPI.sendTestMessage(bot, 'admin123', {
      sendMethod: 'auto'
    });

    // Verify comprehensive statistics
    expect(result.success).toBe(true);
    expect(result.deliveryStats.total).toBe(4);
    expect(result.deliveryStats.delivered).toBe(3);
    expect(result.deliveryStats.failed).toBe(1);
    expect(result.deliveryStats.blocked).toBe(1);
    expect(result.deliveryStats.usernameDelivered).toBe(1); // user1
    expect(result.deliveryStats.telegramIdDelivered).toBe(2); // user3 + user4 fallback
    expect(result.deliveryStats.usernameResolutionFailed).toBe(1); // user4

    // Verify method breakdown
    expect(result.methodBreakdown.username.attempted).toBe(3); // user1, user2, user4
    expect(result.methodBreakdown.username.successful).toBe(1); // user1
    expect(result.methodBreakdown.telegram_id.attempted).toBe(2); // user3 + user4 fallback
    expect(result.methodBreakdown.telegram_id.successful).toBe(2); // user3 + user4 fallback

    // Verify admin message was logged
    const adminMessages = db.prepare('SELECT * FROM admin_messages ORDER BY sent_at DESC LIMIT 1').all();
    expect(adminMessages).toHaveLength(1);
    expect(adminMessages[0].total_recipients).toBe(4);
    expect(adminMessages[0].delivered_count).toBe(3);
    expect(adminMessages[0].failed_count).toBe(1);
    expect(adminMessages[0].blocked_count).toBe(1);
  });
});