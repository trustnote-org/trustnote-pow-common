/**
 * 	set process env
 */
process.env.ENV_UNIT_TEST	= true;


const _network		= require( '../../network.js' );


const _peer		= 'ws://dev.mainchain.pow.trustnote.org:9191';



/**
 * 	start here
 */
_network.connectToPeer( _peer, function( err, ws )
{
	console.log( `will request catchup from ${ ws.peer }` );
	_network.requestCatchup( ws );
});
