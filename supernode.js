/*jslint node: true */
"use strict";
var db = require('./db.js');

var wallet_id;

function readSingleAddress(handleAddress){
	readSingleWallet(function(wallet_id){
		db.query("SELECT address FROM my_addresses WHERE wallet=?", [wallet_id], function(rows){
			if (rows.length === 0)
				throw Error("no addresses");
			if (rows.length > 1)
				throw Error("more than 1 address");
			handleAddress(rows[0].address);
		});
	})
}

function readSingleWallet(handleWallet){
	db.query("SELECT wallet FROM wallets", function(rows){
		if (rows.length === 0)
			throw Error("no wallets");
		if (rows.length > 1)
			throw Error("more than 1 wallet");
		handleWallet(rows[0].wallet);
	});
}

exports.readSingleWallet = readSingleWallet;
exports.readSingleAddress = readSingleAddress;