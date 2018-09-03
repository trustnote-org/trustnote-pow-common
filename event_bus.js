/*jslint node: true */
"use strict";

/**
 *	@boss	XING
 */


require('./enforce_singleton.js');

var EventEmitter = require('events').EventEmitter;

var eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(0);

module.exports = eventEmitter;
