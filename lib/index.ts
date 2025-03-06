import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { readFile } from 'fs/promises';
import validator from 'validator';
import { EventEmitter } from 'events';
import mongoose, { Schema, Model, Document } from 'mongoose';
import { Sequelize, DataTypes, Model as SequelizeModel, Optional, Op } from 'sequelize';
import Handlebars from 'handlebars';

/**
 * Configuration for the mail transporter.
 * @typedef {Object} MailConfig
 * @property {string} host - The SMTP host (e.g., smtp.gmail.com).
 * @property {number} port - The SMTP port (e.g., 587).
 * @property {string} user - The SMTP username (e.g., your-email@gmail.com).
 * @property {string} pass - The SMTP password or app-specific password.
 * @property {boolean} [secure] - Whether to use a secure connection (defaults to true if port is 465).
 */
interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure?: boolean;
}

/**
 * Options for configuring the WaitlistMailer.
 * @typedef {Object} WaitlistMailerOptions
 * @property {string} [companyName] - The name of the company for email templates.
 * @property {string} [mongoUri] - The MongoDB connection URI (e.g., mongodb://localhost:27017/waitlistdb).
 * @property {Object} [sqlConfig] - Configuration for SQL databases.
 * @property {'postgres' | 'mysql'} sqlConfig.dialect - The SQL dialect (PostgreSQL or MySQL).
 * @property {string} sqlConfig.host - The SQL database host.
 * @property {number} sqlConfig.port - The SQL database port.
 * @property {string} sqlConfig.username - The SQL database username.
 * @property {string} sqlConfig.password - The SQL database password.
 * @property {string} sqlConfig.database - The SQL database name.
 */
interface WaitlistMailerOptions {
  companyName?: string;
  mongoUri?: string;
  sqlConfig?: {
    dialect: 'postgres' | 'mysql' | 'sqlite';
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
}
/**
 * Attributes for the Waitlist model.
 * @typedef {Object} WaitlistAttributes
 * @property {string} email - The email address.
 * @property {Date} [createdAt] - The creation date of the record.
 */
interface WaitlistAttributes {
  email: string;
  createdAt?: Date;
}

/**
 * Creation attributes for the Waitlist model.
 * @typedef {Object} WaitlistCreationAttributes
 * @extends {Optional<WaitlistAttributes, 'email' | 'createdAt'>}
 */
interface WaitlistCreationAttributes extends Optional<WaitlistAttributes, 'email' | 'createdAt'> {}

/**
 * Sequelize model for the Waitlist table.
 * @class WaitlistSequelize
 * @extends {SequelizeModel<WaitlistAttributes, WaitlistCreationAttributes>}
 * @implements {WaitlistAttributes}
 */
class WaitlistSequelize extends SequelizeModel<WaitlistAttributes, WaitlistCreationAttributes> implements WaitlistAttributes {
  declare email: string;
  declare createdAt: Date;
}

/**
 * Mongoose schema for the Waitlist collection.
 * @constant {Schema} WaitlistSchema
 */
const WaitlistSchema = new Schema<Document & WaitlistAttributes>({
  email: { type: String, required: true, unique: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

/**
 * Mongoose model for the Waitlist collection.
 * @constant {Model<Document & WaitlistAttributes>} WaitlistModel
 */
const WaitlistModel: Model<Document & WaitlistAttributes> = mongoose.model<Document & WaitlistAttributes>('Waitlist', WaitlistSchema);

/**
 * Enum for storage types.
 * @enum {string}
 */
export enum StorageType {
  Local = 'local',
  Db = 'db',
  Sql = 'sql',
}

/**
 * Main class for managing waitlists and sending confirmation emails.
 * @class WaitlistMailer
 * @extends {EventEmitter}
 */
export class WaitlistMailer extends EventEmitter {
  private storage: StorageType;
  private waitlist: Set<string>;
  private transporter: Transporter;
  private fromEmail: string;
  private companyName: string;
  private mongoUri?: string;
  private sqlConnection?: Sequelize;
  private initialized: boolean = false;

  /**
   * Creates an instance of WaitlistMailer.
   * @param {StorageType} [storage=StorageType.Local] - The storage type (local, db, or sql).
   * @param {MailConfig} mailConfig - The mail configuration.
   * @param {WaitlistMailerOptions} [options] - Additional options for the mailer.
   * @throws {Error} If mailConfig parameters are invalid.
   */
  constructor(storage: StorageType = StorageType.Local, mailConfig: MailConfig, options?: WaitlistMailerOptions) {
    super();
    this.storage = storage;
    this.waitlist = new Set();
    this.companyName = options?.companyName || 'Your Company';
    this.mongoUri = options?.mongoUri;
    this.fromEmail = mailConfig.user;

    // Validate mailConfig
    if (!mailConfig.host || !mailConfig.port || !mailConfig.user || !mailConfig.pass) {
      throw new Error('Invalid mail configuration: host, port, user, and pass are required');
    }

    // Initialize SQL connection if configured
    if (options?.sqlConfig) {
      this.sqlConnection = new Sequelize({
        dialect: options.sqlConfig.dialect,
        host: options.sqlConfig.host,
        port: options.sqlConfig.port,
        username: options.sqlConfig.username,
        password: options.sqlConfig.password,
        database: options.sqlConfig.database,
        logging: false,
      });
    }

    // Initialize Nodemailer transporter
    this.transporter = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure ?? mailConfig.port === 465,
      auth: {
        user: mailConfig.user,
        pass: mailConfig.pass,
      },
    });

    // Initialize the mailer asynchronously
    this.initialize()
      .then(() => console.log('WaitlistMailer initialized'))
      .catch(error => this.handleError('initialize', 'Initialization failed', error));
  }

  // ==================== Private Methods ====================

  /**
   * Initializes the mailer, including database connections and data loading.
   * @private
   * @returns {Promise<void>}
   */
  private async initialize(): Promise<void> {
    await this.verifyTransporter();
    await this.initializeStorage();
    await this.loadInitialData();
    this.initialized = true;
    this.emit('onInitialized');
  }

  /**
   * Verifies the Nodemailer transporter configuration.
   * @private
   * @returns {Promise<void>}
   * @throws {Error} If transporter verification fails.
   */
  private async verifyTransporter(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.transporter.verify(error => {
        if (error) {
          this.emit('onTransporterError', error);
          reject(error);
        } else {
          this.emit('onTransporterReady');
          resolve();
        }
      });
    });
  }

