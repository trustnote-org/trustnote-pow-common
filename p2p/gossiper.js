const { EventEmitter }		= require( 'events' );
const { DeUtilsCore }		= require( 'deutils.js' );

const { GossiperPeer }		= require( './gossiper-peer' );
const { GossiperScuttle }	= require( './gossiper-scuttle' );
const { GossiperUtils }		= require( './gossiper-utils' );



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
 *	@event	peer_update
 * 	@param	{string}	sPeerUrl
 * 	@param	{string}	sKey
 * 	@param	{}		vValue
 */
const EVENT_PEER_UPDATE		= 'peer_update';

/**
 *	@event	peer_alive
 * 	@param	{string}	sPeerUrl
 */
const EVENT_PEER_ALIVE		= 'peer_alive';

/**
 *	@event	peer_failed
 * 	@param	{string}	sPeerUrl
 */
const EVENT_PEER_FAILED		= 'peer_failed';

/**
 *	@event	new_peer
 * 	@param	{string}	sPeerUrl
 */
const EVENT_NEW_PEER		= 'new_peer';







/**
 *	@class Gossiper over Web Socket
 */
class Gossiper extends EventEmitter
{
	/**
	 *	@constructor
	 *
	 *	@param	{object}	oOptions
	 *	@param	{number}	oOptions.interval	- interval in milliseconds for gossiper communication
	 *	@param	{string}	oOptions.url		- local url, 'wss://127.0.0.1:6000', 'udp|tcp...://127.0.0.1:6000' or undefined
	 *	@param	{string}	oOptions.address	- local super node address
	 *	@param	{function}	oOptions.signer		- local signer function provided by super node
	 */
	constructor( oOptions )
	{
		super();

		//	...
		this.m_nInterval	= DeUtilsCore.isPlainObjectWithKeys( oOptions, 'interval' ) ? oOptions.interval : DEFAULT_INTERVAL;

		//
		//	local
		//
		this.m_oLocalPeer	= new GossiperPeer( oOptions );
		this.m_oRemotePeers	= {};
		this.m_oScuttle		= new GossiperScuttle( this.m_oRemotePeers, this.m_oLocalPeer );
	}


