# Overview

## Directory structure

Samples are organized into "packages". Each package consists of a directory, and it can contain one or more code samples. They should be self-contained and include their own tests. They can also contain subpackages. Packages are defined in a language-specific way, so each language is different, for example:

<details>
<summary>
<b>Python</b>: Contains a <code>requirements.txt</code> file.
</summary>

```sh
my-package/
├─ requirements.txt  # package file
├─ my_sample.py
├─ my_sample_test.py
└─ my-subpackage/
   ├─ requirements.txt  # package file
   ├─ other_sample.py
   └─ other_sample_test.py
```

</details>
<br/>

<details>
<summary>
<b>Go</b>: Contains a <code>go.mod</code> file.
</summary>

```sh
my-package/
├─ go.mod  # package file
├─ my_sample.go
├─ my_sample_test.go
└─ my-subpackage/
   ├─ go.mod  # package file
   ├─ other_sample.go
   └─ other_sample_test.go
```

</details>
<br/>

<details>
<summary>
<b>Node</b>: Contains a <code>package.json</code> file.
</summary>

```sh
my-package/
├─ package.json  # package file
├─ my-sample.js
├─ test/
│  └─ my-sample.test.js
└─ my-subpackage/
   ├─ package.json  # package file
   ├─ other-sample.js
   └─ test/
      └─ other-sample.test.js
```

</details>
<br/>

<details>
<summary>
<b>Java</b>: Contains a <code>pom.xml</code> file.
</summary>

```sh
my-package/
├─ pom.xml  # package file
├─ src/
│  ├─ main/java/mypackage/
│  │  └─ MySample.java
│  └─ test/java/mypackage/
│     └─ MySampleTest.java
└─ my-subpackage/
   ├─ pom.xml  # package file
   └─ src/
      ├─ main/java/mysubpackage/
      │  └─ OtherSample.java
      └─ test/java/mysubpackage/
         └─ OtherSampleTest.java
```

</details>
<br/>

## What's next?

- [New repository](new-repo.md) -- configure the tooling for your own repository.
- [GitHub Actions](github-actions.md) -- set up a new GH Actions workflow.
- [Config files](config-files.md) -- settings for package discovery and setup.
- [CI setup files](ci-setup-files.md) -- per-package settings, env vars, secrets, etc.
- [Secrets](secrets.md) -- manage secrets like API keys and passwords.
- [Fast tests](fast-tests.md) -- keep your tests running fast.
- [Test resources](test-resources.md) -- setup, teardown, and resource management.
- [Concurrent runs](concurrent-runs.md) -- run the same test on multiple PRs at the same time.
- [Flaky tests](flaky-tests.md) -- tips for stable and resilient tests.
