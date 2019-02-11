// const ACLMatrix = require('./../acl/matrix')
// const field = require('./fields')

// const Schema = function () {
//   this.schema = {
//     name: {
//       required: true,
//       type: 'string'
//     },
//     version: {
//       required: true,
//       type: 'string'
//     },
//     database: {
//       required: true,
//       type: 'string'
//     },
//     fields: {
//       required: true,
//       type: 'object'
//     },
//     settings: {
//       required: true,
//       type: 'object'
//     }
//   }
// }

// /**
//  * Fires the callback defined in `this.saveCallback`, if any,
//  * returning the value of the input argument after it finishes
//  * executing. If the callback is not defined, a Promise resolved
//  * with the input argument is returned instead.
//  *
//  * @param  {Object} input
//  * @return {Promise}
//  */
// Schema.prototype.broadcastWrite = function (input) {
//   if (typeof this.saveCallback === 'function') {
//     return this.saveCallback().then(() => input)
//   }

//   return Promise.resolve(input)
// }

// /**
//  * Creates a Collection.
//  *
//  * @param  {Object} Collection
//  * @return {Promise<Object>}
//  */
// Schema.prototype.create = function (collection) {
//   return this.validate(collection).then(() => {
//     return this.model.find({
//       query: {
//         name: collection.name
//       }
//     })
//   }).then(({results}) => {
//     if (results.length > 0) {
//       return Promise.reject(
//         new Error('COLLECTION_EXISTS')
//       )
//     }

//     return field
//       .validateFields(collection.fields)
//       .then(() => {
//         return this.model.create({
//           documents: [collection],
//           rawOutput: true,
//           validate: false
//         })
//       })
//   }).then(result => {
//     return this.broadcastWrite(result)
//   })
// }

// /**
//  * Deletes a Collection.
//  *
//  * @param  {String} name
//  * @return {Promise<Object>}
//  */
// Schema.prototype.delete = function (name) {
//   // Before deleting a collection, we need to check for any
//   // collections that extend it and set their `extends` property
//   // to `null`.
//   return this.model.update({
//     query: {
//       extends: name
//     },
//     update: {
//       extends: null
//     },
//     validate: false
//   }).then(res => {
//     return this.model.delete({
//       query: {
//         name
//       }
//     })
//   }).then(result => {
//     return this.broadcastWrite(result)
//   })
// }

// /**
//  * Sanitises a Collection, preparing it for output.
//  *
//  * @param  {Object} Collection
//  * @return {Object}
//  */
// Schema.prototype.formatForOutput = function (collection) {
//   let sanitisedCollection = Object.keys(this.schema).reduce((output, key) => {
//     if (!this.schema[key].hidden) {
//       output[key] = collection[key] || this.schema[key].default

//       if (key === 'settings') {
//         output[key] = collection[key] || {}
//       }
//     }

//     return output
//   }, {})

//   return sanitisedCollection
// }

// /**
//  * Retrieves the Collection that matches `name` if it is
//  * supplied; otherwise, all Collections are returned.
//  *
//  * @param  {String|Array<String>} names
//  * @return {Promise<Object>}
//  */
// Schema.prototype.get = function (collection) {
//   let query = {}

//   if (collection) {
//     query = Object.assign({}, collection)
//   }

//   return this.model.find({
//     query
//   }).then(response => {
//     let formattedResults = response.results.map(result => {
//       return this.formatForOutput(result)
//     })

//     return Promise.all(formattedResults).then(results => {
//       return {
//         results: results
//       }
//     })
//   })
// }

// /**
//  * Adds a field to a collection.
//  *
//  * @param  {String} collection     The collection name
//  * @param  {String} resource The name of the resource
//  * @param  {Object} access   Access matrix
//  * @return {Promise<Object>}
//  */
// Schema.prototype.fieldAdd = function (collection, newField, access) {
//   return this.model.find({
//     options: {},
//     query: {
//       name: collection
//     }
//   }).then(({results}) => {
//     if (results.length === 0) {
//       return Promise.reject(
//         new Error('COLLECTION_NOT_FOUND')
//       )
//     }

