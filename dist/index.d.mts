/**
 * Interface for mail configuration.
 * Defines the required properties for setting up an SMTP transporter.
 */
interface MailConfig {
    host: string;
    port: number;
    user: string;
    pass: string;
}
/**
 * Optional configuration for WaitlistMailer.
 * Allows customization of company name and other settings.
 */
interface WaitlistMailerOptions {
    companyName?: string;
}
/**
 * Class for managing a waitlist and sending confirmation emails.
 * Supports both local and database storage for the waitlist.
 */
declare class WaitlistMailer {
    private storage;
    private waitlist;
    private transporter;
    private companyName;
    /**
     * Constructor for initializing the WaitlistMailer instance.
     * @param storage - Storage type ('local' or 'db').
     * @param mailConfig - Configuration for the SMTP transporter.
     * @param options - Optional settings (e.g., company name).
     */
    constructor(storage: "local" | "db" | undefined, mailConfig: MailConfig, options?: WaitlistMailerOptions);
    /**
     * Adds an email address to the waitlist if it's valid and unique.
     * @param email - Email address to add.
     * @returns True if the email was added successfully, false otherwise.
     */
    addEmail(email: string): boolean;
    /**
     * Validates the format of an email address using Joi.
     * @param email - Email address to validate.
     * @returns True if the email is valid, false otherwise.
     */
    private isValidEmail;
    /**
     * Sends a confirmation email using template functions.
     * This method is maintained for backward compatibility.
     *
     * @param email - Recipient email address.
     * @param subjectTemplate - Function generating the email subject.
     * @param bodyTemplate - Function generating the email body (HTML content).
     * @returns True if the email was sent successfully, false otherwise.
     */
    sendConfirmation(email: string, subjectTemplate: (email: string) => string, bodyTemplate: (email: string) => string): Promise<boolean>;
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
    sendConfirmationFromFile(email: string, subjectTemplate: (email: string) => string, templateFilePath: string, replacements?: Record<string, string>): Promise<boolean>;
    /**
     * Saves the waitlist to the specified storage (local or database).
     */
    saveWaitlist(): void;
}

export { WaitlistMailer as default };
