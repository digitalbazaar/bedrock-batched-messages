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
var uuid = require('uuid').v4;

var store = database.collections.messages;
var storeInvalid = database.collections.invalidMessages;

var referenceMessage = {
  _id: '',
  id: '',
  '@context': '',
  date: '',
  meta: '',
  recipient: '',
  sender: '',
  subject: '',
  type: '',
  content: {
    body: '',
    holder: '',
    link: ''
  }
};

describe('bedrock-messages API requests', function() {
  before(function(done) {
    helpers.prepareDatabase(mockData, done);
  });
  after(function(done) {
    helpers.removeCollections(done);
  });
  describe('store function', function() {
    it('store a message into mongodb', function(done) {
      var recipient = uuid();
      var message = helpers.createMessage({recipient: recipient});
      var query = {
        recipient: database.hash(recipient)
      };
      async.auto({
        store: function(callback) {
          brMessages.store(message, callback);
        },
        query: ['store', function(callback) {
          store.find(query, {}).toArray(callback);
        }],
        test: ['query', function(callback, results) {
          should.exist(results.query);
          var r = results.query;
          r.should.be.an('array');
          r.should.have.length(1);
          r[0].should.be.an('object');
          should.exist(r[0].id);
          r[0].id.should.be.a('string');
          should.exist(r[0].value);
          r[0].value.should.be.an('object');
          var message = r[0].value;
          should.exist(message['@context']);
          message['@context'].should.be.a('string');
          should.exist(message.date);
          message.date.should.be.a('string');
          should.exist(message.recipient);
          message.recipient.should.be.a('string');
          should.exist(message.sender);
          message.sender.should.be.a('string');
          should.exist(message.subject);
          message.subject.should.be.a('string');
          should.exist(message.type);
          message.type.should.be.a('string');
          // check content
          should.exist(message.content);
          message.content.should.be.an('object');
          should.exist(message.content.body);
          message.content.body.should.be.a('string');
          should.exist(message.content.holder);
          message.content.holder.should.be.a('string');
          should.exist(message.content.link);
          message.content.link.should.be.a('string');
          // check meta
          should.exist(message.meta);
          message.meta.should.be.an('object');
          should.exist(message.meta.events);
          message.meta.events.should.be.an('array');
          message.meta.events.should.have.length(1);
          message.meta.events[0].should.be.an('object');
          // check meta events
          var event = message.meta.events[0];
          should.exist(event.type);
          event.type.should.be.a('string');
          event.type.should.equal('created');
          should.exist(event.date);
          event.date.should.be.a('number');
          callback();
        }]
      }, done);
    });
    it('store seven messages using single operations', function(done) {
      var recipient = uuid();
      var numberOfMessages = 7;
      var query = {
        recipient: database.hash(recipient)
      };
      async.auto({
        store: function(callback) {
          async.times(numberOfMessages, function(n, next) {
            brMessages.store(
              helpers.createMessage({recipient: recipient}), next);
          }, function(err) {
            callback();
          });
        },
        query: ['store', function(callback) {
          store.find(query, {}).toArray(callback);
        }],
        test: ['query', function(callback, results) {
          should.exist(results.query);
          var r = results.query;
          r.should.be.an('array');
          r.should.have.length(numberOfMessages);
          callback();
        }]
      }, done);
    });
    it('store seven valid messages as an array', function(done) {
      var recipient = uuid();
      var numberOfMessages = 7;
      var testMessages = [];
      for(var i = 0; i < numberOfMessages; i++) {
        testMessages.push(helpers.createMessage({recipient: recipient}));
      }
      var query = {
        recipient: database.hash(recipient)
      };
      async.auto({
        store: function(callback) {
          brMessages.store(testMessages, callback);
        },
        query: ['store', function(callback, results) {
          // check store results
          results.store.valid.count.should.equal(7);
          store.find(query, {}).toArray(callback);
        }],
        test: ['query', function(callback, results) {
          should.exist(results.query);
          var r = results.query;
          r.should.be.an('array');
          r.should.have.length(numberOfMessages);
          callback();
        }]
      }, done);
    });
    it('store seven valid messages as an array w/random recipients',
      function(done) {
      var numberOfMessages = 7;
      var testMessages = [];
      for(var i = 0; i < numberOfMessages; i++) {
        testMessages.push(helpers.createMessage());
      }
      // var query = {
      //   recipient: database.hash(recipient)
      // };
      async.auto({
        store: function(callback) {
          brMessages.store(testMessages, callback);
        } //,
        // query: ['store', function(callback, results) {
        //   // check store results
        //   results.store.valid.should.equal(7);
        //   store.find(query, {}).toArray(callback);
        // }],
        // test: ['query', function(callback, results) {
        //   should.exist(results.query);
        //   var r = results.query;
        //   r.should.be.an('array');
        //   r.should.have.length(numberOfMessages);
        //   callback();
        // }]
      }, done);
    });
    it('one invalid message is stored in invalidMessage table', function(done) {
      var holder = uuid();
      var message = helpers.createMessage({holder: holder});
      // delete the recipient property
      delete message.recipient;
      var query = {
        'value.message.content.holder': holder
      };
      async.auto({
        store: function(callback) {
          brMessages.store(message, callback);
        },
        query: ['store', function(callback) {
          storeInvalid.find(query, {}).toArray(callback);
        }],
        test: ['query', function(callback, results) {
          should.exist(results.query);
          results.query.should.be.an('array');
          results.query.should.have.length(1);
          callback();
        }]
      }, done);
    });
    it('seven invalid message stored individually in invalidMessage collection',
      function(done) {
      var holder = uuid();
      var numberOfMessages = 7;
      var message = helpers.createMessage({holder: holder});
      var query = {
        'value.message.content.holder': holder
      };
      async.auto({
        store: function(callback) {
          async.times(numberOfMessages, function(n, next) {
            var message = helpers.createMessage({holder: holder});
            delete message.recipient;
            brMessages.store(message, next);
          }, function(err) {
            callback();
          });
        },
        query: ['store', function(callback) {
          storeInvalid.find(query, {}).toArray(callback);
        }],
        test: ['query', function(callback, results) {
          should.exist(results.query);
          results.query.should.be.an('array');
          results.query.should.have.length(7);
          callback();
        }]
      }, done);
    });
    it('store seven invalid messages as an array', function(done) {
      var holder = uuid();
      var numberOfMessages = 7;
      var testMessages = [];
      for(var i = 0; i < numberOfMessages; i++) {
        var message = helpers.createMessage({holder: holder});
        delete message.recipient;
        testMessages.push(message);
      }
      var query = {
        'value.message.content.holder': holder
      };
      async.auto({
        store: function(callback) {
          brMessages.store(testMessages, callback);
        },
        queryValid: ['store', function(callback, results) {
          // check store results
          results.store.valid.count.should.equal(0);
          store.find(query, {}).toArray(callback);
        }],
        queryInvalid: ['store', function(callback, results) {
          results.store.invalid.count.should.equal(7);
          var invalidQuery = {
            'value.meta.events.job': results.store.job
          };
          storeInvalid.find(invalidQuery).toArray(callback);
        }],
        test: ['queryValid', 'queryInvalid', function(callback, results) {
          should.exist(results.queryValid);
          var validResults = results.queryValid;
          validResults.should.be.an('array');
          validResults.should.have.length(0);
          var invalidResults = results.queryInvalid;
          invalidResults.should.be.an('array');
          invalidResults.should.have.length(7);
          callback();
        }]
      }, done);
    });
    it('store a mix of valid and invalid messages', function(done) {
      var numberOfValidMessages = 7;
      var numberOfInvalidMessages = 3;
      var testMessages = [];
      var i = 0;
      var message = null;
      for(i = 0; i < numberOfInvalidMessages; i++) {
        message = helpers.createMessage();
        delete message.recipient;
        testMessages.push(message);
      }
      for(i = 0; i < numberOfValidMessages; i++) {
        message = helpers.createMessage();
        testMessages.push(message);
      }
      async.auto({
        store: function(callback) {
          brMessages.store(testMessages, callback);
        },
        queryValid: ['store', function(callback, results) {
          // check store results
          var validQuery = {
            'value.meta.events.job': results.store.job
          };
          results.store.valid.count.should.equal(numberOfValidMessages);
          store.find(validQuery, {}).toArray(callback);
        }],
        queryInvalid: ['store', function(callback, results) {
          results.store.invalid.count.should.equal(numberOfInvalidMessages);
          var invalidQuery = {
            'value.meta.events.job': results.store.job
          };
          storeInvalid.find(invalidQuery).toArray(callback);
        }],
        test: ['queryValid', 'queryInvalid', function(callback, results) {
          should.exist(results.queryValid);
          var validResults = results.queryValid;
          validResults.should.be.an('array');
          validResults.should.have.length(numberOfValidMessages);
          var invalidResults = results.queryInvalid;
          invalidResults.should.be.an('array');
          invalidResults.should.have.length(numberOfInvalidMessages);
          callback();
        }]
      }, done);
    });
  });

  describe('get function', function() {
    afterEach(function(done) {
      helpers.removeCollections({collections: ['messages']}, done);
    });
    it('retrieve one NEW messages by recipient', function(done) {
      var body = uuid();
      var holder = uuid();
      var link = uuid();
      var recipient = mockData.identities.rsa4096.identity.id;
      var sender = uuid();
      var subject = uuid();
      var type = uuid();
      var message = helpers.createMessage({
        body: body,
        holder: holder,
        link: link,
        recipient: recipient,
        sender: sender,
        subject: subject,
        type: type
      });
      async.auto({
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        store: function(callback) {
          brMessages.store(message, callback);
        },
        query: ['store', 'getIdentity', function(callback, results) {
          brMessages._get(results.getIdentity[0], {}, recipient, callback);
        }],
        test: ['query', function(callback, results) {
          should.exist(results.query);
          results.query.should.be.an('array');
          results.query.should.have.length(1);
          results.query[0].should.be.an('object');
          var message = results.query[0];
          should.exist(message.id);
          message.id.should.be.a('string');
          should.exist(message['@context']);
          message['@context'].should.be.a('string');
          should.exist(message.date);
          message.date.should.be.a('string');
          should.exist(message.recipient);
          message.recipient.should.be.a('string');
          message.recipient.should.equal(recipient);
          should.exist(message.sender);
          message.sender.should.be.a('string');
          message.sender.should.equal(sender);
          should.exist(message.subject);
          message.subject.should.be.a('string');
          message.subject.should.equal(subject);
          should.exist(message.type);
          message.type.should.be.a('string');
          message.type.should.equal(type);
          should.exist(message.content);
          // check content
          message.content.should.be.an('object');
          var content = message.content;
          should.exist(content.body);
          content.body.should.be.a('string');
          content.body.should.equal(body);
          should.exist(content.holder);
          content.holder.should.be.a('string');
          content.holder.should.equal(holder);
          should.exist(message.meta);
          message.meta.should.be.an('object');
          callback();
        }]
      }, done);
    });
    it('message should not contain any unwanted properties', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      async.auto({
        store: function(callback) {
          brMessages.store(
            helpers.createMessage({recipient: recipient}), callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(
            null, mockData.identities.rsa4096.identity.id, callback);
        },
        test: ['store', 'getIdentity', function(callback, results) {
          brMessages._get(
            results.getIdentity[0], {}, recipient, function(err, results) {
            should.not.exist(err);
            var message = results[0];
            message.should.be.an('object');
            // check message
            _.difference(Object.keys(message), Object.keys(referenceMessage))
              .should.have.length(0);
            // check content
            _.difference(
              Object.keys(message.content),
              Object.keys(referenceMessage.content))
              .should.have.length(0);
            callback(err);
          });
        }]
      }, done);
    });
    it('get seven new messages', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      var numberOfMessages = 7;
      var query = {
        recipient: database.hash(recipient)
      };
      async.auto({
        insert: function(callback) {
          async.times(numberOfMessages, function(n, next) {
            brMessages.store(
              helpers.createMessage({recipient: recipient}), next);
          }, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(
            null, mockData.identities.rsa4096.identity.id, callback);
        },
        get: ['insert', 'getIdentity', function(callback, results) {
          brMessages._get(results.getIdentity[0], {}, recipient, callback);
        }],
        test: ['get', function(callback, results) {
          should.exist(results.get);
          var r = results.get;
          r.should.be.an('array');
          r.should.have.length(numberOfMessages);
          callback();
        }]
      }, done);
    });
    it('should not allow access to another user\`s messages', function(done) {
      var recipient = uuid();
      var numberOfMessages = 7;
      var query = {
        recipient: database.hash(recipient)
      };
      async.auto({
        insert: function(callback) {
          async.times(numberOfMessages, function(n, next) {
            brMessages.store(
              helpers.createMessage({recipient: recipient}), next);
          }, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(
            null, mockData.identities.rsa4096.identity.id, callback);
        },
        get: ['insert', 'getIdentity', function(callback, results) {
          brMessages._get(
            results.getIdentity[0], {}, recipient, function(err, result) {
            should.exist(err);
            err.should.be.an('object');
            err.name.should.be.a('string');
            err.name.should.equal('PermissionDenied');
            should.exist(err.details);
            err.details.should.be.an('object');
            err.details.sysPermission.should.be.a('string');
            err.details.sysPermission.should.equal('MESSAGE_ACCESS');
            callback();
          });
        }]
      }, done);
    });
  });

  describe('update function', function() {
    afterEach(function(done) {
      helpers.removeCollections({collections: ['messages']}, done);
    });
    it('archive one message', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      var message = helpers.createMessage({
        recipient: recipient
      });
      async.auto({
        store: function(callback) {
          brMessages.store(message, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        getId: ['store', 'getIdentity', function(callback, results) {
          // need the ids for the messages that have been stored
          brMessages._get(results.getIdentity[0], {}, recipient, callback);
        }],
        act: ['getId', function(callback, results) {
          var request = {
            operation: 'archive',
            message: results.getId[0].id
          };
          brMessages._updateMessage(
            results.getIdentity[0], request, {recipient: recipient}, callback);
        }],
        test: ['act', function(callback, results) {
          should.exist(results.act);
          should.exist(results.act.result);
          results.act.result.nModified.should.equal(1);
          results.act.result.should.be.an('object');
          brMessages._get(
            results.getIdentity[0], {}, recipient, function(err, result) {
            should.exist(result[0].meta.events);
            result[0].meta.events.should.be.an('array');
            var events = result[0].meta.events;
            events.should.have.length(2);
            events[0].type.should.equal('created');
            events[1].type.should.equal('archived');
            events[1].date.should.be.a('number');
            callback();
          });
        }]
      }, done);
    });
    it('does not allow updates to another user\'s message', function(done) {
      var testIdentity = mockData.identities.rsa4096.identity.id;
      var recipient = uuid();
      var message = helpers.createMessage({
        recipient: recipient
      });
      async.auto({
        store: function(callback) {
          brMessages.store(message, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(null, testIdentity, callback);
        },
        getId: ['store', 'getIdentity', function(callback, results) {
          // need the ids for the messages that have been stored
          brMessages._get(null, {}, recipient, callback);
        }],
        act: ['getId', function(callback, results) {
          var request = {
            operation: 'archive',
            message: results.getId[0].id
          };
          brMessages._updateMessage(
            results.getIdentity[0], request, {recipient: recipient},
            function(err, result) {
            should.exist(err);
            err.should.be.an('object');
            err.name.should.be.a('string');
            err.name.should.equal('PermissionDenied');
            should.exist(err.details);
            err.details.should.be.an('object');
            err.details.sysPermission.should.be.a('string');
            err.details.sysPermission.should.equal('MESSAGE_ACCESS');
            callback();
          });
        }]
      }, done);
    });

    it('update with an unrecognized operation', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      var message = helpers.createMessage({
        recipient: recipient
      });
      async.auto({
        store: function(callback) {
          brMessages.store(message, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        getId: ['store', 'getIdentity', function(callback, results) {
          // need the ids for the messages that have been stored
          brMessages._get(results.getIdentity[0], {}, recipient, callback);
        }],
        act: ['getId', function(callback, results) {
          var request = {
            operation: 'foo',
            message: results.getId[0].id
          };
          brMessages._updateMessage(
            results.getIdentity[0], request, {recipient: recipient},
            function(err, results) {
            should.exist(err);
            err.name.should.equal('MessageUpdate');
            callback();
          });
        }]
      }, done);
    });
  });

  describe('update batch function', function() {
    afterEach(function(done) {
      helpers.removeCollections({collections: ['messages']}, done);
    });
    it('archive two messages', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      var message1 = helpers.createMessage({
        recipient: recipient
      });
      var message2 = helpers.createMessage({
        recipient: recipient
      });
      var messages = [message1, message2];
      async.auto({
        store: function(callback) {
          brMessages.store(messages, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        getIds: ['store', 'getIdentity', function(callback, results) {
          // need the ids for the messages that have been stored
          brMessages._get(results.getIdentity[0], {}, recipient, callback);
        }],
        act: ['getIds', function(callback, results) {
          var messageIds = results.getIds.map(function(message) {
            return message.id;
          });
          var request = [
            {
              op: 'archive',
              id: messageIds[1]
            },
            {
              op: 'archive',
              id: messageIds[0]
            }
          ];
          brMessages._bulkUpdate(
            results.getIdentity[0], request, {recipient: recipient}, callback);
        }],
        test: ['act', function(callback, results) {
          should.exist(results.act.result.nModified);
          results.act.result.nModified.should.equal(2);
          brMessages._get(
            results.getIdentity[0], {}, recipient, function(err, result) {
            should.exist(result[0].meta.archived);
            result[0].meta.archived.should.be.true;
            should.exist(result[0].meta.events[1]);
            result[0].meta.events[1].type.should.equal('archived');
            result[0].meta.events[1].date.should.be.a('number');
            should.exist(result[1].meta.archived);
            result[1].meta.archived.should.be.true;
            should.exist(result[1].meta.events[1]);
            result[1].meta.events[1].type.should.equal('archived');
            result[1].meta.events[1].date.should.be.a('number');
            callback();
          });
        }]
      }, done);
    });
    it('returns error on  mixed results', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      var message1 = helpers.createMessage({
        recipient: recipient
      });
      var message2 = helpers.createMessage({
        recipient: recipient
      });
      var messages = [message1, message2];
      async.auto({
        store: function(callback) {
          brMessages.store(messages, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        getIds: ['store', 'getIdentity', function(callback, results) {
          // need the ids for the messages that have been stored
          brMessages._get(results.getIdentity[0], {}, recipient, callback);
        }],
        act: ['getIds', function(callback, results) {
          var messageIds = results.getIds.map(function(message) {
            return message.id;
          });
          // replace one of the message ids with an invalid id
          messageIds[1] = 'invalidMessageId1234';
          var request = [
            {
              op: 'archive',
              id: messageIds[1]
            },
            {
              op: 'archive',
              id: messageIds[0]
            }
          ];
          brMessages._bulkUpdate(
            results.getIdentity[0], request, {recipient: recipient},
            function(err, result) {
              should.exist(err);
              err.name.should.equal('BulkUpdateFailure');
              should.exist(err.details.mongoResult.result.nModified);
              err.details.mongoResult.result.nModified.should.equal(1);
              callback();
            });
        }]
      }, done);
    });
    it('returns error on an unrecognized operation', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      var message1 = helpers.createMessage({
        recipient: recipient
      });
      var message2 = helpers.createMessage({
        recipient: recipient
      });
      var messages = [message1, message2];
      async.auto({
        store: function(callback) {
          brMessages.store(messages, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        act: ['store', 'getIdentity', function(callback, results) {
          var request = [
            {
              op: 'foo',
              id: messages[1].id
            },
            {
              op: 'foo',
              id: messages[0].id
            }
          ];
          brMessages._bulkUpdate(
            results.getIdentity[0], request, {recipient: recipient},
            function(err, results) {
            should.exist(err);
            should.exist(err.name);
            err.name.should.be.a('string');
            err.name.should.equal('MessageUpdate');
            err.details.httpStatusCode.should.equal(400);
            callback();
          });
        }]
      }, done);
    });
  });

  describe('delete function', function() {
    afterEach(function(done) {
      helpers.removeCollections({collections: ['messages']}, done);
    });
    it('delete one message', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      var message = helpers.createMessage({
        recipient: recipient
      });
      async.auto({
        store: function(callback) {
          brMessages.store(message, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        getId: ['store', 'getIdentity', function(callback, results) {
          // need the ids for the messages that have been stored
          brMessages._get(results.getIdentity[0], {}, recipient, callback);
        }],
        act: ['getId', function(callback, results) {
          brMessages._deleteMessage(
            results.getIdentity[0], results.getId[0].id, {recipient: recipient},
            callback);
        }],
        test: ['act', function(callback, results) {
          should.exist(results.act);
          should.exist(results.act.result);
          results.act.result.should.be.an('object');
          brMessages._get(
            results.getIdentity[0], {}, recipient, function(err, result) {
            should.not.exist(err);
            should.exist(result);
            result.should.be.an('array');
            result.should.have.length(0);
            callback();
          });
        }]
      }, done);
    });
  });

  describe('delete batch function', function() {
    afterEach(function(done) {
      helpers.removeCollections({collections: ['messages']}, done);
    });
    it('delete two messages', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      var message1 = helpers.createMessage({
        recipient: recipient
      });
      var message2 = helpers.createMessage({
        recipient: recipient
      });
      var messages = [message1, message2];
      async.auto({
        store: function(callback) {
          brMessages.store(messages, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        getIds: ['store', 'getIdentity', function(callback, results) {
          // need the ids for the messages that have been stored
          brMessages._get(results.getIdentity[0], {}, recipient, callback);
        }],
        act: ['getIds', function(callback, results) {
          var messageIds = results.getIds.map(function(message) {
            return message.id;
          });
          brMessages._bulkDelete(
            results.getIdentity[0], messageIds,
            {recipient: recipient}, callback);
        }],
        test: ['act', function(callback, results) {
          should.exist(results.act);
          should.exist(results.act.result);
          results.act.result.should.be.a('object');
          brMessages._get(
            results.getIdentity[0], {}, recipient, function(err, result) {
            should.not.exist(err);
            should.exist(result);
            result.should.be.an('array');
            result.should.have.length(0);
            callback();
          });
        }]
      }, done);
    });
    it('returns error on  mixed results', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      var message1 = helpers.createMessage({
        recipient: recipient
      });
      var message2 = helpers.createMessage({
        recipient: recipient
      });
      var messages = [message1, message2];
      async.auto({
        store: function(callback) {
          brMessages.store(messages, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        getIds: ['store', 'getIdentity', function(callback, results) {
          // need the ids for the messages that have been stored
          brMessages._get(results.getIdentity[0], {}, recipient, callback);
        }],
        act: ['getIds', function(callback, results) {
          var messageIds = results.getIds.map(function(message) {
            return message.id;
          });
          // replace one of the message ids with an invalid id
          messageIds[1] = 'invalidMessageId1234';
          brMessages._bulkDelete(
            results.getIdentity[0], messageIds, {recipient: recipient},
            function(err, result) {
              should.exist(err);
              err.name.should.equal('BulkDeleteFailure');
              should.exist(err.details.mongoResult.result.n);
              err.details.mongoResult.result.n.should.equal(1);
              callback();
            });
        }]
      }, done);
    });
  });

  describe('getNew Function', function() {
    afterEach(function(done) {
      helpers.removeCollections({collections: ['messages']}, done);
    });
    it('retrieve one NEW messages by recipient', function(done) {
      var body = uuid();
      var recipient = mockData.identities.rsa4096.identity.id;
      var sender = uuid();
      var link = uuid();
      var holder = uuid();
      var subject = uuid();
      var type = uuid();
      var message = helpers.createMessage({
        body: body,
        holder: holder,
        link: link,
        recipient: recipient,
        sender: sender,
        subject: subject,
        type: type
      });
      async.auto({
        store: function(callback) {
          brMessages.store(message, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        process: ['store', 'getIdentity', function(callback) {
          brMessages._batchMessages(callback);
        }],
        test: ['process', function(callback, results) {
          brMessages._getNew(
            results.getIdentity[0], recipient, function(err, results) {
            should.not.exist(err);
            should.exist(results);
            results.should.be.an('array');
            results.should.have.length(1);
            var message = results[0];
            message.should.be.an('object');
            should.exist(message['@context']);
            message['@context'].should.be.a('string');
            should.exist(message.date);
            message.date.should.be.a('string');
            should.exist(message.recipient);
            message.recipient.should.be.a('string');
            message.recipient.should.equal(recipient);
            should.exist(message.sender);
            message.sender.should.be.a('string');
            message.sender.should.equal(sender);
            should.exist(message.subject);
            message.subject.should.be.a('string');
            message.subject.should.equal(subject);
            should.exist(message.type);
            message.type.should.be.a('string');
            message.type.should.equal(type);
            should.exist(message.content);
            // check content
            message.content.should.be.an('object');
            var content = message.content;
            should.exist(content.holder);
            content.holder.should.be.a('string');
            content.holder.should.equal(holder);
            should.exist(content.body);
            content.body.should.be.a('string');
            content.body.should.equal(body);
            callback(err);
          });
        }]
      }, done);
    });
    it('message should not contain any unwanted properties', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      async.auto({
        store: function(callback) {
          brMessages.store(
            helpers.createMessage({recipient: recipient}), callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        process: ['store', 'getIdentity', function(callback) {
          brMessages._batchMessages(callback);
        }],
        test: ['process', function(callback, results) {
          brMessages._getNew(
            results.getIdentity[0], recipient, function(err, results) {
            should.not.exist(err);
            var message = results[0];
            message.should.be.an('object');
            // check message
            _.difference(Object.keys(message), Object.keys(referenceMessage))
              .should.have.length(0);
            // check content
            _.difference(
              Object.keys(message.content),
              Object.keys(referenceMessage.content))
              .should.have.length(0);
            callback(err);
          });
        }]
      }, done);
    });
    it('not receive the same new message a second time', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      var message = helpers.createMessage({recipient: recipient});
      async.auto({
        store: function(callback) {
          brMessages.store(message, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        process: ['store', 'getIdentity', function(callback) {
          brMessages._batchMessages(callback);
        }],
        getFirst: ['process', function(callback, results) {
          brMessages._getNew(
            results.getIdentity[0], recipient, function(err, results) {
            results[0].recipient.should.equal(recipient);
            callback(err);
          });
        }],
        test: ['getFirst', function(callback, results) {
          brMessages._getNew(
            results.getIdentity[0], recipient, function(err, results) {
            should.not.exist(err);
            should.exist(results);
            results.should.be.an('array');
            results.should.have.length(0);
            callback(err);
          });
        }]
      }, done);
    });
    it('get seven new messages', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      var numberOfMessages = 7;
      var query = {
        recipient: database.hash(recipient)
      };
      async.auto({
        store: function(callback) {
          async.times(numberOfMessages, function(n, next) {
            brMessages.store(
              helpers.createMessage({recipient: recipient}), next);
          }, function(err) {
            callback();
          });
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        process: ['store', 'getIdentity', function(callback) {
          brMessages._batchMessages(callback);
        }],
        get: ['process', function(callback, results) {
          brMessages._getNew(results.getIdentity[0], recipient, callback);
        }],
        test: ['get', function(callback, results) {
          should.exist(results.get);
          var r = results.get;
          r.should.be.an('array');
          r.should.have.length(numberOfMessages);
          callback();
        }]
      }, done);
    });
  });
  describe('getMessages function', function() {
    afterEach(function(done) {
      helpers.removeCollections({collections: ['messages']}, done);
    });
    it('get some messages', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      var numberOfMessages = 7;
      async.auto({
        store: function(callback) {
          async.times(numberOfMessages, function(n, next) {
            brMessages.store(
              helpers.createMessage({recipient: recipient}), next);
          }, function(err, results) {
            callback(err);
          });
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        getIds: ['store', 'getIdentity', function(callback, results) {
          // need the ids for the messages that have been stored
          brMessages._get(results.getIdentity[0], {}, recipient, callback);
        }],
        act: ['getIds', function(callback, results) {
          // pull out 3 ids for testing
          var testMessages = [];
          testMessages.push(
            results.getIds[1].id, results.getIds[3].id, results.getIds[6].id);
          // testSubjects.push
          brMessages.getMessages(
            results.getIdentity[0], testMessages, {recipient: recipient},
            callback);
        }],
        test: ['act', function(callback, results) {
          results.act.should.be.an('array');
          results.act.should.have.length(3);
          should.exist(_.find(results.act, results.getIds[1]));
          should.exist(_.find(results.act, results.getIds[3]));
          should.exist(_.find(results.act, results.getIds[6]));
          callback();
        }]
      }, done);
    });
    it('returns an error if all messages were not found', function(done) {
      var recipient = mockData.identities.rsa4096.identity.id;
      var numberOfMessages = 7;
      async.auto({
        store: function(callback) {
          async.times(numberOfMessages, function(n, next) {
            brMessages.store(
              helpers.createMessage({recipient: recipient}), next);
          }, function(err, results) {
            callback(err);
          });
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        getIds: ['store', 'getIdentity', function(callback, results) {
          // need the ids for the messages that have been stored
          brMessages._get(results.getIdentity[0], {}, recipient, callback);
        }],
        act: ['getIds', function(callback, results) {
          // pull out 2 good ids for testing and add an invalid id
          var testMessages = [];
          testMessages.push(
            results.getIds[1].id, results.getIds[3].id, 'invalidMessageId1234');
          brMessages.getMessages(
            results.getIdentity[0], testMessages, {recipient: recipient},
            function(err, result) {
              should.exist(err);
              err.name.should.equal('GetMessagesFailure');
              should.exist(err.details.mongoResult);
              err.details.mongoResult.should.be.an('array');
              err.details.mongoResult.should.have.length(2);
              should.exist(_.find(err.details.mongoResult, results.getIds[1]));
              should.exist(_.find(err.details.mongoResult, results.getIds[3]));
              callback();
            });
        }]
      }, done);
    });
  });
});
