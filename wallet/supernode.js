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
 * Create Deposit Address
 * @param {String} my_address - address that use to generate deposit address
 * @param {Array} arrDefinition - definiton of miner shared address
 * @param {Object} assocSignersByPath - address paths of shared address
 * @param {Function} callback - callback(deposit_address)
 */
function createDepositAddress(my_address, callback) {
	var walletDefinedByAddresses = require('../wallet/wallet_defined_by_addresses.js');
	var constants = require('../config/constants.js');
	var device = require('./device.js');
	var myDeviceAddresses = device.getMyDeviceAddress();

	var arrDefinition = [
		'or', 
		[
			['address', constants.FOUNDATION_ADDRESS],
			['address', my_address],
		]
	];
	
	var assocSignersByPath={
		'r.0.0': {
			address: constants.FOUNDATION_ADDRESS,
			member_signing_path: 'r',
			device_address: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
		},
		'r.1.0': {
			address: my_address,
			member_signing_path: 'r',
			device_address: myDeviceAddresses
		},
	};
	var shared_address = objectHash.getChash160(arrDefinition)

	walletDefinedByAddresses.handleNewSharedAddress({address: shared_address, definition: arrDefinition, signers: assocSignersByPath}, callback)
}


/**
 *	@exports
 */
exports.readSingleWallet	= readSingleWallet;
exports.readSingleAddress	= readSingleAddress;

exports.readMinerAddress	= readMinerAddress;
exports.readMinerDeposit	= readMinerDeposit;

exports.createDepositAddress = createDepositAddress;