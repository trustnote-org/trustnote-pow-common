const UrlParser			= require( 'url-parse' );
const { DeUtilsCore }	= require( 'deutils.js' );
const { Gossiper }	= require( '../../p2p/gossiper.js' );
const _pow_service	= require( '../../pow/pow_service.js' );

/**
 *	service port
 */
let _servicePort	= 50000;
if ( Array.isArray( process.argv ) && process.argv.length >= 3 )
{
	_servicePort	= parseInt( process.argv[ 2 ] );
}

/**
 *	port list
 */
let _arrPortList	= [
				50000,
				50001,
				// 50002,
				// 50003,
			].filter( nPort => nPort !== _servicePort );

/**
 *	Gossiper options
 */
let _oGossiperOptions	= {
	interval	: 1000,
	url		: `ws://127.0.0.1:${ _servicePort }`,
	address		: 'its my address',
	signer		: ( sMessage ) =>
	{
	}
};
let _oGossiper	= new Gossiper( _oGossiperOptions );



/**
 * 	Gossiper
 */
function startGossiper()
{
	_oGossiper.on( 'peer_update', ( sPeerUrl, sKey, vValue ) =>
	{
		console.log( `))) EVENT [peer_update] :: `, sPeerUrl, sKey, vValue );
	});
	_oGossiper.on( 'peer_alive', ( sPeerUrl ) =>
	{
		console.log( `))) EVENT [peer_alive] :: `, sPeerUrl );
	});
	_oGossiper.on( 'peer_failed', ( sPeerUrl ) =>
	{
		console.log( `))) EVENT [peer_failed] :: `, sPeerUrl );
	});

	_oGossiper.on( 'new_peer', ( sPeerUrl ) =>
	{
		console.log( `))) EVENT [new_peer] :: `, sPeerUrl );
		if ( sPeerUrl !== _oGossiperOptions.url && ! _oGossiper.m_oScuttle.getPeer( sPeerUrl ) )
		{
			connectToServer( sPeerUrl );
		}
	});


	let oSeeds = {};
	// if ( 50000 === _servicePort )
	// {
	// 	oSeeds = {
	// 		'ws://127.0.0.1:50001'	: null,
	// 		'ws://127.0.0.1:50002'	: null,
	// 		'ws://127.0.0.1:50003'	: null,
	// 	};
	// }

	//
	//	start gossiper
	//
	_oGossiper.start( oSeeds );


	//
	//	update data
	//
	if ( 50000 === _servicePort )
	{
		setInterval
		(
			() =>
			{
				_oGossiper.setLocalValue( `key_main`, Date.now(), err =>{} );
				//console.log( `[${ _oGossiper.m_oLocalPeer.getUrl() }]_oGossiper.setLocalValue( key_main ): ${ _oGossiper.m_oLocalPeer.getMaxVersion() }` );
			},
			DeUtilsCore.getRandomInt( 800, 1000 )
		);
	}
	else
	{
		setInterval
		(
			() =>
			{
				_oGossiper.setLocalValue( `key_${ _servicePort }`, Date.now(), err =>{} );
				//console.log( `[${ _oGossiper.m_oLocalPeer.getUrl() }]_oGossiper.setLocalValue( key_${ _servicePort } ): ${ _oGossiper.m_oLocalPeer.getMaxVersion() }` );
			},
			DeUtilsCore.getRandomInt( 1000, 2000 )
		);
	}
}

function onReceiveMessage( sSideType, oWs, sMessage )
{
	try
	{
		// let oJson = JSON.parse( sMessage );
		// if ( DeUtilsCore.isPlainObjectWithKeys( oJson, 'url' ) )
		// {
		// 	oWs.url		= oJson.url;
		// 	_oGossiper.updateSockets({
		// 		[ oJson.url ]	: oWs,
		// 	});
		// }

		let arrJson = JSON.parse( sMessage );
		if ( Array.isArray( arrJson ) &&
			2 === arrJson.length &&
			'gossiper' === arrJson[ 0 ] &&
			DeUtilsCore.isPlainObjectWithKeys( arrJson[ 1 ], 'type' ) )
		{
			_oGossiper.onMessage( oWs, arrJson[ 1 ] );
		}
		else
		{
			console.error( `${ sSideType } >> invalid message/JSON: ${ sMessage }` );
		}
	}
	catch( e )
	{
		console.error( `${ sSideType } >> onMessage occurred exception: ${ JSON.stringify( e ) }` );
	}
}


/**
 *	Server
 */
function startServer()
{
	const oServerOptions	= {
		url		: _oGossiperOptions.url,
		port		: _servicePort,
		onStart		: ( err, oWsServer ) =>
		{
			if ( err )
			{
				return console.error( err );
			}

			console.log( `SERVER >> socket server started:${ oWsServer }.` );
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

			console.log( `SERVER >> a new client connected in.` );
			console.log( `SERVER >> oWs.url : ${ oWs.url }` );
		},
		onMessage	: ( oWs, sMessage ) =>
		{
			console.log( `SERVER >> received a message: ${ sMessage }` );
			onReceiveMessage( 'SERVER', oWs, sMessage );
		},
		onError		: ( oWs, vError ) =>
		{
			console.error( `SERVER >> occurred an error: `, vError );
		},
		onClose		: ( oWs, sReason ) =>
		{
			console.log( `SERVER >> socket was closed(${ sReason })` );
		}
	};
	_pow_service.server.createServer( oServerOptions );
}


/**
 *	Client
 */
function connectToServer( sRemotePeerUrl )
{
	const oClientOptions	= {
		minerGateway	: sRemotePeerUrl,
		onOpen		: ( err, oWs ) =>
		{
			if ( err )
			{
				return console.error( err );
			}

			console.log( `CLIENT >> we have connected to ${ oWs.host } successfully.` );

			//
			//	update the remote socket
			//
			oWs.url	= sRemotePeerUrl;
			_oGossiper.updateSockets({
				[ sRemotePeerUrl ] : oWs
			});
		},
		onMessage	: ( oWs, sMessage ) =>
		{
			console.log( `CLIENT >> received a message : ${ sMessage }` );
			onReceiveMessage( 'CLIENT', oWs, sMessage );
		},
		onError		: ( oWs, vError ) =>
		{
			console.error( `CLIENT >> error from server ${ oClientOptions.minerGateway }: `, vError );

			//	...
			setTimeout( () =>
			{
				connectToServer( sRemotePeerUrl );

			}, 2000 );
		},
		onClose		: ( oWs, sReason ) =>
		{
			console.log( `CLIENT >> socket was closed(${ sReason })` );
		}
	};
	_pow_service.client.connectToServer( oClientOptions );
}





startGossiper();
startServer();

for( let nPort of _arrPortList )
{
	connectToServer( `ws://127.0.0.1:${ nPort }` );
}



