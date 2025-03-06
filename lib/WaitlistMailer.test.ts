import { WaitlistMailer, StorageType } from './index';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import { Sequelize } from 'sequelize';
import Handlebars from 'handlebars';

// Silenciar console.log y console.error durante las pruebas
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock de nodemailer
jest.mock('nodemailer');
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'mock-id' });
(nodemailer.createTransport as jest.Mock).mockReturnValue({
  sendMail: mockSendMail,
  verify: jest.fn().mockImplementation(callback => callback(null)),
});

// Mock de Handlebars
jest.mock('handlebars');
const mockCompile = jest.fn().mockReturnValue((data: any) => `<h1>Hello ${data.email}</h1>`);
(Handlebars.compile as jest.Mock).mockImplementation(mockCompile);

// Mock para simular lectura de archivos
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue('{{email}} - {{companyName}}'),
}));

// Configuración desde .env
const mailConfig = {
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: Number(process.env.SMTP_PORT) || 587,
  user: process.env.SMTP_USER || 'test@example.com',
  pass: process.env.SMTP_PASS || 'password',
};

const sqlConfig = {
  dialect: (process.env.SQL_DIALECT || 'mysql') as 'mysql' | 'postgres' | 'sqlite',
  host: process.env.SQL_HOST || 'localhost',
  port: Number(process.env.SQL_PORT) || 3306,
  username: process.env.SQL_USER || 'root',
  password: process.env.SQL_PASSWORD || '',
  database: process.env.SQL_DATABASE || 'testdb',
};

// Helper para crear conexión SQL
const createSqlConnection = () =>
  new Sequelize({
    dialect: sqlConfig.dialect,
    host: sqlConfig.host,
    port: sqlConfig.port,
    username: sqlConfig.username,
    password: sqlConfig.password,
    database: sqlConfig.database,
    logging: false,
  });

