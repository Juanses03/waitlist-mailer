# WaitlistMailer

[![npm project link](https://img.shields.io/badge/npm-waitlist--mailer-red.svg)](https://www.npmjs.com/package/waitlist-mailer)  
[![GitHub](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)  
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://www.npmjs.com/package/waitlist-mailer)  
[![Nodejs](https://img.shields.io/badge/node.js-%3E%3D14-blue.svg)](https://nodejs.org)  
[![MongoDB](https://img.shields.io/badge/MongoDB-supported-green.svg)](https://www.mongodb.com)  
[![PostgreSQL/MySQL](https://img.shields.io/badge/PostgreSQL%2FMySQL-supported-green.svg)](https://www.postgresql.org)  
[![Downloads](https://img.shields.io/npm/dt/waitlist-mailer.svg)](https://www.npmjs.com/package/waitlist-mailer)  

**WaitlistMailer** is a TypeScript-based NPM package for managing waitlists and sending confirmation emails. It supports **local**, **MongoDB**, and **SQL (PostgreSQL/MySQL)** storage, with **customizable HTML templates**, an **event-driven architecture**, and advanced features like **bulk sending**, **automatic retries**, **Joi validation**, and **query capabilities**.

The **1.0.0 version** introduces **bulk email sending**, **indexed database storage**, and **advanced queries**.

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

**Version 1.0.0** adds:
- **Bulk email sending** for efficient mass communication  
- **Indexed MongoDB and SQL storage** for optimized performance  
- **Advanced queries** for searching and aggregating waitlist data  

---

## Key Features

- **Email Validation**: Strict validation using Joi  
- **Storage Options**: Local (in-memory), MongoDB (`Waitlist` collection), or SQL (`waitlist` table)  
- **Dynamic Templates**: HTML emails with inline or file-based templates  
- **Nodemailer Integration**: Reliable SMTP delivery  
- **Event-Driven**: Emits events like `onEmailSent`, `onBulkConfirmationComplete`  
- **Retries**: Automatic retry for failed email sends  
- **Bulk Sending**: Mass emailing with retry support (v1.0.0)  
- **Database Indexing**: Indexed `email` and `createdAt` fields (v1.0.0)  
- **Advanced Queries**: Pattern-based search and date range counting (v1.0.0)  

> ⚠️ **Note**: Requires Node.js >= 14. Install via `npm install waitlist-mailer`.

---

## Installation

```bash
npm install waitlist-mailer@1.0.0 nodemailer joi events mongoose sequelize pg mysql2
```

### Dependencies
- **nodemailer**: Email sending  
- **joi**: Email validation  
- **mongoose**: MongoDB support (optional)  
- **sequelize, pg, mysql2**: SQL support (optional)

### Environment Variables
Create a `.env.local` file:

```ini
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
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
Initialize with storage type (local, db, or sql) and configuration:

```typescript
import WaitlistMailer from 'waitlist-mailer';

const mailConfig = {
  host: process.env.SMTP_HOST!,
  port: parseInt(process.env.SMTP_PORT!),
  user: process.env.SMTP_USER!,
  pass: process.env.SMTP_PASS!,
};

// SQL Example
const mailer = new WaitlistMailer('sql', mailConfig, {
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

// MongoDB Example
// const mailer = new WaitlistMailer('db', mailConfig, { mongoUri: process.env.MONGO_URI! });

// Local Example
// const mailer = new WaitlistMailer('local', mailConfig);

await mailer.waitForInitialization(); // Wait for DB connection if applicable
```

### Adding Emails to the Waitlist

```typescript
const success = mailer.addEmail('user@example.com');
console.log(success ? 'Email added' : 'Failed (invalid or duplicate)');
```

### Removing Emails

```typescript
const removed = mailer.removeEmail('user@example.com');
console.log(removed ? 'Email removed' : 'Email not found');
```

### Viewing the Waitlist

```typescript
const emails = mailer.getWaitlist();
console.log('Current waitlist:', emails);
```

### Clearing the Waitlist

```typescript
mailer.clearWaitlist();
console.log('Waitlist cleared');
```

### Sending Confirmation Emails

#### Using Template Functions

```typescript
const subjectTemplate = (email: string) => `Welcome, ${email}!`;
const bodyTemplate = (email: string) => `<h1>Hello ${email}</h1><p>Welcome to [Company Name]!</p>`;

const sent = await mailer.sendConfirmation('user@example.com', subjectTemplate, bodyTemplate);
console.log(sent ? 'Email sent' : 'Failed to send');
```

#### Using HTML Files
Create `templates/confirmation.html`:

```html
<h1>Welcome, {{email}}!</h1>
<p>Thanks for joining {{companyName}}. {{customMessage}}</p>
```

```typescript
const sent = await mailer.sendConfirmationFromFile(
  'user@example.com',
  (email) => `Welcome, ${email}!`,
  './templates/confirmation.html',
  { customMessage: 'We're excited to have you!' }
);
console.log(sent ? 'Email sent' : 'Failed to send');
```

#### With Retries

```typescript
const sent = await mailer.sendConfirmationWithRetry(
  'user@example.com',
  (email) => `Welcome, ${email}!`,
  (email) => `<p>Hello ${email}</p>`,
  3, // retries
  1000 // delay in ms
);
console.log(sent ? 'Email sent after retries' : 'Failed after retries');
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
mailer.on('onBulkConfirmationComplete', ({ successCount, total }) => console.log(`Bulk: ${successCount}/${total}`));
mailer.on('onWaitlistSaved', (emails) => console.log('Saved:', emails));
mailer.on('onError', ({ email, action, error }) => console.error(`Error in ${action} for ${email}:`, error));
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
new WaitlistMailer(storage: 'local' | 'db' | 'sql', mailConfig: MailConfig, options?: WaitlistMailerOptions)
```
- **storage**: Storage type (default: 'local')
- **mailConfig**: { host: string, port: number, user: string, pass: string }
- **options**: { companyName?: string, mongoUri?: string, sqlConfig?: { dialect: 'postgres' | 'mysql', host: string, port: number, username: string, password: string, database: string } }

### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| addEmail(email: string) | Adds a validated, unique email | boolean |
| removeEmail(email: string) | Removes an email if it exists | boolean |
| getWaitlist() | Returns all emails as an array | string[] |
| clearWaitlist() | Clears in-memory and persistent waitlist | void |
| isInitialized() | Checks if initialization is complete | boolean |
| waitForInitialization() | Waits for async setup to finish | Promise<void> |
| sendConfirmation(email, subjectTemplate, bodyTemplate) | Sends an email with templates | Promise<boolean> |
| sendConfirmationFromFile(email, subjectTemplate, templateFilePath, replacements) | Sends using an HTML file | Promise<boolean> |
| sendConfirmationWithRetry(email, subjectTemplate, bodyTemplate, retries, delayMs) | Sends with retries | Promise<boolean> |
| sendBulkConfirmation(subjectTemplate, bodyTemplate, retries, delayMs) | Sends to all emails | Promise<number> |
| saveWaitlist() | Persists waitlist to storage | Promise<boolean> |
| findEmailsByPattern(pattern: string) | Finds emails matching a pattern | Promise<string[]> |
| countWaitlistByDate(startDate?: Date, endDate?: Date) | Counts emails by date range | Promise<number> |
| close() | Closes database and transporter | Promise<void> |

### Events

- `onEmailAdded(email: string)`  
- `onEmailRemoved(email: string)`  
- `onEmailSent(email: string, info: SentMessageInfo)`  
- `onEmailRetry(email: string, attempt: number)`  
- `onBulkConfirmationComplete({ successCount: number, total: number })`  
- `onWaitlistSaved(emails: string[])`  
- `onWaitlistCleared()`  
- `onValidationError({ email: string, error: string })`  
- `onDuplicateEmail(email: string)`  
- `onError({ email: string, action: string, error: unknown })`  
- `onTransporterReady()`  
- `onTransporterError(error: Error)`  
- `onDbConnected()`  
- `onDbError(error: Error)`  
- `onSqlConnected()`  
- `onSqlError(error: Error)`  
- `onInitialized()`

---

## Common Errors

- **SMTP Connection Refused**: Invalid mailConfig  
  Fix: Verify host, port, user, pass
- **Invalid Email**: Format error (e.g., user@)  
  Fix: Use valid email (e.g., user@example.com)
- **Duplicate Email**: Email already in waitlist  
  Fix: Check getWaitlist() or handle onDuplicateEmail
- **File Not Found**: Wrong templateFilePath  
  Fix: Ensure file exists and path is correct
- **Database Failure**: Invalid mongoUri or sqlConfig  
  Fix: Check DB server and credentials

---

## Contributions

- Fork the repo  
- Submit pull requests  
- Report issues on GitHub

---

## License

MIT - Free to use, modify, and distribute with attribution.

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | March 3, 2025 | - Stable release with bulk sending<br>- Indexed MongoDB (Waitlist) and SQL (waitlist) storage<br>- Advanced queries: findEmailsByPattern, countWaitlistByDate<br>- Centralized error handling<br>- Enhanced modularity |
| 0.1.0 | TBD | - Pre-release: Basic waitlist and email sending<br>- Local storage only<br>- Initial event system |

⚠️ Future: UI integration may be considered for later versions.

---