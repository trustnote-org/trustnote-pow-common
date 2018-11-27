const _net			= require( 'net' );
//const _msgPack		= require( 'msgpack' );
const { EventEmitter }		= require( 'events' );
const { DeUtilsCore }		= require( 'deutils.js' );
const { DeUtilsNetwork }	= require( 'deutils.js' );

const { GossiperPeer }		= require( './gossiper-peer' );
const { GossiperScuttle }	= require( './gossiper-scuttle' );



/**
 *	@constants
 */
const DEFAULT_INTERVAL		= 1000;		//	default interval in milliseconds for gossiper communication





/**
 *	SYN:
 *	Gossip Digest Syn Message
 *
 *	The node initiating the round of gossip sends the SYN message which contains a compendium of the nodes in the cluster.
 *	It contains tuples of the IP address of a node in the cluster, the generation and the heartbeat version of the node.
 */
const REQUEST			= 0;

/**
 *	ACK:
 *	Gossip Digest Ack Message
 *
 *	The peer after receiving SYN message compares its own metadata information with
 *	the one sent by the initiator and produces a diff.
 *	ACK contains two kinds of data.
 *	One part consists of updated metadata information (AppStates) that the peer has but the initiator doesn't,
 *	and the other part consists of digest of nodes the initiator has that the peer doesn't.
 */
const FIRST_RESPONSE		= 1;

/**
 *	ACK2:
 * 	Gossip Digest Ack2 Message
 *
 *	The initiator receives the ACK from peer and updates its metadata from the AppStates and sends back ACK2
 *	containing the metadata information the peer has requested for.
 *	The peer receives ACK2, updates its metadata and the round of gossip concludes.
 */
const SECOND_RESPONSE		= 2;








/**
 *	@class Gossiper over Web Socket
 */
class Gossiper extends EventEmitter
{
	/**
	 *	@constructor
	 *	@param	{object}	oOptions
	 *	@param	{number}	oOptions.interval	- interval in milliseconds for gossiper communication
	 *	@param	{string}	oOptions.ip		- local ip address, '127.0.0.1' or undefined
	 *	@param	{number}	oOptions.port		- local port number
	 *	@param	{string}	oOptions.address	- local super node address
	 *	@param	{function}	oOptions.signer		- local signer function provided by super node
	 *	@param	{array}		oOptions.seeds		- [ '127.0.0.1:60001' ]
	 */
	constructor( oOptions )
	{
		super();

		//	...
		this.m_nInterval	= DeUtilsCore.isPlainObjectWithKeys( oOptions, 'interval' ) ? oOptions.interval : DEFAULT_INTERVAL;

		this.m_sPeerName	= null;
		this.m_oPeers		= {};

		//
		//	local
		//
		this.m_sLocalIp		= DeUtilsCore.isPlainObjectWithKeys( oOptions, 'ip' ) ? oOptions.ip : null;
		this.m_nLocalPort	= DeUtilsCore.isPlainObjectWithKeys( oOptions, 'port' ) ? oOptions.port : null;
		this.m_nLocalAddress	= DeUtilsCore.isPlainObjectWithKeys( oOptions, 'address' ) ? oOptions.address : '';
		this.m_nLocalSigner	= DeUtilsCore.isPlainObjectWithKeys( oOptions, 'signer' ) ? oOptions.signer : null;

		//
		//	initializing peers
		//
		this.m_arrInitPeers	= DeUtilsCore.isPlainObjectWithKeys( oOptions, 'seeds' ) ? oOptions.seeds : [];

		//
		//	local
		//
		this.m_oLocalPeer	= new GossiperPeer();
		this.m_oScuttle		= new GossiperScuttle( this.m_oPeers, this.m_oLocalPeer );

		this._handleNewPeers( this.m_arrInitPeers );
	}

	/**
	 * 	start
	 *	@param	{object}	oSocket
	 *	@param	{function}	pfnCallback
	 */
	start( oSocket, pfnCallback )
	{
		if ( ! oSocket )
		{
			return pfnCallback( `call start with invalid oSocket: ${ JSON.stringify( oSocket ) }` );
		}

		//
		//	try to initialize with initializing peers
		//
		this._handleNewPeers( this.m_arrInitPeers );

		//
		//	start gossip
		//
		this.m_nHeartBeatTimer = setInterval
		(
			() =>
			{
				this.m_oLocalPeer.beatHeart();
			},
			this.m_nInterval
		);
		this.m_nGossipTimer = setInterval
		(
			() =>
			{
				this._gossip();
			},
			this.m_nInterval
		);
	}

