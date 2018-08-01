/*jslint node: true */
"use strict";
var ValidationUtils = require("./validation_utils.js");
var constants = require("./constants.js");
var conf = require('./conf.js');


function parseUri(uri, callbacks){
	var objRequest = {};


	if(uri.length == 32){
		var address = uri;
		if (!ValidationUtils.isValidAddress(address))
			return callbacks.ifError("address "+address+" is invalid");
		objRequest.type = "address";
		objRequest.address = address;
		return callbacks.ifOk(objRequest);
	}


	var protocol = conf.program || 'trustnote';
	var re = new RegExp('^'+protocol+':(.+)$', 'i');
	var arrMatches = uri.match(re);
	if (!arrMatches){
		return callbacks.ifError("no "+protocol+" prefix");
	}
	var value = arrMatches[1];


	// 是否是 T-code 的领取
	if(value.indexOf('tcode-') == 0 && value.length == 22){
		var tempTcode = value.replace('tcode-','');
		if(tempTcode.length != 16){
			return;
		}
		objRequest.type = "tcode";
		objRequest.to_address = tempTcode;
		return callbacks.ifOk(objRequest);
	}


	// 是否是 login
	if(value.indexOf('login-') == 0){
		var tempLogin = value.replace('login-','');
		objRequest.type = "login";
		objRequest.loginMsg = tempLogin;
		return callbacks.ifOk(objRequest);
	}


	// 是否是 sendAssets
	if(value.indexOf('payment-') == 0){
		var tempSend = value.replace('payment-','');
		objRequest.type = "payment";
		objRequest.sendAssetMsg = tempSend;
		return callbacks.ifOk(objRequest);
	}


	// observed_wallet to pay
	var arrPairingMatches = value;
	var flag = (/^\{.*\}$/).test(arrPairingMatches);
	if (flag){
		var toObj = JSON.parse(arrPairingMatches);
		if(toObj.type != "h2")
			return callbacks.ifError("no "+protocol+" prefix");
		objRequest.type = "ob_walletToPay";
		objRequest.text_to_sign = toObj.sign;
		objRequest.path = toObj.path;
		objRequest.to_address = toObj.addr;
		objRequest.amount = toObj.amount;
		objRequest.v = toObj.v;
		return callbacks.ifOk(objRequest);
	}
	// observed_wallet to pay --- end


	// pairing / start a chat
	//	var arrPairingMatches = value.match(/^([\w\/+]{44})@([\w.:\/-]+)(?:#|%23)([\w\/+]+)$/);
	var arrPairingMatches = value.replace('%23', '#').match(/^([\w\/+]{44})@([\w.:\/-]+)#([\w\/+-]+)$/);
	if (arrPairingMatches){
		objRequest.type = "pairing";
		objRequest.pubkey = arrPairingMatches[1];
		objRequest.hub = arrPairingMatches[2];
		objRequest.pairing_secret = arrPairingMatches[3];
		//if (objRequest.pairing_secret.length > 12)
		//    return callbacks.ifError("pairing secret too long");
		return callbacks.ifOk(objRequest);
	}

	// authentication/authorization
	var arrAuthMatches = value.match(/^auth\?(.+)$/);
	if (arrAuthMatches){
		objRequest.type = "auth";
		var query_string = arrAuthMatches[1];
		var assocParams = parseQueryString(query_string);
		if (assocParams.url){
			if (!assocParams.url.match(/^https?:\/\//))
				return callbacks.ifError("invalid url");
		}
		else if (assocParams.device){
			if (!assocParams.pairing_secret)
				return callbacks.ifError("no pairing secret in auth params");
			if (!assocParams.app)
				return callbacks.ifError("no app in auth params");
			var arrParts = assocParams.device.split('@');
			if (arrParts.length !== 2)
				return callbacks.ifError("not 2 parts in full device address");
			var pubkey = arrParts[0];
			var hub = arrParts[1];
			if (pubkey.length !== constants.PUBKEY_LENGTH)
				return callbacks.ifError("pubkey length is not 44");
			if (hub.match(/[^\w\.:-]/))
				return callbacks.ifError("invalid hub address");
		}
		else
			return callbacks.ifError("neither url nor device in auth params");
		objRequest.params = assocParams;
		return callbacks.ifOk(objRequest);
	}

	// pay to address
	var arrParts = value.split('?');
	if (arrParts.length > 2)
		return callbacks.ifError("too many question marks");
	var address = arrParts[0];
	if(address.length == 34)
		address = address.substr(2, 34);
	if(address.length == 2)
		return;
	var query_string = arrParts[1];
	if (!ValidationUtils.isValidAddress(address))
		return callbacks.ifError("address "+address+" is invalid");
	objRequest.type = "address";
	objRequest.address = address;
	if (query_string){
		var assocParams = parseQueryString(query_string);
		var strAmount = assocParams.amount;
		if (typeof strAmount === 'string'){
			var amount = parseInt(strAmount);
			if (amount + '' !== strAmount)
				return callbacks.ifError("invalid amount: "+strAmount);
			if (!ValidationUtils.isPositiveInteger(amount))
				return callbacks.ifError("nonpositive amount: "+strAmount);
			objRequest.amount = amount;
		}
		var asset = assocParams.asset;
		if (typeof asset === 'string'){
			if (asset !== 'base' && !ValidationUtils.isValidBase64(asset, constants.HASH_LENGTH)) // invalid asset
				return callbacks.ifError('invalid asset: '+asset);
			objRequest.asset = asset;
		}
		if (!objRequest.asset && objRequest.amount) // when amount is set, asset must be also set
			objRequest.asset = 'base';
		var device_address = assocParams.device_address;
		if (device_address){
			if (!ValidationUtils.isValidDeviceAddress(device_address))
				return callbacks.ifError('invalid device address: '+device_address);
			objRequest.device_address = device_address;
		}
	}
	callbacks.ifOk(objRequest);
}

function parseQueryString(str, delimiter){
	if (!delimiter)
		delimiter = '&';
	var arrPairs = str.split(delimiter);
	var assocParams = {};
	arrPairs.forEach(function(pair){
		var arrNameValue = pair.split('=');
		if (arrNameValue.length !== 2)
			return;
		var name = decodeURIComponent(arrNameValue[0]);
		var value = decodeURIComponent(arrNameValue[1]);
		assocParams[name] = value;
	});
	return assocParams;
}



exports.parseQueryString = parseQueryString;
exports.parseUri = parseUri;
