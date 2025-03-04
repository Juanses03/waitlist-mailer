import WaitlistMailer from './index'; // Adjust the path as needed
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Load environment variables from .env.local file
dotenv.config({ path: '.env.local' });

jest.mock('nodemailer');
jest.mock('mongoose');

const mockMailConfig = {
  host: process.env.SMTP_HOST!,  // Non-null assertion since .env.local provides it
  port: parseInt(process.env.SMTP_PORT!, 10), // Already safe with parseInt
  user: process.env.SMTP_USER!,  // Non-null assertion
  pass: process.env.SMTP_PASS!,  // Non-null assertion
};

const mockOptionsMongo = {
  companyName: 'Test Company',
  mongoUri: process.env.MONGO_URI,
  sqlConfig: undefined,
};

const mockOptionsSQL = {
  companyName: 'Test Company',
  mongoUri: undefined,
  sqlConfig: {
    dialect: process.env.SQL_DIALECT as 'mysql' | 'postgres',
    host: process.env.SQL_HOST || 'localhost', // Provide default value
    port: parseInt(process.env.SQL_PORT!, 10),
    username: process.env.SQL_USER || '', // Provide default value
    password: process.env.SQL_PASSWORD || '', // Provide default value
    database: process.env.SQL_DATABASE || 'test', // Provide default value
  },
};

