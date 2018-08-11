/*jslint node: true */
"use strict";

/**
 *	@boss	XING
 */

const _ref		= require( 'ref' );
//const _ffi		= require( 'ffi' );
const _fs		= require( 'fs' );
const _crypto		= require( 'crypto' );

const _constants	= require( './constants.js' );
const _round		= require( './round.js' );



/**
 * 	@global
 *	@variables
 */
let _objEquihashLibrary		= null;



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
 * 	let bCallStartCalculation = startCalculation( oConn, function( err )
 * 	{
 * 		if ( err )
 * 		{
 * 			console.log( `failed to start calculation, `, err );
 * 			return;
 * 		}
 *
 * 		console.log( `start calculation successfully.` );
 * 	});
 *
 *	let nCallStartCalculation = startCalculationWithInput
 *	({
 *		 coinBaseList	: {
 *			 '4T57ZFLZOMUAMZTXO63XLK5YDQRF5DP2': 10000,
 *			 '2SATGZDFDXNNJRVZ52O4J6VYTTMO2EZR': 10000,
 *		 },
 *		 trustMEBall	: 'rjywtuZ8A70vgIsZ7L4lBR3gz62Nl3vZr2t7I4lzsMU=',
 *		 difficulty	: '000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
 *		 pubSeed		: 'public key',
 *		 superNode	: 'xing.supernode.trustnote.org',
 *	}, function( err )
 *	{
 * 		if ( err )
 * 		{
 * 			console.log( `failed to start calculation, `, err );
 * 			return;
 * 		}
 *
 * 		console.log( `start calculation successfully.` );
 * 	});
 *
 *
 *	let bIsValidEquihash = isValidEquihash
 *	(
 *		{
 *			coinBaseList	: {
 *				'4T57ZFLZOMUAMZTXO63XLK5YDQRF5DP2': 10000,
 *				'2SATGZDFDXNNJRVZ52O4J6VYTTMO2EZR': 10000,
 *			},
 *			trustMEBall	: 'rjywtuZ8A70vgIsZ7L4lBR3gz62Nl3vZr2t7I4lzsMU=',
 *			difficulty	: '000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
 *			pubSeed		: 'public key',
 *			superNode	: 'xing.supernode.trustnote.org',
 *		},
 *		'00000001c570c4764aadb3f09895619f549000b8b51a789e7f58ea7500007097',
 *		'xxxxxxxxxxxx'
 *	);
 *	console.log( bIsValidEquihash );
 *
 */


/**
 *	start calculation
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{function}	pfnCallback( err )
 *	@return {boolean}
 */
function startCalculation( oConn, pfnCallback )
{
	if ( 'function' !== typeof pfnCallback )
	{
		throw new Error( `call startCalculation with invalid pfnCallback.` );
	}

	_round.getCurrentRoundIndex( oConn, function( nRoundIndex )
	{
		oConn.query
		(
			"SELECT DISTINCT address FROM units JOIN unit_authors USING(unit) \
			WHERE round_index = ? AND is_stable=1 AND is_on_main_chain=1 AND pow_type=? \
			ORDER BY main_chain_index",
			[ nRoundIndex, _constants.POW_TYPE_COIN_BASE ],
			function( arrRows )
			{
				if ( 0 === arrRows.length )
				{
					return pfnCallback( `no coin base unit.` );
				}
				if ( arrRows.length < 8 )
				{
					return pfnCallback( `not enough coin base units.` );
				}

				//
				//	TODO
				//	calculate address : amount
				//
				pfnCallback( null, arrRows );
			}
		);
	});


	return true;
}


/**
 *	start calculation with inputs
 *
 * 	@param	{object}	objInput
 *	@param	{array}		objInput.coinBaseList		@see description
 *	@param	{string}	objInput.trustMEBall
 *	@param	{string}	objInput.difficulty
 *	@param	{string}	objInput.pubSeed
 *	@param	{string}	objInput.superNode
 *	@param	{function}	pfnCallback( err )
 *	@return	{boolean}
 */
