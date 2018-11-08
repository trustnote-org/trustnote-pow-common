/*jslint node: true */
"use strict";

/**
 *	@boss	XING
 */

const _conf		= require( '../config/conf.js' );
const _bBrowser		= typeof window !== 'undefined' && window;
const _bLight		= _conf.bLight;
const _bWallet		= _conf.bWallet;

const _crypto		= require( 'crypto' );
const _blakejs		= require( 'blakejs' );
const _async		= require( 'async' );
const _pow_miner	= (_bWallet && _bLight && _bBrowser) ? null : require( 'trustnote-pow-miner' );

const _constants	= require( '../config/constants.js' );
const _round		= require( '../pow/round.js' );
const _deposit		= require( '../sc/deposit.js' );
const _super_node	= require( '../wallet/supernode.js' );
const _event_bus	= require( '../base/event_bus.js' );
const _db		= require( '../db/db.js' );

const _bDebugModel	= _conf.debug;
const _bUnitTestEnv	= process.env && 'object' === typeof process.env && 'string' === typeof process.env.ENV_UNIT_TEST && 'true' === process.env.ENV_UNIT_TEST.toLowerCase();




/**
 * 	@author		XING
 * 	@datetime	2018/8/6 4:53 PM
 *
 * 	////////////////////////////////////////////////////////////
 *	@description
 *
 * 	Assume that this is the round N, the inputs of the round N+1 are:
 * 	1, unique coin-base units sorted by address from round (N-1)
 *	   arrCoinBaseList
 *	   [
 *		'address0'	: 20% of total amount,
 *		'address1'	: amount of coins,
 *		'address2'	: amount of coins,
 *		'address3'	: amount of coins,
 *		'address4'	: amount of coins,
 *		'address5'	: amount of coins,
 *		'address6'	: amount of coins,
 *		'address7'	: amount of coins,
 *		'address8'	: amount of coins,
 *	   ]
 *	   Note: the address0 came from TrustNote Foundation.
 *	2, ball address of the first TrustME unit from round (N)
 *	3, bits value of round (N)
 *	4, public seed of round (N)
 *	5, author address of current SuperNode.
 *
 *
 *	////////////////////////////////////////////////////////////
 *	@examples
 *
 * 	let bCallStartCalculation = startMining( oConn, function( err )
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
 *	let nCallStartCalculation = startMiningWithInputs
 *	(
 *		{
 *			roundIndex		: 111,
 *			firstTrustMEBall	: 'rjywtuZ8A70vgIsZ7L4lBR3gz62Nl3vZr2t7I4lzsMU=',
 *			bits			: 11111,
 *			publicSeed		: 'public key',
 *			superNodeAuthor		: 'xing.supernode.trustnote.org',
 *		},
 *		function( err )
 *		{
 * 			if ( err )
 * 			{
 * 				console.log( `failed to start calculation, `, err );
 * 				return;
 * 			}
 *
 * 			console.log( `start calculation successfully.` );
 * 		}
 *	);
 *
 *	checkProofOfWork
 *	(
 *		{
 *			roundIndex		: 111,
 *			firstTrustMEBall	: 'rjywtuZ8A70vgIsZ7L4lBR3gz62Nl3vZr2t7I4lzsMU=',
 *			bits			: 11111,
 *			publicSeed		: 'public key',
 *			superNodeAuthor		: 'xing.supernode.trustnote.org',
 *		},
 *		'00000001c570c4764aadb3f09895619f549000b8b51a789e7f58ea7500007097',
 *		88888,
 *		function( err, oResult )
 *		{
 *			if ( null === err )
 *			{
 *				if ( 0 === oResult.code )
 *				{
 *					console.log( `correct solution` );
 *				}
 *				else
 *				{
*					console.log( `invalid solution` );
 *				}
 *			}
 *			else
 *			{
 *				console.log( `occurred an error : `, err );
 *			}
 *		}
 *	);
 *
 */





/**
 *	start calculation
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	nRoundIndex
 *	@param	{function}	pfnCallback( err )
 *	@return {boolean}
 *
 * 	@description
 * 	start successfully	pfnCallback( null );
 * 	failed to start		pfnCallback( error );
 */
