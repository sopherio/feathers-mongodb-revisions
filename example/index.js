import feathers from 'feathers'
import rest from 'feathers-rest'
import socketio from 'feathers-socketio'
import errorHandler from 'feathers-errors/handler'
import bodyParser from 'body-parser'
import { MongoClient } from 'mongodb'
import revisionsAdapter from '../lib'

// Create a Feathers application.
const app = feathers()
  .configure(socketio())
  .configure(rest())
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true }))

export default new Promise(function (resolve, reject) {
  // Connect to the MongoDB instance.
  MongoClient.connect('mongodb://localhost:27017/feathers-mongodb-revisions')
    .then(db => {
      // Create a Feathers service.
      app.use('/messages', revisionsAdapter({
        Model: db.collection('messages'),
        paginate: {
          default: 2,
          max: 4
        }
      }))

      // A basic error handler.
      app.use(errorHandler())

      // Start the server.
      const server = app.listen(3030)

      server.on('listening', () => {
        console.log('Feathers Message MongoDB service running on 127.0.0.1:3030')
        resolve(server)
      })
    })
    .catch(error => {
      console.error(error)
    })
})
