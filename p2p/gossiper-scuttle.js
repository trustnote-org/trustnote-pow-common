const { DeUtilsCore }		= require( 'deutils.js' );
const { DeUtilsNetwork }	= require( 'deutils.js' );



/**
 * 	@class GossiperScuttle
 *	@type {GossiperScuttle}
 */
class GossiperScuttle
{
	constructor( oPeers, oLocalPeer )
	{
		this.m_oPeers		= oPeers;
		this.m_oLocalPeer	= oLocalPeer;
	}

	/**
	 *	digest
	 *	All peers( ip:port ) I known and the max version of data stored here.
	 *
	 * 	@return
	 * 	{
	 * 		'127.0.0.1:9011'	: m_nMaxVersionSeen,
	 * 		'127.0.0.1:9012'	: m_nMaxVersionSeen,
	 * 		...
	 * 	}
	 */
	digest()
	{
		let oDigest	= {};
		let arrPeerNames	= Object.keys( this.m_oPeers );

		for ( let i = 0; i < arrPeerNames.length; i ++ )
		{
			let sPeerName		= arrPeerNames[ i ];
			let oPeer		= this.m_oPeers[ sPeerName ];
			oDigest[ sPeerName ]	= oPeer.m_nMaxVersionSeen;
		}

		return oDigest;
	}


	/**
	 *	* HEART OF THE BEAST *
	 *
	 *	@param	{object}	oDigest
	 *		all peers( ip:port ) known by the peer and the max version of data stored in the peer.
	 *		for example:
	 *		{
	 *			'127.0.0.1:9000'	: 1,	//	max version
	 *			'127.0.0.1:9001'	: 2,	//	max version
	 *		}
	 *	@return	{object}
	 */
	scuttle( oDigest )
	{
		let arrDeltasWithPeer	= [];
		let oRequests		= {};
		let arrNewPeers		= [];

		for ( let sPeerName in oDigest )
		{
			if ( ! oDigest.hasOwnProperty( sPeerName ) )
			{
				continue;
			}

			//
			//	sPeerName	- 'ip:port'
			//
			let oLocalPeer		= this.m_oPeers[ sPeerName ];
			let nLocalMaxVersion	= this.getMaxVersionSeenOfPeer( sPeerName );
			let nDigestMaxVersion	= oDigest[ sPeerName ];

			if ( ! this.m_oPeers[ sPeerName ] )
			{
				//
				//	We don't know about this peer.
				// 	Request all information.
				//
				oRequests[ sPeerName ]	= 0;
				arrNewPeers.push( sPeerName );
			}
			else if ( nLocalMaxVersion > nDigestMaxVersion )
			{
				//
				//	We have more recent information for this peer.
				// 	Build up deltas.
				//
				//	{
				//		peer	: peer name,
				//		deltas	:
				//		[
				//			[ sKey, vValue, nVersion ],
				//			[ sKey, vValue, nVersion ],
				//			[ sKey, vValue, nVersion ],
				// 		]
				// 	}
				//
				//
				arrDeltasWithPeer.push
				(
					{
						peer	: sPeerName,
						deltas	: oLocalPeer.getDeltasAfterVersion( nDigestMaxVersion )
					}
				);
			}
			else if ( nLocalMaxVersion < nDigestMaxVersion )
			{
				//
				//	They have more recent information.
				// 	Request it.
				//
				oRequests[ sPeerName ] = nLocalMaxVersion;
			}
			else
			{
				//
				//	Everything is the same.
				//
			}
		}

		//
		//	Sort by peers with most deltas
		//
		arrDeltasWithPeer.sort
		(
			( a, b ) =>
			{
				return ( b.deltas.length - a.deltas.length );
			}
		);

		let arrDeltas = [];
		for ( let i = 0; i < arrDeltasWithPeer.length; i ++ )
		{
			let oPeer		= arrDeltasWithPeer[ i ];
			let arrPeerDeltas	= oPeer.deltas;

			//
			//	Sort deltas by version number ASC
			//
			//	arrPeerDeltas
			//	[
			//		[ key, value, version ],
			//		[ key, value, version ],
			//		[ key, value, version ],
			// 	]
			//
			arrPeerDeltas.sort
			(
				( a, b ) =>
				{
					return a[ 2 ] - b[ 2 ];
				}
			);

			if ( arrPeerDeltas.length > 1 )
			{
				//	console.log(peer_deltas);
			}

			for ( let j in arrPeerDeltas )
			{
				let arrDelta	= null;

				//
				//	step 1:
				//	arrDelta	- [ key, value, version ]
				//
				arrDelta	= arrPeerDeltas[ j ];

				//
				//	step 2:
				//	Array.unshift() method adds one or more elements to the beginning of an array
				// 	and returns the new length of the array.
				//
				//	arrDelta	- [ sPeerName, key, value, version ]
				//
				arrDelta.unshift( oPeer.peer );

				//
				//	build into list arrDeltas
				//
				arrDeltas.push( arrDelta );
			}
		}

		//
		//
		//	arrDeltas
		//	[
		//		[ sPeerName, key, value, version ],
		//		[ sPeerName, key, value, version ],
		//		...
		// 	],
		//	oRequests
		//	{
		// 		sPeerName	: 0,
		// 		sPeerName	: nLocalMaxVersion,
		//		...
		//	},
		//	arrNewPeers
		//	[
		//		sPeerName,
		//		sPeerName,
		//		...
		// 	]
		//
		return {
			'deltas'	: arrDeltas,		//	for updates
			'requests'	: oRequests,
			'new_peers'	: arrNewPeers
		};
	}

