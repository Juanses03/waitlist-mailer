# WaitlistMailer



![GitHub](https://img.shields.io/badge/license-MIT-blue.svg) <img title="" src="file:///C:/Users/Juanse/Downloads/WaitlistMailer.webp" alt="Version" width="294" data-align="center">

The **WaitlistMailer** package is a tool designed to manage waitlists and send confirmation emails to registered users. It supports both local (`localStorage`) and database (`db`) storage and uses customizable HTML templates for confirmation emails.

---

## Table of Contents

1. [Project Description](#project-description)
2. [Key Features](#key-features)
3. [Installation](#installation)
4. [Usage](#usage)
   - [Initial Setup](#initial-setup)
   - [Adding Emails to the Waitlist](#adding-emails-to-the-waitlist)
   - [Sending Confirmation Emails](#sending-confirmation-emails)
5. [Local Storage vs Database](#local-storage-vs-database)
6. [HTML Template Example](#html-template-example)
7. [Common Errors](#common-errors)
8. [Contributions](#contributions)
9. [License](#license)

---

## Project Description

**WaitlistMailer** is a TypeScript class that allows you to manage a waitlist and send confirmation emails using **Nodemailer** [[1]]. The package is designed to be flexible and easy to integrate into modern web projects. It includes robust email validation using **Joi** [[2]], support for dynamic HTML templates, and options for both local and database storage.

---

## Key Features

- **Email Validation**: Uses Joi to validate email formats before adding them to the waitlist.
- **Flexible Storage**: Supports both local storage (`localStorage`) and database (`db`) storage.
- **Customizable Templates**: Allows the use of HTML templates to personalize confirmation email content.
- **Nodemailer Compatibility**: Sends emails using standard SMTP configurations.
- **Error Handling**: Provides clear error messages for common issues like duplicate emails or invalid formats.

---

## Installation

To install this package in your project, run the following command:

```bash
npm install waitlist-mailer
```

Make sure you have the necessary dependencies installed:

```bash
npm install nodemailer joi
```

---

## Usage

### Initial Setup

To use **WaitlistMailer**, first configure the SMTP transport and desired options:

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

You can add emails to the waitlist using the `addEmail` method. This method validates the email format and checks if it’s already registered:

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

You can send confirmation emails using template functions for the subject and body:

```typescript
const subjectTemplate = (email: string): string => `Welcome to our waitlist, ${email}!`;
const bodyTemplate = (email: string): string => `Hello ${email},\n\nThank you for registering on our waitlist.`;

mailer.sendConfirmation('user@example.com', subjectTemplate, bodyTemplate);
```

#### Using HTML Files

You can also send emails using HTML files as templates. Ensure placeholders (`{{ email }}`, `{{ companyName }}`) are replaced in the file:

```typescript
mailer.sendConfirmationFromFile(
  'user@example.com',
  (email: string) => `Welcome to our waitlist, ${email}!`,
  './templates/waitlist-confirmation.html',
  { customMessage: 'We are thrilled to have you with us.' }
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

Here’s an example of an HTML template you can use for confirmation emails:

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

1. **Invalid Email**: If the email format is invalid, the `addEmail` method will return `false`.
2. **Duplicate Email**: If the email is already registered, the `addEmail` method will also return `false`.
3. **Template File Not Found**: If the specified HTML file does not exist, the `sendConfirmationFromFile` method will fail.

---

## Contributions

Contributions are welcome! If you’d like to improve this project, follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/new-feature`).
3. Make your changes and commit them (`git commit -m "Add new feature"`).
4. Push your changes (`git push origin feature/new-feature`).
5. Open a pull request.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
