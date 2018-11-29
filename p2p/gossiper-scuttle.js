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
		let arrPeerUrls	= Object.keys( this.m_oPeers );

		for ( let i = 0; i < arrPeerUrls.length; i ++ )
		{
			let sPeerUrl	= arrPeerUrls[ i ];
			let oPeer	= this.m_oPeers[ sPeerUrl ];

			oDigest[ sPeerUrl ]	= oPeer.m_nMaxVersionSeen;
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

		for ( let sPeerUrl in oDigest )
		{
			if ( ! oDigest.hasOwnProperty( sPeerUrl ) )
			{
				continue;
			}

			//
			//	sPeerName	- 'ip:port'
			//
			let oLocalPeer		= this.m_oPeers[ sPeerUrl ];
			let nLocalMaxVersion	= this.getMaxVersionSeenOfPeer( sPeerUrl );
			let nDigestMaxVersion	= oDigest[ sPeerUrl ];

			if ( ! this.m_oPeers[ sPeerUrl ] )
			{
				//
				//	We don't know about this peer.
				// 	Request all information.
				//
				oRequests[ sPeerUrl ]	= 0;
				arrNewPeers.push( sPeerUrl );
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
						peer	: sPeerUrl,
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
				oRequests[ sPeerUrl ] = nLocalMaxVersion;
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
	 *
	 *	@param	{string}	sPeerUrl
	 *	@return	{number}
	 */
	getMaxVersionSeenOfPeer( sPeerUrl )
	{
		let nRet	= 0;

		if ( DeUtilsCore.isExistingString( sPeerUrl ) &&
			DeUtilsCore.isPlainObject( this.m_oPeers[ sPeerUrl ] ) )
		{
			nRet = this.m_oPeers[ sPeerUrl ].m_nMaxVersionSeen;
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
		//		[ sPeerUrl, key, value, version ],
		//		[ sPeerUrl, key, value, version ],
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
			let sPeerUrl	= arrDelta.shift();
			if ( DeUtilsCore.isExistingString( sPeerUrl ) )
			{
				let oDeltaPeer	= this.m_oPeers[ sPeerUrl ];
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

		for ( let sPeerUrl in oRequests )
		{
			let nMaxVersionSeenByPeer = oRequests[ sPeerUrl ];
			if ( ! DeUtilsCore.isNumeric( nMaxVersionSeenByPeer ) )
			{
				continue;
			}

			let oPeer = this.m_oPeers[ sPeerUrl ];
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
					arrPeerDeltas[ j ].unshift( sPeerUrl );
					arrDeltas.push( arrPeerDeltas[ j ] );
				}
			}
		}

		//
		//	arrDeltas
		//	[
		//		[ sPeerUrl, sKey, vValue, nVersion ],
		//		[ sPeerUrl, sKey, vValue, nVersion ],
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