	/**
	 *	stop
	 */
	stop()
	{
		//
		//	clear intervals
		//
		clearInterval( this.m_nHeartBeatTimer );
		clearInterval( this.m_nGossipTimer );
		this.m_nHeartBeatTimer	= null;
		this.m_nGossipTimer	= null;
	}


	/**
	 * 	handle message given by caller
	 *
	 *	* I AM A CALLEE, THE MESSAGE WAS DELIVERED BY CALLER
	 *
	 *	@param	{object}	oSocket
	 *	@param	{object}	oMessage
	 *	@return	{*}
	 */
	onMessage( oSocket, oMessage )
	{
		return this._handleMessage( oSocket, oMessage );
	}


	/**
	 * 	check if the nType is a valid message type
	 *	@param	{number}	nType
	 *	@return {boolean}
	 */
	isValidMessageType( nType )
	{
		return DeUtilsCore.isNumeric( nType ) &&
			[ REQUEST, FIRST_RESPONSE, SECOND_RESPONSE ].includes( nType );
	}

	/**
	 * 	check if the sPeerName is a valid peer name
	 *	@param	{string}	sPeerName	- '127.0.0.1:8000'
	 *	@return	{boolean}
	 */
	isValidPeerName( sPeerName )
	{
		let bRet = false;

		if ( DeUtilsCore.isExistingString( sPeerName ) )
		{
			let arrPeerSplit = sPeerName.split( ":" );
			if ( Array.isArray( arrPeerSplit ) && arrPeerSplit.length >= 2 )
			{
				if ( DeUtilsNetwork.isValidIpV4( arrPeerSplit[ 0 ] ) &&
					DeUtilsNetwork.isValidPort( arrPeerSplit[ 1 ] ) )
				{
					bRet = true;
				}
			}
		}

		return bRet;
	}

	/**
	 *	get peer by name
	 *	@param	{string}	sPeerName
	 *	@return {*}
	 */
	getPeer( sPeerName )
	{
		let oPeer	= null;

		if ( DeUtilsCore.isExistingString( sPeerName ) )
		{
			oPeer = this.m_oPeers[ sPeerName ];
		}

		return oPeer;
	}

	/**
	 *	create a new peer or return existed instance
	 *	@param	{string}	sPeerName
	 *	@return {*}
	 */
	createPeer( sPeerName )
	{
		let oPeer	= null;
		let bExists	= false;

		if ( DeUtilsCore.isExistingString( sPeerName ) )
		{
			if ( this.m_oPeers[ sPeerName ] )
			{
				//
				//	already exists
				//
				bExists	= true;
				oPeer	= this.m_oPeers[ sPeerName ];
			}
			else
			{
				//
				//	create new
				//
				bExists	= false;
				this.m_oPeers[ sPeerName ] = new GossiperPeer( sPeerName );
				oPeer	= this.m_oPeers[ sPeerName ];

				//
				//	emit events and listen
				//
				this.emit( 'new_peer', sPeerName );
				this._listenToPeer( oPeer );
			}
		}

		return {
			peer	: oPeer,
			exists	: bExists,
		};
	}

	/**
	 *	set local state
	 *	@param	{string}	sKey
	 *	@param	{}		vValue
	 *	@param	{function}	pfnCallback( err )
	 *	@return	{void}
	 */
	setLocalValue( sKey, vValue, pfnCallback )
	{
		this.m_oLocalPeer.updateLocalValue( sKey, vValue, pfnCallback );
	}

	/**
	 *	get local state
	 *	@param	{string}	sKey
	 */
	getLocalValue( sKey )
	{
		return this.m_oLocalPeer.getValue( sKey );
	}


	/**
	 *	get peer keys
	 *
	 *	@param	{string}	sPeerName
	 *	@return {Array}
	 */
	getPeerAllKeys( sPeerName )
	{
		let arrKeys	= null;
		let oPeer	= this.m_oPeers[ sPeerName ];

		if ( oPeer )
		{
			arrKeys	= oPeer.getAllKeys();
		}

		return arrKeys;
	}

	/**
	 *	get peer value
	 *
	 *	@param	{string}	sPeerName
	 *	@param	{string}	sKey
	 *	@return {*}
	 */
	getPeerValue( sPeerName, sKey )
	{
		let vValue	= null;
		let oPeer	= this.m_oPeers[ sPeerName ];

		if ( oPeer )
		{
			vValue	= oPeer.getValue( sKey );
		}

		return vValue;
	}

