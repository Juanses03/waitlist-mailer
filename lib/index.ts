import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { readFile } from 'fs/promises';
import Joi from 'joi';
import { EventEmitter } from 'events';
import mongoose, { Schema, Model, Document } from 'mongoose';
import { Sequelize, DataTypes, Model as SequelizeModel, Optional, Op } from 'sequelize';

interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

interface WaitlistMailerOptions {
  companyName?: string;
  mongoUri?: string;
  sqlConfig?: {
    dialect: 'postgres' | 'mysql';
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
}

/**
 * Interface for Sequelize Waitlist model
 */
interface WaitlistAttributes {
  email: string;
  createdAt?: Date;
}

interface WaitlistCreationAttributes extends Optional<WaitlistAttributes, 'email' | 'createdAt'> {}

class WaitlistSequelize extends SequelizeModel<WaitlistAttributes, WaitlistCreationAttributes> implements WaitlistAttributes {
  declare email: string;
  declare createdAt: Date;
}

const WaitlistSchema = new Schema<Document & WaitlistAttributes>({
  email: { type: String, required: true, unique: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

WaitlistSchema.index({ email: 1 }, { unique: true });

const WaitlistModel: Model<Document & WaitlistAttributes> = mongoose.model<Document & WaitlistAttributes>('Waitlist', WaitlistSchema);

/**
 * Class to manage the waitlist and send confirmation emails.
 * This is a reusable NPM package that supports local, MongoDB, and SQL storage.
 * Extends EventEmitter for event-driven functionality.
 */
class WaitlistMailer extends EventEmitter {
  private storage: 'local' | 'db' | 'sql';
  private waitlist: Set<string>;
  private transporter: Transporter;
  private companyName: string;
  private mongoUri?: string;
  private sqlConnection?: Sequelize;
  private initialized: boolean = false;

  constructor(storage: 'local' | 'db' | 'sql' = 'local', mailConfig: MailConfig, options?: WaitlistMailerOptions) {
    super();
    this.storage = storage;
    this.waitlist = new Set();
    this.companyName = options?.companyName || 'Your Company Name';
    this.mongoUri = options?.mongoUri;
    this.sqlConnection = options?.sqlConfig ? new Sequelize({
      dialect: options.sqlConfig.dialect,
      host: options.sqlConfig.host,
      port: options.sqlConfig.port,
      username: options.sqlConfig.username,
      password: options.sqlConfig.password,
      database: options.sqlConfig.database,
      logging: false // Disable logging for tests
    }) : undefined;

    // Initialize Nodemailer transporter
    this.transporter = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.port === 465,
      auth: {
        user: mailConfig.user,
        pass: mailConfig.pass,
      },
    });

    // Verify transporter configuration
    this.transporter.verify((error) => {
      if (error) {
        console.error('Transporter configuration error:', error);
        this.emit('onTransporterError', error);
      } else {
        console.log('Transporter is ready');
        this.emit('onTransporterReady');
      }
    });

    // Connect to MongoDB or SQL if selected
    if (this.storage === 'db' && this.mongoUri) {
      mongoose.connect(this.mongoUri).then(() => {
        console.log('Connected to MongoDB');
        this.emit('onDbConnected');
        return this.loadWaitlistFromDb();
      }).then(() => {
        this.initialized = true;
        this.emit('onInitialized');
      }).catch(err => {
        console.error('MongoDB connection error:', err);
        this.emit('onDbError', err);
      });
    } else if (this.storage === 'sql' && this.sqlConnection) {
      WaitlistSequelize.init({
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
      }, {
        sequelize: this.sqlConnection,
        modelName: 'Waitlist',
        indexes: [{ unique: true, fields: ['email'] }, { fields: ['createdAt'] }],
      });

      this.sqlConnection.authenticate().then(() => {
        console.log('Connected to SQL database');
        this.emit('onSqlConnected');
        return WaitlistSequelize.sync();
      }).then(() => {
        return this.loadWaitlistFromSql();
      }).then(() => {
        this.initialized = true;
        this.emit('onInitialized');
      }).catch(err => {
        console.error('SQL connection error:', err);
        this.emit('onSqlError', err);
      });
    } else {
      // For local storage, mark as initialized immediately
      this.initialized = true;
      setTimeout(() => this.emit('onInitialized'), 0);
    }
  }

  // Private method to validate email format
  private validateEmailFormat(email: string): { isValid: boolean; message?: string } {
    const schema = Joi.string().email({ tlds: { allow: false } }).required();
    const { error } = schema.validate(email);
    if (error) {
      return { isValid: false, message: error.message };
    }
    return { isValid: true };
  }

  // Private method to check if email already exists
  private emailExists(email: string): boolean {
    return this.waitlist.has(email);
  }

  // Centralized error handling
  private handleError(email: string, action: string, error: unknown): void {
    console.error(`${action} failed for ${email}:`, error);
    this.emit('onError', { email, action, error });
  }

  // Load waitlist from MongoDB
  private async loadWaitlistFromDb(): Promise<void> {
    try {
      const waitlistDocs = await WaitlistModel.find();
      waitlistDocs.forEach(doc => this.waitlist.add(doc.email));
      console.log('Waitlist loaded from MongoDB:', Array.from(this.waitlist));
      return Promise.resolve();
    } catch (error) {
      this.handleError('waitlist', 'loadWaitlistFromDb', error);
      return Promise.reject(error);
    }
  }

  // Load waitlist from SQL
  private async loadWaitlistFromSql(): Promise<void> {
    if (!this.sqlConnection) return Promise.resolve();
    try {
      const waitlistDocs = await WaitlistSequelize.findAll({ attributes: ['email'] });
      waitlistDocs.forEach(doc => this.waitlist.add(doc.email));
      console.log('Waitlist loaded from SQL:', Array.from(this.waitlist));
      return Promise.resolve();
    } catch (error) {
      this.handleError('waitlist', 'loadWaitlistFromSql', error);
      return Promise.reject(error);
    }
  }

  // Check if the system is initialized
  isInitialized(): boolean {
    return this.initialized;
  }

  // Wait for initialization to complete
  async waitForInitialization(): Promise<void> {
    if (this.initialized) return Promise.resolve();

    return new Promise<void>((resolve) => {
      this.once('onInitialized', () => resolve());
    });
  }

  // Advanced query: Find emails by pattern
  async findEmailsByPattern(pattern: string): Promise<string[]> {
    try {
      let results: string[] = [];
      if (this.storage === 'local') {
        // For local storage, filter in-memory
        results = Array.from(this.waitlist).filter(email =>
          email.toLowerCase().includes(pattern.toLowerCase())
        );
      } else if (this.storage === 'db' && this.mongoUri) {
        const regex = new RegExp(pattern, 'i');
        const docs = await WaitlistModel.find({ email: { $regex: regex } });
        results = docs.map(doc => doc.email);
      } else if (this.storage === 'sql' && this.sqlConnection) {
        const docs = await WaitlistSequelize.findAll({
          where: { email: { [Op.like]: `%${pattern}%` } },
        });
        results = docs.map(doc => doc.email);
      }
      console.log(`Found emails matching "${pattern}":`, results);
      return results;
    } catch (error) {
      this.handleError('waitlist', 'findEmailsByPattern', error);
      return [];
    }
  }

  // Advanced query: Count emails by date range
  async countWaitlistByDate(startDate?: Date, endDate?: Date): Promise<number> {
    try {
      let count = 0;

      if (this.storage === 'local') {
        // For local storage, we don't track creation dates so return total count
        count = this.waitlist.size;
      } else if (this.storage === 'db' && this.mongoUri) {
        const query: any = {};
        if (startDate || endDate) {
          query.createdAt = {};
          if (startDate) query.createdAt.$gte = startDate;
          if (endDate) query.createdAt.$lte = endDate;
        }
        count = await WaitlistModel.countDocuments(query);
      } else if (this.storage === 'sql' && this.sqlConnection) {
        const where: any = {};
        if (startDate && endDate) {
          where.createdAt = { [Op.between]: [startDate, endDate] };
        } else {
          if (startDate) where.createdAt = { ...where.createdAt, [Op.gte]: startDate };
          if (endDate) where.createdAt = { ...where.createdAt, [Op.lte]: endDate };
        }
        count = await WaitlistSequelize.count({ where });
      }

      console.log(`Emails count between ${startDate} and ${endDate}:`, count);
      return count;
    } catch (error) {
      this.handleError('waitlist', 'countWaitlistByDate', error);
      return 0;
    }
  }

  addEmail(email: string): boolean {
    // First validate the email format
    const formatCheck = this.validateEmailFormat(email);
    if (!formatCheck.isValid) {
      console.error(`Validation error: ${formatCheck.message || 'Invalid email format'}`);
      this.emit('onValidationError', { email, error: formatCheck.message });
      return false;
    }

    // Then check if it already exists
    if (this.emailExists(email)) {
      console.error(`Email already registered: ${email}`);
      this.emit('onDuplicateEmail', email);
      return false;
    }

    // Add to waitlist
    this.waitlist.add(email);
    console.log(`Email added: ${email}`);
    this.emit('onEmailAdded', email);

    const createdAt = new Date();

    // Persist to storage
    if (this.storage === 'db' && this.mongoUri) {
      WaitlistModel.create({ email, createdAt }).catch(err => this.handleError(email, 'addEmailDb', err));
    } else if (this.storage === 'sql' && this.sqlConnection) {
      WaitlistSequelize.create({ email, createdAt }).catch(err => this.handleError(email, 'addEmailSql', err));
    }

    return true;
  }

  removeEmail(email: string): boolean {
    if (!this.waitlist.has(email)) {
      console.error(`Email not registered: ${email}`);
      return false;
    }

    this.waitlist.delete(email);
    console.log(`Email removed: ${email}`);
    this.emit('onEmailRemoved', email);

    if (this.storage === 'db' && this.mongoUri) {
      WaitlistModel.deleteOne({ email }).catch(err => this.handleError(email, 'removeEmailDb', err));
    } else if (this.storage === 'sql' && this.sqlConnection) {
      WaitlistSequelize.destroy({ where: { email } }).catch(err => this.handleError(email, 'removeEmailSql', err));
    }

    return true;
  }

  getWaitlist(): string[] {
    return Array.from(this.waitlist);
  }

  clearWaitlist(): void {
    this.waitlist.clear();
    console.log('Waitlist cleared');
    this.emit('onWaitlistCleared');

    if (this.storage === 'db' && this.mongoUri) {
      WaitlistModel.deleteMany({}).catch(err => this.handleError('waitlist', 'clearWaitlistDb', err));
    } else if (this.storage === 'sql' && this.sqlConnection) {
      WaitlistSequelize.destroy({ where: {} }).catch(err => this.handleError('waitlist', 'clearWaitlistSql', err));
    }
  }

  private async sendMail(email: string, subject: string, htmlContent: string): Promise<boolean> {
    if (!this.transporter || !(this.transporter.options as any).auth?.user) {
      this.handleError(email, 'sendMail', 'Transporter not configured');
      return false;
    }

    const mailOptions: SendMailOptions = {
      from: `"${this.companyName}" <${(this.transporter.options as any).auth?.user}>`,
      to: email,
      subject,
      html: htmlContent,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Confirmation email sent to: ${email}`);
      console.log('Message ID:', info.messageId);
      this.emit('onEmailSent', email, info);
      return true;
    } catch (error) {
      this.handleError(email, 'sendMail', error);
      return false;
    }
  }

  async sendConfirmation(
    email: string,
    subjectTemplate: (email: string) => string,
    bodyTemplate: (email: string) => string
  ): Promise<boolean> {
    // Check if email is in waitlist
    if (!this.waitlist.has(email)) {
      console.error(`Confirmation error for ${email}: Email not in waitlist`);
      return false;
    }

    const subject = subjectTemplate(email);
    let htmlContent = bodyTemplate(email).replace(/\[Company Name\]/g, this.companyName);
    return await this.sendMail(email, subject, htmlContent);
  }

  async sendConfirmationFromFile(
    email: string,
    subjectTemplate: (email: string) => string,
    templateFilePath: string,
    replacements: Record<string, string> = {}
  ): Promise<boolean> {
    // Check if email is in waitlist
    if (!this.waitlist.has(email)) {
      console.error(`File confirmation error for ${email}: Email not in waitlist`);
      return false;
    }

    let htmlContent: string;
    try {
      htmlContent = await readFile(templateFilePath, 'utf8');
      const templateVariables = { email, companyName: this.companyName, ...replacements };
      for (const [key, value] of Object.entries(templateVariables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        htmlContent = htmlContent.replace(regex, value);
      }
    } catch (error) {
      this.handleError(email, 'sendConfirmationFromFile', error);
      return false;
    }

    const subject = subjectTemplate(email);
    return await this.sendMail(email, subject, htmlContent);
  }

  async sendConfirmationWithRetry(
    email: string,
    subjectTemplate: (email: string) => string,
    bodyTemplate: (email: string) => string,
    retries: number = 3,
    delayMs: number = 1000
  ): Promise<boolean> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const result = await this.sendConfirmation(email, subjectTemplate, bodyTemplate);
      if (result) return true;
      this.emit('onEmailRetry', email, attempt + 1);
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return false;
  }

  /**
   * Sends bulk confirmation emails to all waitlist members.
   * @param subjectTemplate - Function to generate the email subject.
   * @param bodyTemplate - Function to generate the email body.
   * @param retries - Number of retry attempts per email (default 3).
   * @param delayMs - Delay between retries in milliseconds (default 1000).
   * @returns Number of successfully sent emails.
   */
  async sendBulkConfirmation(
    subjectTemplate: (email: string) => string,
    bodyTemplate: (email: string) => string,
    retries: number = 3,
    delayMs: number = 1000
  ): Promise<number> {
    const emails = this.getWaitlist();
    let successCount = 0;

    for (const email of emails) {
      const result = await this.sendConfirmationWithRetry(email, subjectTemplate, bodyTemplate, retries, delayMs);
      if (result) successCount++;
    }

    console.log(`Bulk confirmation sent to ${successCount} out of ${emails.length} emails`);
    this.emit('onBulkConfirmationComplete', { successCount, total: emails.length });
    return successCount;
  }

  async saveWaitlist(): Promise<boolean> {
    try {
      const waitlistArray = Array.from(this.waitlist);
      if (this.storage === 'local') {
        console.log('Waitlist saved locally:', waitlistArray);
        return true;
      } else if (this.storage === 'db' && this.mongoUri) {
        await WaitlistModel.deleteMany({});
        if (waitlistArray.length > 0) {
          await WaitlistModel.insertMany(waitlistArray.map(email => ({ email })));
        }
        console.log('Waitlist saved to MongoDB:', waitlistArray);
        this.emit('onWaitlistSaved', waitlistArray);
        return true;
      } else if (this.storage === 'sql' && this.sqlConnection) {
        await this.sqlConnection.transaction(async (t) => {
          await WaitlistSequelize.destroy({ where: {}, transaction: t });
          if (waitlistArray.length > 0) {
            await WaitlistSequelize.bulkCreate(waitlistArray.map(email => ({ email })), { transaction: t });
          }
          console.log('Waitlist saved to SQL:', waitlistArray);
          this.emit('onWaitlistSaved', waitlistArray);
        });
        return true;
      }
      return false;
    } catch (error) {
      this.handleError('waitlist', 'saveWaitlist', error);
      return false;
    }
  }

  // Clean up resources when done
  async close(): Promise<void> {
    try {
      if (this.storage === 'db' && mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log('MongoDB connection closed');
      }

      if (this.storage === 'sql' && this.sqlConnection) {
        await this.sqlConnection.close();
        console.log('SQL connection closed');
      }

      // Close nodemailer connection if possible
      if (this.transporter && typeof this.transporter.close === 'function') {
        this.transporter.close();
      }

      console.log('WaitlistMailer resources cleaned up');
    } catch (error) {
      console.error('Error closing connections:', error);
    }
  }
}

export default WaitlistMailer;
