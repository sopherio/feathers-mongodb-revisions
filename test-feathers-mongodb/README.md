These tests are copied directly from [feathers-mongodb](https://github.com/feathersjs/feathers-mongodb), and are here for informational and sanity-checking purposes.

Many of the tests will never be able to pass against the revisions service, due to the way the base test data is generated (no `_revision` properties). It is still good practice to run these tests occasionally in order to keep fidelity with the upstream Mongo adapter.

## Usage

`npm run test:feathers-mongodb`
