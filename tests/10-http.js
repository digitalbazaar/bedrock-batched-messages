/*
 * Copyright (c) 2015-2016 Digital Bazaar, Inc. All rights reserved.
 */
 /* globals describe, before, after, it, should, beforeEach, afterEach */
 /* jshint node: true */

'use strict';

var _ = require('lodash');
var async = require('async');
var bedrock = require('bedrock');
var brKey = require('bedrock-key');
var brMessages = require('../lib/messages');
var config = bedrock.config;
var util = bedrock.util;
var helpers = require('./helpers');
var brIdentity = require('bedrock-identity');
var database = require('bedrock-mongodb');
var request = require('request');
var mockData = require('./mock.data');
var uuid = require('uuid').v4;
request = request.defaults({json: true});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

var store = database.collections.messages;

var messagesSearchEndpoint =
  config.server.baseUri + config.messages.endpoints.messagesSearch;

describe('bedrock-messages HTTP API', function() {
  describe('unauthenticated requests', function() {
    it('should respond with 400 - PermissionDenied', function(done) {
      var user = mockData.identities.rsa4096;
      request.post({
        url: messagesSearchEndpoint + '/' + user.identity.id + '/new'
      }, function(err, res, body) {
        should.not.exist(err);
        res.statusCode.should.equal(400);
        should.exist(body);
        body.should.be.an('object');
        body.type.should.be.a('string');
        body.type.should.equal('PermissionDenied');
        done();
      });
    });
  });

  describe('authenticated requests', function() {
    before('Prepare the database', function(done) {
      helpers.prepareDatabase(mockData, done);
    });
    after('Remove test data', function(done) {
      helpers.removeCollections(done);
    });

    it('return empty array if there are no new messages', function(done) {
      var user = mockData.identities.rsa4096;
      request.post(
        helpers.createHttpSignatureRequest(
          messagesSearchEndpoint + '/' + user.identity.id + '/new', user),
        function(err, res, body) {
        should.not.exist(err);
        res.statusCode.should.equal(200);
        should.exist(body);
        body.should.be.an('array');
        body.should.have.length(0);
        done();
      });
    });
    it('return one new message', function(done) {
      var user = mockData.identities.rsa4096;
      async.auto({
        insert: function(callback) {
          brMessages.store(
            helpers.createMessage({recipient: user.identity.id}), callback);
        },
        process: ['insert', function(callback) {
          brMessages._batchMessages(callback);
        }],
        get: ['process', function(callback) {
          request.post(
            helpers.createHttpSignatureRequest(
              messagesSearchEndpoint + '/' + user.identity.id + '/new', user),
            function(err, res, body) {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            should.exist(body);
            body.should.be.an('array');
            body.should.have.length(1);
            done();
          });
        }]
      }, done);
    });
    it('return seven new messages', function(done) {
      var user = mockData.identities.rsa4096;
      var numberOfMessages = 7;
      async.auto({
        insert: function(callback) {
          async.times(numberOfMessages, function(n, next) {
            brMessages.store(
              helpers.createMessage({recipient: user.identity.id}), next);
          }, function(err) {
            callback();
          });
        },
        process: ['insert', function(callback) {
          brMessages._batchMessages(callback);
        }],
        get: ['process', function(callback) {
          request.post(
            helpers.createHttpSignatureRequest(
              messagesSearchEndpoint + '/' + user.identity.id + '/new', user),
            function(err, res, body) {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            should.exist(body);
            body.should.be.an('array');
            body.should.have.length(numberOfMessages);
            done();
          });
        }]
      }, done);
    });
    it('does not allow access to another user\'s messages',
      function(done) {
      var user = mockData.identities.rsa4096;
      var badUserId = 'did:' + uuid();
      request.post(
        helpers.createHttpSignatureRequest(
          messagesSearchEndpoint + '/' + badUserId + '/new', user),
        function(err, res, body) {
          should.not.exist(err);
          res.statusCode.should.equal(403);
          should.exist(body);
          body.should.be.an('object');
          should.exist(body.type);
          body.type.should.be.a('string');
          body.type.should.equal('PermissionDenied');
          should.exist(body.details.sysPermission);
          body.details.sysPermission.should.be.a('string');
          body.details.sysPermission.should.equal('MESSAGE_ACCESS');
          done();
        });
    });
  });
});