	/**
	 *	get max version seen of peer
	 *	@param	{string}	sPeerName
	 *	@return	{number}
	 */
	getMaxVersionSeenOfPeer( sPeerName )
	{
		let nRet	= 0;

		if ( DeUtilsCore.isExistingString( sPeerName ) &&
			DeUtilsCore.isPlainObject( this.m_oPeers[ sPeerName ] ) )
		{
			nRet = this.m_oPeers[ sPeerName ].m_nMaxVersionSeen;
		}

		return nRet;
	}

	/**
	 *	update known state
	 *	@param	arrDeltas
	 */
	updateKnownState( arrDeltas )
	{
		if ( ! Array.isArray( arrDeltas ) )
		{
			return false;
		}

		//
		//	arrDeltas
		//	[
		//		[ sPeerName, key, value, version ],
		//		[ sPeerName, key, value, version ],
		//		...
		// 	],
		//
		for ( let i = 0; i < arrDeltas.length; i ++ )
		{
			let arrDelta	= arrDeltas[ i ];
			if ( ! Array.isArray( arrDelta ) || arrDelta.length < 4 )
			{
				continue;
			}

			//
			//	Array.shift() method removes the first element from an array and
			// 	returns that removed element. This method changes the length of the array.
			//
			let sPeerName	= arrDelta.shift();
			if ( DeUtilsCore.isExistingString( sPeerName ) )
			{
				let oDeltaPeer	= this.m_oPeers[ sPeerName ];
				if ( oDeltaPeer )
				{
					let sKey	= arrDelta[ 0 ];
					let vValue	= arrDelta[ 1 ];
					let nVersion	= arrDelta[ 2 ];

					if ( DeUtilsCore.isExistingString( sKey ) &&
						DeUtilsCore.isNumeric( nVersion ) )
					{
						//
						//	Okay, update now
						//
						oDeltaPeer.updateWithDelta( sKey, vValue, nVersion, err =>
						{
						});
					}
				}
			}
		} // end for

		return true;
	}


	/**
	 *	build updates for SECOND_RESPONSE
	 *	@param	{object}	oRequests
	 *	@return	{Array}
	 */
	fetchDeltas( oRequests )
	{
		//
		//	oRequests
		//	{
		// 		sPeerName	: 0,
		// 		sPeerName	: nLocalMaxVersion,
		//		...
		//	}
		//
		if ( ! DeUtilsCore.isPlainObject( oRequests ) )
		{
			return [];
		}

		//	...
		let arrDeltas = [];

		for ( let sPeerName in oRequests )
		{
			let nMaxVersionSeenByPeer = oRequests[ sPeerName ];
			if ( ! DeUtilsCore.isNumeric( nMaxVersionSeenByPeer ) )
			{
				continue;
			}

			let oPeer = this.m_oPeers[ sPeerName ];
			if ( oPeer )
			{
				//
				//
				//	arrPeerDeltas
				//	[
				//		[ sKey, vValue, nVersion ],
				//		[ sKey, vValue, nVersion ],
				//		...
				// 	]
				//
				let arrPeerDeltas = oPeer.getDeltasAfterVersion( nMaxVersionSeenByPeer );

				//	Sort deltas by version number ASC
				arrPeerDeltas.sort
				(
					( a, b ) =>
					{
						return a[ 2 ] - b[ 2 ];
					}
				);

				for ( let j in arrPeerDeltas )
				{
					//
					//	Array.unshift() method adds one or more elements to the beginning of an array
					// 	and returns the new length of the array.
					//	arrPeerDeltas[ j ]
					//	-	[ sPeerName, sKey, vValue, nVersion ],
					//
					arrPeerDeltas[ j ].unshift( sPeerName );
					arrDeltas.push( arrPeerDeltas[ j ] );
				}
			}
		}

		//
		//	arrDeltas
		//	[
		//		[ sPeerName, sKey, vValue, nVersion ],
		//		[ sPeerName, sKey, vValue, nVersion ],
		//		...
		// 	]
		//
		return arrDeltas;
	}

}





/**
 *	@exports
 *	@type {GossiperScuttle}
 */
module.exports	=
{
	GossiperScuttle	: GossiperScuttle
};
