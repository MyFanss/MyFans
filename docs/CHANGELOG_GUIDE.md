# Changelog Automation Guide

## Overview

MyFans uses conventional commits to automatically generate changelogs. This ensures consistent, readable release notes without manual maintenance.

## Conventional Commit Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature (triggers minor version bump)
- **fix**: Bug fix (triggers patch version bump)
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring without feature changes
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks, dependency updates
- **ci**: CI/CD configuration changes
- **build**: Build system changes

### Scopes (Optional)

- `frontend`: Frontend changes
- `backend`: Backend changes
- `contract`: Smart contract changes
- `docs`: Documentation
- `ci`: CI/CD

### Examples

```bash
# Feature addition
git commit -m "feat(frontend): add creator profile page"

# Bug fix
git commit -m "fix(backend): resolve subscription renewal issue"

# Breaking change
git commit -m "feat(contract)!: change subscription payment structure

BREAKING CHANGE: Subscription payment now requires upfront payment"

# Multiple scopes
git commit -m "feat(frontend,backend): implement real-time notifications"
```

## Breaking Changes

Mark breaking changes with `!` after type/scope or include `BREAKING CHANGE:` in footer:

```bash
git commit -m "feat(contract)!: update subscription interface"

# OR

git commit -m "feat(contract): update subscription interface

BREAKING CHANGE: The subscribe method now requires additional parameters"
```

## Automation Workflow

### Automatic Generation

The changelog is automatically generated when:
1. Code is pushed to `main` branch
2. Workflow is manually triggered from GitHub Actions

### Manual Generation

Generate changelog locally:

```bash
# Install conventional-changelog-cli
npm install -g conventional-changelog-cli

# Generate changelog
conventional-changelog -p angular -i CHANGELOG.md -s

# Or generate from scratch
conventional-changelog -p angular -i CHANGELOG.md -s -r 0
```

## Changelog Structure

The generated `CHANGELOG.md` includes:

- **Features**: New functionality
- **Bug Fixes**: Resolved issues
- **Performance Improvements**: Optimizations
- **Breaking Changes**: Incompatible changes
- **Commit links**: Direct links to commits
- **Issue references**: Automatically linked issues

## Best Practices

1. **Write clear subjects**: Keep under 72 characters
2. **Use imperative mood**: "add feature" not "added feature"
3. **Reference issues**: Include issue numbers in footer
4. **Group related changes**: Use consistent scopes
5. **Explain breaking changes**: Always document impact

### Good Commit Messages

```bash
feat(frontend): add subscription management dashboard

Implements user interface for managing active subscriptions,
viewing payment history, and canceling subscriptions.

Closes #123
```

```bash
fix(backend): prevent duplicate subscription charges

Added idempotency check to subscription renewal process
to prevent users from being charged multiple times.

Fixes #456
```

### Bad Commit Messages

```bash
# Too vague
git commit -m "fix stuff"

# Missing type
git commit -m "add new feature"

# Not imperative
git commit -m "feat: added subscription page"
```

## Version Bumping

Conventional commits also enable semantic versioning:

- `feat`: Minor version bump (1.0.0 → 1.1.0)
- `fix`: Patch version bump (1.0.0 → 1.0.1)
- `BREAKING CHANGE`: Major version bump (1.0.0 → 2.0.0)

## Integration with CI/CD

The changelog workflow:
1. Runs on every push to `main`
2. Generates/updates `CHANGELOG.md`
3. Commits changes back to repository
4. Skips CI on changelog commits (`[skip ci]`)

## Troubleshooting

### Changelog not updating
- Ensure commits follow conventional format
- Check GitHub Actions logs for errors
- Verify repository permissions

### Missing commits in changelog
- Only commits since last tag are included
- Use `-r 0` flag to regenerate entire changelog

### Duplicate entries
- Delete `CHANGELOG.md` and regenerate from scratch

## Resources

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Angular Commit Guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
- [Semantic Versioning](https://semver.org/)

## Maintenance

Review and clean up `CHANGELOG.md` before major releases to ensure clarity and accuracy.

**Last Updated**: 2026-04-22