	/**
	 *	get all peers
	 *
	 *	@return {Array}
	 *
	 * 	@description
	 *	this.m_oPeers
	 *	{
	 *		peer_name_1	: { ... },
	 *		peer_name_2	: { ... },
	 *	}
	 */
	getAllPeerNames()
	{
		let arrPeerNames = [];

		for ( let sPeerName in this.m_oPeers )
		{
			arrPeerNames.push( sPeerName );
		}

		return arrPeerNames;
	}

	/**
	 *	get live peer name list
	 *
	 *	@return {Array}
	 *
	 * 	@description
	 * 	@see	.getAllPeerNames()
	 */
	getLivePeerNames()
	{
		let arrPeerNames = [];

		for ( let sPeerName in this.m_oPeers )
		{
			if ( this.m_oPeers[ sPeerName ].isAlive() )
			{
				arrPeerNames.push( sPeerName );
			}
		}

		return arrPeerNames;
	}

	/**
	 *	get dead peers
	 *
	 *	@return {Array}
	 *
	 * 	@description
	 * 	@see	.getAllPeerNames()
	 */
	getDeadPeerNames()
	{
		let arrPeerNames = [];

		for ( let sPeerName in this.m_oPeers )
		{
			if ( ! this.m_oPeers[ sPeerName ].isAlive() )
			{
				arrPeerNames.push( sPeerName );
			}
		}

		return arrPeerNames;
	}






	/**
	 *	The method of choosing which peer(s) to gossip to is borrowed from Cassandra.
	 *	They seemed to have worked out all of the edge cases
	 *
	 *	@see http://wiki.apache.org/cassandra/ArchitectureGossip
	 */
	_gossip()
	{
		let arrLivePeerNames	= this.getLivePeerNames();
		let arrDeadPeerNames	= this.getDeadPeerNames();
		let sLivePeerName	= null;
		let sDeadPeerName	= null;

		//
		//	Find a live peer to gossip to
		//
		if ( arrLivePeerNames.length > 0 )
		{
			sLivePeerName	= this._chooseRandom( arrLivePeerNames );
			this._gossipToPeer( sLivePeerName );
		}

		//
		//	possibly gossip to a dead peer
		//
		let fProb = arrDeadPeerNames.length / ( arrLivePeerNames.length + 1 );
		if ( fProb > Math.random() )
		{
			sDeadPeerName	= this._chooseRandom( arrDeadPeerNames );
			this._gossipToPeer( sDeadPeerName );
		}

		//
		//	Gossip to seed under certain conditions
		//	TODO
		//	- have too many bugs
		//
		if ( sLivePeerName && ! this.m_arrInitPeers[ sLivePeerName ] &&
			arrLivePeerNames.length < this.m_arrInitPeers.length )
		{
			if ( Math.random() < ( this.m_arrInitPeers.length / this.getAllPeerNames().length ) )
			{
				let arrCertainPeerName	= this._chooseRandom( Object.keys( this.m_oPeers ) );
				this._gossipToPeer( arrCertainPeerName );
			}
		}

		//
		//	Check health of m_oPeers
		//
		for ( let i in this.m_oPeers )
		{
			let oPeer = this.m_oPeers[ i ];
			if ( oPeer !== this.m_oLocalPeer )
			{
				oPeer.checkIfSuspect();
			}
		}
	}

	/**
	 *	choose random
	 *	@param	{Array}	arrPeers
	 *	@return {string|null}
	 */
	_chooseRandom( arrPeers )
	{
		if ( ! Array.isArray( arrPeers ) || 0 === arrPeers.length )
		{
			return null;
		}

		//
		//	Choose random peer to gossip to
		//
		let i = Math.floor( Math.random() * 1000000 ) % arrPeers.length;
		return arrPeers[ i ];
	}

	/**
	 *	gossip to peer
	 *	@param	{string}	sPeerName
	 */
	_gossipToPeer( sPeerName )
	{
		if ( ! this.isValidPeerName( sPeerName ) )
		{
			return this._emitErrorLog( `call _gossipToPeer with invalid sPeerName: ${ JSON.stringify( sPeerName ) }` );
		}

		let oPeer = this.getPeer( sPeerName );
		if ( oPeer )
		{
			//
			//	send REQUEST message to peer
			//
			this._sendMessage( oPeer.getSocket(), this._requestMessage() );
		}
		else
		{
			this._emitErrorLog( `Peer not found by sPeerName: ${ JSON.stringify( sPeerName ) }` );
		}
	}

