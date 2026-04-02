# Seli GitHub & npm Publish Checklist

This project intentionally does not include GitHub Actions workflows by default.
Use this checklist for manual release and publish.

## 1) Repository Rename (GitHub)

- Rename repository slug to `seli` on GitHub.
- Update local remote:

```bash
git remote set-url origin git@github.com:<owner>/seli.git
```

- Verify:

```bash
git remote -v
```

## 2) Package Metadata

- `package.json` should contain:
  - `"name": "seli"`
  - `"version": "<release-version>"`
  - `"bin": { "seli": "./src/cli.ts" }`

- Ensure README install/start commands match:
  - `npm install -g seli`
  - `seli init`

## 3) Preflight Checks

```bash
bun install
bun run typecheck
bun test
```

## 4) Publish to npm

- Login if needed:

```bash
npm login
```

- Publish:

```bash
npm publish --access public
```

## 5) Git Tag + Release

```bash
git tag v<release-version>
git push origin v<release-version>
```

- Create GitHub Release from the tag and include key changes:
  - Branding rename to Seli
  - `.selirc` / `.seli.lock` contract
  - legacy migration support
  - CLI banner and status UX

## 6) Post-Release Validation

- Install from npm in a clean environment:

```bash
npm install -g seli
seli --help
```

- Smoke-run `seli init` against a temp project and verify outputs:
  - `.selirc`
  - `.seli.lock`
  - `.agents/skill_team.md`
