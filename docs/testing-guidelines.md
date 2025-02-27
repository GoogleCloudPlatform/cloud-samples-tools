# Testing guidelines

This contains an overview, tips, and best practices to help you test your samples.

## Directory structure

Samples are organized into "packages". Each package consists of a directory, and it can contain one or more code samples. They should be self-contained and include their own tests. They can also contain subpackages. Packages are defined in a language-specific way, so each language is different.

For example _(click to expand / collapse)_:

---

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

---

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

---

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

---

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

---

These might be different for your repository, but it's all configurable.

For more information on how to configure this, see
[custard config files](../custard/README.md#config-files).

## CI setup files

The testing infrastructure supports an _optional_ file to configure the testing infrastructure runtime environment on a per-package basis.
The CI setup file _must_ be located in the same directory as the package file.

For example:

---

<details>
<summary>
<b>Python</b>
</summary>

```sh
my-product/
└─ my-package/
   ├─ requirements.txt  # package file
   └─ ci-setup.json     # setup file
```

</details>

---

<details>
<summary>
<b>Go</b>
</summary>

```sh
my-product/
└─ my-package/
   ├─ go.mod         # package file
   └─ ci-setup.json  # setup file
```

</details>

---

<details>
<summary>
<b>Node</b>
</summary>

```sh
my-product/
└─ my-package/
   ├─ package.json   # package file
   └─ ci-setup.json  # setup file
```

</details>

---

<details>
<summary>
<b>Java</b>
</summary>

```sh
my-product/
└─ my-package/
   ├─ pom.xml        # package file
   └─ ci-setup.json  # setup file
```

</details>

---

The CI setup filename, valid fields, and default values are defined in the config file.
If the CI setup file is not present, or only some values are configured, the rest will use the defaults defined in the config file.

Common things to define here are environment variables, [Secret Manager](https://cloud.google.com/security/products/secret-manager) secrets, language runtime version, test timeout, and other settings that could be useful to override on a per-package basis.

The CI setup file _must_ be a JSON file.
Only the fields defined as defaults in the config file are considered valid fields, any other fields raise a validation error.

JSON doesn't support comments, but you can add a field that starts with `_` and it will be ignored instead of raising an error.
For example, `"_comment": "Set this value because of X"`.

For more information on how to configure this, see
[custard config files](../custard/README.md#config-files).

## Keep tests fast

Tests run **every time a new commit is pushed** to a pull request.
Tests provide feedback to the developer proposing changes.
The faster the feedback, the less context switching required and the more likely a developer will take action in response to the feedback.

> **Tip**: Try to keep test times to less than 5 minutes, but less than 1 minute would be ideal.

However, some tests can take longer to run.
Usually, it's only a small amount of long-running tests.
Separate those long-running tests into their own package or subpackage.
Each long running-test should be its own package.

> **Tip**: In a collection of samples, if a sample requires extra dependencies, split that sampleit into its own package.
> That keeps the other sample's dependencies clean.

> **Tip**: Keeping each new feature into its own package helps to ensure that testing times don't increase every time a new sample is added.

## Test resources

Tests will likely require resources to exist in the testing Google Cloud project. For example, a Cloud Storage bucket, a database, a model endpoint, etc.

We recommend that each test creates and destroys its own resources.
This makes each test more self-contained and minimizes the amount of infrastructure we need to maintain.
This also aligns with the principles of "Infrastructure as Code".

Sometimes creating a resource takes too long or is very expensive, like training or fine tuning a model.
For these cases, we can use a persistent resource.
Persistent resources can have additional maintenance needs, as well as extra care of not deleting them accidentally during cleanups.

If you need a persistent resource created, contact us to discuss options.

## Concurrent runs

Ideally, we should be able to run the same test multiple times at the same time.
Maybe two or more contributors are creating pull requests for the same package, or a pull request was created while the nightly tests are running.
If tests are not designed to run concurrently, someone might get some unexpected errors.
These errors can be confusing and hard to debug, especially for first time contributors.

If a test creates and destroys their own resources, make sure the resource names are different for each run.
This can be done by appending a unique identifier to each resource ID.

> **Tip**: If a test fails due to a resource not found, but it's created during the test, it might have been caused by a concurrent run.
> Try adding unique identifiers to all the created resources.

If a test uses a persistent resource, it's usually safe to do any non-destructive operations concurrently like listing a resource, getting information, reading a value, getting predictions from a model, etc.
Any destructive operations like delete, move, update, etc.
should be done with care in a way that they don't interfere with each other.
Be sure to provide detailed comments in the tests.
This will require more careful code reviews and may raise some flags during review.

## Flaky tests

A flaky test is when it sometimes passes and sometimes fails.
We want to avoid this as much as possible.
This usually happens from non-deterministic APIs, overcomplicated tests, or transient errors.

Here are some common reasons for flaky tests and how to avoid them.

### Simple checks

There are some APIs that might return non-deterministic responses, for example, calls to a machine learning model like Speech-to-Text, or calls to a Large Language Model like Gemini.
Other times a service might slightly change the response format, like adding new fields, or returning a value instead of a null value.
In either case, a code sample should not check that the API works as expected, instead it should only check that the call to the API succeeds.
The API producers should already be doing tests to check the correctness of their APIs, so we don't need to test that.

For samples that show a single API call, it's enough to check that the call succeeded (a 200 response code might still have an "error" in the response body). If necessary you could do general value checks. For example, a call to translate some text should be successful and return a non-empty string. Checking for a specific phrase or word could break the test if the translation backend ever changes, so simply checking that it’s not empty should be enough to assume that the API call was successful and valid.

> **Tip**: If a call raises an exceptions if they fail, it's not necessary to catch and re-raise those errors since they would cause the test to fail anyways.

For samples that involve multiple services or API calls, it's enough that none of the API calls failed and to check that the final result seems valid.
For example, that the final list is not empty, or the result is not null.

> **Tip**: A rule of thumb is to both explicitly check for errors, and to check for “emptiness” or “non-emptiness” of a result.

A sample might be designed to achieve a very specific result, like showing how to configure options in a call for a common use case.
In these cases, it's okay to check that the result satisfies the expected conditions.
It's still a good idea to make those checks as broad as possible, in case the backend implementation changes.

### Retries

There are sometimes transient errors beyond our control.
Maybe the service had an outage, or the worker machine processing our request ran out of memory, or there was a network issue.
These errors can happen, and yet the sample and tests are correct.
With these kinds of transient errors, it's okay to do a retry with
[exponential backoff](https://cloud.google.com/memorystore/docs/redis/exponential-backoff).

Some examples of transient errors are:

- Internal server error (code 500)
- Service unavailable (code 503)
- Too many requests (code 429)
- Connection errors
- Quota limits

> **Tip**: Some libraries like
> [`google.api_core.retry`](https://googleapis.dev/python/google-api-core/latest/retry.html#google.api_core.retry.Retry)
> in Python already handle this.

Generative AI models like Gemini are non-deterministic which may cause a sample to work most of the time.
For example, asking a model to output following a JSON schema, it might get it wrong sometimes.
If it usually does the right thing and only occasionally fails, it's okay to retry as well.
But it might be worth playing with the prompt.

> **Tip**: For Gemini, you can use
> [Controlled generation](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output)
> to specify a schema.

Please keep the number of retries low, usually transient errors should succeed on a second or even third call.
Typically, a timeout of 2 minutes (120 seconds), or a maximum of 3 to 5 retries should be enough.
If a call is consistently failing, even with the retries, there might be something else wrong.
Check the call arguments.
This might be a bug or an error message that could be improved.

If there's a bug or an improvement to the API that could be done, file it!
