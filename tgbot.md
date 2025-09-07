---
alwaysApply: true
---

# Telegram Bot Rules – Event Reminder Bot

## **Modular Organization**

All modules are separated into folders:

- `database/` – database operations
- `features/` – functional modules
- `utils/` – reusable utilities
- `bot/` – bot core logic and launch
- `interface/` – UI components
- `docs/` – documentation

---

## **Documentation**

### **Code Comments**

- For complex logic – bilingual comments:  
  // [RU] Отправка напоминаний по расписанию  
  // [EN] Scheduled reminders delivery

- Simple comments – in Russian
- JSDoc – in English only

### **README Files**

- `/docs/README.ru.md` – full Russian version
- `/README.md` – brief English summary

---

## **File Structure**

- Each functionality in a separate file
- Maximum file size: 300 lines
- File naming format: _kebab-case_

---

## **Database**

### **Core Tables**

- `users` (id, telegram_id, full_name, created_at)
- `user_responses` (id, user_id, message, created_at)
- `scheduled_messages` (id, message_text, send_date)
- `delivery_logs` (id, user_id, message_id, sent_at, status)

### **Principles**

- All relations via `FOREIGN KEY`
- Use `ON DELETE CASCADE` for dependent records
- Add indexes on frequently used fields

---

## **Functional Modules**

- `onboarding/` – welcome and collect user response
- `reminder-scheduler/` – schedule future reminders
- `message-delivery/` – send scheduled messages

Each module contains:

- `logic.js` – business logic
- `api.js` – external connections (if any)

---

## **Interface**

UI screen files:

- `main-menu.js`
- `welcome-screen.js`
- `user-response.js`
- `upcoming-events.js`

All texts are stored in `/bot/texts.js`

---

## **Reusable Components**

Common utility functions stored in `utils/`:

- `date-utils.js`
- `format-utils.js`
- `db-utils.js`
- `message-helpers.js`

---

## **Technologies**

- Telegraf
- sqlite3
- dotenv
- winston

> Additional libraries may be introduced if justified

---

## **Development Principles**

- No global variables allowed
- Mandatory error handling
- Max cyclomatic complexity: 10
- DRY (Don’t Repeat Yourself) principle
- KISS principle

---

## **Testing**

### **Test Structure**
- All tests are placed in `tests/` directory
- Subcategories: `unit/`, `integration/`, `debug/`, `isolated/`
- New tests created via `npm run create-test`

### **Naming Rules**
- Prefix `test-` for all test files
- Placement only in `tests/` directory and subfolders
- Use templates for consistency

### **Test Scripts**
- `npm test` - all tests
- `npm run test:unit` - unit tests
- `npm run test:integration` - integration tests
- `npm run test:debug` - debug tests
- `npm run test:isolated` - isolated tests
- `npm run test:watch` - with change monitoring
- `npm run test:coverage` - with code coverage

### **Creating New Tests**
```bash
# Unit test
npm run create-test unit feature-name

# Integration test
npm run create-test integration workflow-name

# Debug test
npm run create-test debug issue-name

# Isolated test
npm run create-test isolated component-name
```

### **Test Cases**

- User onboarding and response saving
- Message scheduling
- Successful message delivery

---

## **Localization**

- All text content is managed in `/bot/texts.js`

---

## **Text Format Example**

module.exports = {
welcome: {
title: "👋 Welcome!",
prompt: "Please reply if you're attending the event:"
},
reminders: {
upcoming: "📅 Don't forget: the event is coming soon!",
confirmed: "✅ Thank you for your response!"
}
};

---

## **Important SQL Indexes**

CREATE INDEX idx_user_responses_user ON user_responses(user_id);
CREATE INDEX idx_scheduled_messages_date ON scheduled_messages(send_date);
CREATE INDEX idx_delivery_logs_user_message ON delivery_logs(user_id, message_id);
