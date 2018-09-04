const _pow			= require( '../../pow.js' );
const _event_bus		= require( '../../event_bus.js' );
const _trustnote_pow_miner	= require( 'trustnote-pow-miner' );


//
// *	@param	{number}	oInput.roundIndex
// *	@param	{string}	oInput.currentFirstTrustMEBall
// *	@param	{string}	oInput.currentDifficulty
// *	@param	{string}	oInput.currentPubSeed
// *	@param	{string}	oInput.superNodeAuthor
//
let nDifficulty = _trustnote_pow_miner.difficulty256HexToUInt32( "00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" );


_event_bus.on
(
	'pow_mined_gift',
	( objSolution ) =>
	{
		console.log( `############################################################` );
		console.log( objSolution );
	}
);
_pow.startMiningWithInputs
(
	{
		roundIndex	: 111,
		currentFirstTrustMEBall	: 'rjywtuZ8A70vgIsZ7L4lBR3gz62Nl3vZr2t7I4lzsMU=',
		currentDifficulty	: nDifficulty,
		currentPubSeed		: 'public key',
		superNodeAuthor		: 'xing.supernode.trustnote.org',
	},
	function( err )
	{
		if ( err )
		{
			console.log( `failed to start calculation, `, err );
			return;
		}

		console.log( `start calculation successfully.` );
	}
);
