'use strict';
import errors from '@feathersjs/errors';
import adapter from 'feathers-mongodb';
import errorHandler from 'feathers-mongodb/lib/error-handler';
import merge from 'lodash/merge';

class Service extends adapter.Service {
  /**
   * Duplicates `super._find`, but omits historical revisions for performance.
   */
  _find (params, count, getFilter) {
    // Ensure query parameters have been specified.
    params.query = params.query || {};

    // Whether results will need post-processing to remove historical revisions.
    let removeHistoricalRevisionsManually = true;

    if (!params.query.$select) {
      // If no $select fields have been specified,
      // exclude historical revisions from the response.
      params.query.$select = { '_revision.history': 0 };
      // Since the historical revisions are omitted,
      // there is no need to manually remove them.
      removeHistoricalRevisionsManually = false;
    }

    return super._find(params, count, getFilter)
      .then(response => {
        // Mongo only allows for including or excluding fields, not both.
        // If `$select` fields have been requested, the only way to remove
        // the historical revisions is after the query has been executed.
        if (removeHistoricalRevisionsManually) {
          const data = params.paginate ? response.data : response;
          data.forEach(resource => {
            if (resource._revision && resource._revision.history) {
              delete resource._revision.history;
            }
          });
        }
        return response;
      })
      .catch(errorHandler);
  }

  /**
   * Duplicates `super._get`, but omits historical revisions for performance.
   *
   * This could be much simpler if `get`/`_get` supported field selection,
   * but that omission is likely intentional to simplify Feathers.
   */
  _get (id) {
    id = this._objectifyId(id);

    return this.Model.findOne({ [this.id]: id }, { '_revision.history': 0 })
      .then(data => {
        if (!data) {
          throw new errors.NotFound(`No record found for id '${id}'`);
        }

        return data;
      })
      .catch(errorHandler);
  }

  create (data) {
    // Add revision metadata.
    data._revision = {
      id: 1,
      createdAt: data.updatedAt || new Date()
    };

    return super.create(data);
  }

  _updateRevision (id, data, params, partialUpdate = false) {
    id = this._objectifyId(id);

    return this.Model
      .findOne({ [this.id]: id }, { '_revision.history': 0 })
      .then(current => {
        if (!current) {
          throw new errors.NotFound(`No record found for id '${id}'`);
        }
        // Require passing in the current revision ID, to guard against race conditions.
        if (!data._revision || (data._revision && !data._revision.id)) {
          throw new errors.NotAcceptable('The current revision ID must be provided as \'_revision.id\'');
        }

        // Validate the current revision ID, to guard against race conditions.
        // Convert to strings in case the data type is different.
        if (data._revision.id.toString() !== current._revision.id.toString()) {
          throw new errors.Forbidden(`Record '${id}' has been updated by another request. Try again.`);
        }

        // If this is a `patch` update, merge the updated values into the current resource.
        if (partialUpdate) {
          data = merge({}, current, data);
        }

        // Disallow explicitly updating revision metadata.
        if (data._revision) {
          delete data._revision;
        }

        // Update revision metadata.
        // Use dot notation here, otherwise Mongo will complain during the update.
        data['_revision.id'] = current._revision.id + 1;
        data['_revision.createdAt'] = data.updatedAt || new Date();

        // Ensure the historical revisions aren't accidentally overridden.
        if (data['_revision.history']) {
          delete data['_revision.history'];
        }

        // remove history from old revision
        delete current._revision.history;

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
            $push: { '_revision.history': current }
          })
          .then(response => {
            // Alert to race conditions between the `find` and `update` calls.
            if (response.result.nModified !== 1) {
              throw new errors.Forbidden(`Record '${id}' has been updated by another request. Try again.`);
            }
          })
          // Return the updated resource.
          .then(() => this._findOrGet(id));
      })
      .catch(errorHandler);
  }

  patch (id, data, params) {
    return this._updateRevision(id, data, params, true);
  }

  update (id, data, params) {
    // Duplicate the validation check from `super.update` for safety.
    if (Array.isArray(data) || id === null) {
      return Promise.reject(new Error('Not replacing multiple records. Did you mean `patch`?'));
    }

    return this._updateRevision(id, data, params, false);
  }
}

export default function init (options) {
  return new Service(options);
}

init.Service = Service;
