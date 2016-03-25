/*
 * Copyright (c) 2015-2016 Digital Bazaar, Inc. All rights reserved.
 */
 /* jshint node: true */

 'use strict';

var _ = require('lodash');
var async = require('async');
var brKey = require('bedrock-key');
var brIdentity = require('bedrock-identity');
var config = require('bedrock').config;
var uuid = require('node-uuid').v4;
var database = require('bedrock-mongodb');

var api = {};
module.exports = api;

api.createMessage = function(options) {
  // console.log('OPTIONS', options);
  var testMessage = {
    body: uuid(),
    date: new Date().toJSON(),
    holder: uuid(),
    link: uuid(),
    recipient: uuid(),
    sender: uuid(),
    subject: uuid(),
    type: uuid()
  };
  _.assign(testMessage, options);
  var message = {
    '@context': 'https://example.com/messages',
    date: testMessage.date,
    recipient: testMessage.recipient,
    sender: testMessage.sender,
    subject: testMessage.subject,
    type: testMessage.type,
    content: {
      body: testMessage.body,
      holder: testMessage.holder,
      link: testMessage.link
    }
  };
  return message;
};

api.createHttpSignatureRequest = function(url, identity) {
  var newRequest = {
    url: url,
    httpSignature: {
      key: identity.keys.privateKey.privateKeyPem,
      keyId: identity.keys.publicKey.id,
      headers: ['date', 'host', 'request-line']
    }
  };
  return newRequest;
};

api.createIdentity = function(userName) {
  var newIdentity = {
    id: 'did:' + uuid.v4(),
    type: 'Identity',
    sysSlug: userName,
    label: userName,
    email: userName + '@bedrock.dev',
    sysPassword: 'password',
    sysPublic: ['label', 'url', 'description'],
    sysResourceRole: [],
    url: config.server.baseUri,
    description: userName
  };
  return newIdentity;
};

api.createKeyPair = function(options) {
  var userName = options.userName;
  var publicKey = options.publicKey;
  var privateKey = options.privateKey;
  var ownerId = null;
  if(userName === 'userUnknown') {
    ownerId = '';
  } else {
    ownerId = options.userId;
  }
  var newKeyPair = {
    publicKey: {
      '@context': 'https://w3id.org/identity/v1',
      id: ownerId + '/keys/1',
      type: 'CryptographicKey',
      owner: ownerId,
      label: 'Signing Key 1',
      publicKeyPem: publicKey
    },
    privateKey: {
      type: 'CryptographicKey',
      owner: ownerId,
      label: 'Signing Key 1',
      publicKey: ownerId + '/keys/1',
      privateKeyPem: privateKey
    }
  };
  return newKeyPair;
};

api.prepareDatabase = function(mockData, callback) {
  async.series([
    function(callback) {
      api.removeCollections(callback);
    },
    function(callback) {
      insertTestData(mockData, callback);
    }
  ], callback);
};

api.removeCollections = function(options, callback) {
  if(typeof options === 'function') {
    callback = options;
  }
  var collectionNames = options.collections ||
    ['messages', 'invalidMessages', 'identity', 'publicKey', 'messagesBatch'];
  database.openCollections(collectionNames, function(err) {
    async.each(collectionNames, function(collectionName, callback) {
      database.collections[collectionName].remove({}, callback);
    }, function(err) {
      callback(err);
    });
  });
};

// Insert identities and public keys used for testing into database
function insertTestData(mockData, callback) {
  async.forEachOf(mockData.identities, function(identity, key, callback) {
    async.parallel([
      function(callback) {
        brIdentity.insert(null, identity.identity, callback);
      },
      function(callback) {
        brKey.addPublicKey(null, identity.keys.publicKey, callback);
      }
    ], callback);
  }, function(err) {
    if(err) {
      if(!database.isDuplicateError(err)) {
        // duplicate error means test data is already loaded
        return callback(err);
      }
    }
    callback();
  }, callback);
}
