# Contributing

Thank you for contributing to IFC Language Tools.

## Development

Install dependencies and run the project checks:

```bash
npm install
npm run check
npm test
npm run compile
```

Open `src/extension.ts` in VS Code, press `F5`, and choose **VS Code Extension Development Host** to run the extension locally.

Package a local `.vsix` with:

```bash
npm run package
```

## Changelog

Add a concise, user-facing bullet under `## Unreleased` in `CHANGELOG.md` for every change users should know about. Internal refactoring, tests, and other changes without a user-visible effect do not require an entry.

Keep entries focused on behavior and outcomes rather than implementation details. The release workflow uses the changelog section whose version matches the pushed Git tag as the curated beginning of the GitHub Release notes.

## Release Process

Prepare releases on `dev`; do not include experimental work that is not intended for the release.

1. Choose the next version according to semantic versioning.
2. Rename `## Unreleased` in `CHANGELOG.md` to the new version, for example `## 0.6.0`.
3. Update `package.json` and `package-lock.json` without creating a tag:

   ```bash
   npm version 0.6.0 --no-git-tag-version
   ```

4. Verify the release:

   ```bash
   npm ci
   npm run check
   npm test
   npm run compile
   npm run package
   ```

5. Commit the release preparation on `dev` and merge `dev` into `production`.
6. Update the local `production` branch and tag the merge commit:

   ```bash
   git switch production
   git pull --ff-only origin production
   git tag v0.6.0
   git push origin v0.6.0
   ```

7. Add a new `## Unreleased` section at the top of `CHANGELOG.md` on `dev` for subsequent work.

The tag version, the version in `package.json`, and the changelog heading must match exactly. Pushing the tag starts the release workflow, which verifies the tag is on `production`, packages the extension, and creates a GitHub Release containing the curated changelog section followed by automatically generated pull-request and contributor notes.
