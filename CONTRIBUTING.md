# Contributing to **WaitlistMailer**

Welcome to the **WaitlistMailer** project! We're excited to have you contribute to this tool, which helps manage waitlists and send confirmation emails. Whether you're fixing a bug, adding a feature, or improving documentation, your contributions are valuable. Please follow the guidelines below to ensure a smooth and collaborative process.

---

## **Table of Contents**

1. [Getting Started](#getting-started)
2. [How to Contribute](#how-to-contribute)
   - [Bug Reports](#bug-reports)
   - [Feature Requests](#feature-requests)
   - [Pull Requests](#pull-requests)
3. [Development Setup](#development-setup)
4. [Coding Standards](#coding-standards)
5. [Commit Guidelines](#commit-guidelines)
6. [Testing](#testing)
7. [License](#license)

---

## **Getting Started**

Before contributing, please take a moment to review the following:
- **README.md**: Understand the purpose and functionality of the project.
- **Codebase**: Familiarize yourself with the existing code and structure.
- **Issues**: Check the [GitHub Issues](https://github.com/Juanses03/waitlist-mailer/issues) page to see if there are any open tasks or bugs that need attention.

If you're new to open-source contributions, don't worry! We're here to help, and we appreciate any level of contribution.

---

## **How to Contribute**

### **Bug Reports**

If you encounter a bug, please report it by opening an issue on GitHub. When submitting a bug report, include the following information:
- A clear and descriptive title.
- Steps to reproduce the issue.
- Expected behavior vs. actual behavior.
- Any relevant screenshots, logs, or error messages.

Example:

```plaintext
**Title**: Error when sending confirmation emails

**Description**: 
When trying to send a confirmation email using the `sendConfirmation` method, the application throws an error: "TypeError: Cannot read property 'replace' of undefined". 

Steps to reproduce:
1. Call `sendConfirmation` with a valid email address.
2. Observe the error in the console.

Expected behavior: The email should be sent successfully.
Actual behavior: The application crashes with the above error.
```

---

### **Feature Requests**

If you have an idea for a new feature or improvement, feel free to open an issue labeled as "Feature Request." Provide details about:
- The problem you're trying to solve.
- How the feature would work.
- Any potential implementation ideas.

Example:

```plaintext
**Title**: Add support for multiple email templates

**Description**: 
It would be great if the package supported multiple email templates (e.g., welcome emails, confirmation emails, etc.) instead of just one. This would allow users to customize their emails further.

Potential implementation:
- Add a `templateType` parameter to the `sendConfirmation` method.
- Use different HTML files based on the `templateType`.
```

---

### **Pull Requests**

We encourage you to submit pull requests (PRs) to contribute directly to the project. Follow these steps:

1. **Fork the Repository**:
   - Click the "Fork" button on the [WaitlistMailer GitHub repository](https://github.com/Juanses03/waitlist-mailer) to create a copy under your account.

2. **Clone Your Fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/waitlist-mailer.git
   cd waitlist-mailer
   ```

3. **Create a New Branch**:
   Always create a new branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make Your Changes**:
   - Write clean, well-documented code.
   - Follow the [Coding Standards](#coding-standards).
   - Test your changes locally.

5. **Commit Your Changes**:
   Use clear and concise commit messages. See the [Commit Guidelines](#commit-guidelines) section for more details.

6. **Push Your Changes**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request**:
   - Go to the original repository: [https://github.com/Juanses03/waitlist-mailer](https://github.com/Juanses03/waitlist-mailer).
   - Click "New Pull Request."
   - Provide a clear title and description for your PR.
   - Reference any related issues (e.g., "Fixes #123").

8. **Review Process**:
   - Maintainers will review your PR and may request changes.
   - Once approved, your changes will be merged into the main branch.

---

## **Development Setup**

To set up the project locally for development, follow these steps:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Tests**:
   Ensure all tests pass before submitting your changes:
   ```bash
   npm test
   ```

3. **Build the Project**:
   Compile TypeScript files into JavaScript:
   ```bash
   npm run build
   ```

---

## **Coding Standards**

Please adhere to the following coding standards to maintain consistency across the codebase:
- Use **TypeScript** for all new code.
- Follow the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) for formatting.
- Use meaningful variable and function names.
- Add comments where necessary to explain complex logic.

---

## **Commit Guidelines**

Use the following format for commit messages to ensure clarity and consistency:

```plaintext
type(scope): short description

Longer description (optional)
```

Examples:
- `feat(email): add support for HTML templates`
- `fix(validation): resolve Joi validation error for invalid emails`
- `docs(contributing): update contribution guidelines`

Common types:
- `feat`: A new feature.
- `fix`: A bug fix.
- `docs`: Documentation changes.
- `style`: Code formatting or styling changes.
- `refactor`: Code refactoring without adding features or fixing bugs.
- `test`: Adding or modifying tests.
- `chore`: Maintenance tasks or updates to build tools.

---

## **Testing**

All contributions must include tests to ensure the reliability of the code. Run the test suite locally before submitting your PR:

```bash
npm test
```

If you're adding a new feature, include unit tests to cover the new functionality.

---

## **License**

By contributing to **WaitlistMailer**, you agree that your contributions will be licensed under the **ISC License**. See the [LICENSE](https://github.com/Juanses03/waitlist-mailer/blob/main/LICENSE) file for details.

---

Thank you for contributing to **WaitlistMailer**! Your efforts help make this project better for everyone. If you have any questions or need assistance, feel free to reach out by opening an issue or contacting the maintainers.

Happy coding! 🚀
