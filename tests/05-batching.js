/*
 * Copyright (c) 2015-2016 Digital Bazaar, Inc. All rights reserved.
 */
 /* globals describe, before, after, it, should, beforeEach, afterEach */
 /* jshint node: true */

'use strict';

var _ = require('lodash');
var async = require('async');
var bedrock = require('bedrock');
var brIdentity = require('bedrock-identity');
var brMessages = require('../lib/messages');
var config = bedrock.config;
var database = require('bedrock-mongodb');
var helpers = require('./helpers');
var mockData = require('./mock.data');
var stateData = require('./state.data');
var util = bedrock.util;
var uuid = require('uuid').v4;

var store = database.collections.messages;
var storeBatch = database.collections.messagesBatch;

describe('bedrock-messages message batching functions', function() {
  before(function(done) {
    helpers.prepareDatabase(mockData, done);
  });
  after(function(done) {
    helpers.removeCollections(done);
  });

  describe('batchMessage state generation', function() {
    afterEach(function(done) {
      helpers.removeCollections(
        {collections: ['messagesBatch', 'messages']}, done);
    });
    _.forEach(stateData.batchMessageStateData, function(batchMessageStateData) {
      var msgData = batchMessageStateData.msgData;
      var batchData = batchMessageStateData.batchData;
      var expectedResult = batchMessageStateData.result;
      var expectedResultStr = 'result should have msg state: ';
      expectedResultStr += expectedResult.msgState;
      expectedResultStr += ', batch dirty: ' + expectedResult.dirty;
      var inputStr = 'input: msg state: ' + msgData.state;
      inputStr += ', batch dirty: ' + batchData.dirty;
      it(expectedResultStr + ' -- ' + inputStr,
        function(done) {
        var message = util.clone(mockData.messages.alpha);
        var batch = util.clone(mockData.batches.alpha);

        batch.value.dirty = batchData.dirty;
        message.value.meta.batch.state = msgData.state;
        if(batch.value.dirty) {
          batch.value.messages[message.value.id] = true;
        }
        async.auto({
          insertMessage: function(callback) {
            store.insert(message, callback);
          },
          insertBatch: function(callback) {
            storeBatch.insert(batch, callback);
          },
          act: ['insertMessage', 'insertBatch', function(callback) {
            brMessages._batchMessage(batch.value, message.value, callback);
          }],
          messageQuery: ['act', function(callback) {
            store.findOne({}, callback);
          }],
          batchQuery: ['act', function(callback) {
            storeBatch.findOne({}, callback);
          }],
          test: ['messageQuery', 'batchQuery', function(callback, results) {
            var m = results.messageQuery.value;
            m.meta.batch.id.should.equal(0);
            m.meta.batch.state.should.equal(expectedResult.msgState);
            var b = results.batchQuery.value;
            b.id.should.equal(0);
            b.recipient.should.equal(message.value.recipient);
            should.exist(b.messages);
            b.messages.should.be.an('object');
            if(expectedResult.dirty) {
              should.exist(b.messages[message.value.id]);
            } else {
              _.isEmpty(b.messages).should.be.true;
            }
            callback();
          }]
        }, done);
      });
    });
  }); // end batchMessage state generation

  describe('batchMessage function', function() {
    afterEach(function(done) {
      helpers.removeCollections(
        {collections: ['messagesBatch', 'messages']}, done);
    });
    it('batches a msg when msg state is pending and msg is not in map',
      function(done) {
      // state in the mock message is 'pending'
      var testMessage = util.clone(mockData.messages.alpha);
      var testBatch = util.clone(mockData.batches.alpha);
      async.auto({
        insertMessage: function(callback) {
          store.insert(testMessage, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(testBatch, callback);
        },
        act: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._batchMessage(
            testBatch.value, testMessage.value, callback);
        }],
        messageQuery: ['act', function(callback) {
          store.findOne({}, callback);
        }],
        batchQuery: ['act', function(callback) {
          storeBatch.findOne({}, callback);
        }],
        test: ['messageQuery', 'batchQuery', function(callback, results) {
          var message = results.messageQuery.value;
          message.meta.batch.id.should.equal(0);
          message.meta.batch.state.should.equal('ready');
          var batch = results.batchQuery.value;
          batch.id.should.equal(0);
          batch.recipient.should.equal(message.recipient);
          should.exist(batch.messages);
          batch.messages.should.be.an('object');
          _.isEmpty(batch.messages).should.be.true;
          callback();
        }]
      }, done);
    });
    it('batches a msg when state is pending and msg is in join map',
      function(done) {
      var message = util.clone(mockData.messages.alpha);
      var batch = util.clone(mockData.batches.alpha);
      batch.value.dirty = true;
      batch.value.messages[message.value.id] = true;
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        act: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._batchMessage(batch.value, message.value, callback);
        }],
        messageQuery: ['act', function(callback) {
          store.findOne({}, callback);
        }],
        batchQuery: ['act', function(callback) {
          storeBatch.findOne({}, callback);
        }],
        test: ['messageQuery', 'batchQuery', function(callback, results) {
          var m = results.messageQuery.value;
          m.meta.batch.id.should.equal(0);
          m.meta.batch.state.should.equal('ready');
          var b = results.batchQuery.value;
          b.id.should.equal(0);
          b.recipient.should.equal(message.value.recipient);
          should.exist(b.messages);
          b.messages.should.be.an('object');
          _.isEmpty(b.messages).should.be.true;
          callback();
        }]
      }, done);
    });
    it('does nothing when msg state is ready and msg is in join map',
      function(done) {
      var message = util.clone(mockData.messages.alpha);
      var batch = util.clone(mockData.batches.alpha);
      batch.value.dirty = true;
      batch.value.messages[message.value.id] = true;
      message.value.meta.batch.state = 'ready';
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        act: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._batchMessage(batch.value, message.value, callback);
        }],
        messageQuery: ['act', function(callback) {
          store.findOne({}, callback);
        }],
        batchQuery: ['act', function(callback) {
          storeBatch.findOne({}, callback);
        }],
        test: ['messageQuery', 'batchQuery', function(callback, results) {
          var m = results.messageQuery.value;
          m.meta.batch.id.should.equal(0);
          m.meta.batch.state.should.equal('ready');
          var b = results.batchQuery.value;
          b.id.should.equal(0);
          b.recipient.should.equal(message.value.recipient);
          should.exist(b.messages);
          b.messages.should.be.an('object');
          should.exist(b.messages[message.value.id]);
          callback();
        }]
      }, done);
    });
    it('does nothing when msg state is ready and msg is not in join map',
      function(done) {
      var message = util.clone(mockData.messages.alpha);
      var batch = util.clone(mockData.batches.alpha);
      batch.value.dirty = false;
      message.value.meta.batch.state = 'ready';
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        act: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._batchMessage(batch.value, message.value, callback);
        }],
        messageQuery: ['act', function(callback) {
          store.findOne({}, callback);
        }],
        batchQuery: ['act', function(callback) {
          storeBatch.findOne({}, callback);
        }],
        test: ['messageQuery', 'batchQuery', function(callback, results) {
          var m = results.messageQuery.value;
          m.meta.batch.id.should.equal(0);
          m.meta.batch.state.should.equal('ready');
          var b = results.batchQuery.value;
          b.id.should.equal(0);
          b.recipient.should.equal(message.value.recipient);
          should.exist(b.messages);
          b.messages.should.be.an('object');
          should.exist(b.messages[message.value.id]);
          callback();
        }]
      }, done);
    });
    it('does nothing when batch is "delivered" first by another process',
      function(done) {
      var message = util.clone(mockData.messages.alpha);
      var batch = util.clone(mockData.batches.alpha);
      batch.value.dirty = true;
      batch.value.messages[message.value.id] = true;
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        otherProcessUpdate: ['insertMessage', 'insertBatch',
          function(callback) {
          // Other process increments batch ID
          var q = {id: database.hash(batch.value.recipient)};
          var u = {$inc: {'value.id': 1}};
          storeBatch.update(q, u, callback);
        }],
        act: ['otherProcessUpdate', function(callback) {
          brMessages._batchMessage(batch.value, message.value, callback);
        }],
        messageQuery: ['act', function(callback) {
          store.findOne({}, callback);
        }],
        batchQuery: ['act', function(callback) {
          storeBatch.findOne({}, callback);
        }],
        test: ['messageQuery', 'batchQuery', function(callback, results) {
          var m = results.messageQuery.value;
          m.meta.batch.id.should.equal(message.value.meta.batch.id);
          m.meta.batch.state.should.equal(message.value.meta.batch.state);
          var b = results.batchQuery.value;
          b.id.should.equal(batch.value.id + 1);
          b.recipient.should.equal(message.value.recipient);
          should.exist(b.messages);
          b.messages.should.be.an('object');
          should.exist(b.messages[message.value.id]);
          callback();
        }]
      }, done);
    });
    // message goes to "ready" state and message stays in join list if
    // batch increments mid-function
    it('message is "ready" state and message stays in join list',
      function(done) {
      var message = util.clone(mockData.messages.alpha);
      var batch = util.clone(mockData.batches.alpha);
      batch.value.dirty = true;
      batch.value.messages[message.value.id] = true;
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        updateBatch: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._batchMessageUpdateBatch(
            batch.value, message.value, null, callback);
        }],
        updateMessage: ['updateBatch', function(callback, results) {
          brMessages._batchMessageUpdateMessage(
            batch.value, message.value, null,
            {'updateBatch': results.updateBatch}, callback);
        }],
        otherProcessUpdate: ['updateMessage', function(callback) {
          var q = {id: database.hash(batch.value.recipient)};
          var u = {$inc: {'value.id': 1}};
          storeBatch.update(q, u, callback);
        }],
        removeFromMap: ['otherProcessUpdate', function(callback, results) {
          brMessages._batchMessageRemoveFromMap(
            batch.value, message.value, null,
            {'updateMessage': results.updateMessage}, callback);
        }],
        messageQuery: ['removeFromMap', function(callback) {
          store.findOne({}, callback);
        }],
        batchQuery: ['removeFromMap', function(callback) {
          storeBatch.findOne({}, callback);
        }],
        test: ['messageQuery', 'batchQuery', function(callback, results) {
          var m = results.messageQuery.value;
          m.meta.batch.id.should.equal(message.value.meta.batch.id);
          m.meta.batch.state.should.equal('ready');
          var b = results.batchQuery.value;
          b.id.should.equal(batch.value.id + 1);
          b.recipient.should.equal(message.value.recipient);
          b.dirty.should.equal(true);
          should.exist(b.messages);
          b.messages.should.be.an('object');
          should.exist(b.messages[message.value.id]);
          callback();
        }]
      }, done);
    });
  }); // end batchMessage

  describe('getUnbatchedMessage state generation', function() {
    afterEach(function(done) {
      helpers.removeCollections(
        {collections: ['messagesBatch', 'messages']}, done);
    });
    _.forEach(stateData.getUnbatchedMessageStateData, function(data) {
      var msgData = data.msgData;
      var batchData = data.batchData;
      var expectedResult = data.result;

      var expectedResultStr = '';
      if(expectedResult === null) {
        expectedResultStr = 'Result should be null';
      } else {
        expectedResultStr =
          'Resulting message should have "pending" state and id = ';
        expectedResultStr += batchData.id;
      }

      var inputStr = 'input: msg state: ' + msgData.state;
      inputStr += ', batch dirty: ' + batchData.dirty;
      inputStr += ', batch id: ' + batchData.id;
      it(expectedResultStr + ' -- ' + inputStr,
        function(done) {
        var batch = util.clone(mockData.batches.alpha);
        var message = util.clone(mockData.messages.alpha);

        batch.value.id = batchData.id;
        batch.value.dirty = batchData.dirty;
        if(batch.value.dirty) {
          batch.value.messages[message.value.id] = true;
        }
        message.value.meta.batch.state = msgData.state;

        async.auto({
          insertMessage: function(callback) {
            store.insert(message, callback);
          },
          insertBatch: function(callback) {
            storeBatch.insert(batch, callback);
          },
          getUnbatched: ['insertMessage', 'insertBatch', function(callback) {
            brMessages._getUnbatchedMessage(null, callback);
          }],
          batchQuery: ['getUnbatched', function(callback) {
            storeBatch.findOne({}, callback);
          }],
          messageQuery: ['getUnbatched', function(callback) {
            store.findOne({}, callback);
          }],
          test: ['batchQuery', 'messageQuery', function(callback, results) {
            if(expectedResult === null) {
              should.not.exist(results.getUnbatched);
              results.batchQuery.value.id.should.equal(batch.value.id);
              results.messageQuery.value.meta.batch.id.should.equal(
                batch.value.id);
            } else {
              should.exist(results.messageQuery);
              should.exist(results.batchQuery);

              results.batchQuery.value.id.should.equal(
                results.messageQuery.value.meta.batch.id);
              results.messageQuery.value.meta.batch.state.should.equal(
                'pending');
            }

            callback();
          }]
        }, done);
      });
    });
  }); // End getUnbatchedMessage state generation

  describe('getUnbatchedMessage function', function() {
    afterEach(function(done) {
      helpers.removeCollections(
        {collections: ['messagesBatch', 'messages']}, done);
    });
    it('returns a dirty batch', function(done) {
      var batch = util.clone(mockData.batches.alpha);
      var message = util.clone(mockData.messages.alpha);
      batch.value.dirty = true;
      batch.value.messages[message.value.id] = true;
      message.value.meta.batch.state = 'ready';
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        getUnbatched: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._getUnbatchedMessage(null, callback);
        }],
        test: ['getUnbatched', function(callback, results) {
          should.exist(results.getUnbatched);
          results.getUnbatched.should.be.an('object');
          should.exist(results.getUnbatched.batch);
          results.getUnbatched.batch.should.be.an('object');
          results.getUnbatched.batch.should.deep.equal(batch.value);
          should.exist(results.getUnbatched.message);
          results.getUnbatched.message.should.be.an('object');
          results.getUnbatched.message.should.deep.equal(message.value);
          callback();
        }]
      }, done);
    });

    //FIXME: getUnbatchedMessage and resetMessage are returning the orginally passed in message, rather than the updated one.
    //This implemention is unexpected, and should be changed.
    it('returns a pending message', function(done) {
      var batch = util.clone(mockData.batches.alpha);
      var message = util.clone(mockData.messages.alpha);
      message.value.meta.batch.state = 'pending';
      batch.value.id = 1;
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        getUnbatched: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._getUnbatchedMessage(null, callback);
        }],
        test: ['getUnbatched', function(callback, results) {
          should.exist(results.getUnbatched);
          results.getUnbatched.should.be.an('object');
          should.exist(results.getUnbatched.batch);
          results.getUnbatched.batch.should.be.an('object');
          results.getUnbatched.batch.should.deep.equal(batch.value);
          should.exist(results.getUnbatched.message);
          results.getUnbatched.message.should.be.an('object');
          results.getUnbatched.message.should.deep.equal(message.value);
          callback();
        }]
      }, done);
    });
    it('returns a pending messagage again', function(done) {
      var batch = util.clone(mockData.batches.alpha);
      var message = util.clone(mockData.messages.alpha);
      message.value.meta.batch.state = 'pending';
      batch.value.id = 0;
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        getUnbatched: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._getUnbatchedMessage(null, callback);
        }],
        test: ['getUnbatched', function(callback, results) {
          should.exist(results.getUnbatched);
          results.getUnbatched.should.be.an('object');
          should.exist(results.getUnbatched.batch);
          results.getUnbatched.batch.should.be.an('object');
          results.getUnbatched.batch.should.deep.equal(batch.value);
          should.exist(results.getUnbatched.message);
          results.getUnbatched.message.should.be.an('object');
          results.getUnbatched.message.should.deep.equal(message.value);
          callback();
        }]
      }, done);
    });
    it('returns null if no dirty batch or pending messages', function(done) {
      var batch = util.clone(mockData.batches.alpha);
      var message = util.clone(mockData.messages.alpha);
      message.value.meta.batch.state = 'ready';
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        getUnbatched: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._getUnbatchedMessage(null, callback);
        }],
        test: ['getUnbatched', function(callback, results) {
          should.not.exist(results.getUnbatched);
          callback();
        }]
      }, done);
    });
    it('creates a batch on pending messages but no batch for recipient',
      function(done) {
      var message = util.clone(mockData.messages.alpha);
      message.value.meta.batch.state = 'pending';
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        getUnbatched: ['insertMessage', function(callback) {
          brMessages._getUnbatchedMessage(null, callback);
        }],
        batchQuery: ['getUnbatched', function(callback) {
          storeBatch.findOne({}, callback);
        }],
        test: ['batchQuery', function(callback, results) {
          should.exist(results.getUnbatched);
          should.exist(results.batchQuery);
          //var b = results.batchQuery.value;
          //b.id.should.equal(0);
          //b.recipient.should.equal(message.value.recipient);
          //should.exist(b.messages);
          //b.messages.should.be.an('object');
          //should.exist(b.messages[message.value.id]);

          callback();
        }]
      }, done);
    });
    it('returns a reset message', function(done) {
      // Message not in join map, message.meta.batch.id < batch.id
      var batch = util.clone(mockData.batches.alpha);
      var message = util.clone(mockData.messages.alpha);
      message.value.meta.batch.state = 'pending';
      message.value.meta.batch.id = 0;
      batch.value.id = 1;
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        getUnbatched: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._getUnbatchedMessage(batch.value, callback);
        }],
        getMessage: ['getUnbatched', function(callback) {
          store.findOne({}, callback);
        }],
        test: ['getMessage', function(callback, results) {
          should.exist(results.getUnbatched);
          results.getUnbatched.should.be.an('object');
          should.exist(results.getUnbatched.batch);
          results.getUnbatched.batch.should.be.an('object');
          results.getUnbatched.batch.should.deep.equal(batch.value);
          should.exist(results.getMessage.value);
          results.getMessage.value.should.be.an('object');
          results.getMessage.value.meta.batch.id.should.equal(1);
          callback();
        }]
      }, done);
    });
    it('also returns a reset message', function(done) {
      // Message in join map, message.meta.batch.id < batch.id
      var batch = util.clone(mockData.batches.alpha);
      var message = util.clone(mockData.messages.alpha);
      message.value.meta.batch.state = 'pending';
      message.value.meta.batch.id = 0;
      batch.value.id = 1;
      batch.value.messages = [message.value.id];
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        getUnbatched: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._getUnbatchedMessage(batch.value, callback);
        }],
        getMessage: ['getUnbatched', function(callback) {
          store.findOne({}, callback);
        }],
        test: ['getMessage', function(callback, results) {
          should.exist(results.getUnbatched);
          results.getUnbatched.should.be.an('object');
          should.exist(results.getUnbatched.batch);
          results.getUnbatched.batch.should.be.an('object');
          results.getUnbatched.batch.should.deep.equal(batch.value);
          should.exist(results.getMessage.value);
          results.getMessage.value.should.be.an('object');
          results.getMessage.value.meta.batch.id.should.equal(1);
          callback();
        }]
      }, done);
    });
    it('returns a reset batch', function(done) {
      // Message pending, message.meta.batch.id == batch.id
      var batch = util.clone(mockData.batches.alpha);
      var message = util.clone(mockData.messages.alpha);
      message.value.meta.batch.state = 'pending';
      message.value.meta.batch.id = 1;
      batch.value.id = 1;
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        getUnbatched: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._getUnbatchedMessage(batch.value, callback);
        }],
        getBatch: ['getUnbatched', function(callback) {
          storeBatch.findOne({}, callback);
        }],
        test: ['getBatch', function(callback, results) {
          should.exist(results.getBatch.value);
          results.getBatch.value.should.be.an('object');
          results.getBatch.value.dirty.should.equal(false);
          callback();
        }]
      }, done);
    });
  }); // end getUnbatchedMessage

  describe('deliverBatch state generation', function() {
    afterEach(function(done) {
      helpers.removeCollections(
        {collections: ['messagesBatch', 'messages']}, done);
    });
    _.forEach(stateData.deliverBatchStateData, function(data) {
      var msgData = data.msgData;
      var batchData = data.batchData;
      var expectedResult = data.result;

      var expectedResultStr = 'Message state should be pending and batch id = ';
      expectedResultStr += expectedResult.id;

      var inputStr = 'input: msg state: ' + msgData.state;
      inputStr += ', msg id: ' + msgData.id;
      inputStr += ', batch dirty: ' + batchData.dirty;
      inputStr += ', batch id: ' + batchData.id;
      it(expectedResultStr + ' -- ' + inputStr,
        function(done) {
        var batch = util.clone(mockData.batches.alpha);
        var message = util.clone(mockData.messages.alpha);

        batch.value.id = batchData.id;
        batch.value.dirty = batchData.dirty;
        if(batch.value.dirty) {
          batch.value.messages[message.value.id] = true;
        }
        message.value.meta.batch.state = msgData.state;
        message.value.meta.batch.id = msgData.id;

        async.auto({
          insertMessage: function(callback) {
            store.insert(message, callback);
          },
          insertBatch: function(callback) {
            storeBatch.insert(batch, callback);
          },
          closeBatch: ['insertMessage', 'insertBatch', function(callback) {
            brMessages._closeBatch(batch.value.recipient, callback);
          }],
          readBatch: ['closeBatch', function(callback) {
            brMessages._readBatch(batch.value.recipient, callback);
          }],
          test: ['readBatch', function(callback, results) {
            should.exist(results.readBatch);
            results.readBatch.id.should.equal(expectedResult.id);
            if(expectedResult.length === 0) {
              should.not.exist(results.closeBatch);
            } else {
              should.exist(results.closeBatch.messages);
              results.closeBatch.messages.should.be.an('array');
              results.closeBatch.messages.should.have.length(
                expectedResult.length);
              delete message.value.meta;
              results.closeBatch.messages[0].value.should.deep.equal(
                message.value);
            }
            callback();
          }]
        }, done);
      });
    });
  }); // end deliverBatch state generation

  describe('deliverBatch function', function() {
    afterEach(function(done) {
      helpers.removeCollections(
        {collections: ['messagesBatch', 'messages']}, done);
    });
    it('return empty array if state is ready but message is in join map',
      function(done) {
      var batch = util.clone(mockData.batches.alpha);
      var message = util.clone(mockData.messages.alpha);
      batch.value.messages[message.value.id] = true;
      message.value.meta.batch.state = 'ready';
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        closeBatch: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._closeBatch(batch.value.recipient, callback);
        }],
        readBatch: ['closeBatch', function(callback) {
          brMessages._readBatch(batch.value.recipient, callback);
        }],
        test: ['readBatch', function(callback, results) {
          should.exist(results.readBatch);
          results.readBatch.id.should.equal(0);
          should.not.exist(results.closeBatch);
          callback();
        }]
      }, done);
    });
    it('return message if message is ready and not in the join map',
      function(done) {
      var batch = util.clone(mockData.batches.alpha);
      var message = util.clone(mockData.messages.alpha);
      message.value.meta.batch.state = 'ready';
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        closeBatch: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._closeBatch(batch.value.recipient, callback);
        }],
        readBatch: ['closeBatch', function(callback) {
          brMessages._readBatch(batch.value.recipient, callback);
        }],
        test: ['readBatch', function(callback, results) {
          should.exist(results.readBatch);
          results.readBatch.id.should.equal(1);
          should.exist(results.closeBatch);
          results.closeBatch.should.be.an('object');
          should.exist(results.closeBatch.id);
          results.closeBatch.id.should.equal(0);
          should.exist(results.closeBatch.messages);
          results.closeBatch.messages.should.be.an('array');
          results.closeBatch.messages.should.have.length(1);
          delete message.value.meta;
          results.closeBatch.messages[0].value.should.deep.equal(message.value);
          callback();
        }]
      }, done);
    });
    it('does not increments the batch if no message is returned',
      function(done) {
      var batch = util.clone(mockData.batches.alpha);
      async.auto({
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        closeBatch: ['insertBatch', function(callback) {
          brMessages._closeBatch(batch.value.recipient, callback);
        }],
        readBatch: ['closeBatch', function(callback) {
          brMessages._readBatch(batch.value.recipient, callback);
        }],
        test: ['readBatch', function(callback, results) {
          should.exist(results.readBatch);
          results.readBatch.id.should.equal(0);
          should.not.exist(results.closeBatch);
          callback();
        }]
      }, done);
    });
    // does not advance state illegally when another process updates message
    // batch id mid-function
    it('does not advance state when another process updates message batch id',
      function(done) {
      var batch = util.clone(mockData.batches.alpha);
      var message = util.clone(mockData.messages.alpha);
      message.value.meta.batch.state = 'ready';
      async.auto({
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        readBatch: ['insertMessage', 'insertBatch', function(callback) {
          brMessages
            ._closeBatchReadBatch(batch.value.recipient, null, callback);
        }],
        findMessage: ['readBatch', function(callback, results) {
          brMessages._closeBatchFindMessage(
            batch.value.recipient, null, results, callback);
        }],
        updateBatch: ['findMessage', function(callback, results) {
          brMessages._closeBatchUpdateBatch(
            batch.value.recipient, null, results, callback);
        }],
        otherProcessUpdate: ['updateBatch', function(callback) {
          var u = {$inc: {'value.meta.batch.id': 1}};
          store.update({}, u, callback);
        }],
        getMessages: ['otherProcessUpdate', function(callback, results) {
          brMessages._closeBatchGetMessages(
            batch.value.recipient, null, results, callback);
        }],
        messageQuery: ['getMessages', function(callback) {
          store.findOne({}, callback);
        }],
        batchQuery: ['getMessages', function(callback) {
          storeBatch.findOne({}, callback);
        }],
        test: ['messageQuery', 'batchQuery', function(callback, results) {
          // TODO test messages return -- messages should not be included
          // but that's ok because they'll be picked up on the next closeBatch
          var m = results.messageQuery.value;
          m.meta.batch.id.should.equal(message.value.meta.batch.id + 1);
          m.meta.batch.state.should.equal('ready');
          var b = results.batchQuery.value;
          b.id.should.equal(batch.value.id + 1);
          b.recipient.should.equal(message.value.recipient);
          should.exist(b.messages);
          b.messages.should.be.an('object');
          callback();
        }]
      }, done);
    });
    it('does not change state when message batch incremennts mid function',
      function(done) {
      var batch = util.clone(mockData.batches.alpha);
      var message = util.clone(mockData.messages.alpha);
      message.value.meta.batch.state = 'ready';
      async.auto({
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        readBatch: ['insertMessage', 'insertBatch', function(callback) {
          brMessages
            ._closeBatchReadBatch(batch.value.recipient, null, callback);
        }],
        otherProcessUpdate: ['readBatch', function(callback) {
          var u = {$inc: {'value.id': 1}};
          storeBatch.update({}, u, callback);
        }],
        findMessage: ['otherProcessUpdate', function(callback, results) {
          brMessages._closeBatchFindMessage(
            batch.value.recipient, null, results, callback);
        }],
        updateBatch: ['findMessage', function(callback, results) {
          brMessages._closeBatchUpdateBatch(
            batch.value.recipient, null, results, callback);
        }],
        getMessages: ['updateBatch', function(callback, results) {
          brMessages._closeBatchGetMessages(
            batch.value.recipient, function(err, results) {
            // Should return here, with null err and results.
            callback();
          }, callback, results);
        }],
        messageQuery: ['getMessages', function(callback) {
          store.findOne({}, callback);
        }],
        batchQuery: ['getMessages', function(callback) {
          storeBatch.findOne({}, callback);
        }],
        test: ['messageQuery', 'batchQuery', function(callback, results) {
          // No state should be updated other than the batch id write
          var m = results.messageQuery.value;
          m.meta.batch.id.should.equal(message.value.meta.batch.id);
          m.meta.batch.state.should.equal(message.value.meta.batch.state);
          var b = results.batchQuery.value;
          b.id.should.equal(batch.value.id + 1);
          b.recipient.should.equal(message.value.recipient);
          should.exist(b.messages);
          b.messages.should.be.an('object');
          callback();
        }]
      }, done);
    });
  }); // end deliverBatch

  describe('batchMessages function', function() {
    afterEach(function(done) {
      helpers.removeCollections(
        {collections: ['messagesBatch', 'messages']}, done);
    });
    it('batches where msg state is ready and msg is in join map',
      function(done) {
      var batch = util.clone(mockData.batches.alpha);
      var message = util.clone(mockData.messages.alpha);
      batch.value.messages[message.value.id] = true;
      batch.value.dirty = true;
      message.value.meta.batch.state = 'ready';
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        batchMessages: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._batchMessages(callback);
        }],
        readBatch: ['batchMessages', function(callback) {
          brMessages._readBatch(batch.value.recipient, callback);
        }],
        readMessage: ['batchMessages', function(callback) {
          store.find({}).toArray(callback);
        }],
        test: ['readBatch', 'readMessage', function(callback, results) {
          should.exist(results.readBatch);
          var b = results.readBatch;
          b.id.should.equal(0);
          _.isEmpty(b.messages).should.be.true;
          b.dirty.should.be.false;
          // message should be returned to 'ready' state
          var m = results.readMessage[0].value;
          m.should.deep.equal(message.value);
          callback();
        }]
      }, done);
    });
  }); // end batchMessages

  describe('resetMessage state generation', function() {
    afterEach(function(done) {
      helpers.removeCollections(
        {collections: ['messagesBatch', 'messages']}, done);
    });
    _.forEach(stateData.resetMessageStateData, function(data) {
      var msgData = data.msgData;
      var batchData = data.batchData;
      var expectedResult = data.result;

      var expectedResultStr = 'Message state should be pending and batch id = ';
      expectedResultStr += batchData.id;

      var inputStr = 'input: msg state: ' + msgData.state;
      inputStr += ', batch dirty: ' + batchData.dirty;
      inputStr += ', batch id: ' + batchData.id;
      it(expectedResultStr + ' -- ' + inputStr,
        function(done) {
        var batch = util.clone(mockData.batches.alpha);
        var message = util.clone(mockData.messages.alpha);

        batch.value.id = batchData.id;
        batch.value.dirty = batchData.dirty;
        if(batch.value.dirty) {
          batch.value.messages[message.value.id] = true;
        }
        message.value.meta.batch.state = msgData.state;

        async.auto({
          insertMessage: function(callback) {
            store.insert(message, callback);
          },
          insertBatch: function(callback) {
            storeBatch.insert(batch, callback);
          },
          getUnbatched: ['insertMessage', 'insertBatch', function(callback) {
            brMessages._resetMessage(batch.value, message.value, callback);
          }],
          batchQuery: ['getUnbatched', function(callback) {
            storeBatch.findOne({}, callback);
          }],
          messageQuery: ['getUnbatched', function(callback) {
            store.findOne({}, callback);
          }],
          test: ['batchQuery', 'messageQuery', function(callback, results) {
            should.exist(results.messageQuery);
            should.exist(results.batchQuery);
            results.batchQuery.value.id.should.equal(
              results.messageQuery.value.meta.batch.id);
            results.messageQuery.value.meta.batch.state.should.equal('pending');
            callback();
          }]
        }, done);
      });
    });
  }); // End resetMessage state generation

  describe('resetMessage function', function() {
    afterEach(function(done) {
      helpers.removeCollections(
        {collections: ['messagesBatch', 'messages']}, done);
    });
    it('resets a message back to pending with new batch id', function(done) {
      var batch = util.clone(mockData.batches.alpha);
      var message = util.clone(mockData.messages.alpha);
      message.value.meta.batch.state = 'ready';
      batch.value.id = 1;
      async.auto({
        insertMessage: function(callback) {
          store.insert(message, callback);
        },
        insertBatch: function(callback) {
          storeBatch.insert(batch, callback);
        },
        act: ['insertMessage', 'insertBatch', function(callback) {
          brMessages._resetMessage(batch.value, message.value, callback);
        }],
        testResults: ['act', function(callback, results) {
          should.exist(results.act);
          results.act.should.be.an('object');
          should.exist(results.act.message);
          results.act.message.should.deep.equal(message.value);
          should.exist(results.act.batch);
          results.act.batch.should.deep.equal(batch.value);
          callback();
        }],
        findMessage: ['act', function(callback) {
          store.find({id: message.id}).toArray(callback);
        }],
        testMessage: ['findMessage', function(callback, results) {
          results.findMessage[0].value.meta.batch.state.should.equal('pending');
          results.findMessage[0].value.meta.batch.id.should.equal(1);
          callback();
        }]
      }, done);
    });
  }); // end resetMessage

});
