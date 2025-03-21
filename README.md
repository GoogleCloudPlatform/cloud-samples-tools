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

      # You can pass comma-separated packages to use instead of git diff.
      # paths: my/package
      # paths: my/package1, my/package2, my/package3
```

> **Tip**: Pass `paths: .` to return all packages.

## GitHub Actions reusable steps

These are used as steps within your workflow job.

### Custard setup

[`GoogleCloudPlatform/cloud-samples-tools/actions/steps/setup-custard`](actions/steps/setup-custard/action.yaml)

This checks out your source code, authenticates to Google Cloud, sets up the environment variables and secrets from the `ci-setup.json` file.

This is intended to be used with `find-affected`.
For example, this is how to spin a test job for all affected packages.

```yaml
jobs:
  test:
    needs: affected
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        path: ${{ fromJson(needs.affected.outputs.paths) }}
    steps:
      - name: Setup Custard
        uses: GoogleCloudPlatform/cloud-samples-tools/actions/steps/setup-custard
        with:
          path: ${{ matrix.path }}
          ci-setup: ${{ toJson(fromJson(needs.affected.outputs.ci-setups)[matrix.path]) }}

          # For auth, if any is missing auth is skipped.
          project-id: my-project-id
          workload-identity-provider: projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider
          service-account: my-service-account@my-project-id.iam.gserviceaccount.com

      - run: ./run-my-tests
        working-directory: ${{ matrix.path }}
```

### Map run

[`GoogleCloudPlatform/cloud-samples-tools/actions/steps/map-run`](actions/steps/map-run/action.yaml)

Used to run a command on multiple paths.

For example, this can be used to run a linter on affected packages only.

```yaml
jobs:
  lint:
    needs: affected
    runs-on: ubuntu-latest
    steps:
      - name: Run linter
        uses: GoogleCloudPlatform/cloud-samples-tools/actions/steps/map-run
        with:
          command: ./run-my-linter
          paths: ${{ needs.affected.outputs.paths }}
```
