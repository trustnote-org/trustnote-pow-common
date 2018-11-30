/*jslint node: true */
"use strict";

/**
 *	@boss	XING
 */
const WebSocket		= process.browser ? global.WebSocket : require( 'ws' );
const socks		= process.browser ? null : require( 'socks' + '' );


/**
 *	TODO
 *	1, eventBus.emit( "launch_pow", round_index );
 */


/**
 * 	constants
 */
const POW_SERVICE_MAX_INBOUND	= 1000;


/**
 * 	variables
 */
let m_arrCacheOutboundPeers	= [];
let m_oCacheRunningServers	= {};




/**
 * 	SERVER
 *	create a web socket server
 *
 * 	@public
 * 	@param	{object}	oOptions
 * 	@param	{string}	oOptions.url
 * 	@param	{number}	oOptions.port
 * 	@param	{function}	oOptions.onStart( err, oWsServer )
 * 	@param	{function}	oOptions.onConnection( err, oWsClient )
 * 	@param	{function}	oOptions.onMessage( oWsClient, sMessage )
 * 	@param	{function}	oOptions.onError( oWsClient, vError )
 * 	@param	{function}	oOptions.onClose( oWsClient, sReason )
 */
function createServer( oOptions )
{
	let oWsServer;
	let sServerKey;

	if ( 'object' !== typeof oOptions )
	{
		throw new Error( 'call createServer with invalid oOptions' );
	}
	if ( 'string' !== typeof oOptions.url )
	{
		throw new Error( 'call createServer with invalid oOptions.url.' );
	}
	if ( 'number' !== typeof oOptions.port )
	{
		throw new Error( 'call createServer with invalid oOptions.port.' );
	}
	if ( 'function' !== typeof oOptions.onStart )
	{
		throw new Error( 'call createServer with invalid oOptions.onStart' );
	}
	if ( 'function' !== typeof oOptions.onConnection )
	{
		throw new Error( 'call createServer with invalid oOptions.onConnection' );
	}
	if ( 'function' !== typeof oOptions.onMessage )
	{
		throw new Error( 'call createServer with invalid oOptions.onMessage' );
	}
	if ( 'function' !== typeof oOptions.onError )
	{
		throw new Error( 'call createServer with invalid oOptions.onError' );
	}
	if ( 'function' !== typeof oOptions.onClose )
	{
		throw new Error( 'call createServer with invalid oOptions.onClose' );
	}

	//
	//	key of this server
	//
	sServerKey = `*.${ oOptions.port }`;
	if ( m_oCacheRunningServers.hasOwnProperty( sServerKey ) )
	{
		console.log( `server ${ sServerKey } already running.` );
		oOptions.onStart( null, m_oCacheRunningServers[ sServerKey ] );
		return false;
	}

	//
	//	create a new WebSocket server
	//
	oWsServer = new WebSocket.Server
	({
		port : oOptions.port
	});
	oWsServer.url	= oOptions.url;

	oWsServer.on( 'connection', ( oWsClient ) =>
	{
		//
		//	oWs	- Web Socket handle connected in from remote client
		//
		if ( ! oWsClient )
		{
			oOptions.onConnection( `invalid oWs`, oWsClient );
			return false;
		}

		//	...
		let sRemoteAddress = _getRemoteAddress( oWsClient );
		if ( ! sRemoteAddress )
		{
			oOptions.onConnection( `no ip/sRemoteAddress in accepted connection`, oWsClient );
			oWsClient.terminate();
			return false;
		}
		if ( ! _isValidResourceAddress( sRemoteAddress ) )
		{
			oOptions.onConnection( `we only accept connection from intranet or loop-back.`, oWsClient );
			oWsClient.terminate();
			return false;
		}
		if ( Array.isArray( oWsClient.clients ) &&
			oWsClient.clients.length >= POW_SERVICE_MAX_INBOUND )
		{
			oOptions.onConnection( `inbound connections maxed out, rejecting new client ${ sRemoteAddress }`, oWsClient );
			oWsClient.close( 1000, "inbound connections maxed out" );
			return false;
		}

		//
		//	okay, we accepted a new client connecting in
		//
		oWsClient.peer		= sRemoteAddress + ":" + oWsClient.upgradeReq.connection.remotePort;
		oWsClient.host		= sRemoteAddress;
		oWsClient.bInbound	= true;
		oWsClient.last_ts	= Date.now();

		//	...
		console.log( `got connection from ${ oWsClient.peer }, host ${ oWsClient.host }` );

		//
		//	callback saying there was a client connected
		//
		oOptions.onConnection( null, oWsClient );

		//
		//	handle events
		//
		oWsClient.on( 'message', ( sMessage ) =>
		{
			oOptions.onMessage( oWsClient, sMessage );
		});
		oWsClient.on( 'close', () =>
		{
			oOptions.onClose( oWsClient, `client ${ oWsClient.peer } disconnected` );
		});
		oWsClient.on( 'error', ( vError ) =>
		{
			oWsClient.close( 1000, "received error" );
			oOptions.onError( oWsClient, vError );
		});

		//	...
		return true;
	});

	//	call onStart
	oOptions.onStart( null, oWsServer );

	//
	//	update running server list
	//
	m_oCacheRunningServers[ sServerKey ] = oWsServer;

	//	...
	console.log( `new WebSocket server(${ sServerKey }) running at port ${ oOptions.port }` );
}


