import express from '@feathersjs/express';
import feathers from '@feathersjs/feathers';
import { MongoClient } from 'mongodb';

import revisionsAdapter from '../lib';

// Create a Feathers application.
const app = express(feathers())
  .use(express.json())
  .use(express.urlencoded({ extended: true }))
  .configure(express.rest());

export default new Promise(function (resolve, reject) {
  // Connect to the MongoDB instance.
  MongoClient.connect('mongodb://localhost:27017', { useUnifiedTopology: true })
    .then(client => client.db('feathers-mongodb-revisions'))
    .then(db => {
      // Create a Feathers service.
      app.use('/messages', revisionsAdapter({
        Model: db.collection('messages'),
        paginate: {
          default: 2,
          max: 4
        }
      }));

      // A basic error handler.
      app.use(express.errorHandler());

      // Start the server.
      const server = app.listen(3030);

      server.on('listening', () => {
        console.log('Feathers Message MongoDB service running on 127.0.0.1:3030');
        resolve(server);
      });
    })
    .catch(error => {
      console.error(error);
    });
});
