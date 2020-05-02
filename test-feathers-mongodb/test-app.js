import express from '@feathersjs/express';
import feathers from '@feathersjs/feathers';
import { MongoClient } from 'mongodb';

import service from '../lib';

const app = express(feathers())
  .use(express.json())
  .use(express.urlencoded({ extended: true }))
  .configure(express.rest());

export default new Promise(function (resolve) {
  // Connect to your MongoDB instance(s)
  MongoClient.connect('mongodb://localhost:27017', { useUnifiedTopology: true })
  .then(client => client.db('feathers-mongodb-revisions-test'))
  .then(db => {
    app.use('/todos', service({
      Model: db.collection('todos'),
      paginate: {
        default: 2,
        max: 4
      }
    }))
    // A basic error handler
    app.use(express.errorHandler());
    // Start the server
    var server = app.listen(3030);
    server.on('listening', function () {
      console.log('Feathers Message MongoDB service running on 127.0.0.1:3030');
      resolve(server);
    });
  });
});