function startMining( oConn, nRoundIndex, pfnCallback )
{
	if ( ! oConn )
	{
		throw new Error( `call startMining with invalid oConn.` );
	}
	if ( 'number' !== typeof nRoundIndex )
	{
		throw new Error( `call startMining with invalid nRoundIndex.` );
	}
	if ( 'function' !== typeof pfnCallback )
	{
		//	arguments.callee.name
		throw new Error( `call startMining with invalid pfnCallback.` );
	}
	if ( _bDebugModel && ! _bUnitTestEnv )
	{
		return _startMiningInDebugModel( oConn, nRoundIndex, pfnCallback );
	}

	obtainMiningInput( oConn, nRoundIndex, function( err, objInput )
	{
		if ( err )
		{
			return pfnCallback( err );
		}

		//	...
		startMiningWithInputs( objInput, function( err )
		{
			if ( err )
			{
				return pfnCallback( err );
			}

			//
			//	successfully
			//
			pfnCallback( null );
		});
	});

	return true;
}
function _startMiningInDebugModel( oConn, nRoundIndex, pfnCallback )
{
	_round.getDifficultydByRoundIndex( oConn, nRoundIndex, function( nBits )
	{
		_round.getRoundInfoByRoundIndex( oConn, nRoundIndex, function( round_index, min_wl, sSeed )
		{
			let nTimeout = _generateRandomInteger( 120 * 1000, 180 * 1000 );
			setTimeout( () =>
			{
				_event_bus.emit
				(
					'pow_mined_gift',
					null,
					{
						round		: nRoundIndex,
						bits		: nBits,
						publicSeed	: sSeed,
						nonce		: _generateRandomInteger( 10000, 200000 ),
						hash		: _crypto.createHash( 'sha256' ).update( String( Date.now() ), 'utf8' ).digest( 'hex' )
					}
				);

			}, nTimeout );

			//	...
			pfnCallback( null );
		});
	});

	return true;
}



/**
 *	obtain mining input
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	uRoundIndex
 *	@param	{function}	pfnCallback( err )
 *	@return {boolean}
 *
 * 	@description
 * 	start successfully	pfnCallback( null, objInput );
 * 	failed to start		pfnCallback( error );
 */
function obtainMiningInput( oConn, uRoundIndex, pfnCallback )
{
	if ( ! oConn )
	{
		throw new Error( `call obtainMiningInput with invalid oConn.` );
	}
	if ( 'number' !== typeof uRoundIndex )
	{
		throw new Error( `call obtainMiningInput with invalid nRoundIndex.` );
	}
	if ( 'function' !== typeof pfnCallback )
	{
		//	arguments.callee.name
		throw new Error( `call obtainMiningInput with invalid pfnCallback.` );
	}

	let sCurrentFirstTrustMEBall	= null;
	let uCurrentBitsValue		= null;
	let sCurrentPublicSeed		= null;
	let sSuperNodeAuthorAddress	= null;
	let sDepositAddress		= null;
	let fDepositBalance		= null;

	_async.series
	([
		function( pfnNext )
		{
			//
			//	author address of this super node
			//
			_super_node.readSingleAddress( oConn, function( sAddress )
			{
				sSuperNodeAuthorAddress = sAddress;
				return pfnNext();
			});
		},
		function( pfnNext )
		{
			//
			//	get deposit address by super-node address
			//
			_deposit.getDepositAddressBySupernodeAddress( oConn, sSuperNodeAuthorAddress, ( err, sAddress ) =>
			{
				if ( err )
				{
					return pfnNext( err );
				}

				sDepositAddress	= sAddress;
				return pfnNext();
			});
		},
		function( pfnNext )
		{
			//
			//	get deposit amount by deposit address
			//
			_deposit.getBalanceOfDepositContract( oConn, sDepositAddress, uRoundIndex, ( err, fBanlance ) =>
			{
				if ( err )
				{
					return pfnNext( err );
				}

				fDepositBalance = fBanlance;
				return pfnNext();
			});
		},
		function( pfnNext )
		{
			//
			//	round (N)
			//	obtain ball address of the first TrustME unit from current round
			//
			_round.queryFirstTrustMEBallOnMainChainByRoundIndex( oConn, uRoundIndex, function( err, sBall )
			{
				if ( err )
				{
					return pfnNext( err );
				}

				sCurrentFirstTrustMEBall = sBall;
				return pfnNext();
			});
		},
		function( pfnNext )
		{
			//
			//	round (N)
			//	calculate public seed
			//
			_round.getRoundInfoByRoundIndex( oConn, uRoundIndex, function( round_index, min_wl, sSeed )
			{
				sCurrentPublicSeed = sSeed;
				return pfnNext();
			});
		},
		// function( pfnNext )
		// {
		// 	//
		// 	//	round (N)
		// 	//	calculate bits value
		// 	//
		// 	_round.getDifficultydByRoundIndex( oConn, uRoundIndex, function( nBits )
		// 	{
		// 		nCurrentBitsValue	= nBits;
		// 		return pfnNext();
		// 	});
		// },
		function( pfnNext )
		{
			//
			//	calculate bits value
			//
			calculateBitsValueByRoundIndexWithDeposit
			(
				oConn,
				uRoundIndex,
				fDepositBalance,
				( err, uSelfBits ) =>
				{
					if ( err )
					{
						return pfnCallback( err );
					}

					//	...
					uCurrentBitsValue = uSelfBits;
					return pfnNext();
				}
			);
		}
	], function( err )
	{
		if ( err )
		{
			return pfnCallback( err );
		}

		let objInput	= {
			roundIndex		: uRoundIndex,
			firstTrustMEBall	: sCurrentFirstTrustMEBall,
			bits			: uCurrentBitsValue,
			deposit			: fDepositBalance,
			publicSeed		: sCurrentPublicSeed,
			superNodeAuthor		: sSuperNodeAuthorAddress,
		};
		pfnCallback( null, objInput );
	});

	return true;
}


