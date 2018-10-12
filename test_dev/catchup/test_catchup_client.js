/**
 * 	set process env
 */
process.env.ENV_UNIT_TEST	= true;


const _network		= require( '../../network.js' );
const _catchup		= require( '../../catchup.js' );
const _event_bus	= require( '../../event_bus.js' );

const _arrPeerList	= [
	'ws://dev.mainchain.pow.trustnote.org:9191',
	'ws://test.mainchain.pow.trustnote.org:9191',
	'ws://127.0.0.1:9191'
];
const _peer		= _arrPeerList[ 1 ];



/**
 * 	start here
 */
_network.connectToPeer( _peer, function( err, ws )
{
	console.log( `will request catchup from ${ ws.peer }` );
	_network.requestCatchup_Dev( ws, { last_stable_mci: 0, last_known_mci: 0 } );
});



_event_bus.on( 'updated_last_round_index_from_peers', ( nLastRoundIndexFromPeers ) =>
{
	console.log( `================================================================================` );
	console.log( `================================================================================` );
	console.log( `RECEIVED updated_last_round_index_from_peers with value: ${ nLastRoundIndexFromPeers }` );
	console.log( `================================================================================` );
	console.log( `================================================================================` );
});

setInterval( () =>
{
	console.log( `### catchup getLastRoundIndexFromPeers : ${ _catchup.getLastRoundIndexFromPeers() }.` );

}, 1000 );