	/**
	 * 	start
	 *
	 *	@param	{object}	oSeeds		- seeds for initializing Gossiper
	 *		{
	 *			'wss://127.0.0.1:60001'	: {
	 *				ip	: '',
	 *				port	: 0,
	 *				address	: '',
	 *				socket	: null
	 *			},
	 *			...
	 *		}
	 *	@return	{void}
	 */
	start( oSeeds )
	{
		//
		//	initializing peers
		//
		this.m_oSeeds = DeUtilsCore.isPlainObject( oSeeds ) ? oSeeds : {};

		//
		//	try to initialize with initializing peers
		//
		this._handleNewPeers( this.m_oSeeds );

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
	 *	@return	{void}
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
	 *	handle message given by caller
	 *	* I AM A CALLEE, THE MESSAGE WAS DELIVERED BY CALLER
	 *
	 *	@param	{function}	oSocket
	 *	@param	{object}	oMessage
	 *	@param	{number}	oMessage.type
	 *	@param	{object}	[oMessage.digest=]
	 *	@param	{object}	[oMessage.request_digest=]
	 *	@param	{array}		[oMessage.updates=]
	 *	@return	{*}
	 */
	onMessage( oSocket, oMessage )
	{
		if ( ! oSocket )
		{
			return this._emitErrorLog( `call onMessage with invalid oSocket: ${ JSON.stringify( oSocket ) }.` );
		}
		if ( ! DeUtilsCore.isPlainObjectWithKeys( oMessage, 'type' ) )
		{
			return this._emitErrorLog( `call onMessage with invalid oMessage: ${ JSON.stringify( oMessage ) }.` );
		}
		if ( ! this.isValidMessageType( oMessage.type ) )
		{
			return this._emitErrorLog( `call onMessage with invalid oMessage.type: ${ JSON.stringify( oMessage.type ) }.` );
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
				//		'wss://127.0.0.1:9011'	: m_nMaxVersionSeen,
				//		'tcp://127.0.0.1:9012'	: m_nMaxVersionSeen,
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
				//		[ sPeerUrl, key, value, version ],
				//		[ sPeerUrl, key, value, version ],
				//		...
				// 	],
				//	oMsg.request_digest
				//	{
				// 		sPeerUrl	: 0,
				// 		sPeerUrl	: nLocalMaxVersion,
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
				//		[ sPeerUrl, sKey, vValue, nVersion ],
				//		[ sPeerUrl, sKey, vValue, nVersion ],
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

	/**
	 *	update socket
	 *
	 *	@param	{object}	oSockets
	 *		{
	 *			'wss://127.0.0.1:60001'	: {
	 *				ip	: '',
	 *				port	: 0,
	 *				address	: '',
	 *				socket	: null
	 *			},
	 *			...
	 *		}
	 *	@return	{number}
	 */
	updateSockets( oSockets )
	{
		let nCount = 0;

		if ( DeUtilsCore.isPlainObject( oSockets ) )
		{
			for ( let oSocket in oSockets )
			{
				if ( ! DeUtilsCore.isPlainObjectWithKeys( oSocket, 'url' ) ||
					! GossiperUtils.isValidPeerUrl( oSocket.url ) )
				{
					continue;
				}

				if ( this.m_oRemotePeers[ oSocket.url ] )
				{
					this.m_oRemotePeers[ oSocket.url ].updateConfigItem( 'socket', oSockets );
					nCount ++;
				}
			}
		}

		return nCount;
	}


	/**
	 * 	check if the nType is a valid message type
	 *
	 *	@param	{number}	nType
	 *	@return {boolean}
	 */
	isValidMessageType( nType )
	{
		return DeUtilsCore.isNumeric( nType ) &&
			[ REQUEST, FIRST_RESPONSE, SECOND_RESPONSE ].includes( nType );
	}

	/**
	 *	get peer by url
	 *
	 *	@param	{string}	sPeerUrl
	 *	@return {*}
	 */
	getPeer( sPeerUrl )
	{
		let oPeer	= null;

		if ( DeUtilsCore.isExistingString( sPeerUrl ) )
		{
			oPeer = this.m_oRemotePeers[ sPeerUrl ];
		}

		return oPeer;
	}

	/**
	 *	create a new peer or return existed instance
	 *
	 *	@param	{string}	sPeerUrl
	 *	@param	{object}	oPeerConfig
	 *	@return {*}
	 */
	createPeer( sPeerUrl, oPeerConfig )
	{
		let oPeer	= null;
		let bExists	= false;

		if ( GossiperUtils.isValidPeerUrl( sPeerUrl ) )
		{
			if ( this.m_oRemotePeers[ sPeerUrl ] )
			{
				//
				//	already exists
				//
				bExists	= true;
				oPeer	= this.m_oRemotePeers[ sPeerUrl ];
			}
			else
			{
				//
				//	create new
				//
				bExists	= false;

				let oPeerOptions = Object.assign( {}, oPeerConfig );
				this.m_oRemotePeers[ sPeerUrl ] = new GossiperPeer( oPeerOptions );
				oPeer	= this.m_oRemotePeers[ sPeerUrl ];

				//
				//	emit events and listen
				//
				this.emit( 'new_peer', sPeerUrl );
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
	 *	@param	{string}	sPeerUrl
	 *	@return {Array}
	 */
	getPeerAllKeys( sPeerUrl )
	{
		let arrKeys	= null;
		let oPeer	= this.m_oRemotePeers[ sPeerUrl ];

		if ( oPeer )
		{
			arrKeys	= oPeer.getAllKeys();
		}

		return arrKeys;
	}

	/**
	 *	get peer value
	 *
	 *	@param	{string}	sPeerUrl
	 *	@param	{string}	sKey
	 *	@return {*}
	 */
	getPeerValue( sPeerUrl, sKey )
	{
		let vValue	= null;
		let oPeer	= this.m_oRemotePeers[ sPeerUrl ];

		if ( oPeer )
		{
			vValue	= oPeer.getValue( sKey );
		}

		return vValue;
	}

	/**
	 *	get all peer urls
	 *
	 *	@return {Array}
	 *
	 * 	@description
	 *	this.m_oRemotePeers
	 *	{
	 *		'wss://127.0.0.1:6001'	: { ... },
	 *		'wss://127.0.0.1:6002'	: { ... },
	 *	}
	 */
	getAllPeerUrls()
	{
		let arrUrls = [];

		for ( let sPeerUrl in this.m_oRemotePeers )
		{
			arrUrls.push( sPeerUrl );
		}

		return arrUrls;
	}

	/**
	 *	get live peer name list
	 *
	 *	@return {Array}
	 *
	 * 	@description
	 * 	@see	.getAllPeerUrls()
	 */
	getLivePeerUrls()
	{
		let arrUrls = [];

		for ( let sPeerUrl in this.m_oRemotePeers )
		{
			if ( this.m_oRemotePeers[ sPeerUrl ].isAlive() )
			{
				arrUrls.push( sPeerUrl );
			}
		}

		return arrUrls;
	}

	/**
	 *	get dead peers
	 *
	 *	@return {Array}
	 *
	 * 	@description
	 * 	@see	.getAllPeerUrls()
	 */
	getDeadPeerUrls()
	{
		let arrUrls = [];

		for ( let sPeerUrl in this.m_oRemotePeers )
		{
			if ( ! this.m_oRemotePeers[ sPeerUrl ].isAlive() )
			{
				arrUrls.push( sPeerUrl );
			}
		}

		return arrUrls;
	}


	/**
	 *	The method of choosing which peer(s) to gossip to is borrowed from Cassandra.
	 *	They seemed to have worked out all of the edge cases
	 *
	 *	@see http://wiki.apache.org/cassandra/ArchitectureGossip
	 */
	_gossip()
	{
		let arrLivePeerUrls	= this.getLivePeerUrls();
		let arrDeadPeerUrls	= this.getDeadPeerUrls();
		let sLivePeerUrl	= null;
		let sDeadPeerUrl	= null;

		//
		//	Find a live peer to gossip to
		//
		if ( arrLivePeerUrls.length > 0 )
		{
			sLivePeerUrl	= this._chooseRandom( arrLivePeerUrls );
			this._gossipToPeer( sLivePeerUrl );
		}

		//
		//	possibly gossip to a dead peer
		//
		let fProb = arrDeadPeerUrls.length / ( arrLivePeerUrls.length + 1 );
		if ( fProb > Math.random() )
		{
			sDeadPeerUrl	= this._chooseRandom( arrDeadPeerUrls );
			this._gossipToPeer( sDeadPeerUrl );
		}

		//
		//	Gossip to seed under certain conditions
		//
		if ( sLivePeerUrl && ! this.m_oSeeds[ sLivePeerUrl ] &&
			arrLivePeerUrls.length < this.m_oSeeds.length )
		{
			if ( Math.random() < ( this.m_oSeeds.length / this.getAllPeerUrls().length ) )
			{
				let arrCertainPeerUrl	= this._chooseRandom( Object.keys( this.m_oRemotePeers ) );
				this._gossipToPeer( arrCertainPeerUrl );
			}
		}

		//
		//	Check health of m_oRemotePeers
		//
		for ( let i in this.m_oRemotePeers )
		{
			let oPeer = this.m_oRemotePeers[ i ];
			if ( oPeer !== this.m_oLocalPeer )
			{
				oPeer.checkIfSuspect();
			}
		}

		//console.log( `${ new Date().toString() } :: gossip live: ${ arrLivePeerUrls.length }, dead: ${ arrDeadPeerUrls.length }` );
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
	 *	@param	{string}	sPeerUrl
	 */
	_gossipToPeer( sPeerUrl )
	{
		if ( ! GossiperUtils.isValidPeerUrl( sPeerUrl ) )
		{
			return this._emitErrorLog( `call _gossipToPeer with invalid sPeerUrl: ${ JSON.stringify( sPeerUrl ) }` );
		}

		let oPeer = this.getPeer( sPeerUrl );
		if ( oPeer )
		{
			//
			//	send REQUEST message to peer
			//
			this._sendMessage( oPeer.getSocket(), this._requestMessage() );
		}
		else
		{
			this._emitErrorLog( `Peer not found by sPeerUrl: ${ JSON.stringify( sPeerUrl ) }` );
		}
	}


	////////////////////////////////////////////////////////////////////////////////
	//	MESSSAGES
	////////////////////////////////////////////////////////////////////////////////

	/**
	 *	handle new peers
	 *
	 *	@param	{object}	oNewPeers
	 *		{
	 *			'wss://127.0.0.1:60001'	: {
	 *				ip	: '',
	 *				port	: 0,
	 *				address	: '',
	 *				socket	: null
	 *			},
	 *			...
	 *		}
	 *	@return	{number}
	 */
	_handleNewPeers( oNewPeers )
	{
		if ( ! DeUtilsCore.isPlainObject( oNewPeers ) )
		{
			return 0;
		}

		//
		//	arrNewPeers
		//	[
		//		sPeerUrl,
		//		sPeerUrl,
		//		...
		// 	]
		//
		let nCount		= 0;
		let arrPeerNames	= Object.keys( oNewPeers );

		for ( let i = 0; i < arrPeerNames.length; i ++ )
		{
			let sPeerUrl	= arrPeerNames[ i ];
			let oPeerConfig	= oNewPeers[ sPeerUrl ];

			if ( GossiperUtils.isValidPeerUrl( sPeerUrl ) )
			{
				let oPeerData	= this.createPeer( sPeerUrl, oPeerConfig );
				if ( oPeerData.peer )
				{
					if ( ! oPeerData.exists )
					{
						nCount ++;
					}
				}
			}
		}

		return nCount;
	}

	/**
	 *	listen to peer
	 *
	 *	@param oPeer
	 */
	_listenToPeer( oPeer )
	{
		if ( ! oPeer )
		{
			return false;
		}

		//	...
		oPeer.on( 'peer_update', ( sKey, vValue ) =>
		{
			this.emit( 'peer_update', oPeer.getUrl(), sKey, vValue );
		});
		oPeer.on( 'peer_alive', () =>
		{
			this.emit( 'peer_alive', oPeer.getUrl() );
		});
		oPeer.on( 'peer_failed', () =>
		{
			this.emit( 'peer_failed', oPeer.getUrl() );
		});

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
		//		'wss://127.0.0.1:9011'	: m_nMaxVersionSeen,
		//		'wss://127.0.0.1:9012'	: m_nMaxVersionSeen,
		//	}
		//
		return {
			type	: REQUEST,
			digest	: this.m_oScuttle.digest(),
		};
	}

	/**
	 *	first response
	 *
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
		//		[ sPeerUrl, key, value, version ],
		//		[ sPeerUrl, key, value, version ],
		//		...
		// 	],
		//	requests	>>> return.request_digest
		//	{
		// 		sPeerUrl	: 0,
		// 		sPeerUrl	: nLocalMaxVersion,
		//		...
		//	},
		//	new_peers
		//	[
		//		sPeerUrl,
		//		sPeerUrl,
		//		...
		// 	]
		//
		let oScuttle = this.m_oScuttle.scuttle( oPeerDigest );

		//
		//	TODO
		//	to handle new peers
		//
		this._handleNewPeers( oScuttle.new_peers );
		return {
			type		: FIRST_RESPONSE,
			request_digest	: oScuttle.requests,
			updates		: oScuttle.deltas
		};
	}

	/**
	 * 	second response
	 *
	 *	@param	oRequests
	 *	@return {{type: number, updates: Array}}
	 */
	_secondResponseMessage( oRequests )
	{
		//
		//	oRequests
		//	{
		// 		sPeerUrl	: 0,
		// 		sPeerUrl	: nLocalMaxVersion,
		//		...
		//	}
		//
		//
		//	return.updates
		//	[
		//		[ sPeerUrl, sKey, vValue, nVersion ],
		//		[ sPeerUrl, sKey, vValue, nVersion ],
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
	 *
	 *	@param	{}	vData
	 *	@private
	 */
	_emitInfoLog( vData )
	{
		return this._emitLog( 'info', vData );
	}

	/**
	 *	emit an error to caller
	 *
	 *	@param	{}	vData
	 *	@private
	 */
	_emitErrorLog( vData )
	{
		return this._emitLog( 'error', vData );
	}

	/**
	 *	emit a message to caller
	 *
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