/**
 *	start calculation with inputs
 *
 * 	@param	{object}	oInput
 *	@param	{number}	oInput.roundIndex
 *	@param	{string}	oInput.firstTrustMEBall
 *	@param	{string}	oInput.bits
 *	@param	{string}	oInput.publicSeed
 *	@param	{string}	oInput.superNodeAuthor
 *	@param	{function}	pfnCallback( err )	will be called immediately while we start mining
 *	@return	{boolean}
 *
 * 	@events
 *
 * 	'pow_mined_gift'
 *
 * 		will post solution object through event bus while mining successfully
 *
 * 		[parameters]
 * 		err		- null if no error, otherwise a string contains error description,
 * 		objSolution	- solution object
 * 		{
 *			round		: oInput.roundIndex,
 *			bits		: oInput.bits,
 *			publicSeed	: oInput.publicSeed,
 *			nonce		: oData.nonce,
 *			hash		: oData.hashHex
 *		};
 */
function startMiningWithInputs( oInput, pfnCallback )
{
	console.log( `>***< will start mining with inputs : ${ JSON.stringify( oInput ) }` );

	if ( _bBrowser && ! _bWallet )
	{
		throw new Error( 'I am not be able to run in a Web Browser.' );
	}
	if ( 'object' !== typeof oInput )
	{
		throw new Error( 'call startMiningWithInputs with invalid oInput' );
	}
	if ( 'number' !== typeof oInput.roundIndex )
	{
		throw new Error( 'call startMiningWithInputs with invalid oInput.roundIndex' );
	}
	if ( 'string' !== typeof oInput.firstTrustMEBall || 44 !== oInput.firstTrustMEBall.length )
	{
		throw new Error( 'call startMiningWithInputs with invalid oInput.firstTrustMEBall' );
	}
	if ( 'number' !== typeof oInput.bits || oInput.bits < 0 )
	{
		throw new Error( 'call startMiningWithInputs with invalid oInput.bits' );
	}
	if ( 'string' !== typeof oInput.publicSeed || 0 === oInput.publicSeed.length )
	{
		throw new Error( 'call startMiningWithInputs with invalid oInput.publicSeed' );
	}
	if ( 'string' !== typeof oInput.superNodeAuthor || 0 === oInput.superNodeAuthor.length )
	{
		throw new Error( 'call startMiningWithInputs with invalid oInput.superNodeAuthor' );
	}
	if ( 'function' !== typeof pfnCallback )
	{
		throw new Error( `call startMiningWithInputs with invalid pfnCallback.` );
	}
	if ( _bDebugModel && ! _bUnitTestEnv )
	{
		return _startMiningWithInputs_debug( oInput, pfnCallback );
	}

	/**
	 *	start here
	 */
	let _oOptions	=
		{
			bufInputHeader	: _createMiningInputBufferFromObject( oInput ),
			bits		: oInput.bits,
			calcTimes	: ( 'number' === typeof oInput.calcTimes ? oInput.calcTimes : 30 ),
			maxLoop		: ( 'number' === typeof oInput.maxLoop ? oInput.maxLoop : 1000000 ),
		};
	console.log( `))) stopMining.` );
	_pow_miner.stopMining();

	console.log( `))) startMining with options : `, _oOptions );
	_pow_miner.startMining( _oOptions, function( err, oData )
	{
		let objSolution	= null;

		if ( null === err )
		{
			console.log( `))) startMining, callback data( ${ typeof oData } ) : `, oData );
			if ( oData && 'object' === typeof oData )
			{
				if ( oData.hasOwnProperty( 'win' ) && oData.win )
				{
					console.log( `pow-solution :: WINNER WINNER, CHICKEN DINNER!`, oData );
					objSolution	= {
						round		: oInput.roundIndex,
						selfBits	: oInput.bits,
						publicSeed	: oInput.publicSeed,
						nonce		: oData.nonce,
						hash		: oData.hashHex
					};
				}
				else if ( oData.hasOwnProperty( 'gameOver' ) && oData.gameOver )
				{
					err = `pow-solution :: game over!`;
				}
				else
				{
					err = `pow-solution :: unknown error!`;
				}
			}
			else
			{
				err = `pow-solution :: invalid data!`;
			}
		}

		//	...
		_event_bus.emit( 'pow_mined_gift', err, objSolution );

	});

	pfnCallback( null );
	return true;
}
function _startMiningWithInputs_debug( oInput, pfnCallback )
{
	let nTimeout = _generateRandomInteger( 120 * 1000, 180 * 1000 );
	setTimeout( () =>
	{
		_event_bus.emit
		(
			'pow_mined_gift',
			null,
			{
				round		: oInput.roundIndex,
				selfBits	: oInput.bits,
				publicSeed	: oInput.publicSeed,
				nonce		: _generateRandomInteger( 10000, 200000 ),
				hash		: _crypto.createHash( 'sha256' ).update( String( Date.now() ), 'utf8' ).digest( 'hex' )
			}
		);

	}, nTimeout );

	//	...
	pfnCallback( null );
	return true;
}




