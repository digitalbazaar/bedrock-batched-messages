/*
 * Copyright (c) 2015 Digital Bazaar, Inc. All rights reserved.
 */

var config = require('bedrock').config;
var path = require('path');

config.messages = {};
// these messages will be inserted into the database at startup
config.messages.newMessages = [];
config.messages.endpoints = {};
config.messages.endpoints.messages = '/messages';

config.messages.jobs = {};
config.messages.jobs.batchMessages = {};
// Set how often the scheduler background-job will run
config.messages.jobs.batchMessages.frequency = 'R/PT1M';
// Set priority of this background job
config.messages.jobs.batchMessages.priority = 0;
// Set max amount of bedrock workers on the scheduling job
config.messages.jobs.batchMessages.concurrency = -1;

// load validation schemas
config.validation.schema.paths.push(path.join(__dirname, '..', 'schemas'));

// message permissions
var permissions = config.permission.permissions;
permissions.MESSAGE_ADMIN = {
  id: 'MESSAGE_ADMIN',
  label: 'Message Administration',
  comment: 'Required to administer Messages.'
};
permissions.MESSAGE_ACCESS = {
  id: 'MESSAGE_ACCESS',
  label: 'Access Message',
  comment: 'Required to access a Message.'
};
permissions.MESSAGE_INSERT = {
  id: 'MESSAGE_INSERT',
  label: 'Insert a Message into the database',
  comment: 'Required to insert a Message.'
};
permissions.MESSAGE_REMOVE = {
  id: 'MESSAGE_REMOVE',
  label: 'Remove Message',
  comment: 'Required to remove a Message.'
};

// FIXME: add additional roles
// messages roles
var roles = config.permission.roles;
roles['messages.user'] = {
  id: 'messages.user',
  label: 'Messages User',
  comment: 'Role for messsage users.',
  sysPermission: [
    permissions.MESSAGE_ACCESS.id,
    permissions.MESSAGE_REMOVE.id
  ]
};
