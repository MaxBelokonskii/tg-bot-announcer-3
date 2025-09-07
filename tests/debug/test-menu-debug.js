/**
 * Debug test for menu buttons issue
 */

// Mock the database and admin dependencies to avoid connection issues
class MockAdminLogic {
  constructor() {}
  
  isAdmin(userId) {
    // For testing, let's make user 123 an admin and others not
    return userId === '123';
  }
}

// Mock the attendance and event info logic
class MockLogic {
  constructor() {}
}

// Temporarily replace the require paths for testing
const originalRequire = require;
require = function(id) {
  if (id.includes('admin/logic')) {
    return { AdminLogic: MockAdminLogic };
  }
  if (id.includes('attendance/logic')) {
    return { AttendanceLogic: MockLogic };
  }
  if (id.includes('event-info/logic')) {
    return { EventInfoLogic: MockLogic };
  }
  return originalRequire(id);
};

const { createInlineKeyboard } = originalRequire('../../utils/message-helpers');
const texts = originalRequire('../../bot/texts');

// Create a simplified MainMenu class for testing
class TestMainMenu {
  constructor() {
    this.adminLogic = new MockAdminLogic();
  }

  generateMenuItems(userId) {
    const isAdmin = this.adminLogic.isAdmin(userId);
    
    // Basic menu items for all users
    const menuItems = [
      { text: texts.menu.buttons.changeAttendance, callback_data: 'change_attendance' },
      { text: texts.menu.buttons.eventDetails, callback_data: 'event_details' },
      { text: texts.menu.buttons.usefulInfo, callback_data: 'useful_info' },
      { text: texts.menu.buttons.upcomingEvents, callback_data: 'upcoming_events' },
      { text: texts.menu.buttons.help, callback_data: 'help' }
    ];

    // Add admin button for administrators
    if (isAdmin) {
      menuItems.splice(3, 0, { text: texts.menu.buttons.adminGuestList, callback_data: 'admin_guest_list' });
    }

    return menuItems;
  }

  async show(ctx, user = null) {
    try {
      console.log(`📋 Generating menu for user ${ctx.from.id}`);
      
      const userName = user ? user.full_name : (ctx.from.first_name || 'Пользователь');
      const userId = ctx.from.id.toString();
      
      const menuText = `${texts.menu.title}\n\nПривет, ${userName}! ${texts.menu.description}`;

      // Generate buttons based on user role
      const menuItems = this.generateMenuItems(userId);
      console.log('📋 Generated menu items:',
        menuItems.map(item => ({ text: item.text, callback: item.callback_data || item.callback }))
      );
      
      // Check button data correctness
      if (!Array.isArray(menuItems) || menuItems.length === 0) {
        console.error('❌ Error: empty menu items array');
        return { success: false, error: 'Empty menu items' };
      }
      
      const keyboard = createInlineKeyboard(menuItems, 2);
      console.log('⌨️ Keyboard created:', keyboard ? 'success' : 'error');
      
      // Additional keyboard validation
      if (!keyboard) {
        console.error('❌ Keyboard creation failed');
        return { success: false, error: 'Keyboard creation failed' };
      }

      await ctx.reply(menuText, keyboard);
      console.log('✅ Menu sent successfully');

      return { success: true };
    } catch (error) {
      console.error('❌ Error displaying main menu:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Test menu generation
console.log('🔍 Debugging menu buttons issue...\n');

// 1. Test menu items generation
console.log('1. Testing menu items generation:');
const mainMenu = new TestMainMenu();

// Test for regular user
console.log('\n   Regular user (456):');
const regularMenuItems = mainMenu.generateMenuItems('456');
console.log('   Generated items:', regularMenuItems.length);
regularMenuItems.forEach((item, index) => {
  console.log(`   ${index + 1}. "${item.text}" -> ${item.callback_data}`);
});

// Test for admin user
console.log('\n   Admin user (123):');
const adminMenuItems = mainMenu.generateMenuItems('123');
console.log('   Generated items:', adminMenuItems.length);
adminMenuItems.forEach((item, index) => {
  console.log(`   ${index + 1}. "${item.text}" -> ${item.callback_data}`);
});

// 2. Test keyboard creation
console.log('\n2. Testing keyboard creation:');
const keyboard = createInlineKeyboard(regularMenuItems, 2);
console.log('   Keyboard created:', !!keyboard);
console.log('   Keyboard structure:');
console.log(JSON.stringify(keyboard, null, 2));

// 3. Test complete menu display
console.log('\n3. Testing complete menu display:');

const mockCtx = {
  from: { id: 456, first_name: 'Test User' },
  reply: function(text, options) {
    console.log('   📤 Message would be sent:');
    console.log('   Text:', text.substring(0, 100) + '...');
    console.log('   Has options:', !!options);
    console.log('   Has keyboard:', !!(options && options.reply_markup));
    
    if (options && options.reply_markup) {
      const markup = options.reply_markup;
      console.log('   Keyboard type:', markup.inline_keyboard ? 'inline' : 'regular');
      if (markup.inline_keyboard) {
        console.log('   Rows:', markup.inline_keyboard.length);
        markup.inline_keyboard.forEach((row, rowIndex) => {
          console.log(`   Row ${rowIndex + 1}:`, row.map(btn => `"${btn.text}"`).join(', '));
        });
      }
    }
    
    return Promise.resolve();
  },
  callbackQuery: null
};

async function testCompleteMenu() {
  try {
    const mockUser = { full_name: 'Test User' };
    const result = await mainMenu.show(mockCtx, mockUser);
    console.log('   Result:', result);
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
}

testCompleteMenu().then(() => {
  console.log('\n✅ Debug test completed');
}).catch(err => {
  console.error('\n❌ Debug test failed:', err.message);
});