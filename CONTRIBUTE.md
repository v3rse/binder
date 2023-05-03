# Contributing to Binder

Welcome to Binder! We're thrilled that you're interested in contributing to our project. This document should provide you with all the information you need to get started.

## Getting started

### Requirements

Before you can contribute to Binder, you'll need to ensure that your development environment meets the following requirements:

- Node.js (v12 or later)
- npm
- Git

### Setting up the project

To get started, clone the Binder repository:

```sh
git clone git@github.com:v3rse/binder.git
```

Then, install the project's dependencies:

```sh
cd binder
npm ci
```

### Running the tests

You can run the project's tests using the following command:

```sh
npm test
```

### Building the project

To build the project, run the following command:

```sh
npm run build
```

### Running the project

To run the project, use the following command:

```sh
npm start -- docs wiki
```
### Pull requests

To contribute code to Binder, please follow these steps:

1. Fork the repository to your own GitHub account.
2. Clone the forked repository to your local machine.
3. Create a new branch for your changes: `git checkout -b my-new-feature`.
4. Make your changes and commit them: `git commit -m "Add some feature"`.
5. Push your changes to your forked repository: `git push origin my-new-feature`.
6. Submit a pull request to the main Binder repository.

Please ensure that your pull request:

- Includes a clear description of the changes you've made.
- Includes tests for any new functionality.
- Passes all existing tests.
- Follows the code style guidelines enforced by ESLint.

### Code of conduct

We expect all contributors to follow our [code of conduct](CODE_OF_CONDUCT.md). Please review this document before contributing.

### Issues

If you encounter a bug or have a feature request, please [open a new issue](https://github.com/v3rse/binder/issues/new) in the GitHub repository.

## Contact

If you have any questions about contributing to Binder, please contact me at [@NanaOAdane](https://twitter.com/NanaOAdane).

Thank you for your interest in contributing to Binder!