	/**
	 *	handle message
	 *
	 *	@param	{object}	oSocket
	 *	@param	{object}	oMessage
	 *	@param	{number}	oMessage.type
	 *	@param	{object}	[oMessage.digest=]
	 *	@param	{object}	[oMessage.request_digest=]
	 *	@param	{array}		[oMessage.updates=]
	 *	@return	{*}
	 */
	_handleMessage( oSocket, oMessage )
	{
		if ( ! oSocket )
		{
			return this._emitErrorLog( `call _handleMessage with invalid oSocket: ${ JSON.stringify( oSocket ) }.` );
		}
		if ( ! DeUtilsCore.isPlainObjectWithKeys( oMessage, 'type' ) )
		{
			return this._emitErrorLog( `call _handleMessage with invalid oMessage: ${ JSON.stringify( oMessage ) }.` );
		}
		if ( ! this.isValidMessageType( oMessage.type ) )
		{
			return this._emitErrorLog( `call _handleMessage with invalid oMessage.type: ${ JSON.stringify( oMessage.type ) }.` );
		}

		//
		//	handle message by type
		//
		switch ( oMessage.type )
		{
			case REQUEST:
				//
				//	oMsg.digest :
				//	{
				//		'127.0.0.1:9011'	: m_nMaxVersionSeen,
				//		'127.0.0.1:9012'	: m_nMaxVersionSeen,
				//		...
				//	}
				//
				this._sendMessage( oSocket, this._firstResponseMessage( oMessage.digest ) );
				break;

			case FIRST_RESPONSE:
				//
				//	first response from other peers
				//
				//
				//
				//	oMsg.updates
				//	[
				//		[ sPeerName, key, value, version ],
				//		[ sPeerName, key, value, version ],
				//		...
				// 	],
				//	oMsg.request_digest
				//	{
				// 		sPeerName	: 0,
				// 		sPeerName	: nLocalMaxVersion,
				//		...
				//	}
				//
				this.m_oScuttle.updateKnownState( oMessage.updates );
				this._sendMessage( oSocket, this._secondResponseMessage( oMessage.request_digest ) );
				break;

			case SECOND_RESPONSE:
				//
				//	second response from other peers
				//
				//	oMsg.updates
				//	[
				//		[ sPeerName, sKey, vValue, nVersion ],
				//		[ sPeerName, sKey, vValue, nVersion ],
				//		...
				// 	]
				//
				this.m_oScuttle.updateKnownState( oMessage.updates );
				break;

			default:
				//	shit went bad
				break;
		}
	}


	////////////////////////////////////////////////////////////////////////////////
	//	MESSSAGES
	////////////////////////////////////////////////////////////////////////////////

	/**
	 *	handle new peers
	 *	@param	{array}	arrNewPeers
	 *	@return	{number}
	 */
	_handleNewPeers(arrNewPeers )
	{
		if ( ! Array.isArray( arrNewPeers ) )
		{
			return 0;
		}

		//
		//	arrNewPeers
		//	[
		//		sPeerName,
		//		sPeerName,
		//		...
		// 	]
		//
		let nCount = 0;
		for ( let i = 0; i < arrNewPeers.length; i ++ )
		{
			let oPeerData	= this.createPeer( arrNewPeers[ i ] );
			if ( ! oPeerData.exists )
			{
				nCount ++;
			}
		}

		return nCount;
	}

	/**
	 *	listen to peer
	 *	@param oPeer
	 */
	_listenToPeer(oPeer )
	{
		if ( ! oPeer )
		{
			return false;
		}

		//	...
		oPeer.on
		(
			'update',
			( sKey, vValue ) =>
			{
				this.emit( 'update', oPeer.getPeerName(), sKey, vValue );
			}
		);
		oPeer.on
		(
			'peer_alive',
			() =>
			{
				this.emit( 'peer_alive', oPeer.getPeerName() );
			}
		);
		oPeer.on
		(
			'peer_failed',
			() =>
			{
				this.emit( 'peer_failed', oPeer.getPeerName() );
			}
		);

		return true;
	}

