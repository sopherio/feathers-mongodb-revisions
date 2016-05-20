'use strict'

import errorHandler from 'feathers-mongodb/lib/error-handler'
import errors from 'feathers-errors'
import adapter from 'feathers-mongodb'

class Service extends adapter.Service {
  // Duplicates super._get, but omits previous revisions for performance.
  _get (id) {
    id = this._objectifyId(id)

    return this.Model.findOne({ [this.id]: id }, { '_revision.previous': 0 })
      .then(data => {
        if (!data) {
          throw new errors.NotFound(`No record found for id '${id}'`)
        }

        return data
      })
      .catch(errorHandler)
  }

  create (data) {
    // Add revision metadata.
    data._revision = {
      id: 1,
      createdAt: data.updatedAt || new Date()
    }

    return super.create(data)
  }

  patch (id, data, params) {
    return super.patch(id, data, params)
  }

  update (id, data, params) {
    // Duplicate the validation check from super.update for safety.
    if (Array.isArray(data) || id === null) {
      return Promise.reject('Not replacing multiple records. Did you mean `patch`?')
    }

    return this.Model
      .findOne({ [this.id]: id }, { '_revision.previous': 0 })
      .then(current => {
        if (!current) {
          throw new errors.NotFound(`No record found for ID '${id}'`)
        }

        // Require passing in the current revision ID, to guard against race conditions.
        if (!data._revision.id) {
          throw new errors.NotAcceptable('The current revision ID must be provided as \'_revision.id\'')
        }

        // Validate the current revision ID, to guard against race conditions.
        // Convert to strings in case the data type is different.
        if (data._revision.id.toString() !== current._revision.id.toString()) {
          return Promise.reject(`Record '${id}' has already been updated. Try again.`)
        }

        // Disallow explicitly updating revision metadata.
        delete data._revision

        // Update revision metadata.
        // Use dot notation here so it doesn't overwrite the `_revision.previous` field.
        data['_revision.id'] = current._revision.id + 1
        data['_revision.createdAt'] = data.updatedAt || new Date()

        // Ensure the previous stack isn't accidentally overridden.
        delete data['_revision.previous']

        return this.Model
          .update({
            // Filter against the resource ID.
            [this.id]: id,
            // Filter against the current revision ID.
            // Prevents updating data that another user has already updated.
            '_revision.id': current._revision.id
          }, {
            // Set the resource data to the updated values.
            $set: data,
            // Push the current revision onto the stack.
            $push: { '_revision.previous': current }
          })
          .then(response => {
            // Alert to race conditions between the `find` and `update` calls.
            if (response.result.nModified !== 1) {
              return Promise.reject(`Record '${id}' has already been updated. Try again.`)
            }
          })
          // Return the updated resource.
          .then(() => this._findOrGet(id))
      })
      .catch(errorHandler)
  }

  remove (id, params) {
    return super.remove(id, params)
  }
}

export default function init (options) {
  return new Service(options)
}

init.Service = Service
