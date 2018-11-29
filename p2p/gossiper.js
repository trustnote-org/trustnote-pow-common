//const _net			= require( 'net' );
//const _msgPack		= require( 'msgpack' );
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
 *	@class Gossiper over Web Socket
 */
class Gossiper extends EventEmitter
{
	/**
	 *	@constructor
	 *
	 *	@param	{object}	oOptions
	 *	@param	{number}	oOptions.interval	- interval in milliseconds for gossiper communication
	 *	@param	{string}	oOptions.ip		- local ip address, '127.0.0.1' or undefined
	 *	@param	{number}	oOptions.port		- local port number
	 *	@param	{string}	oOptions.address	- local super node address
	 *	@param	{function}	oOptions.signer		- local signer function provided by super node
	 *	@param	{object}	oOptions.seeds		- seeds for initializing Gossiper
	 *		{
	 *			'127.0.0.1:60001'	: {
	 *				ip	: '',
	 *				port	: 0,
	 *				address	: '',
	 *				socket	: null
	 *			},
	 *			...
	 *		}
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
		this.m_oOtherPeers	= {};
		this.m_oScuttle		= new GossiperScuttle( this.m_oOtherPeers, this.m_oLocalPeer );
	}


	/**
	 * 	start
	 *
	 *	@param	{object}	oSeeds
	 *		{
	 *			'127.0.0.1:60001'	: {
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
	 *	@param	{object}	oSocket
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
	 *	get peer by name
	 *	@param	{string}	sPeerName
	 *	@return {*}
	 */
	getPeer( sPeerName )
	{
		let oPeer	= null;

		if ( DeUtilsCore.isExistingString( sPeerName ) )
		{
			oPeer = this.m_oOtherPeers[ sPeerName ];
		}

		return oPeer;
	}

	/**
	 *	create a new peer or return existed instance
	 *	@param	{string}	sPeerName
	 *	@param	{object}	oPeerConfig
	 *	@return {*}
	 */
	createPeer( sPeerName, oPeerConfig )
	{
		let oPeerName	= GossiperUtils.parsePeerName( sPeerName );
		let oPeer	= null;
		let bExists	= false;

		if ( null !== oPeerName.ip && null !== oPeerName.port )
		{
			if ( this.m_oOtherPeers[ sPeerName ] )
			{
				//
				//	already exists
				//
				bExists	= true;
				oPeer	= this.m_oOtherPeers[ sPeerName ];
			}
			else
			{
				//
				//	create new
				//
				bExists	= false;

				let oPeerOptions = Object.assign( {}, oPeerName, oPeerConfig );
				this.m_oOtherPeers[ sPeerName ] = new GossiperPeer( oPeerOptions );
				oPeer	= this.m_oOtherPeers[ sPeerName ];

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
		let oPeer	= this.m_oOtherPeers[ sPeerName ];

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
		let oPeer	= this.m_oOtherPeers[ sPeerName ];

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
	 *	this.m_oOtherPeers
	 *	{
	 *		peer_name_1	: { ... },
	 *		peer_name_2	: { ... },
	 *	}
	 */
	getAllPeerNames()
	{
		let arrPeerNames = [];

		for ( let sPeerName in this.m_oOtherPeers )
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

		for ( let sPeerName in this.m_oOtherPeers )
		{
			if ( this.m_oOtherPeers[ sPeerName ].isAlive() )
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

		for ( let sPeerName in this.m_oOtherPeers )
		{
			if ( ! this.m_oOtherPeers[ sPeerName ].isAlive() )
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
		//
		if ( sLivePeerName && ! this.m_oSeeds[ sLivePeerName ] &&
			arrLivePeerNames.length < this.m_oSeeds.length )
		{
			if ( Math.random() < ( this.m_oSeeds.length / this.getAllPeerNames().length ) )
			{
				let arrCertainPeerName	= this._chooseRandom( Object.keys( this.m_oOtherPeers ) );
				this._gossipToPeer( arrCertainPeerName );
			}
		}

		//
		//	Check health of m_oOtherPeers
		//
		for ( let i in this.m_oOtherPeers )
		{
			let oPeer = this.m_oOtherPeers[ i ];
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
		if ( ! GossiperUtils.isValidPeerName( sPeerName ) )
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


	////////////////////////////////////////////////////////////////////////////////
	//	MESSSAGES
	////////////////////////////////////////////////////////////////////////////////

	/**
	 *	handle new peers
	 *
	 *	@param	{object}	oNewPeers
	 *		{
	 *			'127.0.0.1:60001'	: {
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
		//		sPeerName,
		//		sPeerName,
		//		...
		// 	]
		//
		let nCount		= 0;
		let arrPeerNames	= Object.keys( oNewPeers );

		for ( let i = 0; i < arrPeerNames.length; i ++ )
		{
			let sPeerName	= arrPeerNames[ i ];
			let oPeerConfig	= oNewPeers[ sPeerName ];

			if ( GossiperUtils.isValidPeerName( sPeerName ) )
			{
				let oPeerData	= this.createPeer( sPeerName, oPeerConfig );
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
		oPeer.on
		(
			'update',
			( sKey, vValue ) =>
			{
				this.emit( 'update', oPeer.getName(), sKey, vValue );
			}
		);
		oPeer.on
		(
			'peer_alive',
			() =>
			{
				this.emit( 'peer_alive', oPeer.getName() );
			}
		);
		oPeer.on
		(
			'peer_failed',
			() =>
			{
				this.emit( 'peer_failed', oPeer.getName() );
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