  /**
   * Initializes the database storage (MongoDB or SQL).
   * @private
   * @returns {Promise<void>}
   */
  private async initializeStorage(): Promise<void> {
    if (this.storage === StorageType.Db && this.mongoUri) {
      await mongoose.connect(this.mongoUri);
      this.emit('onDbConnected');
    } else if (this.storage === StorageType.Sql && this.sqlConnection) {
      await this.initializeSequelize();
      this.emit('onSqlConnected');
    }
  }

  /**
   * Initializes the Sequelize model and connection.
   * @private
   * @returns {Promise<void>}
   */
  private async initializeSequelize(): Promise<void> {
    if (!this.sqlConnection) return;

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
    });

    await this.sqlConnection.authenticate();
    await WaitlistSequelize.sync();
  }

  /**
   * Loads initial data from the database into memory.
   * @private
   * @returns {Promise<void>}
   */
  private async loadInitialData(): Promise<void> {
    if (this.storage === StorageType.Db) {
      await this.loadFromMongo();
    } else if (this.storage === StorageType.Sql) {
      await this.loadFromSql();
    }
  }

  /**
   * Loads data from MongoDB.
   * @private
   * @returns {Promise<void>}
   */
  private async loadFromMongo(): Promise<void> {
    try {
      const docs = await WaitlistModel.find();
      docs.forEach(doc => this.waitlist.add(doc.email));
    } catch (error) {
      this.handleError('loadFromMongo', 'Failed to load from MongoDB', error);
    }
  }

  /**
   * Loads data from SQL.
   * @private
   * @returns {Promise<void>}
   */
  private async loadFromSql(): Promise<void> {
    if (!this.sqlConnection) return;

    try {
      const records = await WaitlistSequelize.findAll();
      records.forEach(record => this.waitlist.add(record.email));
    } catch (error) {
      this.handleError('loadFromSql', 'Failed to load from SQL', error);
    }
  }

  /**
   * Validates an email address using validator.js.
   * @private
   * @param {string} email - The email to validate.
   * @returns {{ isValid: boolean; message?: string }} - The validation result.
   */
  private validateEmail(email: string): { isValid: boolean; message?: string } {
    if (!validator.isEmail(email)) {
      return { isValid: false, message: 'Invalid email format' };
    }
    return { isValid: true };
  }

  /**
   * Handles errors and emits error events.
   * @private
   * @param {string} context - The context where the error occurred.
   * @param {string} message - A descriptive error message.
   * @param {unknown} error - The error object.
   */
  private handleError(context: string, message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error instanceof Error ? (error as any).code || 'UNKNOWN' : 'UNKNOWN';

    console.error(`[${context}] ${message}:`, errorMessage);
    this.emit('onError', {
      context,
      message,
      error: errorMessage,
      code: errorCode,
    });
  }

  /**
   * Persists an email to the database.
   * @private
   * @param {string} email - The email to persist.
   * @returns {Promise<void>}
   */
  private async persistEmail(email: string): Promise<void> {
    const record = { email, createdAt: new Date() };
    try {
      if (this.storage === StorageType.Db) {
        await new WaitlistModel(record).save();
      } else if (this.storage === StorageType.Sql) {
        await WaitlistSequelize.create(record);
      }
    } catch (error) {
      this.handleError('persistEmail', 'Failed to persist email', error);
      throw error; // Propagate error to caller
    }
  }

  /**
   * Removes an email from the database.
   * @private
   * @param {string} email - The email to remove.
   * @returns {Promise<void>}
   */
  private async removePersistedEmail(email: string): Promise<void> {
    try {
      if (this.storage === StorageType.Db) {
        await WaitlistModel.deleteOne({ email });
      } else if (this.storage === StorageType.Sql) {
        await WaitlistSequelize.destroy({ where: { email } });
      }
    } catch (error) {
      this.handleError('removePersistedEmail', 'Failed to remove email', error);
      throw error; // Propagate error to caller
    }
  }

  // ==================== Public API ====================

  /**
   * Checks if the mailer is initialized.
   * @returns {boolean} - True if initialized, false otherwise.
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Waits for the mailer to initialize.
   * @returns {Promise<void>}
   */
  public async waitForInitialization(): Promise<void> {
    if (this.initialized) return;
    return new Promise(resolve => this.once('onInitialized', resolve));
  }

  /**
   * Adds an email to the waitlist.
   * @param {string} email - The email to add.
   * @returns {Promise<boolean>} - True if the email was added successfully, false otherwise.
   * @throws {Error} If persistence fails.
   */
  public async addEmail(email: string): Promise<boolean> {
    if (!this.initialized) {
      this.handleError('addEmail', 'WaitlistMailer not initialized', new Error('Not initialized'));
      return false;
    }

    const validation = this.validateEmail(email);
    if (!validation.isValid) {
      this.emit('onValidationError', validation);
      return false;
    }

    if (this.waitlist.has(email)) {
      this.emit('onDuplicateEmail', email);
      return false;
    }

    this.waitlist.add(email);
    await this.persistEmail(email);
    this.emit('onEmailAdded', email);
    return true;
  }

  /**
   * Removes an email from the waitlist.
   * @param {string} email - The email to remove.
   * @returns {Promise<boolean>} - True if the email was removed successfully, false otherwise.
   * @throws {Error} If removal fails.
   */
  public async removeEmail(email: string): Promise<boolean> {
    if (!this.initialized || !this.waitlist.has(email)) {
      return false;
    }

    this.waitlist.delete(email);
    await this.removePersistedEmail(email);
    this.emit('onEmailRemoved', email);
    return true;
  }

  /**
   * Gets the current waitlist.
   * @returns {string[]} - An array of emails in the waitlist.
   */
  public getWaitlist(): string[] {
    return Array.from(this.waitlist);
  }

  /**
   * Clears the waitlist.
   * @returns {Promise<void>}
   */
  public async clearWaitlist(): Promise<void> {
    this.waitlist.clear();

    if (this.storage === StorageType.Db) {
      await WaitlistModel.deleteMany({});
    } else if (this.storage === StorageType.Sql) {
      await WaitlistSequelize.destroy({ where: {} });
    }

    this.emit('onWaitlistCleared');
  }

  /**
   * Sends a confirmation email.
   * @param {string} email - The email to send to.
   * @param {(email: string) => string} subjectTemplate - A function to generate the email subject.
   * @param {(email: string) => string} bodyTemplate - A function to generate the email body.
   * @returns {Promise<boolean>} - True if the email was sent successfully, false otherwise.
   */
  public async sendConfirmation(
    email: string,
    subjectTemplate: (email: string) => string,
    bodyTemplate: (email: string) => string
  ): Promise<boolean> {
    if (!this.waitlist.has(email)) {
      this.handleError('sendConfirmation', 'Email not in waitlist', new Error('Email not found'));
      return false;
    }

    try {
      const subject = subjectTemplate(email);
      const html = bodyTemplate(email).replace(/\[Company Name\]/g, this.companyName);

      const mailOptions: SendMailOptions = {
        from: `"${this.companyName}" <${this.fromEmail}>`,
        to: email,
        subject,
        html,
      };

      await this.transporter.sendMail(mailOptions);
      this.emit('onEmailSent', email);
      return true;
    } catch (error) {
      this.handleError('sendConfirmation', 'Failed to send confirmation', error);
      return false;
    }
  }

  /**
   * Sends a confirmation email using a template file.
   * @param {string} email - The email to send to.
   * @param {(email: string) => string} subjectTemplate - A function to generate the email subject.
   * @param {string} templatePath - The path to the template file.
   * @param {Record<string, string>} [replacements={}] - Replacements for the template.
   * @returns {Promise<boolean>} - True if the email was sent successfully, false otherwise.
   */
  public async sendConfirmationFromFile(
    email: string,
    subjectTemplate: (email: string) => string,
    templatePath: string,
    replacements: Record<string, string> = {}
  ): Promise<boolean> {
    try {
      const templateContent = await readFile(templatePath, 'utf8');
      if (!templateContent) {
        throw new Error('Template file is empty');
      }
      const template = Handlebars.compile(templateContent);
      const html = template({
        email,
        companyName: this.companyName,
        ...replacements,
      });

      return this.sendConfirmation(email, subjectTemplate, () => html);
    } catch (error) {
      this.handleError('sendConfirmationFromFile', 'Template processing failed', error);
      return false;
    }
  }

  /**
   * Sends a confirmation email with retry logic.
   * @param {string} email - The email to send to.
   * @param {(email: string) => string} subjectTemplate - A function to generate the email subject.
   * @param {(email: string) => string} bodyTemplate - A function to generate the email body.
   * @param {number} [maxRetries=3] - The maximum number of retry attempts.
   * @param {number} [retryDelay=1000] - The delay between retries in milliseconds.
   * @returns {Promise<boolean>} - True if the email was sent successfully, false otherwise.
   */
  public async sendConfirmationWithRetry(
    email: string,
    subjectTemplate: (email: string) => string,
    bodyTemplate: (email: string) => string,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<boolean> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.sendConfirmation(email, subjectTemplate, bodyTemplate);
        if (result) return true;

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          this.emit('onEmailRetry', email, attempt + 1);
        }
      } catch (error) {
        this.handleError('sendConfirmationWithRetry', `Attempt ${attempt + 1} failed`, error);
      }
    }
    return false;
  }

  /**
   * Sends confirmation emails to all emails in the waitlist.
   * @param {(email: string) => string} subjectTemplate - A function to generate the email subject.
   * @param {(email: string) => string} bodyTemplate - A function to generate the email body.
   * @param {number} [maxRetries=3] - The maximum number of retry attempts per email.
   * @param {number} [retryDelay=1000] - The delay between retries in milliseconds.
   * @returns {Promise<number>} - The number of successfully sent emails.
   */
  public async sendBulkConfirmation(
    subjectTemplate: (email: string) => string,
    bodyTemplate: (email: string) => string,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<number> {
    const emails = this.getWaitlist();
    let successCount = 0;

    for (const email of emails) {
      const success = await this.sendConfirmationWithRetry(
        email,
        subjectTemplate,
        bodyTemplate,
        maxRetries,
        retryDelay
      );
      if (success) successCount++;
    }

    this.emit('onBulkConfirmationComplete', { successCount, total: emails.length });
    return successCount;
  }

  /**
   * Finds emails in the waitlist that match a pattern.
   * @param {string} pattern - The pattern to search for.
   * @returns {Promise<string[]>} - An array of matching emails.
   */
  public async findEmailsByPattern(pattern: string): Promise<string[]> {
    try {
      if (this.storage === StorageType.Local) {
        return Array.from(this.waitlist).filter(email =>
          email.toLowerCase().includes(pattern.toLowerCase())
        );
      }

      if (this.storage === StorageType.Db) {
        const regex = new RegExp(pattern, 'i');
        const docs = await WaitlistModel.find({ email: { $regex: regex } });
        return docs.map(doc => doc.email);
      }

      if (this.storage === StorageType.Sql) {
        const records = await WaitlistSequelize.findAll({
          where: { email: { [Op.like]: `%${pattern}%` } },
        });
        return records.map(record => record.email);
      }

      return [];
    } catch (error) {
      this.handleError('findEmailsByPattern', 'Search failed', error);
      return [];
    }
  }

  /**
   * Counts the number of emails in the waitlist within a date range.
   * @param {Date} [start] - The start date of the range.
   * @param {Date} [end] - The end date of the range.
   * @returns {Promise<number>} - The count of emails.
   */
  public async countWaitlistByDate(start?: Date, end?: Date): Promise<number> {
    try {
      if (this.storage === StorageType.Local) {
        return this.waitlist.size;
      }

      if (this.storage === StorageType.Db) {
        const query: any = {};
        if (start || end) {
          query.createdAt = {};
          if (start) query.createdAt.$gte = start;
          if (end) query.createdAt.$lte = end;
        }
        return WaitlistModel.countDocuments(query);
      }

      if (this.storage === StorageType.Sql) {
        const where: any = {};
        if (start && end) {
          where.createdAt = { [Op.between]: [start, end] };
        } else if (start) {
          where.createdAt = { [Op.gte]: start };
        } else if (end) {
          where.createdAt = { [Op.lte]: end };
        }
        return WaitlistSequelize.count({ where });
      }

      return 0;
    } catch (error) {
      this.handleError('countWaitlistByDate', 'Count failed', error);
      return 0;
    }
  }

  /**
   * Saves the waitlist to the database.
   * @returns {Promise<boolean>} - True if the waitlist was saved successfully, false otherwise.
   */
  public async saveWaitlist(): Promise<boolean> {
    try {
      const emails = this.getWaitlist();
  
      if (this.storage === StorageType.Db) {
        await WaitlistModel.deleteMany({});
        if (emails.length > 0) {
          await WaitlistModel.insertMany(emails.map(email => ({ email })));
        }
        this.emit('onWaitlistSaved', emails); 
        return true;
      }
  
      if (this.storage === StorageType.Sql) {
        await this.sqlConnection?.transaction(async t => {
          await WaitlistSequelize.destroy({ where: {}, transaction: t });
          if (emails.length > 0) {
            await WaitlistSequelize.bulkCreate(
              emails.map(email => ({ email })),
              { transaction: t }
            );
          }
        });
        this.emit('onWaitlistSaved', emails); 
        return true;
      }
  
      return true; // Local storage no necesita guardar
    } catch (error) {
      this.handleError('saveWaitlist', 'Save failed', error);
      return false;
    }
  }  

  /**
   * Closes all database connections.
   * @returns {Promise<void>}
   */
  public async close(): Promise<void> {
    try {
      if (this.storage === StorageType.Db) {
        await mongoose.disconnect();
      } else if (this.storage === StorageType.Sql && this.sqlConnection) {
        await this.sqlConnection.close();
      }
      this.emit('onClose');
    } catch (error) {
      this.handleError('close', 'Failed to close connections', error);
    }
  }
}