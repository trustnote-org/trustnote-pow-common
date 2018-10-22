/*jslint node: true */
"use strict";

function readSingleAddress(conn, handleAddress){
	readSingleWallet(conn, function(wallet_id){
		conn.query("SELECT address FROM my_addresses WHERE wallet=?", [wallet_id], function(rows){
			if (rows.length === 0)
				throw Error("no addresses");
			if (rows.length > 1)
				throw Error("more than 1 address");
			handleAddress(rows[0].address);
		});
	})
}

function readSingleWallet(conn, handleWallet){
	conn.query("SELECT wallet FROM wallets", function(rows){
		if (rows.length === 0)
			throw Error("no wallets");
		if (rows.length > 1)
			throw Error("more than 1 wallet");
		handleWallet(rows[0].wallet);
	});
}

exports.readSingleWallet = readSingleWallet;
exports.readSingleAddress = readSingleAddress;