/**
 *	verify if a solution( hash, nonce ) is valid
 *
 * 	@param	{object}	objInput
 *	@param	{number}	objInput.roundIndex
 *	@param	{string}	objInput.firstTrustMEBall
 *	@param	{string}	objInput.bits
 *	@param	{string}	objInput.publicSeed
 *	@param	{string}	objInput.superNodeAuthor
 *	@param	{number}	objInput.deposit
 *	@param	{string}	sHash				hex string with the length of 64 bytes,
 *								e.g.: '3270bcfd5d77014d85208e39d8608154c89ea10b51a1ba668bc87193340cdd67'
 *	@param	{number}	nNonce				number with the value great then or equal to 0
 *	@param	{function}	pfnCallback( err, { code : 0 } )
 *				err will be null and code will be 0 if the PoW was checked as valid
 *				otherwise, error info will be returned by err
 *	@return	{boolean}
 */
function checkProofOfWork( objInput, sHash, nNonce, pfnCallback )
{
	if ( _bBrowser && !_bWallet )
	{
		throw new Error( 'I am not be able to run in a Web Browser.' );
	}
	if ( ! objInput || 'object' !== typeof objInput )
	{
		throw new Error( 'call checkProofOfWork with invalid objInput' );
	}
	if ( ! _isValidRoundIndex( objInput.roundIndex ) )
	{
		throw new Error( 'call checkProofOfWork with invalid objInput.roundIndex' );
	}
	if ( 'number' !== typeof objInput.deposit )
	{
		throw new Error( 'call checkProofOfWork with invalid objInput.deposit' );
	}
	if ( 'string' !== typeof sHash || 64 !== sHash.length )
	{
		throw new Error( 'call checkProofOfWork with invalid sHash' );
	}
	if ( 'number' !== typeof nNonce )
	{
		throw new Error( 'call checkProofOfWork with invalid sNonce' );
	}
	if ( _bDebugModel && ! _bUnitTestEnv )
	{
		return pfnCallback( null, { code : 0 } );
	}

	//
	//	check proof of work with self bits
	//
	calculateBitsValueByRoundIndexWithDeposit
	(
		_db,
		objInput.roundIndex,
		objInput.deposit,
		( err, uSelfBits ) =>
		{
			if ( err )
			{
				return pfnCallback( err );
			}

			//	...
			let objSelfInput = Object.assign( {}, objInput, { bits : uSelfBits } );
			_pow_miner.checkProofOfWork
			(
				_createMiningInputBufferFromObject( objSelfInput ),
				objSelfInput.bits,
				nNonce,
				sHash,
				pfnCallback
			);
		}
	);
}

