# Cloud Samples tools

This is a collection of tools used for Cloud Samples maintenance and infrastructure.

Here are some resources to learn more:

- [Testing guidelines](docs/testing-guidelines.md): Tips, tricks, and general guidelines to write tests for samples.
- [custard](custard/README.md): Language-agnostic tool to build testing infrastructure runtimes.

## GitHub Actions reusable workflows

These are used as a full job on its own.
You cannot customize or add new steps.

### Find affected packages

[`GoogleCloudPlatform/cloud-samples-tools/.github/workflows/find-affected.yaml`](.github/workflows/find-affected.yaml)

Finds the affected packages as defined by the config file.
By default, it uses `git diff` to find the files that were changed compared to the `main` branch.

```yaml
jobs:
  affected:
    name: Find affected packages
    uses: GoogleCloudPlatform/cloud-samples-tools/.github/workflows/find-affected.yaml
    with:
      config-file: path/to/my/config.jsonc

      # You can pass comma-separated packages instead of git diff.
      # paths: my/package1, my/package2, my/package3

      # To force return all packages instead of git diff.
      # all: true
```

## GitHub Actions reusable steps

These are used as steps within your workflow job.

### Custard setup

[`GoogleCloudPlatform/cloud-samples-tools/.github/custard-setup`](.github/custard-setup/action.yaml)

This checks out your source code, authenticates to Google Cloud, sets up the environment variables and secrets from the `ci-setup.json` file.

```yaml
jobs:
  my-job:
    runs-on: ubuntu-latest
    steps:
      - name: 🍮 Setup
        uses: GoogleCloudPlatform/cloud-samples-tools/.github/custard-setup
        with:
          path: path/to/my/package
          ci-setup: ${{ toJson(fromJson(needs.affected.outputs.ci-setups)[matrix.path]) }}
          project-id: my-project
      - run: bash run.sh
        working-directory: ${{ matrix.path }}
```

> **Tip**: If you omit any of the `project-id`, `worforce-identity-provider`, or `service-accunt`, the authentication step is skipped.

### Map run
