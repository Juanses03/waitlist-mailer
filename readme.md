# WaitlistMailer

[---->npm project link<<----](https://www.npmjs.com/package/waitlist-mailer)

![GitHub](https://img.shields.io/badge/license-MIT-blue.svg)

<img title="" src="WaitlistMailer.jpg" alt="Version" width="294" data-align="center">

The **WaitlistMailer** package is a tool designed to manage waitlists and send confirmation emails to registered users. It supports both local (`localStorage`) and database (`db`) storage, uses customizable HTML templates for confirmation emails, and includes advanced features like event-driven notifications, a retry mechanism, and robust email validation using **Joi**.

---

## Table of Contents

1. [Project Description](#project-description)
2. [Key Features](#key-features)
3. [Installation](#installation)
4. [Usage](#usage)
   - [Initial Setup](#initial-setup)
   - [Adding Emails to the Waitlist](#adding-emails-to-the-waitlist)
   - [Sending Confirmation Emails](#sending-confirmation-emails)
   - [Event Handling](#event-handling)
   - [Retry Mechanism](#retry-mechanism)
5. [Local Storage vs Database](#local-storage-vs-database)
6. [HTML Template Example](#html-template-example)
7. [Common Errors](#common-errors)
8. [Contributions](#contributions)
9. [License](#license)

---

## Project Description

**WaitlistMailer** is a TypeScript class that allows you to manage a waitlist and send confirmation emails using **Nodemailer**. The package is designed to be flexible and easy to integrate into modern web projects. It includes robust email validation using **Joi**, support for dynamic HTML templates, event-driven notifications, and options for both local and database storage.

---

## Key Features

- **Email Validation**: Uses Joi to validate email formats before adding them to the waitlist.
- **Flexible Storage**: Supports both local storage (`localStorage`) and database (`db`) storage.
- **Customizable Templates**: Personalize confirmation emails with dynamic placeholders in your HTML templates.
- **Nodemailer Integration**: Sends emails using standard SMTP configurations.
- **Event-Driven Architecture**: Emits events for key actions (e.g., `emailAdded`, `emailRemoved`, `emailSent`, `emailSendError`, `emailSendRetry`, `waitlistSaved`, and `waitlistCleared`).
- **Retry Mechanism**: Automatically retries sending confirmation emails upon failure.

> **Note:** Real-time invalid email detection has been removed since most SMTP providers (like Gmail) accept the message and later generate a bounce asynchronously. For testing purposes, you can simulate errors if needed.

---

## Installation

To install this package in your project, run the following command:

```bash
npm install waitlist-mailer
```

Make sure you have the necessary dependencies installed:

```bash
npm install
```

---

## Usage

### Initial Setup

Configure the SMTP transport and desired options:

```typescript
import WaitlistMailer from 'waitlist-mailer';

const mailConfig = {
  host: process.env.SMTP_HOST!,
  port: parseInt(process.env.SMTP_PORT!),
  user: process.env.SMTP_USER!,
  pass: process.env.SMTP_PASS!,
};

const mailer = new WaitlistMailer('local', mailConfig, { companyName: 'Your Company Name' });
```

### Adding Emails to the Waitlist

Add emails to the waitlist using the `addEmail` method. This method validates the email format and checks for duplicates:

```typescript
const success = mailer.addEmail('user@example.com');
if (success) {
  console.log('Email added successfully.');
} else {
  console.log('Failed to add email.');
}
```

### Sending Confirmation Emails

#### Using Template Functions

Send confirmation emails using template functions for the subject and body:

```typescript
const subjectTemplate = (email: string): string => `Welcome to our waitlist, ${email}!`;
const bodyTemplate = (email: string): string => `Hello ${email},\n\nThank you for registering on our waitlist.`;

mailer.sendConfirmation('user@example.com', subjectTemplate, bodyTemplate);
```

#### Using HTML Files

Send emails using HTML files as templates. Ensure placeholders (e.g., `{{ email }}`, `{{ companyName }}`) are included in the template:

```typescript
mailer.sendConfirmationFromFile(
  'user@example.com',
  (email: string) => `Welcome to our waitlist, ${email}!`,
  './templates/waitlist-confirmation.html',
  { customMessage: 'We are thrilled to have you with us.' }
);
```

### Event Handling

The package extends the EventEmitter, allowing you to subscribe to events for various actions. Some key events include:

- **emailAdded**: Emitted when an email is successfully added.
- **emailRemoved**: Emitted when an email is removed.
- **emailSent**: Emitted when a confirmation email is successfully sent.
- **emailSendError**: Emitted when there is an error sending an email.
- **emailSendRetry**: Emitted on each retry attempt for sending an email.
- **waitlistSaved**: Emitted after the waitlist is saved.
- **waitlistCleared**: Emitted when the waitlist is cleared.

Example of subscribing to an event:

```typescript
mailer.on('emailSent', (email, info) => {
  console.log(`Confirmation email sent to: ${email}`, info);
});
```

### Retry Mechanism

Send confirmation emails with automatic retries using the `sendConfirmationWithRetry` method:

```typescript
mailer.sendConfirmationWithRetry(
  'user@example.com',
  subjectTemplate,
  bodyTemplate,
  3,       // Number of retries
  1000     // Delay between retries in milliseconds
);
```

---

## Local Storage vs Database

### Local Storage

When using the `local` mode, emails are stored in memory during the program's execution. This is useful for quick testing or small prototypes.

### Database Storage

If you select the `db` mode, ensure you implement the logic to save emails in your database. You can use libraries like **Mongoose** for MongoDB or **Sequelize** for SQL databases.

---

## HTML Template Example

Here’s an example of an HTML template for confirmation emails:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f9; color: #333; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
    <h1 style="color: #007bff;">Hello, {{ email }}!</h1>
    <p>Thank you for registering on our waitlist.</p>
    <p>{{ customMessage }}</p>
    <p>We will contact you soon with more information.</p>
    <p><strong>The {{ companyName }} Team</strong></p>
  </div>
</body>
</html>
```

---

## Common Errors

1. **Invalid Email Format**:  
   The `addEmail` method will return `false` if the email format is invalid.

2. **Duplicate Email**:  
   The `addEmail` method will return `false` if the email is already registered.

3. **Template File Not Found**:  
   The `sendConfirmationFromFile` method will fail if the specified HTML file does not exist.

---

## Contributions

Contributions are welcome! To contribute:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/new-feature`).
3. Make your changes and commit them (`git commit -m "Add new feature"`).
4. Push your changes (`git push origin feature/new-feature`).
5. Open a pull request.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
