/*jslint node: true */
"use strict";

/**
 * 	@author		XING
 * 	@datetime	2018/8/6 4:53 PM
 *
 * 	////////////////////////////////////////////////////////////
 *	@description
 *
 *	arrCoinBaseList
 *	[
 *		'address1'	: amount of coins,
 *		'address2'	: amount of coins,
 *		'address3'	: amount of coins,
 *		'address4'	: amount of coins,
 *		'address5'	: amount of coins,
 *		'address6'	: amount of coins,
 *		'address7'	: amount of coins,
 *		'address8'	: amount of coins,
 *	]
 *
 *
 *	////////////////////////////////////////////////////////////
 *	@examples
 *
 *	let nCallStartCalculation = startCalculation
 *	(
 *		[
 *			'4T57ZFLZOMUAMZTXO63XLK5YDQRF5DP2'	: 10000,
 *			'2SATGZDFDXNNJRVZ52O4J6VYTTMO2EZR'	: 10000,
 *		],
 *		'rjywtuZ8A70vgIsZ7L4lBR3gz62Nl3vZr2t7I4lzsMU=',
 *		'000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
 *		'public key',
 *		'xing.supernode.trustnote.org'
 *	);
 *	console.log(  nCallStartCalculation );
 *
 *
 *	let nCallIsValidEquihash = isValidEquihash
 *	(
 *		[
 *			'4T57ZFLZOMUAMZTXO63XLK5YDQRF5DP2'	: 10000,
 *			'2SATGZDFDXNNJRVZ52O4J6VYTTMO2EZR'	: 10000,
 *		],
 *		'00000001c570c4764aadb3f09895619f549000b8b51a789e7f58ea7500007097',
 *		'xxxxxxxxxxxx'
 *	);
 *	console.log(  nCallIsValidEquihash );
 *
 */




/**
 *	start calculation
 *
 *	@param	{array}		arrCoinBaseList		@see description
 *	@param	{string}	sTrustMEBall
 *	@param	{string}	sDifficulty
 *	@param	{string}	sPubSeed
 *	@param	{string}	sSuperNode
 *	@return	{number}
 *		0	successfully
 *		-1	error
 *		...
 */
function startCalculation( arrCoinBaseList, sTrustMEBall, sDifficulty, sPubSeed, sSuperNode )
{
	if ( ! Array.isArray( arrCoinBaseList ) || 0 === arrCoinBaseList.length )
	{
		throw new Error( 'call startCalculation with invalid arrCoinBaseList' );
	}
	if ( 'string' !== typeof sTrustMEBall || 44 !== sTrustMEBall.length )
	{
		throw new Error( 'call startCalculation with invalid sTrustMEBall' );
	}
	if ( 'string' !== typeof sDifficulty || 64 !== sDifficulty.length )
	{
		throw new Error( 'call startCalculation with invalid sDifficulty' );
	}
	if ( 'string' !== typeof sPubSeed || 0 === sPubSeed.length )
	{
		throw new Error( 'call startCalculation with invalid sPubSeed' );
	}
	if ( 'string' !== typeof sSuperNode || 0 === sSuperNode.length )
	{
		throw new Error( 'call startCalculation with invalid sSuperNode' );
	}

	return 0;
}

/**
 *	verify if a hash is valid
 *	@param	{array}		arrCoinBaseList		@see description
 *	@param	{string}	sHash
 *	@param	{string}	sNonce
 *	@return	{boolean}
 */
function isValidEquihash( arrCoinBaseList, sHash, sNonce )
{
	if ( ! Array.isArray( arrCoinBaseList ) || 0 === arrCoinBaseList.length )
	{
		throw new Error( 'call isValidEquihash with invalid arrCoinBaseList' );
	}
	if ( 'string' !== typeof sHash || 64 !== sHash.length )
	{
		throw new Error( 'call isValidEquihash with invalid sHash' );
	}
	if ( 'string' !== typeof sNonce || 0 === sNonce.length )
	{
		throw new Error( 'call isValidEquihash with invalid sNonce' );
	}

	return true;
}




/**
 *	@exports
 */
module.exports.startCalculation	= startCalculation;
module.exports.isValidEquihash	= isValidEquihash;