/**
 *	stop mining
 *	@param	{number}	nRoundIndex
 *	@return	{boolean}
 */
function stopMining( nRoundIndex )
{
	if ( _bBrowser && !_bWallet )
	{
		throw new Error( 'I am not be able to run in a Web Browser.' );
	}
	if ( 'number' !== typeof nRoundIndex || nRoundIndex < 1 )
	{
		return false;
	}

	//	stop
	_pow_miner.stopMining();

	//	...
	return true;
}


/**
 * 	calculate public seed by round index
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	nRoundIndex
 *				round 1
 *					hard code
 *				round 2
 *					previous seed
 *					[]
 *					TrustME Ball
 *				round	3
 *					previous seed
 *					[]
 *					TrustME Ball
 *
 * 	@param	{function}	pfnCallback( err, sSeed )
 *
 * 	@documentation
 *	https://github.com/trustnote/document/blob/master/TrustNote-TR-2018-02.md#PoW-Unit
 *
 * 	pubSeed(i)	= blake2s256
 * 		(
 * 			pubSeed(i-1) + hash( Coin-base(i-2) ) + hash( FirstStableMCUnit(i-1) )
 * 		)
 */
function calculatePublicSeedByRoundIndex( oConn, nRoundIndex, pfnCallback )
{
	if ( ! oConn )
	{
		return pfnCallback( `call calculatePublicSeedByRoundIndex with invalid oConn` );
	}
	if ( 'number' !== typeof nRoundIndex )
	{
		return pfnCallback( `call calculatePublicSeedByRoundIndex with invalid nRoundIndex` );
	}
	if ( nRoundIndex <= 1 )
	{
		//
		//	round 1
		//		hard code
		//
		return pfnCallback( null, _blakejs.blake2sHex( _constants.GENESIS_UNIT ) );
	}

	let sPreviousPublicSeed		= null;
	let arrPrePreviousCoinBase	= null;
	let sPreviousTrustMEBall	= null;

	_async.series
	([
		function( pfnNext )
		{
			//	public seed
			queryPublicSeedByRoundIndex( oConn, nRoundIndex - 1, function( err, sSeed )
			{
				if ( err )
				{
					return pfnNext( err );
				}
				if ( 'string' !== typeof sSeed || 0 === sSeed.length )
				{
					return pfnNext( `calculatePublicSeedByRoundIndex got invalid sSeed.` );
				}

				sPreviousPublicSeed = sSeed;
				return pfnNext();
			} );
		},
		function( pfnNext )
		{
			//	coin base
			if ( 2 === nRoundIndex )
			{
				arrPrePreviousCoinBase = [];
				return pfnNext();
			}

			//	...
			_round.queryCoinBaseListByRoundIndex( oConn, nRoundIndex - 1, function( err, arrCoinBaseList )
			{
				if ( err )
				{
					return pfnNext( err );
				}
				if ( ! Array.isArray( arrCoinBaseList ) )
				{
					return pfnNext( 'empty coin base list' );
				}
				if ( _constants.COUNT_WITNESSES !== arrCoinBaseList.length )
				{
					return pfnNext( 'no enough coin base units.' );
				}

				arrPrePreviousCoinBase = arrCoinBaseList;
				return pfnNext();
			} );
		},
		function( pfnNext )
		{
			//	first ball
			_round.queryFirstTrustMEBallOnMainChainByRoundIndex( oConn, nRoundIndex - 1, function( err, sBall )
			{
				if ( err )
				{
					return pfnNext( err );
				}
				if ( 'string' !== typeof sBall || 0 === sBall.length )
				{
					return pfnNext( `calculatePublicSeedByRoundIndex got invalid sBall.` );
				}

				sPreviousTrustMEBall = sBall;
				return pfnNext();
			} );
		}
	], function( err )
	{
		if ( err )
		{
			return pfnCallback( err );
		}

		//	...
		let sSource = ""
		+ sPreviousPublicSeed
		+ _crypto.createHash( 'sha512' ).update( JSON.stringify( arrPrePreviousCoinBase ), 'utf8' ).digest();
		+ _crypto.createHash( 'sha512' ).update( sPreviousTrustMEBall, 'utf8' ).digest();

		pfnCallback( null, _blakejs.blake2sHex( sSource ) );
	});
}


