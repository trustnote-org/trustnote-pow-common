const { EventEmitter }		= require( 'events' );
const { DeUtilsCore }		= require( 'deutils.js' );
const { DeUtilsNetwork }	= require( 'deutils.js' );

const { GossiperDetector }	= require( './gossiper-detector' );
const { GossiperUtils }		= require( './gossiper-utils' );


/**
 * 	@constants
 */
const MAX_PHI		=  8;




/**
 *	@class GossiperPeer
 */
class GossiperPeer extends EventEmitter
{
	/**
	 *	@constructor
	 *
	 *	@param	{object}	oOptions
	 *	@param	{string}	[oOptions.url=]		- peer url 'wss://127.0.0.1:6000', 'udp|tcp...://127.0.0.1:6000' or undefined
	 *	@param	{string}	[oOptions.address=]	- super node address
	 *	@param	{function}	[oOptions.signer=]	- signer function provided by super node
	 *	@param	{object}	[oOptions.socket=]	- socket handle which connect to the super node
	 */
	constructor( oOptions )
	{
		super();

		//
		//	configurations
		//
		this.m_oConfig =
			{
				url	: '',
				address	: '',
				singer	: null,
				socket	: null,
			};
		this.updateConfig( oOptions );

		//
		//	attributes
		//
		this.m_bAlive			= true;

		this.m_oAttributes		= {};
		this.m_nMaxVersionSeen		= 0;
		this.m_nHeartbeatVersion	= 0;

		this.m_oDetector		= new GossiperDetector();
	}

	/**
	 * 	get peer url
	 *	@return {string|null}	'wss://127.0.0.1:5001'
	 */
	getUrl()
	{
		return this.getConfigItem( 'url' );
	}

	/**
	 *	get socket handle
	 *	@return {*}
	 */
	getSocket()
	{
		return this.getConfigItem( 'socket' );
	}

	/**
	 *	get config
	 *
	 *	@return { { url: string, address: string, singer: null, socket: null } }
	 */
	getConfig()
	{
		return this.m_oConfig;
	}

	/**
	 *	update configurations
	 *
	 *	@param	{object}	oOptions
	 *	@param	{string}	[oOptions.url=]		- peer url
	 *	@param	{string}	[oOptions.address=]	- super node address
	 *	@param	{function}	[oOptions.signer=]	- signer function provided by super node
	 *	@param	{object}	[oOptions.socket=]	- socket handle which connect to the super node
	 */
	updateConfig( oOptions )
	{
		this.updateConfigItem( oOptions, 'url' );
		this.updateConfigItem( oOptions, 'address' );
		this.updateConfigItem( oOptions, 'signer' );
		this.updateConfigItem( oOptions, 'socket' );
	}

	/**
	 *	get config item
	 *
	 *	@param	{string}	sKey
	 *	@return {*}
	 */
	getConfigItem( sKey )
	{
		let vRet = null;

		if ( DeUtilsCore.isExistingString( sKey ) &&
			DeUtilsCore.isPlainObjectWithKeys( this.m_oConfig, sKey ) )
		{
			vRet = this.m_oConfig[ sKey ];
		}

		return vRet;
	}

	/**
	 *	update config item by key
	 *
	 *	@param	{object}	oOptions
	 *	@param	{string}	sKey
	 *	@return	{boolean}
	 */
	updateConfigItem( oOptions, sKey )
	{
		let bRet = false;

		if ( DeUtilsCore.isExistingString( sKey ) &&
			DeUtilsCore.isPlainObjectWithKeys( oOptions, sKey ) )
		{
			bRet = true;
			this.m_oConfig[ sKey ] = oOptions[ sKey ];
		}

		return bRet;
	}

	/**
	 * 	get status of a this peer: alive or not
	 *	@return {boolean}
	 */
	isAlive()
	{
		return this.m_bAlive;
	}

	/**
	 * 	mark this as alive
	 */
	markAlive()
	{
		if ( ! this.m_bAlive )
		{
			this.m_bAlive = true;
			this.emit( 'peer_alive' );
		}
	}

	/**
	 * 	mark this as dead
	 */
	markDead()
	{
		if ( this.m_bAlive )
		{
			this.m_bAlive = false;
			this.emit( 'peer_failed' );
		}
	}

	/**
	 *	check if this is suspect
	 *
	 *	@return {boolean}
	 *
	 * 	@description
	 *	The getTime() method returns the numeric value corresponding to the time for the specified date according to universal time.
	 *	getTime() always uses UTC for time representation.
	 *	For example, a client browser in one timezone, getTime() will be the same as a client browser in any other timezone.
	 */
	checkIfSuspect()
	{
		//
		//	milliseconds since Jan 1, 1970, 00:00:00.000 GMT
		//
		let nPhi = this.m_oDetector.phi( new Date().getTime() );

		if ( nPhi > MAX_PHI )
		{
			this.markDead();
			return true;
		}
		else
		{
			this.markAlive();
			return false;
		}
	}



