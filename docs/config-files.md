# Config file

The tooling is language agnostic, so anything that is language-specific is configured in a _config file_.

The config file can be a `.json` file, or a `.jsonc` (JSON with comments) file.
For `.jsonc` files, it supports both `// single line comments` and `/* multi-line comments */`.

For example, a config file for Node.js might look like this:

```jsonc
// config.jsonc
{
  // The file or files to look for that define a package. (required).
  "package-file": ["package.json"],

  // CI setup file, must be located in the same directory as the package file.
  // This file is used to define settings or configurations on a per-package basis.
  "ci-setup-filename": "ci-setup.json",

  // CI setup defaults, used when no setup file or field is not sepcified in file.
  // Only the values defined here are valid for a setup file.
  "ci-setup-defaults": {
    "node-version": 20,
    "timeout-minutes": 10,
    "env": {}, // Key value pairs of environment variables.
    "secrets": {} // Secret Manager secrets to export as environment variables.
  },

  // CI setup help URL, shown when a setup file validation fails.
  // You can point this to your documentation.
  "ci-setup-help-url": "https://example.com/path/to/config-setup-docs.html",

  // Match diffs only on .js and .ts files
  // Defaults to match all files.
  "match": ["*.js", "*.ts"],

  // Ignore diffs on the README, text files, and anything under node_modules/.
  // Defaults to not ignore anything.
  "ignore": ["README.md", "*.txt", "node_modules/"],

  // Skip these packages, these could be handled by a different config.
  // Defaults to not exclude anything.
  "exclude-packages": ["path/to/slow-to-test", "special-config-package"]
}
```

> For more information, see [`pkg/config/config.go`](../pkg/config/config.go).

## What's next?

- [New repository](new-repo.md) -- configure the tooling for your own repository.
- [GitHub Actions](github-actions.md) -- set up a new GH Actions workflow.
- [CI setup files](ci-setup-files.md) -- per-package settings, env vars, secrets, etc.