describe('WaitlistMailer', () => {
  let mailer: WaitlistMailer;

  const setupMockTransporter = () => {
    return {
      sendMail: jest.fn().mockResolvedValue({ messageId: '123' }),
      verify: jest.fn().mockImplementation((callback) => callback(null)),
      options: {
        auth: {
          user: mockMailConfig.user,
          pass: mockMailConfig.pass,
        },
      },
    };
  };

  // MongoDB Tests
  describe('with MongoDB', () => {
    beforeAll(async () => {
      if (!mockOptionsMongo.mongoUri) throw new Error('MONGO_URI not defined');
      await mongoose.connect(mockOptionsMongo.mongoUri);
    });

    afterAll(async () => {
      await mongoose.disconnect();
    });

    beforeEach(() => {
      (nodemailer.createTransport as jest.Mock).mockReturnValue(setupMockTransporter());
      mailer = new WaitlistMailer('db', mockMailConfig, mockOptionsMongo);
    });

    afterEach(async () => {
      jest.clearAllMocks(); // Clear mock function calls
      mailer.clearWaitlist(); // Clear in-memory waitlist
      // Clear MongoDB collection (assumes a 'waitlist' collection)
      await mongoose.connection.collection('waitlists').deleteMany({});
    });

    it('should save and load waitlist from MongoDB', async () => {
      mailer.addEmail('test@example.com');
      await mailer.saveWaitlist();

      const mailer2 = new WaitlistMailer('db', mockMailConfig, mockOptionsMongo);
      await mailer2.waitForInitialization();
      expect(mailer2.getWaitlist()).toContain('test@example.com');
    });
  });

  // SQL Tests
  describe('with SQL', () => {
    let sequelize: Sequelize;

    beforeAll(async () => {
      if (
        !mockOptionsSQL.sqlConfig!.dialect ||
        !mockOptionsSQL.sqlConfig!.host ||
        !mockOptionsSQL.sqlConfig!.port ||
        !mockOptionsSQL.sqlConfig!.username ||
        !mockOptionsSQL.sqlConfig!.database
      ) {
        throw new Error('SQL configuration missing in .env.local');
      }

      sequelize = new Sequelize({
        dialect: mockOptionsSQL.sqlConfig!.dialect,
        host: mockOptionsSQL.sqlConfig!.host,
        port: mockOptionsSQL.sqlConfig!.port,
        username: mockOptionsSQL.sqlConfig!.username,
        password: mockOptionsSQL.sqlConfig!.password || '', // Empty string if undefined
        database: mockOptionsSQL.sqlConfig!.database,
        logging: false,
      });

      try {
        await sequelize.authenticate();
        console.log('MySQL connection established successfully');
        await sequelize.query(`CREATE DATABASE IF NOT EXISTS ${mockOptionsSQL.sqlConfig!.database};`);
        await sequelize.query(`USE ${mockOptionsSQL.sqlConfig!.database};`);
      } catch (error) {
        console.error('Failed to connect to MySQL:', error);
        throw error;
      }
    });

    afterAll(async () => {
      if (sequelize) {
        await sequelize.close();
      }
    });

    beforeEach(async () => {
      (nodemailer.createTransport as jest.Mock).mockReturnValue(setupMockTransporter());
      mailer = new WaitlistMailer('sql', mockMailConfig, mockOptionsSQL);
      await mailer.waitForInitialization();
    });

    afterEach(async () => {
      jest.clearAllMocks(); // Clear mock function calls
      mailer.clearWaitlist(); // Clear in-memory waitlist
      // Clear SQL table
      try {
        await sequelize.query('TRUNCATE TABLE waitlist;');
      } catch (error) {
        console.warn('Could not truncate table:', error);
      }
    });

    it('should save and load waitlist from SQL', async () => {
      mailer.addEmail('test@example.com');
      await mailer.saveWaitlist();

      const mailer2 = new WaitlistMailer('sql', mockMailConfig, mockOptionsSQL);
      await mailer2.waitForInitialization();
      expect(mailer2.getWaitlist()).toContain('test@example.com');
    });
  });

  // Local Storage Tests
  describe('with Local Storage', () => {
    beforeEach(() => {
      (nodemailer.createTransport as jest.Mock).mockReturnValue(setupMockTransporter());
      mailer = new WaitlistMailer('local', mockMailConfig, mockOptionsMongo);
      mailer.clearWaitlist();
    });

    afterEach(() => {
      jest.clearAllMocks(); // Clear mock function calls
      mailer.clearWaitlist(); // Clear in-memory waitlist
    });

    it('should initialize with local storage', () => {
      expect(mailer.isInitialized()).toBe(true);
    });

    it('should add an email to the waitlist', () => {
      const result = mailer.addEmail('test@example.com');
      expect(result).toBe(true);
      expect(mailer.getWaitlist()).toContain('test@example.com');
    });

    it('should not add an invalid email', () => {
      const result = mailer.addEmail('invalid-email');
      expect(result).toBe(false);
    });

    it('should not add a duplicate email', () => {
      mailer.addEmail('test@example.com');
      const result = mailer.addEmail('test@example.com');
      expect(result).toBe(false);
    });

    it('should remove an email from the waitlist', () => {
      mailer.addEmail('test@example.com');
      const result = mailer.removeEmail('test@example.com');
      expect(result).toBe(true);
      expect(mailer.getWaitlist()).not.toContain('test@example.com');
    });

    it('should send a confirmation email', async () => {
      mailer.addEmail('test@example.com');
      const result = await mailer.sendConfirmation(
        'test@example.com',
        () => 'Welcome!',
        () => 'Your confirmation email.'
      );
      expect(result).toBe(true);
      expect(nodemailer.createTransport().sendMail).toHaveBeenCalled();
    });

    it('should handle email sending errors', async () => {
      (nodemailer.createTransport().sendMail as jest.Mock).mockRejectedValue(new Error('Send error'));
      mailer.addEmail('test@example.com');
      const result = await mailer.sendConfirmation(
        'test@example.com',
        () => 'Welcome!',
        () => 'Your confirmation email.'
      );
      expect(result).toBe(false);
    });

    it('should find emails by pattern', async () => {
      mailer.addEmail('test@example.com');
      mailer.addEmail('anothertest@example.com');
      const results = await mailer.findEmailsByPattern('test');
      expect(results).toContain('test@example.com');
      expect(results).toContain('anothertest@example.com');
    });

    it('should count waitlist by date range', async () => {
      mailer.addEmail('test@example.com');
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');
      const count = await mailer.countWaitlistByDate(startDate, endDate);
      expect(count).toBeGreaterThan(0);
    });

    it('should clear the waitlist', () => {
      mailer.addEmail('test@example.com');
      mailer.clearWaitlist();
      expect(mailer.getWaitlist()).toHaveLength(0);
    });

    it('should save the waitlist', async () => {
      mailer.addEmail('test@example.com');
      const result = await mailer.saveWaitlist();
      expect(result).toBe(true);
    });

    it('should close resources properly', async () => {
      await mailer.close();
    });
  });
});