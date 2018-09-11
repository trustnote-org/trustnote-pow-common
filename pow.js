/*jslint node: true */
"use strict";

/**
 *	@boss	XING
 */
const _bBrowser		= typeof window !== 'undefined' && window;

const _conf		= require( './conf.js' );

const _crypto		= require( 'crypto' );
const _blakejs		= require( 'blakejs' );
const _async		= require( 'async' );
const _pow_miner	= _bBrowser ? null : require( 'trustnote-pow-miner' );

const _constants	= require( './constants.js' );
const _round		= require( './round.js' );
const _super_node	= require( './supernode.js' );
const _event_bus	= require( './event_bus.js' );



/**
 * 	@global
 *	@variables
 */
let _objDifficultyAdjust	= null;
let _sAssocSingleWallet		= null;


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
 *	3, difficulty value of round (N)
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
 *			difficulty		: 11111,
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
 *			difficulty		: 11111,
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
	if ( _conf.debug )
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
	_round.getDifficultydByRoundIndex( oConn, nRoundIndex, function( nDifficulty )
	{
		_round.getRoundInfoByRoundIndex( oConn, nRoundIndex, function( round_index, min_wl, max_wl, sSeed )
		{
			setTimeout( () =>
			{
				_event_bus.emit
				(
					'pow_mined_gift',
					{
						round		: nRoundIndex,
						difficulty	: nDifficulty,
						publicSeed	: sSeed,
						nonce		: _generateRandomInteger( 10000, 200000 ),
						hash		: _crypto.createHash( 'sha256' ).update( String( Date.now() ), 'utf8' ).digest( 'hex' )
					}
				);
			}, _generateRandomInteger( 10 * 1000, 30 * 1000 ) );

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
 *	@param	{number}	nRoundIndex
 *	@param	{function}	pfnCallback( err )
 *	@return {boolean}
 *
 * 	@description
 * 	start successfully	pfnCallback( null, objInput );
 * 	failed to start		pfnCallback( error );
 */
function obtainMiningInput( oConn, nRoundIndex, pfnCallback )
{
	if ( ! oConn )
	{
		throw new Error( `call obtainMiningInput with invalid oConn.` );
	}
	if ( 'number' !== typeof nRoundIndex )
	{
		throw new Error( `call obtainMiningInput with invalid nRoundIndex.` );
	}
	if ( 'function' !== typeof pfnCallback )
	{
		//	arguments.callee.name
		throw new Error( `call obtainMiningInput with invalid pfnCallback.` );
	}

	let sCurrentFirstTrustMEBall	= null;
	let nCurrentDifficultyValue	= null;
	let sCurrentPublicSeed		= null;
	let sSuperNodeAuthorAddress	= null;

	_async.series
	([
		function( pfnNext )
		{
			//
			//	author address of this super node
			//
			_super_node.readSingleAddress( function( sAddress )
			{
				sSuperNodeAuthorAddress = sAddress;
				return pfnNext();
			});
		},
		function( pfnNext )
		{
			//
			//	round (N)
			//	obtain ball address of the first TrustME unit from current round
			//
			_round.queryFirstTrustMEBallOnMainChainByRoundIndex( oConn, nRoundIndex, function( err, sBall )
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
			//	calculate difficulty value
			//
			_round.getDifficultydByRoundIndex( oConn, nRoundIndex, function( nDifficulty )
			{
				nCurrentDifficultyValue	= nDifficulty;
				return pfnNext();
			});
		},
		function( pfnNext )
		{
			//
			//	round (N)
			//	calculate public seed
			//
			_round.getRoundInfoByRoundIndex( oConn, nRoundIndex, function( round_index, min_wl, max_wl, sSeed )
			{
				sCurrentPublicSeed = sSeed;
				return pfnNext();
			});
		}
	], function( err )
	{
		if ( err )
		{
			return pfnCallback( err );
		}

		let objInput	= {
			roundIndex		: nRoundIndex,
			firstTrustMEBall	: sCurrentFirstTrustMEBall,
			difficulty		: nCurrentDifficultyValue,
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
 *	@param	{string}	oInput.difficulty
 *	@param	{string}	oInput.publicSeed
 *	@param	{string}	oInput.superNodeAuthor
 *	@param	{function}	pfnCallback( err )
 *	@return	{boolean}
 *
 * 	@events
 *
 * 	'pow_mined_gift'
 *
 * 		will return solution object for success
 * 		{
 *			round		: oInput.roundIndex,
 *			difficulty	: oInput.difficulty,
 *			publicSeed	: oInput.publicSeed,
 *			nonce		: oData.nonce,
 *			hash		: oData.hashHex
 *		};
 *
 *		or an error occurred
 *		{
 *			err : `INVALID DATA! ...`
 *		};
 */
function startMiningWithInputs( oInput, pfnCallback )
{
	if ( _bBrowser )
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
	if ( 'number' !== typeof oInput.difficulty || oInput.difficulty <= 0 )
	{
		throw new Error( 'call startMiningWithInputs with invalid oInput.difficulty' );
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
	if ( _conf.debug )
	{
		return _startMiningWithInputsInDebugModel( oInput, pfnCallback );
	}

	/**
	 *	start here
	 */
	let _oOptions	=
		{
			bufInputHeader	: _createMiningInputBufferFromObject( oInput ),
			difficulty	: oInput.difficulty,
			calcTimes	: ( 'number' === typeof oInput.calcTimes ? oInput.calcTimes : 30 ),
			maxLoop		: ( 'number' === typeof oInput.maxLoop ? oInput.maxLoop : 1000000 ),
		};
	_pow_miner.stopMining();
	_pow_miner.startMining( _oOptions, function( err, oData )
	{
		if ( null === err )
		{
			if ( 'object' === typeof oData )
			{
				if ( oData.win )
				{
					console.log( `pow-solution :: WINNER WINNER, CHICKEN DINNER!`, oData );
					let objSolution	= {
						round		: oInput.roundIndex,
						difficulty	: oInput.difficulty,
						publicSeed	: oInput.publicSeed,
						nonce		: oData.nonce,
						hash		: oData.hashHex
					};
					_event_bus.emit( 'pow_mined_gift', objSolution );
				}
				else if ( oData.gameOver )
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

		return pfnCallback( err );
	});

	return true;
}
function _startMiningWithInputsInDebugModel( oInput, pfnCallback )
{
	setTimeout( () =>
	{
		_event_bus.emit
		(
			'pow_mined_gift',
			{
				round		: oInput.roundIndex,
				difficulty	: oInput.difficulty,
				publicSeed	: oInput.publicSeed,
				nonce		: _generateRandomInteger( 10000, 200000 ),
				hash		: _crypto.createHash( 'sha256' ).update( String( Date.now() ), 'utf8' ).digest( 'hex' )
			}
		);
	}, _generateRandomInteger( 10 * 1000, 30 * 1000 ) );

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
 *	@param	{string}	objInput.difficulty
 *	@param	{string}	objInput.publicSeed
 *	@param	{string}	objInput.superNodeAuthor
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
	if ( _bBrowser )
	{
		throw new Error( 'I am not be able to run in a Web Browser.' );
	}
	if ( 'object' !== typeof objInput )
	{
		throw new Error( 'call checkProofOfWork with invalid objInput' );
	}
	if ( 'string' !== typeof sHash || 64 !== sHash.length )
	{
		throw new Error( 'call checkProofOfWork with invalid sHash' );
	}
	if ( 'number' !== typeof nNonce )
	{
		throw new Error( 'call checkProofOfWork with invalid sNonce' );
	}
	if ( _conf.debug )
	{
		return pfnCallback( null, { code : 0 } );
	}

	//	...
	_pow_miner.checkProofOfWork
	(
		_createMiningInputBufferFromObject( objInput ),
		objInput.difficulty,
		nNonce,
		sHash,
		pfnCallback
	);
}

/**
 *	stop mining
 *	@param	{number}	nRoundIndex
 *	@return	{boolean}
 */
function stopMining( nRoundIndex )
{
	if ( _bBrowser )
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
 *	query difficulty value by round index from database
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	nCycleIndex
 *	@param	{function}	pfnCallback( err, nDifficultyValue )
 */
function queryDifficultyValueByCycleIndex( oConn, nCycleIndex, pfnCallback )
{
	if ( ! oConn )
	{
		return pfnCallback( `call queryDifficultyValueByRoundIndex with invalid oConn` );
	}
	if ( 'number' !== typeof nCycleIndex || nCycleIndex <= 0 )
	{
		return pfnCallback( `call queryDifficultyValueByCycleIndex with invalid nCycleIndex` );
	}

	oConn.query
	(
		"SELECT difficulty \
		FROM round_cycle \
		WHERE cycle_id = ?",
		[
			_round.getCycleIdByRoundIndex( nCycleIndex )
		],
		function( arrRows )
		{
			if ( 0 === arrRows.length )
			{
				return pfnCallback( `difficulty not found in table [round_cycle].` );
			}

			return pfnCallback( null, parseInt( arrRows[ 0 ][ 'difficulty' ] ) );
		}
	);
}


/**
 *	calculate difficulty value
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	nCycleIndex		- index of new round
 * 	@param	{function}	pfnCallback( err, nNewDifficultyValue )
 */
function calculateDifficultyValueByCycleIndex( oConn, nCycleIndex, pfnCallback )
{
	if ( ! oConn )
	{
		return pfnCallback( `call calculateDifficultyValue with invalid oConn` );
	}
	if ( 'number' !== typeof nCycleIndex || nCycleIndex <= 0 )
	{
		return pfnCallback( `call calculateDifficultyValue with invalid nCycleIndex` );
	}
	if ( _conf.debug )
	{
		return pfnCallback( null, ( Math.random() * ( 9999 - 1000 ) + 1000 ) );
	}

	let nPreviousDifficulty;
	let nTimeUsed;
	let nTimeStandard;

	_async.series
	([
		function( pfnNext )
		{
			queryDifficultyValueByCycleIndex
			(
				oConn,
				nCycleIndex - 1,
				function( err, nDifficulty )
				{
					nPreviousDifficulty = nDifficulty;
					return pfnNext();
				}
			);
		},
		function( pfnNext )
		{
			//	in seconds
			_round.getDurationByCycleId( oConn, nCycleIndex, function( nTimeUsedInMillisecond )
			{
				nTimeUsed = Math.floor( nTimeUsedInMillisecond / 1000 );
				return pfnNext();
			});
		},
		function( pfnNext )
		{
			//	in seconds
			nTimeStandard = _constants.DURATION_PER_ROUND * _constants.COUNT_ROUNDS_FOR_DIFFICULTY_SWITCH;
			return pfnNext();
		}
	], function( err )
	{
		if ( err )
		{
			return pfnCallback( err );
		}

		let nNewDifficultyValue = _objDifficultyAdjust.CalculateNextWorkRequired
		(
			nPreviousDifficulty,
			nTimeUsed,
			nTimeStandard
		);

		pfnCallback( null, Math.floor( nNewDifficultyValue ) );
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
		difficulty		: objInput.difficulty,
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
 *	read single wallet
 *
 *	@private
 *	@param	{function}	pfnCallback( sAddress )
 *	@return {*}
 */
function _readSingleWallet( pfnCallback )
{
	if ( 'string' === typeof _sAssocSingleWallet && 44 === _sAssocSingleWallet.length )
	{
		return pfnCallback( _sAssocSingleWallet );
	}

	return _super_node.readSingleAddress( sAddress =>
	{
		pfnCallback( sAddress );
	});
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
 *	@exports
 */
module.exports.startMining					= startMining;
module.exports.obtainMiningInput				= obtainMiningInput;
module.exports.startMiningWithInputs				= startMiningWithInputs;
module.exports.stopMining					= stopMining;

module.exports.calculatePublicSeedByRoundIndex			= calculatePublicSeedByRoundIndex;
module.exports.calculateDifficultyValueByCycleIndex		= calculateDifficultyValueByCycleIndex;

module.exports.queryPublicSeedByRoundIndex			= queryPublicSeedByRoundIndex;

module.exports.checkProofOfWork					= checkProofOfWork;
