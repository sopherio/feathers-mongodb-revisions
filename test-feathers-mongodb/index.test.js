import feathers from '@feathersjs/feathers';
import { expect } from 'chai';
import { MongoClient, ObjectID } from 'mongodb';

import service from '../src';

describe('Feathers MongoDB Service', () => {
  const _ids = {};
  const app = feathers()
    .use('/people', service({ Model: {} }));

  let db;
  let client;

  before(done => {
    MongoClient.connect('mongodb://localhost:27017', { useUnifiedTopology: true })
    .then(c => {
      client = c;
      return c.db('feathers-mongodb-revisions-test');
    })
    .then(database => {
      db = database;
      app.service('people').Model = db.collection('people');

      db.collection('people').removeMany();
      db.collection('todos').removeMany();
      done();
    });
  });

  after(done => {
    db.dropDatabase().then(() => {
      client.close();
      done();
    });
  });

  it('is CommonJS compatible', () => {
    expect(typeof require('../lib')).to.equal('function');
  });

  describe('Initialization', () => {
    describe('when missing options', () => {
      it('throws an error', () => {
        expect(service.bind(null)).to.throw('MongoDB options have to be provided');
      });
    });

    describe('when missing a Model', () => {
      it('throws an error', () => {
        expect(service.bind(null, {})).to.throw('MongoDB collection `Model` needs to be provided');
      });
    });

    describe('when missing the id option', () => {
      it('sets the default to be _id', () => {
        expect(service({ Model: db }).id).to.equal('_id');
      });
    });

    describe('when missing the paginate option', () => {
      it('sets the default to be {}', () => {
        expect(service({ Model: db }).paginate).to.deep.equal({});
      });
    });
  });

  describe('Common functionality', () => {
    beforeEach(function (done) {
      db.collection('people').insert({
        name: 'Doug',
        age: 32
      }, function (error, data) {
        if (error) {
          return done(error);
        }

        _ids.Doug = data.insertedIds[0];
        done();
      });
    });

    afterEach(done => db.collection('people').remove({ _id: _ids.Doug }, () => done()));
  });

  describe('Service utility functions', () => {
    describe('objectifyId', () => {
      it('returns an ObjectID instance for a valid ID', () => {
        const id = new ObjectID();
        const result = service({ Model: db })._objectifyId(id.toString(), '_id');
        expect(result).to.be.instanceof(ObjectID);
        expect(result).to.deep.equal(id);
      });

      it('does not return an ObjectID instance for an invalid ID', () => {
        const id = 'non-valid object id';
        const result = service({ Model: db })._objectifyId(id.toString(), '_id');
        expect(result).to.not.be.instanceof(ObjectID);
        expect(result).to.deep.equal(id);
      });
    });

    describe('multiOptions', () => {
      const params = {
        query: {
          age: 21
        },
        options: {
          limit: 5
        }
      };

      it('returns valid result when passed an ID', () => {
        const id = new ObjectID();
        const result = service({ Model: db })._multiOptions(id, params);
        expect(result).to.be.an('object');
        expect(result).to.include.all.keys(['query', 'options']);
        expect(result.query).to.deep.equal(Object.assign({}, params.query, { _id: id }));
        expect(result.options).to.deep.equal(Object.assign({}, params.options, { multi: false }));
      });

      it('returns original object', () => {
        const result = service({ Model: db })._multiOptions(null, params);
        expect(result).to.be.an('object');
        expect(result).to.include.all.keys(['query', 'options']);
        expect(result.query).to.deep.equal(params.query);
        expect(result.options).to.deep.equal(Object.assign({}, params.options, { multi: true }));
      });
    });

    describe('getSelect', () => {
      const mongoFields = { name: 1, age: 1 };

      it('returns Mongo fields object when an array is passed', () => {
        const fields = ['name', 'age'];
        const result = service({ Model: db })._getSelect(fields);
        expect(result).to.be.an('object');
        expect(result).to.deep.equal(mongoFields);
      });

      it('returns original object', () => {
        const fields = mongoFields;
        const result = service({ Model: db })._getSelect(fields);
        expect(result).to.be.an('object');
        expect(result).to.deep.equal(mongoFields);
      });
    });
  });
});