/**
 *	get public seed by round index
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	nRoundIndex
 *	@param	{function}	pfnCallback( err, arrCoinBaseList )
 */
function queryPublicSeedByRoundIndex( oConn, nRoundIndex, pfnCallback )
{
	if ( ! oConn )
	{
		return pfnCallback( `call queryPublicSeedByRoundIndex with invalid oConn` );
	}
	if ( 'number' !== typeof nRoundIndex || nRoundIndex <= 0 )
	{
		return pfnCallback( `call queryPublicSeedByRoundIndex with invalid nRoundIndex` );
	}

	oConn.query
	(
		"SELECT seed \
		FROM round \
		WHERE round_index = ?",
		[
			nRoundIndex
		],
		function( arrRows )
		{
			if ( 0 === arrRows.length )
			{
				return pfnCallback( `seed not found.` );
			}

			return pfnCallback( null, arrRows[ 0 ][ 'seed' ] );
		}
	);
}


/**
 *	query bits value by round index from database
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	uCycleIndex
 *	@param	{function}	pfnCallback( err, nBitsValue )
 */
function queryBitsValueByCycleIndex( oConn, uCycleIndex, pfnCallback )
{
	if ( ! oConn )
	{
		return pfnCallback( `call queryBitsValueByCycleIndex with invalid oConn` );
	}
	if ( 'number' !== typeof uCycleIndex || uCycleIndex <= 0 )
	{
		return pfnCallback( `call queryBitsValueByCycleIndex with invalid uCycleIndex` );
	}

	oConn.query
	(
		"SELECT bits \
		FROM round_cycle \
		WHERE cycle_id = ?",
		[
			_round.getCycleIdByRoundIndex( uCycleIndex )
		],
		function( arrRows )
		{
			if ( 0 === arrRows.length )
			{
				return pfnCallback( `bits not found in table [round_cycle].` );
			}

			return pfnCallback( null, parseInt( arrRows[ 0 ][ 'bits' ] ) );
		}
	);
}


/**
 *	calculate bits value
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	uCycleIndex		- index of new round
 * 	@param	{function}	pfnCallback( err, nNewBitsValue )
 */
function calculateBitsValueByCycleIndex( oConn, uCycleIndex, pfnCallback )
{
	if ( ! oConn )
	{
		return pfnCallback( `call calculateBitsValueByCycleIndex with invalid oConn` );
	}
	if ( 'number' !== typeof uCycleIndex || uCycleIndex < 1 )
	{
		return pfnCallback( `call calculateBitsValueByCycleIndex with invalid uCycleIndex` );
	}

	let nAverageBits;
	let nTimeUsed;
	let nTimeStandard;

	//
	//	return bits value of cycle 1,
	//	if uCycleIndex <= _constants.COUNT_CYCLES_FOR_DIFFICULTY_DURATION
	//
	if ( uCycleIndex <= _constants.COUNT_CYCLES_FOR_DIFFICULTY_DURATION + 1 )
	{
		return queryBitsValueByCycleIndex
		(
			oConn,
			1,
			function( err, nBits )
			{
				if ( err )
				{
					return pfnCallback( err );
				}

				return pfnCallback( null, nBits );
			}
		);
	}

	//	...
	_async.series
	([
		function( pfnNext )
		{
			_round.getAverageDifficultyByCycleId
			(
				oConn,
				uCycleIndex - 1,
				function( nBits )
				{
					nAverageBits = nBits;
					return pfnNext();
				}
			);
		},
		function( pfnNext )
		{
			//	in seconds
			_round.getDurationByCycleId
			(
				oConn,
				uCycleIndex - 1,
				function( nTimeUsedInSecond )
				{
					console.log( `%%% _round.getDurationByCycleId, nTimeUsedInSecond = ${ nTimeUsedInSecond }` );

					//	...
					if ( 'number' === typeof nTimeUsedInSecond &&
						nTimeUsedInSecond > 0 )
					{
						//
						//	to be continued ...
						//
						nTimeUsed = nTimeUsedInSecond;
						return pfnNext();
					}
					else
					{
						//
						//	STOP HERE,
						//	return bits value of previous cycle
						//
						return queryBitsValueByCycleIndex
						(
							oConn,
							uCycleIndex - 1,
							function( err, nBits )
							{
								if ( err )
								{
									return pfnNext( err );
								}

								//	...
								//	bits of previous cycle
								//
								return pfnCallback( null, nBits );
							}
						);
					}
				}
			);
		},
		function( pfnNext )
		{
			//
			//	in seconds
			//
			nTimeStandard = _round.getStandardDuration();
			return pfnNext();
		}
	], function( err )
	{
		if ( err )
		{
			return pfnCallback( err );
		}

		//
		//	calculate next bits
		//
		_pow_miner.calculateNextWorkRequired
		(
			nAverageBits,
			nTimeUsed,
			nTimeStandard,
			function( err, oData )
			{
				//
				//	oData
				//	{ bits : uNextBits }
				//
				if ( err )
				{
					return pfnCallback( err );
				}

				if ( oData &&
					'object' === typeof oData )
				{
					if ( oData.hasOwnProperty( 'bits' ) &&
						'number' === typeof oData.bits &&
						oData.bits > 0 )
					{
						pfnCallback( null, oData.bits );
					}
					else
					{
						pfnCallback( `calculateNextWorkRequired callback :: invalid value .bits, oData = ${ JSON.stringify( oData ) }` );
					}
				}
				else
				{
					pfnCallback( `calculateNextWorkRequired callback :: invalid oData object` );
				}
			}
		);
	});
}


