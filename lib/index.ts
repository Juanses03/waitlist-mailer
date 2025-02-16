import nodemailer from 'nodemailer';
import { readFile } from 'fs/promises';
import Joi from 'joi';
import { EventEmitter } from 'events';

interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

interface WaitlistMailerOptions {
  companyName?: string;
}

/**
 * Class to manage the waitlist and send confirmation emails.
 * Supports both local and database storage, and extends EventEmitter
 * to allow event subscriptions for various actions.
 */
class WaitlistMailer extends EventEmitter {
  private storage: 'local' | 'db';
  private waitlist: Set<string>;
  private transporter: nodemailer.Transporter;
  private companyName: string;

  /**
   * Initializes the WaitlistMailer instance.
   * @param storage - Storage type ('local' or 'db').
   * @param mailConfig - SMTP transporter configuration.
   * @param options - Optional settings (e.g., company name).
   */
  constructor(
    storage: 'local' | 'db' = 'local',
    mailConfig: MailConfig,
    options?: WaitlistMailerOptions
  ) {
    super();
    this.storage = storage;
    this.waitlist = new Set();
    this.companyName = options?.companyName || "Your Company Name";

    // Initialize Nodemailer transporter with provided mail configuration
    this.transporter = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.port === 465, // true for port 465 (SSL)
      auth: {
        user: mailConfig.user,
        pass: mailConfig.pass,
      },
    });
  }

  /**
   * Validates the format of an email address using Joi.
   * @param email - Email address to validate.
   * @returns True if the email is valid, false otherwise.
   */
  private isValidEmail(email: string): boolean {
    const schema = Joi.string().email({ tlds: { allow: false } });
    const { error } = schema.validate(email);
    if (error) {
      console.error(`Validation error for email ${email}:`, error.message);
      return false;
    }
    return true;
  }

  /**
   * Checks if an email is already registered in the waitlist.
   * @param email - Email address to check.
   * @returns True if the email is registered, false otherwise.
   */
  private isEmailRegistered(email: string): boolean {
    return this.waitlist.has(email);
  }

  /**
   * Adds an email address to the waitlist if it is valid and unique.
   * @param email - Email address to add.
   * @returns True if the email was added successfully, false otherwise.
   */
  addEmail(email: string): boolean {
    if (!this.isValidEmail(email)) {
      console.error(`Invalid email format: ${email}`);
      return false;
    }

    if (this.isEmailRegistered(email)) {
      console.error(`Email already registered: ${email}`);
      return false;
    }

    this.waitlist.add(email);
    console.log(`Email added: ${email}`);
    this.emit('emailAdded', email);
    return true;
  }

  /**
   * Removes an email address from the waitlist.
   * @param email - Email address to remove.
   * @returns True if the email was removed successfully, false otherwise.
   */
  removeEmail(email: string): boolean {
    if (!this.isEmailRegistered(email)) {
      console.error(`Email not registered: ${email}`);
      return false;
    }
    this.waitlist.delete(email);
    console.log(`Email removed: ${email}`);
    this.emit('emailRemoved', email);
    return true;
  }

  /**
   * Retrieves the list of email addresses in the waitlist.
   * @returns An array of email addresses.
   */
  getWaitlist(): string[] {
    return Array.from(this.waitlist);
  }

  /**
   * Clears the waitlist.
   */
  clearWaitlist(): void {
    this.waitlist.clear();
    console.log('Waitlist cleared');
    this.emit('waitlistCleared');
  }

  /**
   * Sends an email using Nodemailer.
   * @param email - Recipient email address.
   * @param subject - Email subject.
   * @param htmlContent - Email HTML content.
   * @returns True if the email was sent successfully, false otherwise.
   */
  private async sendMail(email: string, subject: string, htmlContent: string): Promise<boolean> {
    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${this.companyName}" <${(this.transporter.options as any).auth?.user}>`,
      to: email,
      subject,
      html: htmlContent,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Confirmation email sent to: ${email}`);
      console.log('Message ID:', info.messageId);
      this.emit('emailSent', email, info);
      return true;
    } catch (error: any) {
      console.error(`Error sending email to ${email}:`, error);
      this.emit('emailSendError', email, error);
      return false;
    }
  }

  /**
   * Sends a confirmation email using template functions.
   * @param email - Recipient email address.
   * @param subjectTemplate - Function that generates the email subject.
   * @param bodyTemplate - Function that generates the email body (HTML).
   * @returns True if the email was sent successfully, false otherwise.
   */
  async sendConfirmation(
    email: string,
    subjectTemplate: (email: string) => string,
    bodyTemplate: (email: string) => string
  ): Promise<boolean> {
    if (!this.isEmailRegistered(email)) {
      console.error(`Email not found in waitlist: ${email}`);
      return false;
    }

    const subject = subjectTemplate(email);
    let htmlContent = bodyTemplate(email);
    // Replace placeholder [Company Name] with the actual company name
    htmlContent = htmlContent.replace(/\[Company Name\]/g, this.companyName);
    return await this.sendMail(email, subject, htmlContent);
  }

  /**
   * Sends a confirmation email using an HTML template file.
   * Supports dynamic replacements for placeholders in the template.
   * @param email - Recipient email address.
   * @param subjectTemplate - Function that generates the email subject.
   * @param templateFilePath - Path to the HTML template file.
   * @param replacements - Key-value pairs for replacing placeholders in the template.
   * @returns True if the email was sent successfully, false otherwise.
   */
  async sendConfirmationFromFile(
    email: string,
    subjectTemplate: (email: string) => string,
    templateFilePath: string,
    replacements: Record<string, string> = {}
  ): Promise<boolean> {
    if (!this.isEmailRegistered(email)) {
      console.error(`Email not found in waitlist: ${email}`);
      return false;
    }

    let htmlContent: string;
    try {
      htmlContent = await readFile(templateFilePath, 'utf8');
    } catch (fileError) {
      console.error(`Template file not found at ${templateFilePath}:`, fileError);
      return false;
    }

    // Default variables for the template
    const templateVariables = {
      email,
      companyName: this.companyName,
      ...replacements
    };

    // Replace placeholders in the template
    for (const [key, value] of Object.entries(templateVariables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      htmlContent = htmlContent.replace(regex, value);
    }

    const subject = subjectTemplate(email);
    return await this.sendMail(email, subject, htmlContent);
  }

  /**
   * Sends a confirmation email using template functions with a retry mechanism.
   * @param email - Recipient email address.
   * @param subjectTemplate - Function that generates the email subject.
   * @param bodyTemplate - Function that generates the email body (HTML).
   * @param retries - Number of retry attempts (default 3).
   * @param delayMs - Delay between retries in milliseconds (default 1000).
   * @returns True if the email was sent successfully, false otherwise.
   */
  async sendConfirmationWithRetry(
    email: string,
    subjectTemplate: (email: string) => string,
    bodyTemplate: (email: string) => string,
    retries: number = 3,
    delayMs: number = 1000
  ): Promise<boolean> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const result = await this.sendConfirmation(email, subjectTemplate, bodyTemplate);
      if (result) {
        return true;
      }
      this.emit('emailSendRetry', email, attempt + 1);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return false;
  }

  /**
   * Saves the waitlist to the specified storage (local or database).
   */
  saveWaitlist(): void {
    try {
      if (this.storage === 'local') {
        console.log('Waitlist saved locally:', Array.from(this.waitlist));
      } else if (this.storage === 'db') {
        // Implement database save logic here
        console.log('Waitlist saved to database:', Array.from(this.waitlist));
      }
      this.emit('waitlistSaved', Array.from(this.waitlist));
    } catch (error) {
      console.error('Error saving waitlist:', error);
      this.emit('waitlistSaveError', error);
    }
  }
}

export default WaitlistMailer;