//     // let resources = new ACLMatrix(
//     //   results[0].resources
//     // )

//     // let fields = {}

//     // if (fields.get(field)) {
//     //   return Promise.reject(
//     //     new Error('COLLECTION_HAS_FIELD')
//     //   )
//     // }
//     newField.collection = collection

//     return field.create(newField).then(x => {
//       return this.model.update({
//         query: {
//           name: collection
//         },
//         rawOutput: true,
//         update: {
//           // resources: resources.getAll({
//           //   getArrayNotation: true,
//           //   stringifyObjects: true
//           // })
//         },
//         validate: false
//       })
//     }).then(result => {
//       return this.broadcastWrite(result)
//     }).then(({results}) => {
//       let formattedResults = results.map(result => {
//         return this.formatForOutput(result)
//       })

//       return Promise.all(formattedResults).then(results => {
//         return {
//           results: results
//         }
//       })
//     })
//   })

//   // resources.validate(access)
//   // resources.set(resource, access)
// }

// Schema.prototype.setModel = function (model) {
//   this.model = model
// }

// /**
//  * Sets a callback to be fired after data has been modified, so that
//  * other components have the change to act on the new data.
//  *
//  * @param {Function} callback
//  */
// Schema.prototype.setWriteCallback = function (callback) {
//   this.saveCallback = callback
// }

// /**
//  * Updates a collection.
//  *
//  * @param  {Object} collection
//  * @param  {Object} update
//  * @return {Promise<Object>}
//  */
// Schema.prototype.update = function (collection, update) {
//   return this.model.find({
//     options: {
//       fields: {
//         _id: 0,
//         secret: 0
//       }
//     },
//     query: {
//       name: collection.name
//     }
//   }).then(({results}) => {
//     if (results.length > 0) {
//       return Promise.reject(
//         new Error('COLLECTION_EXISTS')
//       )
//     }

//     return this.validate(update, {
//       partial: true
//     })
//   }).then(() => {
//     return this.model.update({
//       query: {
//         name: collection
//       },
//       rawOutput: true,
//       update,
//       validate: false
//     })
//   }).then(result => {
//     return this.broadcastWrite(result)
//   })
// }

// /**
//  * Performs validation on a candidate collection. It returns a Promise
//  * that is rejected with an error object if validation fails, or
//  * resolved with `undefined` otherwise.
//  *
//  * @param  {String}   collection
//  * @param  {Boolean}  options.partial Whether this is a partial value
//  * @return {Promise}
//  */
// Schema.prototype.validate = function (collection, {partial = false} = {}) {
//   let missingFields = Object.keys(this.schema).filter(field => {
//     return this.schema[field].required && collection[field] === undefined
//   })

//   console.log('missing fields :', missingFields)

//   if (!partial && missingFields.length > 0) {
//     let error = new Error('MISSING_FIELDS')

//     error.data = missingFields

//     return Promise.reject(error)
//   }

//   let invalidFields = Object.keys(this.schema).filter(field => {
//     if (
//       collection[field] !== undefined &&
//       this.schema[field].allowedInInput === false
//     ) {
//       return true
//     }

//     return (
//       collection[field] !== undefined &&
//       collection[field] !== null &&
//       typeof collection[field] !== this.schema[field].type
//     )
//   })

//   console.log('invalidFields :', invalidFields);

//   Object.keys(collection).forEach(field => {
//     if (!this.schema[field]) {
//       invalidFields.push(field)
//     }
//   })

//   if (invalidFields.length > 0) {
//     let error = new Error('INVALID_FIELDS')

//     error.data = invalidFields

//     return Promise.reject(error)
//   }

//   if (collection.extends) {
//     return this.model.find({
//       options: {
//         fields: {
//           _id: 1
//         }
//       },
//       query: {
//         name: collection.extends
//       }
//     }).then(({results}) => {
//       if (results.length === 0) {
//         return Promise.reject(
//           new Error('INVALID_PARENT_collection')
//         )
//       }
//     })
//   }

//   return Promise.resolve()
// }

// module.exports = new Schema()
