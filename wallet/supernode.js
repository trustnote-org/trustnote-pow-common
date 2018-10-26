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



/**
 *	read miner address
 *	@param	{string}	sSuperNodeAddress
 *	@param	{function}	pfnCallback( err, sMinerAddress )
 */
function readMinerAddress( sSuperNodeAddress, pfnCallback )
{
	let sRet	= '';

	// SELECT shared_address FROM shared_address_signing_paths AS t_my JOIN shared_address_signing_paths AS t_fon
	// WHERE
	// t_my.address='myaddress' AND t_my.signing_path = 'r.1.0'
	// AND t_fon.address='fondation address' AND t_fon.signing_path = 'r.0.0'

	return pfnCallback( null, sRet );
}

/**
 *	read miner deposit
 *	@param	{string}	sSuperNodeAddress
 *	@param	{function}	pfnCallback( err, nDeposit )
 */
function readMinerDeposit( sSuperNodeAddress, pfnCallback )
{
	readMinerAddress( sSuperNodeAddress, function( err, sMinerAddress )
	{
		if ( err )
		{
			return pfnCallback( err );
		}

		//
		//	query deposit
		//
		let nDeposit	= 0;

		//	...
		return pfnCallback( null, nDeposit );
	});
}

/**
 *	@exports
 */
exports.readSingleWallet	= readSingleWallet;
exports.readSingleAddress	= readSingleAddress;

exports.readMinerAddress	= readMinerAddress;
exports.readMinerDeposit	= readMinerDeposit;