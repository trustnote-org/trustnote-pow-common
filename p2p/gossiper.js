/**
 *	Gossiper
 */
const _db			= require( '../db/db.js' );
const _conf			= require( '../config/conf' );

const { Gossiper: Gossiper }	= require( 'trustnote-pow-gossiper' );
const { GossiperMessages }	= require( 'trustnote-pow-gossiper' );
const { GossiperEvents }	= require( 'trustnote-pow-gossiper' );
const { GossiperUtils }		= require( 'trustnote-pow-gossiper' );
const { DeUtilsCore }		= require( 'deutils.js' );
const { DeUtilsNetwork }	= require( 'deutils.js' );


/**
 * 	@constant
 */
const KEY_BYZANTINE		= 'byzantine';



/**
 * 	@options
 */
const _oGossiperOptions	= {
	interval		: 1000,
	port			: null,
	url			: null,
	address			: null,
	pfnSigner		: null,
	pfnConnectToPeer	: null,
	pfnPeerUpdate		: null,
};
let _oGossiper		= null;





/**
 *	start gossiper
 *
 * 	@param	{object}	oOptions
 * 	@param	{function}	oOptions.pfnConnectToPeer
 * 	@param	{function}	oOptions.pfnSigner
 * 	@param	{function}	oOptions.pfnPeerUpdate
 * 	@return	{void}
 */
function gossiperStart( oOptions )
{
	if ( ! DeUtilsCore.isPlainObjectWithKeys( oOptions, 'pfnSigner' ) ||
		! DeUtilsCore.isFunction( oOptions.pfnSigner ) )
	{
		throw Error( `call gossiperStart with invalid oOptions.pfnSigner: ${ JSON.stringify( oOptions ) }` );
	}
	if ( ! DeUtilsCore.isPlainObjectWithKeys( oOptions, 'pfnConnectToPeer' ) ||
		! DeUtilsCore.isFunction( oOptions.pfnConnectToPeer ) )
	{
		throw Error( `call gossiperStart with invalid oOptions.pfnConnectToPeer: ${ JSON.stringify( oOptions ) }` );
	}
	if ( ! DeUtilsCore.isPlainObjectWithKeys( oOptions, 'pfnPeerUpdate' ) ||
		! DeUtilsCore.isFunction( oOptions.pfnPeerUpdate ) )
	{
		throw Error( `call gossiperStart with invalid oOptions.pfnPeerUpdate: ${ JSON.stringify( oOptions ) }` );
	}


	//
	//	read my address
	//
	_readMyAddress( ( err, sMyAddress ) =>
	{
		if ( err )
		{
			throw Error( err );
		}
		if ( ! DeUtilsNetwork.isValidPort( _conf.port ) )
		{
			throw Error( `can not start Gossiper with invalid conf.port: ${ JSON.stringify( _conf.port ) }.` );
		}
		if ( ! GossiperUtils.isValidPeerUrl( _conf.myUrl ) )
		{
			throw Error( `can not start Gossiper with invalid conf.myUrl: ${ JSON.stringify( _conf.myUrl ) }.` );
		}

		//
		//	start gossiper with options
		//
		_oGossiperOptions.pfnSigner		= oOptions.pfnSigner;
		_oGossiperOptions.pfnConnectToPeer	= oOptions.pfnConnectToPeer;
		_oGossiperOptions.pfnPeerUpdate		= oOptions.pfnPeerUpdate;
		_oGossiperOptions.url			= _conf.myUrl;
		_oGossiperOptions.address		= sMyAddress;

		_gossiperStartWithOptions( _oGossiperOptions );
	});
}


/**
 *	broadcast
 *
 *	@param	{string}	sKey
 *	@param	{}		vValue
 *	@param	{function}	pfnCallback( err )
 *	@return {*}
 */
function gossiperBroadcast( sKey, vValue, pfnCallback )
{
	if ( ! DeUtilsCore.isExistingString( sKey ) )
	{
		return pfnCallback( `GOSSIPER ))) call gossiperBroadcast with invalid sKey: ${ JSON.stringify( sKey ) }` );
	}

	/**
	 * 	update local value and broadcast it to all connected peers
	 */
	_oGossiper.setLocalValue( sKey, vValue, err =>
	{
		if ( err )
		{
			return pfnCallback( err );
		}

		pfnCallback( null );
	});
}


/**
 *	on received gossiper message
 *
 *	@param	{object}	oWs
 *	@param	{object}	oMessage
 *	@return	{void}
 */
function gossiperOnReceivedMessage( oWs, oMessage )
{
	try
	{
		_oGossiper.onReceivedMessage( oWs, oMessage );
	}
	catch( oException )
	{
		console.error( `GOSSIPER ))) gossiperOnReceivedMessage occurred an exception: ${ JSON.stringify( oException ) }` );
	}
}