function startCalculationWithInputs( objInput, pfnCallback )
{
	if ( 'object' !== typeof objInput )
	{
		throw new Error( 'call startCalculation with invalid objInput' );
	}
	if ( ! Array.isArray( objInput.coinBaseList ) || 0 === objInput.coinBaseList.length )
	{
		throw new Error( 'call startCalculation with invalid arrCoinBaseList' );
	}
	if ( 'string' !== typeof objInput.trustMEBall || 44 !== objInput.trustMEBall.length )
	{
		throw new Error( 'call startCalculation with invalid sTrustMEBall' );
	}
	if ( 'string' !== typeof objInput.difficulty || 64 !== objInput.difficulty.length )
	{
		throw new Error( 'call startCalculation with invalid sDifficulty' );
	}
	if ( 'string' !== typeof objInput.pubSeed || 0 === objInput.pubSeed.length )
	{
		throw new Error( 'call startCalculation with invalid sPubSeed' );
	}
	if ( 'string' !== typeof objInput.superNode || 0 === objInput.superNode.length )
	{
		throw new Error( 'call startCalculation with invalid sSuperNode' );
	}
	if ( 'function' !== typeof pfnCallback )
	{
		throw new Error( `call startCalculationWithInputs with invalid pfnCallback.` );
	}

	return true;
}



/**
 *	verify if a hash is valid
 *
 * 	@param	{object}	objInput
 *	@param	{array}		objInput.coinBaseList		@see description
 *	@param	{string}	objInput.trustMEBall
 *	@param	{string}	objInput.difficulty
 *	@param	{string}	objInput.pubSeed
 *	@param	{string}	objInput.superNode
 *	@param	{string}	sHash				'3270bcfd5d77014d85208e39d8608154c89ea10b51a1ba668bc87193340cdd67'
 *	@param	{number}	nNonce
 *	@return	{boolean}
 */
function isValidEquihash( objInput, sHash, nNonce )
{
	if ( 'object' !== typeof objInput )
	{
		throw new Error( 'call isValidEquihash with invalid objInput' );
	}
	if ( 'string' !== typeof sHash || 64 !== sHash.length )
	{
		throw new Error( 'call isValidEquihash with invalid sHash' );
	}
	if ( 'number' !== typeof nNonce )
	{
		throw new Error( 'call isValidEquihash with invalid sNonce' );
	}

	let bRet;
	let nInputLen;
	let bufInput;
	let bufHash;

	//	...
	bRet		= false;
	nInputLen	= 140;
	bufInput	= createInputBufferFromObject( objInput );
	bufHash		= Buffer.concat( [ Buffer.from( sHash, 'utf8' ) ], 32 );

	// //	load library
	// _loadEquihashLibrary();
	//
	//
	//
	//

	//
	// let nCall       = _objEquihashLibrary.equihash( bufInput, nNonce, bufHash, nInputLen );
	//
	// console.log( `call equihash = ${ nCall }` );



	return true;
}


/**
 *	create an input buffer with length of 140 from Js plain object
 *	@public
 *	@param	{object}	objInput
 *	@return	{Buffer}
 */
function createInputBufferFromObject( objInput )
{
	let sInput;
	let bufSha512;
	let bufMd5;
	let bufRmd160;
	let bufSha384;

	if ( 'object' !== typeof objInput )
	{
		return null;
	}

	//	...
	sInput		= JSON.stringify( objInput );

	bufSha512	= _crypto.createHash( 'sha512' ).update( sInput, 'utf8' ).digest();
	bufMd5		= _crypto.createHash( 'md5' ).update( sInput, 'utf8' ).digest();
	bufRmd160	= _crypto.createHash( 'rmd160' ).update( sInput, 'utf8' ).digest();
	bufSha384	= _crypto.createHash( 'sha384' ).update( sInput, 'utf8' ).digest();

	return Buffer.concat( [ bufSha512, bufMd5, bufRmd160, bufSha384 ], 140 );
}




/**
 *	load libequihash.so dynamically
 *	@private
 */
function _loadEquihashLibrary()
{
	if ( null === _objEquihashLibrary )
	{
		_objEquihashLibrary = _ffi.Library
		(
			`${ __dirname }/libs/libequihash.so`,
			{
				'equihash': [ 'int',  [ 'pointer', 'uint', 'pointer', 'int'  ] ]
			}
		);
	}
}









/**
 *	@exports
 */
module.exports.startCalculation			= startCalculation;
module.exports.startCalculationWithInputs	= startCalculationWithInputs;
module.exports.isValidEquihash			= isValidEquihash;
module.exports.createInputBufferFromObject	= createInputBufferFromObject;
