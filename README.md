# Cloud Samples tools

This is a collection of tools used for Cloud Samples maintenance and infrastructure.

Here are some resources to learn more:

- [Testing guidelines](docs/testing-guidelines.md): Tips, tricks, and general guidelines to write tests for samples.
- [custard](custard/README.md): Language-agnostic tool to build testing infrastructure runtimes.

## GitHub Actions reusable workflows

These are used as a full job on its own.
You cannot customize or add new steps.

Open the workflow files to see all the available options.

### Find affected packages

[`GoogleCloudPlatform/cloud-samples-tools/.github/workflows/affected.yaml`](.github/workflows/affected.yaml)

**Requires `statuses: write` permissions.**

> **Note**: This is meant to be used with `workflow_run` or `push` triggers.
> Using this with `pull_request` will cause a duplicated status check.
> See the `affected` _reusable step_ to learn how to use it with different triggers.

Finds the affected packages as defined by the config file.
By default, it uses `git diff` to find the files that were changed compared to the `main` branch.

This creates a status check on a pull request to manage the overall state of everything.
Once this job finishes running, the check is set to status `in_progress`.

The check is meant to be set to `success` by a different job, only after everything finishes running.
This way, the check will block a PR until everything finishes.

<!-- x-release-please-start-version -->

```yaml
jobs:
  affected:
    uses: GoogleCloudPlatform/cloud-samples-tools/.github/workflows/affected.yaml@v0.4.0
    permissions:
      statuses: write
    with:
      head-sha: ${{ github.event.workflow_run.head_sha || github.sha }}
      config-file: path/to/my/config.jsonc
      # paths: my/package, other/package

  lint: ...

  test: ...

  done:
    needs: [affected, lint, test]
    runs-on: ubuntu-latest
    permissions:
      statuses: write
    steps:
      - uses: GoogleCloudPlatform/cloud-samples-tools/actions/steps/update-check@v0.4.0
        with:
          check: ${{ needs.affected.outputs.check }}
          status: success
```

> **Tip**: Pass `paths: .` to return all packages.

## GitHub Actions reusable steps

These are used as steps within your workflow job.

Open the workflow files to see all the available options.

### Setup Custard

[`GoogleCloudPlatform/cloud-samples-tools/actions/steps/setup-custard`](actions/steps/setup-custard/action.yaml)

> **Note**: This requires
> [`google-github-actions/auth`](https://github.com/google-github-actions/auth)
> if there are any secrets to fetch.

Sets up the environment variables and secrets from the `ci-setup.json` file.

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
      - uses: actions/checkout@v5
        with:
          ref: ${{ github.event.workflow_run.head_sha || github.sha }}
      - uses: google-github-actions/auth@v2
        id: auth
        with:
          project_id: my-project
          workload_identity_provider: projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider
          service_account: my-service-account@my-project.iam.gserviceaccount.com
          access_token_lifetime: 600s # 10 minutes
          token_format: id_token
          id_token_audience: https://action.test/ # service must have this custom audience
          id_token_include_email: true
        - name: Setup Custard
        uses: GoogleCloudPlatform/cloud-samples-tools/actions/steps/setup-custard@v0.4.0
        with:
          path: ${{ matrix.path }}
          ci-setup: ${{ toJson(fromJson(needs.affected.outputs.ci-setups)[matrix.path]) }}
          id-token: ${{ steps.auth.outputs.id_token }}
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
        uses: GoogleCloudPlatform/cloud-samples-tools/actions/steps/map-run@v0.4.0
        with:
          command: ./run-my-linter
          paths: ${{ needs.affected.outputs.paths }}
```

### Create and update checks

[`GoogleCloudPlatform/cloud-samples-tools/actions/steps/create-check`](actions/steps/create-check/action.yaml)

[`GoogleCloudPlatform/cloud-samples-tools/actions/steps/update-check`](actions/steps/update-check/action.yaml)

**Requires `statuses: write` permissions.**

Creates and updates checks on a commit, it shows up on the pull request UI.

> **Tip**: You can use `if: failure()` to surface a failure in the check if something goes wrong.

```yaml
jobs:
  my-job:
    permissions:
      statuses: write
    steps:
      - name: Check queued
        uses: GoogleCloudPlatform/cloud-samples-tools/actions/steps/create-check@v0.4.0
        id: queued
        with:
          sha: ${{ github.event.workflow_run.head_sha || github.sha }}
          # status: queued | in_progress | success | failure | action_required | cancelled | neutral | success | skipped | timed_out
          # name: Check name as shown in the UI
          # title: Label shown as "progress" in the UI
          # job-name: Job name to link to.

      # Checkout code, setup language and the environment.

      - name: Check in_progress
        uses: GoogleCloudPlatform/cloud-samples-tools/actions/steps/update-check@v0.4.0
        id: in_progress
        with:
          check: ${{ steps.queued.outputs.check }}
          status: in_progress

      # Run something.

      - name: Check success
        uses: GoogleCloudPlatform/cloud-samples-tools/actions/steps/update-check@v0.4.0
        with:
          check: ${{ steps.in_progress.outputs.check }}
          status: success
      - name: Check failure
        uses: GoogleCloudPlatform/cloud-samples-tools/actions/steps/update-check@v0.4.0
        if: failure()
        with:
          check: ${{ steps.in_progress.outputs.check }}
          status: failure
```

> **Tip**: For strategy matrix jobs, specify the full job name with `job-name`. For example `job-name: ${{ github.job }} (${{ matrix.path }})`.

### Create status

[`GoogleCloudPlatform/cloud-samples-tools/actions/steps/create-status`](actions/steps/create-status/action.yaml)

This is a low level wrapper to create a check using the Status API.

Using this directly is discouraged, we recommend using `create-check` and `create-status`.

### Get job

[`GoogleCloudPlatform/cloud-samples-tools/actions/steps/get-job`](actions/steps/get-job/action.yaml)

Returns the job ID and job URL of the given job.
It defaults to the current job on the current workflow run.

```yaml
jobs:
  my-job:
    steps:
      - name: Get job
        uses: GoogleCloudPlatform/cloud-samples-tools/actions/steps/get-job@v0.4.0
        id: job
        # with:
        #   job-name: my-job
```

> **Tip**: For strategy matrix jobs, specify the full job name with `job-name`. For example `job-name: ${{ github.job }} (${{ matrix.path }})`.

<!-- x-release-please-end-version -->