describe('WaitlistMailer - Comprehensive Tests', () => {
  let mailer: WaitlistMailer;

  afterEach(async () => {
    if (mailer) {
      await mailer.close();
    }
    jest.clearAllMocks();
  });

  // ==================== Local Storage ====================
  describe('Local Storage', () => {
    beforeEach(async () => {
      mailer = new WaitlistMailer(StorageType.Local, mailConfig, { companyName: 'TestCo' });
      await mailer.waitForInitialization();
    });

    test('Adds and removes an email successfully', async () => {
      const addedSpy = jest.fn();
      mailer.on('onEmailAdded', addedSpy);
      const removedSpy = jest.fn();
      mailer.on('onEmailRemoved', removedSpy);

      expect(await mailer.addEmail('test@local.com')).toBe(true);
      expect(mailer.getWaitlist()).toContain('test@local.com');
      expect(addedSpy).toHaveBeenCalledWith('test@local.com');

      expect(await mailer.removeEmail('test@local.com')).toBe(true);
      expect(mailer.getWaitlist()).not.toContain('test@local.com');
      expect(removedSpy).toHaveBeenCalledWith('test@local.com');
    }, 10000);

    test('Clears the waitlist', async () => {
      const clearedSpy = jest.fn();
      mailer.on('onWaitlistCleared', clearedSpy);

      await mailer.addEmail('test1@local.com');
      await mailer.addEmail('test2@local.com');
      expect(mailer.getWaitlist()).toHaveLength(2);

      await mailer.clearWaitlist();
      expect(mailer.getWaitlist()).toHaveLength(0);
      expect(clearedSpy).toHaveBeenCalled();
    }, 10000);

    test('Checks initialization status', async () => {
      expect(mailer.isInitialized()).toBe(true);
    }, 10000);

    test('Sends a confirmation email', async () => {
      const sentSpy = jest.fn();
      mailer.on('onEmailSent', sentSpy);

      await mailer.addEmail('test@local.com');
      const sent = await mailer.sendConfirmation(
        'test@local.com',
        email => `Welcome ${email}`,
        email => `<p>Welcome ${email}</p>`
      );
      expect(sent).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'test@local.com',
        subject: 'Welcome test@local.com',
      }));
      expect(sentSpy).toHaveBeenCalledWith('test@local.com');
    }, 10000);

    test('Sends a confirmation email using a template', async () => {
      await mailer.addEmail('test@local.com');
      const sent = await mailer.sendConfirmationFromFile(
        'test@local.com',
        email => `Welcome ${email}`,
        'mock/path.hbs',
        { extra: 'data' }
      );
      expect(sent).toBe(true);
      expect(mockCompile).toHaveBeenCalled();
    }, 10000);
  });

  // ==================== MongoDB Storage ====================
  describe('MongoDB Storage (testdb.waitlist)', () => {
    beforeAll(async () => {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/testdb', {
        serverSelectionTimeoutMS: 10000,
      });
    }, 20000);

    afterAll(async () => {
      await mongoose.disconnect();
    }, 20000);

    beforeEach(async () => {
      mailer = new WaitlistMailer(StorageType.Db, mailConfig, {
        mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/testdb',
        companyName: 'TestCo',
      });
      await mailer.waitForInitialization();
    }, 10000);

    test('Persists an email and queries it', async () => {
      await mailer.addEmail('mongo@test.com');
      const emails = await mailer.findEmailsByPattern('mongo');
      expect(emails).toContain('mongo@test.com');
      expect(await mailer.countWaitlistByDate()).toBeGreaterThanOrEqual(1);
      expect(mailer.getWaitlist()).toContain('mongo@test.com');
    }, 10000);

    test('Clears the waitlist', async () => {
      const clearedSpy = jest.fn();
      mailer.on('onWaitlistCleared', clearedSpy);

      await mailer.addEmail('mongo2@test.com');
      await mailer.clearWaitlist();
      expect(await mailer.countWaitlistByDate()).toBe(0);
      expect(clearedSpy).toHaveBeenCalled();
    }, 10000);
  });

  // ==================== SQL Storage ====================
  describe('SQL Storage (testdb.waitlist)', () => {
    let sequelize: Sequelize;

    beforeAll(async () => {
      sequelize = createSqlConnection();
    }, 20000);

    beforeEach(async () => {
      mailer = new WaitlistMailer(StorageType.Sql, mailConfig, {
        companyName: 'TestCo',
        sqlConfig,
      });
      await mailer.waitForInitialization();
    }, 10000);

    afterAll(async () => {
      if (sequelize) {
        await sequelize.close();
      }
    }, 20000);

    test('Persists an email and queries it', async () => {
      await mailer.addEmail('sql@test.com');
      const count = await mailer.countWaitlistByDate();
      expect(count).toBeGreaterThanOrEqual(1);
      const emails = await mailer.findEmailsByPattern('sql');
      expect(emails).toContain('sql@test.com');
      expect(mailer.getWaitlist()).toContain('sql@test.com');
    }, 10000);

    test('Saves multiple emails persistently', async () => {
      const savedSpy = jest.fn();
      mailer.on('onWaitlistSaved', savedSpy);

      await mailer.addEmail('sql1@test.com');
      await mailer.addEmail('sql2@test.com');
      const saved = await mailer.saveWaitlist();
      expect(saved).toBe(true);
      const emails = await mailer.findEmailsByPattern('sql');
      expect(emails.length).toBeGreaterThanOrEqual(2);
      expect(savedSpy).toHaveBeenCalledWith(expect.arrayContaining(['sql1@test.com', 'sql2@test.com']));
    }, 10000);

    test('Clears the waitlist', async () => {
      const clearedSpy = jest.fn();
      mailer.on('onWaitlistCleared', clearedSpy);

      await mailer.addEmail('sql3@test.com');
      await mailer.clearWaitlist();
      expect(await mailer.countWaitlistByDate()).toBe(0);
      expect(clearedSpy).toHaveBeenCalled();
    }, 10000);
  });

  // ==================== Email Sending Features ====================
  describe('Email Sending Features', () => {
    beforeEach(async () => {
      mailer = new WaitlistMailer(StorageType.Local, mailConfig, { companyName: 'TestCo' });
      await mailer.waitForInitialization();
    }, 10000);

    test('Sends bulk confirmation to all emails', async () => {
      const bulkSpy = jest.fn();
      mailer.on('onBulkConfirmationComplete', bulkSpy);

      await mailer.addEmail('bulk1@test.com');
      await mailer.addEmail('bulk2@test.com');
      const sentCount = await mailer.sendBulkConfirmation(
        email => `Bulk ${email}`,
        email => `<p>Bulk ${email}</p>`,
        2,
        100
      );
      expect(sentCount).toBe(2);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
      expect(bulkSpy).toHaveBeenCalledWith({ successCount: 2, total: 2 });
    }, 10000);

    test('Retries sending on failure', async () => {
      const retrySpy = jest.fn();
      mailer.on('onEmailRetry', retrySpy);

      await mailer.addEmail('retry@test.com');
      mockSendMail
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ messageId: 'mock-id' });

      const sent = await mailer.sendConfirmationWithRetry(
        'retry@test.com',
        email => `Retry ${email}`,
        email => `<p>Retry ${email}</p>`,
        1,
        100
      );
      expect(sent).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
      expect(retrySpy).toHaveBeenCalledWith('retry@test.com', 1);
    }, 10000);
  });

  // ==================== Error Handling ====================
  describe('Error Handling', () => {
    test('Throws error on invalid mail config', () => {
      expect(() => new WaitlistMailer(StorageType.Local, {
        host: '',
        port: 0,
        user: '',
        pass: '',
      })).toThrow('Invalid mail configuration');
    }, 10000);

    test('Rejects invalid email format', async () => {
      mailer = new WaitlistMailer(StorageType.Local, mailConfig, { companyName: 'TestCo' });
      await mailer.waitForInitialization();
      const validationSpy = jest.fn();
      mailer.on('onValidationError', validationSpy);

      const added = await mailer.addEmail('invalid-email');
      expect(added).toBe(false);
      expect(validationSpy).toHaveBeenCalled();
    }, 10000);

    test('Handles duplicate email', async () => {
      mailer = new WaitlistMailer(StorageType.Local, mailConfig, { companyName: 'TestCo' });
      await mailer.waitForInitialization();
      const duplicateSpy = jest.fn();
      mailer.on('onDuplicateEmail', duplicateSpy);

      await mailer.addEmail('dup@test.com');
      const addedAgain = await mailer.addEmail('dup@test.com');
      expect(addedAgain).toBe(false);
      expect(duplicateSpy).toHaveBeenCalledWith('dup@test.com');
    }, 10000);
  });
});