	/**
	 *	get keys
	 *	@return {Array}
	 */
	getAllKeys()
	{
		return Object.keys( this.m_oAttributes );
	}



	/**
	 *	get value
	 *	@param	{}	sKey
	 *	@return {*}
	 */
	getValue( sKey )
	{
		if ( this.m_oAttributes.hasOwnProperty( sKey ) &&
			Array.isArray( this.m_oAttributes[ sKey ] ) &&
			this.m_oAttributes[ sKey ].length >= 2 )
		{
			//
			//	0	- value
			//	1	- version
			//
			return this.m_oAttributes[ sKey ][ 0 ];
		}

		return undefined;
	}

	/**
	 * 	set value with version by key
	 *
	 *	@param	{string}	sKey
	 *	@param	{}		vValue
	 *	@param	{number}	nVersion
	 *	@param	{function}	pfnCallback( err )
	 */
	setValue( sKey, vValue, nVersion, pfnCallback )
	{
		if ( ! DeUtilsCore.isExistingString( sKey ) )
		{
			return pfnCallback( `call setValue with invalid sKey: ${ JSON.stringify( sKey ) }` );
		}

		this.m_oAttributes[ sKey ] = [ vValue, nVersion ];
		this.emit( 'update', sKey, vValue );

		//	...
		pfnCallback( null );
	}


	/**
	 *	deltas after version
	 *
	 *	@param	{number}	nLowestVersion
	 *	@return {Array}
	 */
	getDeltasAfterVersion( nLowestVersion )
	{
		let arrDeltas	= [];

		for ( let sKey in this.m_oAttributes )
		{
			let vValue	= this.m_oAttributes[ sKey ][ 0 ];
			let nVersion	= this.m_oAttributes[ sKey ][ 1 ];

			if ( nVersion > nLowestVersion )
			{
				arrDeltas.push( [ sKey, vValue, nVersion ] );
			}
		}

		return arrDeltas;
	}

	/**
	 *	update with delta
	 *	@param	{}		sKey
	 *	@param	{}		vValue
	 * 	@param	{number}	nVersion
	 * 	@param	{function}	pfnCallback( err, bUpdated )
	 */
	updateWithDelta( sKey, vValue, nVersion, pfnCallback )
	{
		if ( ! DeUtilsCore.isExistingString( sKey ) )
		{
			return pfnCallback( `call updateWithDelta with invalid sKey: ${ JSON.stringify( sKey ) }` );
		}
		if ( ! DeUtilsCore.isNumeric( nVersion ) )
		{
			return pfnCallback( `call updateWithDelta with invalid nVersion: ${ JSON.stringify( nVersion ) }` );
		}

		//
		//	It's possibly to get the same updates more than once if we're gossiping with multiple peers at once
		//	ignore them
		//
		if ( nVersion > this.m_nMaxVersionSeen )
		{
			this.m_nMaxVersionSeen = nVersion;
			this.setValue( sKey, vValue, nVersion, err =>
			{
				if ( err )
				{
					return pfnCallback( err );
				}

				if ( '__heartbeat__' === sKey )
				{
					this.m_oDetector.add( new Date().getTime() );
				}

				//	yes, updated successfully
				pfnCallback( null, true );
			});
		}
		else
		{
			//	not updated
			pfnCallback( null, false );
		}
	}

	/**
	 * 	This is used when the peerState is owned by this peer
	 *	@param	{string}	sKey
	 *	@param	{}		vValue
	 *	@param	{function}	pfnCallback( err )
	 *	@return	{boolean}
	 */
	updateLocalValue( sKey, vValue, pfnCallback )
	{
		if ( ! DeUtilsCore.isExistingString( sKey ) )
		{
			return pfnCallback( `call updateLocalValue with invalid sKey: ${ JSON.stringify( sKey ) }` );
		}

		this.m_nMaxVersionSeen += 1;
		this.setValue( sKey, vValue, this.m_nMaxVersionSeen, err =>
		{
			if ( err )
			{
				return pfnCallback( err );
			}

			pfnCallback( null );
		});
	}

	/**
	 *	beat heart
	 */
	beatHeart()
	{
		this.m_nHeartbeatVersion += 1;
		this.updateLocalValue( '__heartbeat__', this.m_nHeartbeatVersion, err =>
		{
		});
	}

}




/**
 *	@exports
 */
module.exports	=
{
	GossiperPeer	: GossiperPeer
};



