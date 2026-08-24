# GitHub workflows

- `ci.yml` checks every pull request and push to `main`.
- `security.yml` scans the full Git history for leaked secrets.
- `release.yml` publishes matching `vX.Y.Z` tags to npm with Trusted Publishing
  and creates a GitHub release.
