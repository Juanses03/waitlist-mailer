# WaitlistMailer

[![npm project link](https://img.shields.io/badge/npm-waitlist--mailer-red.svg)](https://www.npmjs.com/package/waitlist-mailer)  
[![GitHub](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)  
[![Version](https://img.shields.io/badge/version-1.1.0-green.svg)](https://www.npmjs.com/package/waitlist-mailer)  
[![Nodejs](https://img.shields.io/badge/node.js-%3E%3D14-blue.svg)](https://nodejs.org)  
[![MongoDB](https://img.shields.io/badge/MongoDB-supported-green.svg)](https://www.mongodb.com)  
[![PostgreSQL/MySQL/SQLite](https://img.shields.io/badge/PostgreSQL%2FMySQL%2FSQLite-supported-green.svg)](https://www.postgresql.org)  
[![Downloads](https://img.shields.io/npm/dt/waitlist-mailer.svg)](https://www.npmjs.com/package/waitlist-mailer)  

**WaitlistMailer** is a TypeScript-based NPM package for managing waitlists and sending confirmation emails. It supports **local**, **MongoDB**, and **SQL (PostgreSQL/MySQL/SQLite)** storage, with **customizable HTML templates**, an **event-driven architecture**, and advanced features like **bulk sending**, **automatic retries**, **validator.js validation**, and **query capabilities**.

---

## What's New in Version 1.1.0

- **Improved Error Handling**: Detailed event emissions for better debugging and error tracking.  
- **Support for Multiple SMTP Providers**: Now works with any SMTP provider, not just Gmail.  
- **Handlebars Integration**: Dynamic and reusable email templates using Handlebars.  
- **Comprehensive Test Suite**: Full test coverage for all core functionalities.  
- **Persistent Storage**: Data remains in the database unless explicitly cleared.  

---

## Table of Contents

- [Description](#description)  
- [Key Features](#key-features)  
- [Installation](#installation)  
- [Usage](#usage)  
  - [Initial Setup](#initial-setup)  
  - [Adding Emails to the Waitlist](#adding-emails-to-the-waitlist)  
  - [Removing Emails](#removing-emails)  
  - [Viewing the Waitlist](#viewing-the-waitlist)  
  - [Clearing the Waitlist](#clearing-the-waitlist)  
  - [Sending Confirmation Emails](#sending-confirmation-emails)  
  - [Bulk Email Sending](#bulk-email-sending)  
  - [Saving the Waitlist](#saving-the-waitlist)  
  - [Advanced Queries](#advanced-queries)  
  - [Event Handling](#event-handling)  
  - [Closing Resources](#closing-resources)  
- [API](#api)  
- [Common Errors](#common-errors)  
- [Contributions](#contributions)  
- [License](#license)  
- [Version History](#version-history)  

---

## Description

**WaitlistMailer** simplifies waitlist management in **Node.js** with robust email validation, flexible storage options, and efficient email delivery via **Nodemailer**. It's designed for scalability and ease of use, supporting both in-memory and persistent storage with MongoDB or SQL databases.

---

## Key Features

- **Email Validation**: Strict validation using `validator.js`.  
- **Storage Options**: Local (in-memory), MongoDB (`Waitlist` collection), or SQL (`waitlist` table: PostgreSQL/MySQL/SQLite).  
- **Dynamic Templates**: HTML emails with Handlebars for inline or file-based templates.  
- **Nodemailer Integration**: Reliable SMTP delivery with support for multiple providers.  
- **Event-Driven**: Emits events like `onEmailSent`, `onBulkConfirmationComplete`, and `onWaitlistSaved`.  
- **Retries**: Automatic retry for failed email sends.  
- **Bulk Sending**: Mass emailing with retry support.  
- **Database Indexing**: Indexed `email` and `createdAt` fields for optimized queries.  
- **Advanced Queries**: Pattern-based search and date range counting.  

> ⚠️ **Note**: Requires Node.js >= 14. Install via `npm install waitlist-mailer`.

---

## Installation

```bash
npm install waitlist-mailer@1.1.0 nodemailer validator events mongoose sequelize pg mysql2 sqlite3 handlebars
```

### Dependencies
- **validator**: Email validation.  
- **mongoose**: MongoDB support (optional).  
- **sequelize, pg, mysql2, sqlite3**: SQL support (optional).  
- **handlebars**: Dynamic template rendering.  

### Environment Variables
Create `.env.local`:

```ini
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
MONGO_URI=mongodb://localhost:27017/waitlistdb
SQL_DIALECT=mysql
SQL_HOST=localhost
SQL_PORT=3306
SQL_USER=root
SQL_PASSWORD=
SQL_DATABASE=waitlistdb
```

---

## Usage

### Initial Setup
```typescript
import WaitlistMailer, { StorageType } from 'waitlist-mailer';

const mailConfig = {
  host: process.env.SMTP_HOST!,
  port: parseInt(process.env.SMTP_PORT!),
  user: process.env.SMTP_USER!,
  pass: process.env.SMTP_PASS!,
};

// SQL Example (MySQL)
const mailer = new WaitlistMailer(StorageType.Sql, mailConfig, {
  companyName: 'My Company',
  sqlConfig: {
    dialect: 'mysql',
    host: process.env.SQL_HOST!,
    port: parseInt(process.env.SQL_PORT!),
    username: process.env.SQL_USER!,
    password: process.env.SQL_PASSWORD!,
    database: process.env.SQL_DATABASE!,
  },
});

await mailer.waitForInitialization();
```

### Adding Emails to the Waitlist
```typescript
const success = await mailer.addEmail('user@example.com');
console.log(success ? 'Email added' : 'Failed (invalid or duplicate)');
```

### Removing Emails
```typescript
const removed = await mailer.removeEmail('user@example.com');
console.log(removed ? 'Email removed' : 'Email not found');
```

### Viewing the Waitlist
```typescript
const emails = mailer.getWaitlist();
console.log('Current waitlist:', emails);
```

### Clearing the Waitlist
```typescript
await mailer.clearWaitlist();
console.log('Waitlist cleared');
```

### Sending Confirmation Emails
#### Using Handlebars Templates
Create `templates/confirmation.hbs`:
```html
<h1>Welcome, {{email}}!</h1>
<p>Thanks for joining {{companyName}}. {{customMessage}}</p>
```

```typescript
const sent = await mailer.sendConfirmationFromFile(
  'user@example.com',
  (email) => `Welcome, ${email}!`,
  './templates/confirmation.hbs',
  { customMessage: 'We\'re excited to have you!' }
);
console.log(sent ? 'Email sent' : 'Failed to send');
```

### Bulk Email Sending
```typescript
const subjectFn = (email) => `Hello, ${email}!`;
const bodyFn = (email) => `<h1>Welcome</h1><p>Join us, ${email}!</p>`;

const successCount = await mailer.sendBulkConfirmation(subjectFn, bodyFn, 3, 1000);
console.log(`Sent to ${successCount} users`);
```

⚠️ **Warning**: Check SMTP rate limits (e.g., Gmail: 500/day).

### Saving the Waitlist
```typescript
const saved = await mailer.saveWaitlist();
console.log(saved ? 'Waitlist saved' : 'Failed to save');
```

### Advanced Queries
#### Find Emails by Pattern
```typescript
const matches = await mailer.findEmailsByPattern('example');
console.log('Matching emails:', matches); // e.g., ['user@example.com']
```

#### Count by Date Range
```typescript
const count = await mailer.countWaitlistByDate(
  new Date('2023-01-01'),
  new Date('2023-12-31')
);
console.log(`Emails in 2023: ${count}`);
```

### Event Handling
```typescript
mailer.on('onEmailAdded', (email) => console.log(`Added: ${email}`));
mailer.on('onEmailRemoved', (email) => console.log(`Removed: ${email}`));
mailer.on('onEmailSent', (email, info) => console.log(`Sent to ${email}: ${info.messageId}`));
mailer.on('onEmailRetry', (email, attempt) => console.log(`Retrying ${email}, attempt ${attempt}`));
mailer.on('onBulkConfirmationComplete', ({ successCount, total }) => console.log(`Bulk: ${successCount}/${total}`));
mailer.on('onWaitlistSaved', (emails) => console.log('Saved:', emails));
mailer.on('onWaitlistCleared', () => console.log('Waitlist cleared'));
mailer.on('onValidationError', ({ message }) => console.error(`Validation error: ${message}`));
mailer.on('onDuplicateEmail', (email) => console.log(`Duplicate email: ${email}`));
mailer.on('onError', ({ context, message, error }) => console.error(`Error in ${context}: ${message}`, error));
mailer.on('onTransporterReady', () => console.log('Transporter ready'));
mailer.on('onTransporterError', (error) => console.error('Transporter error:', error));
mailer.on('onDbConnected', () => console.log('MongoDB connected'));
mailer.on('onDbError', (error) => console.error('MongoDB error:', error));
mailer.on('onSqlConnected', () => console.log('SQL connected'));
mailer.on('onSqlError', (error) => console.error('SQL error:', error));
mailer.on('onInitialized', () => console.log('WaitlistMailer initialized'));
```

### Closing Resources
```typescript
await mailer.close();
console.log('Resources closed');
```

---

## API

### Constructor
```typescript
new WaitlistMailer(storage: StorageType, mailConfig: MailConfig, options?: WaitlistMailerOptions)
```
- **storage**: Storage type (`Local`, `Db`, or `Sql`).  
- **mailConfig**: { host: string, port: number, user: string, pass: string }.  
- **options**: { companyName?: string, mongoUri?: string, sqlConfig?: SQL config object }.  

### Methods
| Method | Description | Returns |
|--------|-------------|---------|
| `addEmail(email)` | Adds validated email | `Promise<boolean>` |
| `removeEmail(email)` | Removes email | `Promise<boolean>` |
| `getWaitlist()` | Returns all emails | `string[]` |
| `clearWaitlist()` | Clears waitlist | `Promise<void>` |
| `sendConfirmation(...)` | Sends email | `Promise<boolean>` |
| `sendBulkConfirmation(...)` | Bulk emails | `Promise<number>` |
| `saveWaitlist()` | Persists waitlist to storage | `Promise<boolean>` |
| `findEmailsByPattern(pattern)` | Finds emails matching a pattern | `Promise<string[]>` |
| `countWaitlistByDate(start, end)` | Counts emails by date range | `Promise<number>` |
| `close()` | Closes database connections | `Promise<void>` |

### Events
- `onEmailAdded(email: string)`  
- `onEmailRemoved(email: string)`  
- `onEmailSent(email: string, info: SentMessageInfo)`  
- `onEmailRetry(email: string, attempt: number)`  
- `onBulkConfirmationComplete({ successCount: number, total: number })`  
- `onWaitlistSaved(emails: string[])`  
- `onWaitlistCleared()`  
- `onValidationError({ message: string })`  
- `onDuplicateEmail(email: string)`  
- `onError({ context: string, message: string, error: unknown })`  
- `onTransporterReady()`  
- `onTransporterError(error: Error)`  
- `onDbConnected()`  
- `onDbError(error: Error)`  
- `onSqlConnected()`  
- `onSqlError(error: Error)`  
- `onInitialized()`  

---

## Common Errors

- **SMTP Connection Refused**: Invalid mailConfig.  
  Fix: Verify host, port, user, and pass.  
- **Invalid Email**: Format error.  
  Fix: Use valid email format.  
- **Duplicate Email**: Already in waitlist.  
  Fix: Check existing emails.  

---

## Contributions

- Fork the repo.  
- Submit pull requests.  
- Report issues.  

---

## License

MIT - Free to use, modify, and distribute with attribution.

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.1.0 | March 5, 2025 | - Improved error handling<br>- Support for multiple SMTP providers<br>- Handlebars for templates<br>- Comprehensive tests |
| 1.0.0 | March 3, 2025 | - Bulk sending<br>- Database indexing |
| 0.1.0 | TBD | Initial release |

---