/**
 * 	CLIENT
 *	connect to server
 *
 * 	@public
 * 	@param	{object}	oOptions
 * 	@param	{string}	oOptions.minerGateway			e.g. : wss://1.miner.trustnote.org
 * 	@param	{function}	oOptions.onOpen( err, oWsClient )
 * 	@param	{function}	oOptions.onMessage( oWsClient, sMessage )
 * 	@param	{function}	oOptions.onError( oWsClient, vError )
 * 	@param	{function}	oOptions.onClose( oWsClient, sReason )
 */
function connectToServer( oOptions )
{
	let sUrl;
	let oWs;

	if ( 'object' !== typeof oOptions )
	{
		throw new Error( 'call connectToServer with invalid oOptions' );
	}
	if ( 'string' !== typeof oOptions.minerGateway ||
		0 === oOptions.minerGateway.length )
	{
		throw new Error( 'call connectToServer with invalid oOptions.minerGateway' );
	}
	if ( 'function' !== typeof oOptions.onOpen )
	{
		throw new Error( 'call connectToServer with invalid oOptions.onOpen' );
	}
	if ( 'function' !== typeof oOptions.onMessage )
	{
		throw new Error( 'call connectToServer with invalid oOptions.onMessage' );
	}
	if ( 'function' !== typeof oOptions.onError )
	{
		throw new Error( 'call connectToServer with invalid oOptions.onError' );
	}
	if ( 'function' !== typeof oOptions.onClose )
	{
		throw new Error( 'call connectToServer with invalid oOptions.onClose' );
	}

	//	...
	sUrl	= oOptions.minerGateway;
	sUrl	= sUrl.trim().toLowerCase();
	oWs	= new WebSocket( sUrl );

	//
	//	set max listeners for EventEmitter
	//
	oWs.on( 'open', () =>
	{
		let oAnotherWsToTheSameServer;

		if ( ! oWs.url )
		{
			throw new Error( "no url on ws" );
		}

		//
		//	browser implementation of Web Socket might add '/'
		//
		if ( oWs.url !== sUrl && oWs.url !== sUrl + "/" )
		{
			throw new Error( `url is different: ${ oWs.url }` );
		}

		//	...
		oAnotherWsToTheSameServer	= _cacheGetHandleByUrl( sUrl );
		if ( oAnotherWsToTheSameServer )
		{
			//
			//	duplicate driver.
			//	May happen if we abondoned a driver attempt after timeout
			// 		but it still succeeded while we opened another driver
			//
			console.log( `already have a connection to ${ sUrl }, will keep the old one and close the duplicate` );
			oWs.close( 1000, 'duplicate driver' );

			//	...
			return oOptions.onOpen( null, oWs );
		}

		//
		//	almost done!
		//
		oWs.peer	= sUrl;				//	peer
		oWs.host	= _getHostByPeerUrl( sUrl );	//	host
		oWs.bOutbound	= true;				//	identify this driver as outbound driver
		oWs.last_ts	= Date.now();			//	record the last timestamp while we connected to this peer

		//	...
		console.log( `connected to ${ sUrl }, host ${ oWs.host }` );

		//
		//	cache new socket handle
		//
		_cacheAddHandle( oWs );

		//	...
		return oOptions.onOpen( null, oWs );
	});
	oWs.on( 'message', ( sMessage ) =>
	{
		oOptions.onMessage( oWs, sMessage );
	});
	oWs.on( 'close', () =>
	{
		_cacheRemoveHandle( oWs );
		oOptions.onClose( oWs, `socket was close` );
	});
	oWs.on( 'error', ( vError ) =>
	{
		oOptions.onError( oWs, vError );
	});

}








/**
 *	send message
 *
 * 	@public
 *	@param	{object}	oWs
 *	@param	{string}	sCommand
 *	@param	{object}	jsonMessage
 *	@return {boolean}
 */
function sendMessage( oWs, sCommand, jsonMessage )
{
	if ( ! oWs )
	{
		console.log( `${ __filename } :: call sendMessage with invalid oWs.` );
		return false;
	}
	if ( oWs.OPEN !== oWs.readyState )
	{
		console.log( `${ __filename } :: readyState=${ oWs.readyState } on peer ${ oWs.peer }, will not send message ['${ sCommand }',${ JSON.stringify( jsonMessage ) }]` );
		return false;
	}
	if ( 'string' !== typeof sCommand )
	{
		console.log( `${ __filename } :: call sendMessage with invalid sCommand.` );
		return false;
	}
	if ( 'object' !== typeof jsonMessage )
	{
		console.log( `${ __filename } :: call sendMessage with invalid jsonMessage.` );
		return false;
	}

	let sContent	= JSON.stringify( [ sCommand, jsonMessage ] );

	console.log( `SENDING ${ sContent } to ${ oWs.peer }` );
	oWs.send( sContent );

	//	...
	return true;
}