	/**
	 *	request message
	 *
	 * 	@description
	 *	send all peers( ip:port ) I known and the max version of data stored here to others
	 *
	 *	@return	{{type: number, digest: {}}}
	 */
	_requestMessage()
	{
		//
		//	digest	:
		//	{
		//		'127.0.0.1:9011'	: m_nMaxVersionSeen,
		//		'127.0.0.1:9012'	: m_nMaxVersionSeen,
		//	}
		//
		return {
			type	: REQUEST,
			digest	: this.m_oScuttle.digest(),
		};
	}

	/**
	 *	first response
	 *	@param	oPeerDigest
	 *		all peers( ip:port ) known by the peer and the max version of data stored in the peer.
	 *		for example:
	 *		{
	 *			'127.0.0.1:9000'	: 1,	//	max version
	 *			'127.0.0.1:9001'	: 2,	//	max version
	 *		}
	 *	@return {{type: number, request_digest: {}, updates: Array}}
	 */
	_firstResponseMessage( oPeerDigest )
	{
		//
		//
		//	deltas		>>> return.updates
		//	[
		//		[ sPeerName, key, value, version ],
		//		[ sPeerName, key, value, version ],
		//		...
		// 	],
		//	requests	>>> return.request_digest
		//	{
		// 		sPeerName	: 0,
		// 		sPeerName	: nLocalMaxVersion,
		//		...
		//	},
		//	new_peers
		//	[
		//		sPeerName,
		//		sPeerName,
		//		...
		// 	]
		//
		let oScuttle = this.m_oScuttle.scuttle( oPeerDigest );

		this._handleNewPeers( oScuttle.new_peers );
		return {
			type		: FIRST_RESPONSE,
			request_digest	: oScuttle.requests,
			updates		: oScuttle.deltas
		};
	}

	/**
	 * 	second response
	 *	@param	oRequests
	 *	@return {{type: number, updates: Array}}
	 */
	_secondResponseMessage( oRequests )
	{
		//
		//	oRequests
		//	{
		// 		sPeerName	: 0,
		// 		sPeerName	: nLocalMaxVersion,
		//		...
		//	}
		//
		//
		//	return.updates
		//	[
		//		[ sPeerName, sKey, vValue, nVersion ],
		//		[ sPeerName, sKey, vValue, nVersion ],
		//		...
		// 	]
		//
		return {
			type	: SECOND_RESPONSE,
			updates	: this.m_oScuttle.fetchDeltas( oRequests )
		};
	}


	/**
	 * 	send message over socket tunnel
	 *
	 *	@param	{object}	oSocket
	 *	@param	{object}	oMessage
	 *	@param	{number}	oMessage.type
	 *	@param	{object}	[oMessage.digest=]
	 *	@param	{object}	[oMessage.request_digest=]
	 *	@param	{array}		[oMessage.updates=]
	 *	@private
	 */
	_sendMessage( oSocket, oMessage )
	{
		if ( ! DeUtilsCore.isPlainObjectWithKeys( oMessage, 'type' ) )
		{
			return this._emitErrorLog( `call _sendMessage with invalid oMessage: ${ JSON.stringify( oMessage ) }.` );
		}
		if ( ! oSocket )
		{
			return this._emitErrorLog( `Socket was not ready.` );
		}
		if ( oSocket.OPEN !== oSocket.readyState )
		{
			return this._emitErrorLog
			(
				`Socket readyState: ${ oSocket.readyState } on peer ${ oSocket.peer }, will not send ${ JSON.stringify( oMessage ) }`
			);
		}

		//
		//	assemble message with Gossiper format
		//
		let sMessage = JSON.stringify( [ 'gossiper', oMessage ] );
		oSocket.send( sMessage );

		//	...
		this._emitInfoLog( `SENDING ${ sMessage } to ${ oSocket.peer }.` );
	}



	/**
	 *	emit an info to caller
	 *	@param	{}	vData
	 *	@private
	 */
	_emitInfoLog( vData )
	{
		return this._emitLog( 'info', vData );
	}

	/**
	 *	emit an error to caller
	 *	@param	{}	vData
	 *	@private
	 */
	_emitErrorLog( vData )
	{
		return this._emitLog( 'error', vData );
	}

	/**
	 *	emit a message to caller
	 *	@param	{string}	sType
	 *	@param	{any}		vData
	 *	@private
	 */
	_emitLog( sType, vData )
	{
		this.emit( 'log', sType, vData );
	}
}




/**
 *	@exports
 */
module.exports	=
{
	Gossiper	: Gossiper
};