/**
 *	calculate bits value
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	uRoundIndex		- index of new round
 *	@param	{number}	dblDeposit		- index of new round
 * 	@param	{function}	pfnCallback( err, nNewBitsValue )
 */
function calculateBitsValueByRoundIndexWithDeposit( oConn, uRoundIndex, dblDeposit, pfnCallback )
{
	if ( ! oConn )
	{
		return pfnCallback( `call calculateBitsValueByRoundIndexWithDeposit with invalid oConn` );
	}
	if ( 'number' !== typeof uRoundIndex || uRoundIndex < 1 )
	{
		return pfnCallback( `call calculateBitsValueByRoundIndexWithDeposit with invalid uRoundIndex` );
	}
	if ( 'number' !== typeof dblDeposit )
	{
		return pfnCallback( `call calculateBitsValueByRoundIndexWithDeposit with invalid dblDeposit` );
	}

	let uCycleIndex;
	let uAverageBits;
	let uTimeUsed;
	let uTimeStandard;

	//	...
	uCycleIndex	= _round.getCycleIdByRoundIndex( uRoundIndex );

	//
	//	return bits value of cycle 1,
	//	if uCycleIndex <= _constants.COUNT_CYCLES_FOR_DIFFICULTY_DURATION
	//
	if ( uCycleIndex <= _constants.COUNT_CYCLES_FOR_DIFFICULTY_DURATION + 1 )
	{
		return queryBitsValueByCycleIndex
		(
			oConn,
			1,
			function( err, uBits )
			{
				if ( err )
				{
					return pfnCallback( err );
				}

				return pfnCallback( null, uBits );
			}
		);
	}

	//	...
	_async.series
	([
		function( pfnNext )
		{
			_round.getAverageDifficultyByCycleId
			(
				oConn,
				uCycleIndex - 1,
				function( uBits )
				{
					uAverageBits = uBits;
					return pfnNext();
				}
			);
		},
		function( pfnNext )
		{
			//	in seconds
			_round.getDurationByCycleId
			(
				oConn,
				uCycleIndex - 1,
				function( uTimeUsedInSeconds )
				{
					console.log( `%%% _round.getDurationByCycleId, uTimeUsedInSeconds = ${ uTimeUsedInSeconds }` );

					//	...
					if ( 'number' === typeof uTimeUsedInSeconds &&
						uTimeUsedInSeconds > 0 )
					{
						//
						//	to be continued ...
						//
						uTimeUsed = uTimeUsedInSeconds;
						return pfnNext();
					}
					else
					{
						//
						//	STOP HERE,
						//	return bits value of previous cycle
						//
						return queryBitsValueByCycleIndex
						(
							oConn,
							uCycleIndex - 1,
							function( err, uBits )
							{
								if ( err )
								{
									return pfnNext( err );
								}

								//	...
								//	bits of previous cycle
								//
								return pfnCallback( null, uBits );
							}
						);
					}
				}
			);
		},
		function( pfnNext )
		{
			//
			//	in seconds
			//
			uTimeStandard = _round.getStandardDuration();
			return pfnNext();
		}
	], function( err )
	{
		if ( err )
		{
			return pfnCallback( err );
		}

		let oInputParameters	= {
			uAverageBits	: uAverageBits,
			uTimeUsed	: uTimeUsed,
			uTimeStandard	: uTimeStandard,
			dblDeposit	: dblDeposit,
			uRoundIndex	: uRoundIndex,
		};
		console.log( `>***< will call _pow_miner.calculateNextWorkRequiredWithDeposit with inputs : ${ JSON.stringify( oInputParameters ) }` );

		//
		//	calculate next bits
		//
		_pow_miner.calculateNextWorkRequiredWithDeposit
		(
			uAverageBits,
			uTimeUsed,
			uTimeStandard,
			dblDeposit,
			uRoundIndex,
			function( err, oData )
			{
				console.log( `>***< got err: ${ JSON.stringify( err ) }, oData: ${ JSON.stringify( oData ) } from _pow_miner.calculateNextWorkRequiredWithDeposit.` );

				//
				//	oData
				//	{ bits : uNextBits, shiftByDeposit : 0, shiftByRoundIndex : 0 }
				//
				if ( err )
				{
					return pfnCallback( err );
				}

				if ( oData &&
					'object' === typeof oData )
				{
					if ( oData.hasOwnProperty( 'bits' ) &&
						'number' === typeof oData.bits &&
						oData.bits >= 0 )
					{
						pfnCallback( null, oData.bits, oData.shiftByDeposit, oData.shiftByRoundIndex );
					}
					else
					{
						pfnCallback( `calculateNextWorkRequiredWithDeposit callback :: invalid value .bits, oInputParameters = ${ JSON.stringify( oInputParameters ) }, oData = ${ JSON.stringify( oData ) }` );
					}
				}
				else
				{
					pfnCallback( `calculateNextWorkRequiredWithDeposit callback :: invalid oData object, oInputParameters = ${ JSON.stringify( oInputParameters ) }` );
				}
			}
		);
	});
}


