import nodemailer from 'nodemailer';
import { readFile } from 'fs/promises';
import Joi from 'joi'; // Importamos Joi para validación avanzada <button class="citation-flag" data-index="2">

/**
 * Interface for mail configuration.
 * Defines the required properties for setting up an SMTP transporter.
 */
interface MailConfig {
  host: string; // SMTP server host
  port: number; // SMTP server port
  user: string; // SMTP username
  pass: string; // SMTP password
}

/**
 * Optional configuration for WaitlistMailer.
 * Allows customization of company name and other settings.
 */
interface WaitlistMailerOptions {
  companyName?: string; // Name of the company to display in emails
}

/**
 * Class for managing a waitlist and sending confirmation emails.
 * Supports both local and database storage for the waitlist.
 */
class WaitlistMailer {
  private storage: 'local' | 'db'; // Storage type ('local' or 'db')
  private waitlist: string[]; // List of email addresses in the waitlist
  private transporter: nodemailer.Transporter; // Nodemailer transporter for sending emails
  private companyName: string; // Company name used in email templates

  /**
   * Constructor for initializing the WaitlistMailer instance.
   * @param storage - Storage type ('local' or 'db').
   * @param mailConfig - Configuration for the SMTP transporter.
   * @param options - Optional settings (e.g., company name).
   */
  constructor(
    storage: 'local' | 'db' = 'local',
    mailConfig: MailConfig,
    options?: WaitlistMailerOptions
  ) {
    this.storage = storage;
    this.waitlist = [];
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
   * Adds an email address to the waitlist if it's valid and unique.
   * @param email - Email address to add.
   * @returns True if the email was added successfully, false otherwise.
   */
  addEmail(email: string): boolean {
    // Validar formato del correo electrónico
    if (!this.isValidEmail(email)) {
      console.error(`Invalid email format: ${email}`);
      return false;
    }

    // Verificar si el correo ya está en la waitlist
    if (this.waitlist.includes(email)) {
      console.error(`Email already registered: ${email}`);
      return false;
    }

    // Agregar el correo a la waitlist
    this.waitlist.push(email);
    console.log(`Email added: ${email}`);
    return true;
  }

  /**
   * Validates the format of an email address using Joi.
   * @param email - Email address to validate.
   * @returns True if the email is valid, false otherwise.
   */
  private isValidEmail(email: string): boolean {
    const schema = Joi.string().email({ tlds: { allow: false } }); // Validación con Joi <button class="citation-flag" data-index="2">
    const { error } = schema.validate(email);

    if (error) {
      console.error(`Validation error for email: ${email}`, error.message);
      return false;
    }

    return true;
  }

  /**
   * Sends a confirmation email using template functions.
   * This method is maintained for backward compatibility.
   * 
   * @param email - Recipient email address.
   * @param subjectTemplate - Function generating the email subject.
   * @param bodyTemplate - Function generating the email body (HTML content).
   * @returns True if the email was sent successfully, false otherwise.
   */
  async sendConfirmation(
    email: string,
    subjectTemplate: (email: string) => string,
    bodyTemplate: (email: string) => string
  ): Promise<boolean> {
    try {
      if (!this.waitlist.includes(email)) {
        console.error(`Email not found in waitlist: ${email}`);
        return false;
      }
      const subject = subjectTemplate(email);
      let htmlContent = bodyTemplate(email);
      // Replace placeholder [Company Name] with actual company name
      htmlContent = htmlContent.replace(/\[Company Name\]/g, this.companyName);
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${this.companyName}" <${(this.transporter.options as any).auth?.user}>`,
        to: email,
        subject: subject,
        html: htmlContent,
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        }
      };
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Confirmation email sent to: ${email}`);
      console.log('Message ID:', info.messageId);
      return true;
    } catch (error) {
      console.error(`Error sending confirmation email to ${email}:`, error);
      return false;
    }
  }

  /**
   * Sends a confirmation email using an HTML template file.
   * Supports dynamic replacements for placeholders in the template.
   * 
   * @param email - Recipient email address.
   * @param subjectTemplate - Function generating the email subject.
   * @param templateFilePath - Path to the HTML template file.
   * @param replacements - Additional key-value pairs for replacing placeholders in the template.
   * @returns True if the email was sent successfully, false otherwise.
   */
  async sendConfirmationFromFile(
    email: string,
    subjectTemplate: (email: string) => string,
    templateFilePath: string,
    replacements: Record<string, string> = {}
  ): Promise<boolean> {
    try {
      if (!this.waitlist.includes(email)) {
        console.error(`Email not found in waitlist: ${email}`);
        return false;
      }
      // Read the HTML template file
      let htmlContent: string;
      try {
        htmlContent = await readFile(templateFilePath, 'utf8');
      } catch (fileError) {
        console.error(`Template file not found at ${templateFilePath}:`, fileError);
        return false;
      }
      // Prepare template variables (default includes email and company name)
      const templateVariables = {
        email,
        companyName: this.companyName,
        ...replacements
      };
      // Replace placeholders in the template
      for (const [key, value] of Object.entries(templateVariables)) {
        const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        htmlContent = htmlContent.replace(placeholder, value);
      }
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${this.companyName}" <${(this.transporter.options as any).auth?.user}>`,
        to: email,
        subject: subjectTemplate(email),
        html: htmlContent,
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        }
      };
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Confirmation email sent to: ${email}`);
      console.log('Message ID:', info.messageId);
      return true;
    } catch (error) {
      console.error(`Error sending email to ${email}:`, error);
      return false;
    }
  }

  /**
   * Saves the waitlist to the specified storage (local or database).
   */
  saveWaitlist(): void {
    try {
      if (this.storage === 'local') {
        console.log('Waitlist saved locally');
      } else if (this.storage === 'db') {
        console.log('Waitlist saved to database');
      }
    } catch (error) {
      console.error('Error saving waitlist:', error);
    }
  }
}

export default WaitlistMailer;