/**
 *	update socket
 *
 *	@param	{object}	oSockets
 *	@return	{number}	- count of successfully updated peers
 */
function updateConnectedPeer( oSockets )
{
	if ( ! oSockets )
	{
		console.error( `GOSSIPER ))) call updateConnectedPeer with null oSockets.` );
		return 0;
	}
	if ( ! DeUtilsCore.isPlainObject( oSockets ) )
	{
		console.error( `GOSSIPER ))) call updateConnectedPeer with invalid oSockets.` );
		return 0;
	}
	if ( ! DeUtilsCore.isPlainObjectWithKeys( oSockets, 'url' ) )
	{
		console.error( `GOSSIPER ))) call updateConnectedPeer with invalid oSockets, no url property.` );
		return 0;
	}
	if ( ! GossiperUtils.isValidPeerUrl( oSockets.url ) )
	{
		console.error( `GOSSIPER ))) call updateConnectedPeer with invalid oSockets.url: ${ JSON.stringify( oSockets.url ) }.` );
		return 0;
	}

	return _oGossiper.updatePeerList
	({
		[ oSockets.url ]	: oSockets
	});
}





////////////////////////////////////////////////////////////////////////////////
//
//	Private
//


/**
 * 	read my address from database
 *
 *	@param pfnCallback
 *	@private
 */
function _readMyAddress( pfnCallback )
{
	_db.query
	(
		"SELECT address FROM my_addresses",
		[],
		arrRows =>
		{
			if ( 0 === arrRows.length )
			{
				return pfnCallback( "no addresses" );
			}
			if ( arrRows.length > 1 )
			{
				return pfnCallback( "more than 1 address" );
			}

			//	...
			pfnCallback( null, arrRows[ 0 ].address );
		}
	);
}

/**
 * 	start gossiper with options
 *
 *	@param	{object}	oOptions
 *	@private
 */
function _gossiperStartWithOptions( oOptions )
{
	//
	//	create Gossiper instance
	//
	_oGossiper	= new Gossiper( oOptions );

	//
	//	listen ...
	//
	_oGossiper.on( 'peer_update', ( sPeerUrl, sKey, vValue ) =>
	{
		console.log( `GOSSIPER ))) EVENT [peer_update] (${ GossiperUtils.isReservedKey( sKey ) ? "Reserved" : "Customized" }):: `, sPeerUrl, sKey, vValue );

		//
		//	callback while we received a update from remote peers
		//
		if ( ! GossiperUtils.isReservedKey( sKey ) )
		{
			_oGossiperOptions.pfnPeerUpdate( sPeerUrl, sKey, vValue );
		}
	});
	_oGossiper.on( 'peer_alive', ( sPeerUrl ) =>
	{
		console.log( `GOSSIPER ))) EVENT [peer_alive] :: `, sPeerUrl );
	});
	_oGossiper.on( 'peer_failed', ( sPeerUrl ) =>
	{
		console.error( `GOSSIPER ))) EVENT [peer_failed] :: `, sPeerUrl );
	});
	_oGossiper.on( 'new_peer', ( sPeerUrl ) =>
	{
		console.log( `GOSSIPER ))) EVENT [new_peer] :: `, sPeerUrl );
		if ( sPeerUrl !== _oGossiperOptions.url &&
			! _oGossiper.m_oRouter.getSocket( sPeerUrl ) )
		{
			//
			//	try to connect to the new peer
			//
			_oGossiperOptions.pfnConnectToPeer( sPeerUrl, ( err, oNewWs ) =>
			{
				if ( err )
				{
					return console.error( `GOSSIPER ))) failed to connectToPeer: ${ sPeerUrl }.` );
				}
				if ( ! oNewWs )
				{
					return console.error( `GOSSIPER ))) connectToPeer returns an invalid oNewWs: ${ JSON.stringify( oNewWs ) }.` );
				}

				//
				//	update the remote socket
				//
				if ( ! DeUtilsCore.isPlainObjectWithKeys( oNewWs, 'url' ) ||
					! GossiperUtils.isValidPeerUrl( oNewWs.url ) )
				{
					oNewWs.url	= sPeerUrl;
				}

				//
				//	update router
				//
				_oGossiper.updatePeerList({
					[ sPeerUrl ] : oNewWs
				});
			});
		}
	});
	_oGossiper.on( 'log', ( sType, vData ) =>
	{
		console.log( `GOSSIPER ))) EVENT [log/${ sType }] :: `, vData );
	});


	//
	//	start gossiper
	//
	_oGossiper.start( {} );
}




/**
 * 	@exports
 */
module.exports	=
{
	gossiperStart			: gossiperStart,
	gossiperBroadcast		: gossiperBroadcast,
	gossiperOnReceivedMessage	: gossiperOnReceivedMessage,
	updateConnectedPeer		: updateConnectedPeer,

	Keys				:
	{
		KEY_BYZANTINE	: KEY_BYZANTINE,
	}
};
