# Contributing to SafeVault

First off, thank you for considering contributing to SafeVault! 🙏

This is a security-focused project, and we take code quality seriously. By contributing, you help make password management safer and more private for everyone.

## 📜 Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## 🤔 How Can I Contribute?

### Reporting Bugs

Before opening a bug report:
1. **Search existing issues** to avoid duplicates
2. **Check if it's already fixed** in the latest release
3. **Gather details**: OS, SafeVault version, steps to reproduce

Use the [Bug Report template](https://github.com/SudhirDevOps1/SafeVault/issues/new?template=bug_report.md).

### Suggesting Features

We welcome feature ideas! Please:
1. Check existing [feature requests](https://github.com/SudhirDevOps1/SafeVault/issues?q=label%3Aenhancement)
2. Clearly describe the use case
3. Consider privacy implications (features must align with our zero-knowledge principle)

Use the [Feature Request template](https://github.com/SudhirDevOps1/SafeVault/issues/new?template=feature_request.md).

### Reporting Security Issues

**⚠️ DO NOT open a public issue for security vulnerabilities.**

Please email us at `security@safevault.local` (or use GitHub's private vulnerability reporting). See [SECURITY.md](SECURITY.md) for details.

## 🛠️ Development Setup

```bash
# Clone and setup
git clone https://github.com/SudhirDevOps1/SafeVault.git
cd SafeVault
npm install

# Start development
npm run dev

# Run tests
npm test

# Check types
npm run typecheck
```

## 📝 Pull Request Process

### Before You Start
1. Open an issue to discuss the change (unless it's a small fix)
2. Fork the repo and create a branch: `git checkout -b feat/your-feature`

### Code Style
- **TypeScript** — no `any` types unless absolutely necessary
- **Functional components** with hooks
- **Zustand** for state management
- **Tailwind CSS** for styling
- **Meaningful variable/function names**
- **Comments** for non-obvious logic (especially crypto)

### Commits
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add keyboard shortcut for lock
fix: resolve TOTP countdown race condition
docs: update README installation steps
test: add crypto utility tests
refactor: simplify vault encryption flow
```

### PR Checklist
- [ ] Code passes `npm run typecheck`
- [ ] Tests added/updated for new functionality
- [ ] All tests pass (`npm test`)
- [ ] Documentation updated (README, comments)
- [ ] No security regressions (especially in crypto/auth)
- [ ] PR description explains the "why", not just "what"

## 🔒 Security Guidelines

Since SafeVault is a credential manager, please:

1. **Never commit secrets** (API keys, passwords, test vaults with real data)
2. **Never log sensitive data** — use the secure logger
3. **Use secure random sources** — `crypto.getRandomValues()` only
4. **Follow existing crypto patterns** — don't roll your own crypto
5. **Test security-sensitive code thoroughly**
6. **Document security implications** of new features

## 🎨 UI/UX Guidelines

- Follow the existing dark theme with emerald accents
- Use **ARIA labels** on interactive elements
- Add **loading states** for async operations
- Provide **error feedback** (role="alert")
- Support **keyboard navigation**
- Test with **screen readers** (NVDA, VoiceOver)

## 💬 Questions?

- Open a [Discussion](https://github.com/SudhirDevOps1/SafeVault/discussions)
- Reach out to maintainers

---

Thank you for contributing to privacy-first software! 🔐
