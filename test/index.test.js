/* global after before describe it */
import feathers from '@feathersjs/feathers';
import { expect } from 'chai';
import { MongoClient, ObjectID } from 'mongodb';

import adapter from '../lib';

/**
 * @file Tests to ensure the revision adapter is actually creating revisions.
 *
 * These tests use Mongo functions for queries in order
 * to bypass the Feathers adapter and return all revisions.
 */

describe('Feathers MongoDB Service Adapter', () => {
  const app = feathers().use('/things', adapter({
    Model: {},
    id: '_id',
    paginate: {
      default: 10,
      max: 50
    }
  }));
  const idField = app.service('things').id;

  let db;
  let client;
  const resources = [];

  before(done => {
    MongoClient.connect('mongodb://localhost:27017', { useUnifiedTopology: true })
      .then(c => {
        client = c;
        return c.db('test');
      })
      .then(database => {
        db = database;
        app.service('things').Model = db.collection('things');
        db.collection('things').removeMany();
        done();
      });
  });

  after(done => {
    db.dropDatabase().then(() => {
      client.close();
      done();
    });
  });

  const createWithFeathers = function (done) {
    const resource = {
      _id: new ObjectID(),
      name: 'a thing'
    };

    // If using a separate ID field, create a unique ID.
    // This doesn't need to be a Mongo ObjectID, but it's easier.
    if (idField !== '_id') {
      resource[idField] = new ObjectID();
    }

    app.service('things')
      .create(resource)
      .then(resource => {
        updateTestCache(resource);
        done();
      })
      .catch(error => done(error));
  };

  const updateTestCache = function (resource) {
    resources[0] = resource;
    return resource;
  };

  const countRevisionsWithMongo = function (expectations, done) {
    db.collection('things')
      .find({ [idField]: resources[0][idField] })
      .toArray()
      .then(resources => {
        expect(resources).to.be.an('array');
        expect(resources).to.have.lengthOf(1);
        return resources[0]._revision.history ? resources[0]._revision.history.length + 1 : 1;
      })
      .then(expectations)
      .catch(error => done(error));
  };

  describe('creating a resource', () => {
    before(createWithFeathers);

    it('creates a new revision', done => {
      countRevisionsWithMongo(count => {
        expect(count).to.equal(1);
        done();
      }, done);
    });
  });

  describe('find without pagination', () => {
    before(createWithFeathers);
    it('finds without pagination', done => {
      app.service('things')
        .find({ query: { name: 'a thing' }, paginate: false })
        .then(data => {
          expect(data.length).to.equal(2);
          done();
        });
    });

    it('finds without pagination, use select', done => {
      app.service('things')
        .find({ query: { name: 'a thing', $select: ['name'] }, paginate: false })
        .then(data => {
          expect(data.length).to.equal(2);
          done();
        });
    });
  });

  describe('patching a resource', () => {
    before(createWithFeathers);

    it('creates a new revision', done => {
      app.service('things')
        .patch(resources[0][idField], {
          name: 'a thing patched',
          _revision: resources[0]._revision
        })
        .then(updateTestCache)
        .then(resource => {
          return countRevisionsWithMongo(count => {
            expect(count).to.equal(2);
            done();
          }, done);
        })
        .catch(error => done(error));
    });

    it('creates a new revision with each patch', done => {
      app.service('things')
        .patch(resources[0][idField], {
          name: 'a thing patched twice',
          _revision: resources[0]._revision
        })
        .then(updateTestCache)
        .then(resource => {
          return countRevisionsWithMongo(count => {
            expect(count).to.equal(3);
            done();
          }, done);
        })
        .catch(error => done(error));
    });
  });

  describe('updating a resource', () => {
    before(createWithFeathers);

    it('creates a new revision', done => {
      app.service('things')
        .update(resources[0][idField], {
          [idField]: resources[0][idField],
          name: 'a thing updated',
          _revision: resources[0]._revision
        })
        .then(updateTestCache)
        .then(resource => {
          return countRevisionsWithMongo(count => {
            expect(count).to.equal(2);
            done();
          }, done);
        })
        .catch(error => done(error));
    });

    it('creates a new revision with each update', done => {
      app.service('things')
        .update(resources[0][idField], {
          [idField]: resources[0][idField],
          name: 'a thing updated twice',
          _revision: resources[0]._revision
        })
        .then(updateTestCache)
        .then(resource => {
          return countRevisionsWithMongo(count => {
            expect(count).to.equal(3);
            done();
          }, done);
        })
        .catch(error => done(error));
    });
  });

  describe('deleting a resource', () => {
    before(createWithFeathers);

    it('deletes all revisions', done => {
      app.service('things')
        // Patch the resource, so a revision is created.
        .patch(resources[0][idField], {
          [idField]: resources[0][idField],
          name: 'a thing patched',
          _revision: resources[0]._revision
        })
        .then(updateTestCache)
        // Remove the resource using Feathers.
        .then(resource => {
          return app.service('things')
            .remove(resources[0][idField])
            .then(resource => {
              // Count resources using Mongo to bypass Feathers.
              return db.collection('things')
                .find({ [idField]: resources[0][idField] })
                .count()
                .then(count => {
                  expect(count).to.equal(0);
                  done();
                })
                .catch(error => done(error));
            });
        })
        .catch(error => done(error));
    });
  });
});
