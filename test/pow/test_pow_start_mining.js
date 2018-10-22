/**
 * 	set process env
 */
process.env.ENV_UNIT_TEST	= true;


/**
 * 	...
 */
const _pow			= require( '../../pow/pow.js' );
const _event_bus		= require( '../../base/event_bus.js' );
const _trustnote_pow_miner	= require( 'trustnote-pow-miner' );


//
// *	@param	{number}	oInput.roundIndex
// *	@param	{string}	oInput.firstTrustMEBall
// *	@param	{string}	oInput.difficulty
// *	@param	{string}	oInput.publicSeed
// *	@param	{string}	oInput.superNodeAuthor
//
let nDifficulty		= _trustnote_pow_miner.difficulty256HexToUInt32( "0fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" );
let nMiningTimes	= 0;


_event_bus.on
(
	'pow_mined_gift',
	( objSolution ) =>
	{
		console.log( `### ${ Date.now() } ############################################################` );
		console.log( objSolution );
	}
);


function mining()
{
	console.log( `))) stopMining.` );
	_pow.stopMining( 1 );

	console.time( 'mining' );
	console.log( `))) will startMiningWithInputs.` );
	_pow.startMiningWithInputs
	(
		{
			roundIndex		: nMiningTimes + 1,
			firstTrustMEBall	: 'rjywtuZ8A70vgIsZ7L4lBR3gz62Nl3vZr2t7I4lzsMU=',
			difficulty		: nDifficulty,
			publicSeed		: 'public key',
			superNodeAuthor		: 'xing.supernode.trustnote.org',
		},
		function( err, oData )
		{
			console.log( `))) ${ Date.now() } callback : `, oData );

			if ( err )
			{
				console.log( `failed to start calculation, `, err );
				return;Î
			}

			console.timeEnd( 'mining' );
			console.log( `********************************************************************************` );
			console.log( `\n\n\n\n\n` );

			if ( nMiningTimes++ < 5 )
			{
				setTimeout
				(
					() =>
					{
						mining();
					},
					3000
				);
			}
		}
	);
}


mining();