/**
 *	send message and then close the socket
 *
 * 	@public
 *	@param	{object}	oWs
 *	@param	{string}	sCommand
 *	@param	{object}	jsonMessage
 *	@return {boolean}
 */
function sendMessageOnce( oWs, sCommand, jsonMessage )
{
	//	...
	sendMessage( oWs, sCommand, jsonMessage );

	//	...
	let nCheckInterval = setInterval( () =>
	{
		if ( 0 === oWs.bufferedAmount )
		{
			//	Im' not busy anymore - set a flag or something like that
			clearInterval( nCheckInterval );
			nCheckInterval = null;

			//	close socket
			oWs.close( 1000, 'done' );
		}
	}, 50 );
}




/**
 *	get socket handle by url
 *
 * 	@private
 *	@param	{string}	sUrl
 *	@returns {null}
 */
function _cacheGetHandleByUrl( sUrl )
{
	let oRet;
	let arrResult;

	if ( 'string' !== typeof sUrl || 0 === sUrl.length )
	{
		return null;
	}

	//	...
	oRet		= null;
	sUrl		= sUrl.trim().toLowerCase();
	arrResult	= m_arrCacheOutboundPeers.filter( oSocket => oSocket.peer === sUrl );
	if ( Array.isArray( arrResult ) && 1 === arrResult.length )
	{
		oRet = arrResult[ 0 ];
	}

	return oRet;
}

/**
 *	add new socket handle by url
 *
 * 	@private
 *	@param	{object}	oSocket
 *	@returns {boolean}
 */
function _cacheAddHandle( oSocket )
{
	if ( ! oSocket )
	{
		return false;
	}

	//	...
	_cacheRemoveHandle( oSocket );
	m_arrCacheOutboundPeers.push( oSocket );
	return true;
}

/**
 *	remove socket handle by url
 *
 * 	@private
 *	@param	{object}	oSocket
 *	@returns {boolean}
 */
function _cacheRemoveHandle( oSocket )
{
	let bRet;
	let nIndex;

	if ( ! oSocket )
	{
		return false;
	}

	//	...
	bRet	= false;
	nIndex	= m_arrCacheOutboundPeers.indexOf( oSocket );
	if ( -1 !== nIndex )
	{
		bRet = true;
		m_arrCacheOutboundPeers.splice( nIndex, 1 );
	}

	return bRet;
}


/**
 *	get host by peer url
 *
 *	@private
 *	@param	{string}	sUrl
 *	@return {string}
 */
function _getHostByPeerUrl( sUrl )
{
	let arrMatches;

	//
	//	this regex will match wss://xxx and ws://xxx
	//
	arrMatches = sUrl.match( /^wss?:\/\/(.*)$/i );
	if ( Array.isArray( arrMatches ) && arrMatches.length >= 1 )
	{
		sUrl = arrMatches[ 1 ];
	}

	//	...
	arrMatches	= sUrl.match( /^(.*?)[:\/]/ );
	return ( Array.isArray( arrMatches ) && arrMatches.length >= 1 ) ? arrMatches[ 1 ] : sUrl;
}


/**
 * 	get remote address
 *
 *	@private
 *	@param	{object}	oSocket
 */
function _getRemoteAddress( oSocket )
{
	let sRet;

	if ( 'object' !== typeof oSocket )
	{
		return null;
	}

	//	...
	sRet = oSocket.upgradeReq.connection.remoteAddress;
	if ( sRet )
	{
		//
		//	check for proxy
		//	ONLY VALID FOR 127.0.0.1 and resources addresses
		//
		if ( oSocket.upgradeReq.headers[ 'x-real-ip' ] && _isValidResourceAddress( sRet ) )
		{
			//	we are behind a proxy
			sRet = oSocket.upgradeReq.headers[ 'x-real-ip' ];
		}
	}

	return sRet;
}


/**
 *	check if the address is a valid resource or loop-back address
 *
 *	@private
 *	@param	{string}	sAddress
 *	@return	{boolean}
 */
function _isValidResourceAddress( sAddress )
{
	return ( 'string' === typeof sAddress &&
		sAddress.length > 0 &&
		( sAddress === '127.0.0.1' || sAddress.match( /^192\.168\./ ) ) );
}



/**
 *	@exports
 */
module.exports.client	= {
	connectToServer : connectToServer
};
module.exports.server	= {
	createServer : createServer
};

module.exports.sendMessage	= sendMessage;
module.exports.sendMessageOnce	= sendMessageOnce;