/**
 *	create an input buffer with length of 140 from Js plain object
 *	@public
 *	@param	{object}	objInput
 *	@return	{Buffer}
 */
function _createMiningInputBufferFromObject( objInput )
{
	let objInputCpy;
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
	objInputCpy	= {
		roundIndex		: objInput.roundIndex,
		firstTrustMEBall	: objInput.firstTrustMEBall,
		bits			: objInput.bits,
		publicSeed		: objInput.publicSeed,
		superNodeAuthor		: objInput.superNodeAuthor,
	};
	sInput		= JSON.stringify( objInputCpy );
	bufSha512	= _crypto.createHash( 'sha512' ).update( sInput, 'utf8' ).digest();
	bufMd5		= _crypto.createHash( 'md5' ).update( sInput, 'utf8' ).digest();
	bufRmd160	= _crypto.createHash( 'rmd160' ).update( sInput, 'utf8' ).digest();
	bufSha384	= _crypto.createHash( 'sha384' ).update( sInput, 'utf8' ).digest();

	return Buffer.concat( [ bufSha512, bufMd5, bufRmd160, bufSha384 ], 140 );
}


/**
 *	generate random integer
 *
 *	@private
 *	@param	{number}	nMin
 *	@param	{number}	nMax
 *	@returns {*}
 */
function _generateRandomInteger( nMin, nMax )
{
	return Math.floor( Math.random() * ( nMax + 1 - nMin ) ) + nMin;
}

/**
 *	check if the vValue is a valid round index
 *	@param	{number}	vValue
 *	@return {boolean}
 *	@private
 */
function _isValidRoundIndex( vValue )
{
	return 'number' === typeof vValue && vValue > 0;
}






/**
 *	@exports
 */
module.exports.startMining					= startMining;
module.exports.obtainMiningInput				= obtainMiningInput;
module.exports.startMiningWithInputs				= startMiningWithInputs;
module.exports.stopMining					= stopMining;

module.exports.calculatePublicSeedByRoundIndex			= calculatePublicSeedByRoundIndex;
module.exports.calculateBitsValueByCycleIndex			= calculateBitsValueByCycleIndex;
module.exports.calculateBitsValueByRoundIndexWithDeposit	= calculateBitsValueByRoundIndexWithDeposit;

module.exports.queryPublicSeedByRoundIndex			= queryPublicSeedByRoundIndex;

module.exports.checkProofOfWork					= checkProofOfWork;
