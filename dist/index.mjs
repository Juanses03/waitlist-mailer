var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// lib/index.ts
import nodemailer from "nodemailer";
import { readFile } from "fs/promises";
import Joi from "joi";
var WaitlistMailer = class {
  // Company name used in email templates
  /**
   * Constructor for initializing the WaitlistMailer instance.
   * @param storage - Storage type ('local' or 'db').
   * @param mailConfig - Configuration for the SMTP transporter.
   * @param options - Optional settings (e.g., company name).
   */
  constructor(storage = "local", mailConfig, options) {
    this.storage = storage;
    this.waitlist = [];
    this.companyName = (options == null ? void 0 : options.companyName) || "Your Company Name";
    this.transporter = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.port === 465,
      // true for port 465 (SSL)
      auth: {
        user: mailConfig.user,
        pass: mailConfig.pass
      }
    });
  }
  /**
   * Adds an email address to the waitlist if it's valid and unique.
   * @param email - Email address to add.
   * @returns True if the email was added successfully, false otherwise.
   */
  addEmail(email) {
    if (!this.isValidEmail(email)) {
      console.error(`Invalid email format: ${email}`);
      return false;
    }
    if (this.waitlist.includes(email)) {
      console.error(`Email already registered: ${email}`);
      return false;
    }
    this.waitlist.push(email);
    console.log(`Email added: ${email}`);
    return true;
  }
  /**
   * Validates the format of an email address using Joi.
   * @param email - Email address to validate.
   * @returns True if the email is valid, false otherwise.
   */
  isValidEmail(email) {
    const schema = Joi.string().email({ tlds: { allow: false } });
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
  sendConfirmation(email, subjectTemplate, bodyTemplate) {
    return __async(this, null, function* () {
      var _a;
      try {
        if (!this.waitlist.includes(email)) {
          console.error(`Email not found in waitlist: ${email}`);
          return false;
        }
        const subject = subjectTemplate(email);
        let htmlContent = bodyTemplate(email);
        htmlContent = htmlContent.replace(/\[Company Name\]/g, this.companyName);
        const mailOptions = {
          from: `"${this.companyName}" <${(_a = this.transporter.options.auth) == null ? void 0 : _a.user}>`,
          to: email,
          subject,
          html: htmlContent,
          headers: {
            "Content-Type": "text/html; charset=utf-8"
          }
        };
        const info = yield this.transporter.sendMail(mailOptions);
        console.log(`Confirmation email sent to: ${email}`);
        console.log("Message ID:", info.messageId);
        return true;
      } catch (error) {
        console.error(`Error sending confirmation email to ${email}:`, error);
        return false;
      }
    });
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
  sendConfirmationFromFile(_0, _1, _2) {
    return __async(this, arguments, function* (email, subjectTemplate, templateFilePath, replacements = {}) {
      var _a;
      try {
        if (!this.waitlist.includes(email)) {
          console.error(`Email not found in waitlist: ${email}`);
          return false;
        }
        let htmlContent;
        try {
          htmlContent = yield readFile(templateFilePath, "utf8");
        } catch (fileError) {
          console.error(`Template file not found at ${templateFilePath}:`, fileError);
          return false;
        }
        const templateVariables = __spreadValues({
          email,
          companyName: this.companyName
        }, replacements);
        for (const [key, value] of Object.entries(templateVariables)) {
          const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, "g");
          htmlContent = htmlContent.replace(placeholder, value);
        }
        const mailOptions = {
          from: `"${this.companyName}" <${(_a = this.transporter.options.auth) == null ? void 0 : _a.user}>`,
          to: email,
          subject: subjectTemplate(email),
          html: htmlContent,
          headers: {
            "Content-Type": "text/html; charset=utf-8"
          }
        };
        const info = yield this.transporter.sendMail(mailOptions);
        console.log(`Confirmation email sent to: ${email}`);
        console.log("Message ID:", info.messageId);
        return true;
      } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
        return false;
      }
    });
  }
  /**
   * Saves the waitlist to the specified storage (local or database).
   */
  saveWaitlist() {
    try {
      if (this.storage === "local") {
        console.log("Waitlist saved locally");
      } else if (this.storage === "db") {
        console.log("Waitlist saved to database");
      }
    } catch (error) {
      console.error("Error saving waitlist:", error);
    }
  }
};
var index_default = WaitlistMailer;
export {
  index_default as default
};
