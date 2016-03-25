/*
 * Copyright (c) 2015-2016 Digital Bazaar, Inc. All rights reserved.
 */
 /* jshint node: true */

'use strict';

var helpers = require('./helpers');

var data = {};
module.exports = data;

data.batchMessageStateData = [
  {
    msgData: {state: 'pending'}, batchData: {dirty: false},
    result: {msgState: 'ready', dirty: false}
  },
  {
    msgData: {state: 'pending'}, batchData: {dirty: true},
    result: {msgState: 'ready', dirty: false}
  },
  {
    msgData: {state: 'ready'}, batchData: {dirty: true},
    result: {msgState: 'ready', dirty: true}
  }
];

data.getUnbatchedMessageStateData = [
  {msgData: {state: 'ready'}, batchData: {dirty: true, id: 1}, result: true},
  {msgData: {state: 'ready'}, batchData: {dirty: true, id: 0}, result: true},
  {msgData: {state: 'pending'}, batchData: {dirty: false, id: 0}, result: true},
  {msgData: {state: 'pending'}, batchData: {dirty: false, id: 1}, result: true},
  {msgData: {state: 'ready'}, batchData: {dirty: false, id: 0}, result: null}
];

// Not currently testing the return value of this function
// only testing the resulting database changes
data.resetMessageStateData = [
  {msgData: {state: 'ready'}, batchData: {dirty: false, id: 0}},
  {msgData: {state: 'ready'}, batchData: {dirty: false, id: 1}},
  {msgData: {state: 'ready'}, batchData: {dirty: true, id: 0}},
  {msgData: {state: 'ready'}, batchData: {dirty: true, id: 1}},
  {msgData: {state: 'pending'}, batchData: {dirty: false, id: 0}},
  {msgData: {state: 'pending'}, batchData: {dirty: false, id: 1}},
  {msgData: {state: 'pending'}, batchData: {dirty: true, id: 0}},
  {msgData: {state: 'pending'}, batchData: {dirty: true, id: 1}}
];

data.deliverBatchStateData = [
  {
    msgData: {state: 'ready', id: 0}, batchData: {dirty: true, id: 0},
    result: {length: 0, id: 0}
  },
  {
    msgData: {state: 'ready', id: 0}, batchData: {dirty: true, id: 1},
    result: {length: 0, id: 1}
  },
  {
    msgData: {state: 'ready', id: 0}, batchData: {dirty: false, id: 0},
    result: {length: 1, id: 1}
  },
  {
    msgData: {state: 'ready', id: 0}, batchData: {dirty: false, id: 1},
    result: {length: 0, id: 1}
  },
  {
    msgData: {state: 'ready', id: 1}, batchData: {dirty: false, id: 1},
    result: {length: 1, id: 2}
  }
];
