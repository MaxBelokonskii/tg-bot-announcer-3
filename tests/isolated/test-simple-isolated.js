/**
 * Simple isolated test for menu functionality
 */

console.log('Starting simple menu test...');

// Test 1: Basic require
try {
  console.log('1. Testing basic requires...');
  const texts = require('../../bot/texts');
  console.log('   texts.js loaded:', !!texts);
  console.log('   menu title:', texts.menu.title);
  
  const { createInlineKeyboard } = require('../../utils/message-helpers');
  console.log('   message-helpers loaded:', !!createInlineKeyboard);
} catch (error) {
  console.error('   Error in requires:', error.message);
  process.exit(1);
}

// Test 2: Button creation
try {
  console.log('2. Testing button creation...');
  const { createInlineKeyboard } = require('../../utils/message-helpers');
  
  const testButtons = [
    { text: 'Button 1', callback_data: 'test1' },
    { text: 'Button 2', callback_data: 'test2' }
  ];
  
  const keyboard = createInlineKeyboard(testButtons, 2);
  console.log('   Keyboard created:', !!keyboard);
  console.log('   Keyboard structure exists:', !!keyboard.reply_markup);
} catch (error) {
  console.error('   Error in button creation:', error.message);
}

// Test 3: Text loading
try {
  console.log('3. Testing menu texts...');
  const texts = require('../../bot/texts');
  
  console.log('   Menu buttons object exists:', !!texts.menu.buttons);
  console.log('   Change attendance button:', texts.menu.buttons.changeAttendance);
  console.log('   Event details button:', texts.menu.buttons.eventDetails);
  console.log('   Upcoming events button:', texts.menu.buttons.upcomingEvents);
} catch (error) {
  console.error('   Error in text loading:', error.message);
}

console.log('Simple test completed.');