# Publishing & Releases

## npm Package Publishing

Uses OIDC trusted publishing — no npm token stored in secrets.

### How It Works

1. GitHub Actions requests an OIDC token from GitHub
2. npm exchanges the OIDC token for a short-lived publish token
3. Package is published with cryptographic provenance

### Workflow File

`.github/workflows/publish.yml`

Key settings:
```yaml
permissions:
  id-token: write   # Required for OIDC
  contents: read

- run: npm publish --access public
  # No NODE_AUTH_TOKEN needed
```

### npm Configuration

Configure trusted publisher at https://www.npmjs.com/package/@bryanguffey/astro-standard-site/access

Settings:
- **Organization/user:** `bryanguffey`
- **Repository:** `astro-standard-site` (or actual repo name)
- **Workflow filename:** `publish.yml`

## Release Process

### 1. Update Version

```bash
# In package.json, bump version
npm version patch  # or minor, or major
```

Or edit `package.json` manually.

### 2. Commit

```bash
git add package.json
git commit -m "Release v1.0.1"
```

### 3. Tag

```bash
git tag v1.0.1
```

### 4. Push

```bash
git push && git push --tags
```

### 5. Create GitHub Release

- Go to GitHub → Releases → "Create new release"
- Select the tag you just pushed
- Add release notes
- Publish

This triggers the `publish.yml` workflow.

## Versioning

Follow semver:

| Change | Version Bump |
|--------|--------------|
| Bug fix, no API change | patch (1.0.0 → 1.0.1) |
| New feature, backward compatible | minor (1.0.0 → 1.1.0) |
| Breaking change | major (1.0.0 → 2.0.0) |

## Troubleshooting

**"Unable to authenticate"**
- Check workflow filename matches exactly (case-sensitive, include `.yml`)
- Ensure `id-token: write` permission is set
- Verify trusted publisher config on npmjs.com

**"Package already exists"**
- Version in `package.json` wasn't bumped
- Bump version and re-release

**Tests failing in CI**
- Workflow runs `npm test` before publish
- Fix tests locally first: `npm test`
