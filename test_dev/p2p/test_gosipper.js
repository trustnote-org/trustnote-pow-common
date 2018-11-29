const { Gossiper }	= require( '../../p2p/gossiper.js' );
const _pow_service	= require( '../../pow/pow_service.js' );

let _servicePort	= 50000;

if ( Array.isArray( process.argv ) && process.argv.length >= 3 )
{
	_servicePort	= parseInt( process.argv[ 2 ] );
}



/**
 *	options
 */
const _oOptions		= {
	port		: _servicePort,
	onStart		: ( err, oWsServer ) =>
	{
		if ( err )
		{
			return console.error( err );
		}

		console.log( `TEST >> socket server started:${ oWsServer }.` );
		console.log(
			oWsServer.options.host,
			oWsServer.options.port,
			oWsServer.options.handleProtocols,
			oWsServer.options.path );
	},
	onConnection	: ( err, oWs ) =>
	{
		if ( err )
		{
			return console.error( err );
		}

		console.log( `TEST >> a new client connected in.` );
	},
	onMessage	: ( oWs, sMessage ) =>
	{
		console.log( `TEST >> received a message: ${ sMessage }` );
	},
	onError		: ( oWs, vError ) =>
	{
		console.error( `TEST >> occurred an error: `, vError );
	},
	onClose		: ( oWs, sReason ) =>
	{
		console.log( `TEST >> socket was closed(${ sReason })` );
	}
};
_pow_service.server.createServer( _oOptions );





let oOptions	= {
	interval	: 1000,
	url		: `wss://127.0.0.1:${ _servicePort }`,
	address		: 'xxxxxxxxxx',
	signer		: ( sMessage ) =>
	{
	}
};
let oGossiper	= new Gossiper( oOptions );

oGossiper.on( 'peer_update', ( sPeerUrl, sKey, vValue ) =>
{
	console.log( `[peer_update] :: `, sPeerUrl, sKey, vValue );
});
oGossiper.on( 'peer_alive', ( sPeerUrl ) =>
{
	console.log( `[peer_alive] :: `, sPeerUrl );
});
oGossiper.on( 'peer_failed', ( sPeerUrl ) =>
{
	console.log( `[peer_failed] :: `, sPeerUrl );
});

oGossiper.on( 'new_peer', ( sPeerUrl ) =>
{
	console.log( `[new_peer] :: `, sPeerUrl );
});


oGossiper.start({
	'wss://127.0.0.1:50001'	: null,
	'wss://127.0.0.1:50002'	: null,
	'wss://127.0.0.1:50003'	: null,
});


setTimeout
(
	() =>
	{
		oGossiper.setLocalValue( 'key1', Date.now(), err =>{} );
	},
	2000
);