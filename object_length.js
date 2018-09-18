/*jslint node: true */
"use strict";
var _ = require('lodash');
var constants = require('./constants.js');

var PARENT_UNITS_SIZE = 2*44;

function getLength(value) {
	if (value === null)
		return 0;
	switch (typeof value){
		case "string": 
			return value.length;
		case "number": 
			return 8;
			//return value.toString().length;
		case "object":
			var len = 0;
			if (Array.isArray(value))
				value.forEach(function(element){
					len += getLength(element);
				});
			else    
				for (var key in value){
					if (typeof value[key] === "undefined")
						throw Error("undefined at "+key+" of "+JSON.stringify(value));
					len += getLength(value[key]);
				}
			return len;
		case "boolean": 
			return 1;
		default:
			throw Error("unknown type="+(typeof value)+" of "+value);
	}
}

function getHeadersSize(objUnit) {
	if (objUnit.content_hash)
		throw Error("trying to get headers size of stripped unit");
	var objHeader = _.cloneDeep(objUnit);
	delete objHeader.unit;
	delete objHeader.headers_commission;
	delete objHeader.payload_commission;
	delete objHeader.main_chain_index;
	delete objHeader.timestamp;
	delete objHeader.messages;
	delete objHeader.round_index;
	delete objHeader.pow_type;
	delete objHeader.parent_units; // replaced with PARENT_UNITS_SIZE
	return getLength(objHeader) + PARENT_UNITS_SIZE;
}

function getTotalPayloadSizeOld(objUnit) {
	if (objUnit.content_hash)
		throw Error("trying to get payload size of stripped unit");
	return getLength(objUnit.messages);	
}

function getTotalPayloadSize(objUnit) {
	if (objUnit.content_hash)
		throw Error("trying to get payload size of stripped unit");
	// pow modi
	//return getLength(objUnit.messages);
	var totalPayloadSize = 0;
	objUnit.messages.forEach(function(message){
		if(constants.PAYLOAD_COEFFICIENT[message.app] === null || isNaN(constants.PAYLOAD_COEFFICIENT[message.app]))
			throw Error("payload coefficient is not number or null " + message.app);
		totalPayloadSize += getLength(message) * constants.PAYLOAD_COEFFICIENT[message.app];
	});
	return totalPayloadSize;
}



exports.getHeadersSize = getHeadersSize;
exports.getTotalPayloadSize = getTotalPayloadSize;
exports.getTotalPayloadSizeOld = getTotalPayloadSizeOld;
