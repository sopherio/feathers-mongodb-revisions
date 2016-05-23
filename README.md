# feathers-mongodb-revisions

> Feathers MongoDB service with revision support.

This [Feathers](http://feathersjs.com) database adapter extends the basic [MongoDB adapter](https://github.com/feathersjs/feathers-mongodb), adding revision support.

## Installation

`npm install --save mongodb feathers-mongodb-revisions`

## Usage

This module is used in the same way as other [Feathers database adapters](http://docs.feathersjs.com/databases/readme.html), but automatically tracks `_revision` metadata.

This adapter currently implements an "embedded revision" data model, however there are [numerous ways to model revisions in MongoDB](http://www.askasya.com/post/trackversions/). Future versions of this adapter may introduce other revision models (pull requests gladly accepted).

### Revision Metadata

```js
{
  _id: 123, // Resource ID (Mongo ObjectID or as configured)
  name: 'Resource Name 2', // Arbitrary properties
  _revision: {
    id: 2,
    createdAt: '2016-05-09T01:23:45.678Z',
    history: [
      {
        _id: 123,
        name: 'Resource Name 1',
        _revision: {
          id: 1,
          createdAt: '2016-05-08T01:23:45.678Z'
        }
      }
    ]
  }
}
```

- `id`: The `_revision.id` property is an auto-incrementing ID.
- `createdAt`: The `_revision.createdAt` date will always be overwritten, even if it is supplied. However, if an `updatedAt` property is supplied on the resource, it will be used instead. (TODO: Make this configurable.)
- `history`: An array of previous revisions (omitting the recursive `history` properties). When retrieving resources, the `history` property is omitted. (It will be possible to include the complete history in a future version of the adapter.)

### Updating Resources

When updating a resource (via either `patch` or `update`), the current revision ID **must** be supplied with the resource data. If this ID is missing or does not match the most recent revision, the update will fail.

```js
let service = app.service('resources')

let resource = service.get(1)

service.patch(service.id, {
  name: 'updated name',
  _revision: {
    id: resource._revision.id
  }
})
```

## More Documentation

Please refer to the [Feathers database adapter documentation](http://docs.feathersjs.com/databases/readme.html) for more details or directly at:

- [MongoDB](http://docs.feathersjs.com/databases/mongodb.html) - The detailed documentation for the parent MongoDB adapter
- [Extending](http://docs.feathersjs.com/databases/extending.html) - How to extend a database adapter
- [Pagination and Sorting](http://docs.feathersjs.com/databases/pagination.html) - How to use pagination and sorting for the database adapter
- [Querying](http://docs.feathersjs.com/databases/querying.html) - The common adapter querying mechanism
