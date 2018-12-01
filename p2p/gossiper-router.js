const { EventEmitter }		= require( 'events' );
const { DeUtilsCore }		= require( 'deutils.js' );
const { DeUtilsNetwork }	= require( 'deutils.js' );

const { GossiperDetector }	= require( './gossiper-detector' );
const { GossiperUtils }		= require( './gossiper-utils' );


/**
 * 	@constants
 */
const REFRESH_INTERVAL		= 1000;




/**
 *	@class GossiperRouter
 */
class GossiperRouter extends EventEmitter
{
	/**
	 *	@constructor
	 */
	constructor()
	{
		super();

		//
		//	router map
		//	{
		//		'wss://127.0.0.1:50000'	:
		// 		{
		//			address	: 'node address',
		//			lastTs	: 1543652041735,
		// 		},
		//		...
		// 	}
		//
		this.m_oRouterMap	= {};

		//
		//	start timer
		//
		this.m_nRefreshTimer	= setInterval
		(
			() =>
			{
				this._handleRefresh();
			},
			REFRESH_INTERVAL
		);
	}

	/**
	 *	update multi-socket
	 *
	 *	@param	{object}	oMultiSockets
	 *		{
	 *			'wss://127.0.0.1:60001'	: oSocket,
	 *			...
	 *		}
	 *		{object}	oSocket
	 *		{
	 *				address	: 'node address',
	 *		}
	 *	@return	{number}	- count of successfully updated
	 */
	updateMultiSockets( oMultiSockets )
	{
		let nCount = 0;

		if ( DeUtilsCore.isPlainObject( oMultiSockets ) )
		{
			for ( let sUrl in oMultiSockets )
			{
				let oSocket = oMultiSockets[ sUrl ];

				//
				//	update single socket
				//
				if ( this.updateSocket( oSocket, oSocket ) )
				{
					nCount ++;
				}
			}
		}

		return nCount;
	}

	/**
	 * 	renew/update/add a socket
	 *
	 *	@param	{object}	oSocket
	 *	@param	{object}	oOptions
	 */
	updateSocket( oSocket, oOptions )
	{
		let bRet	= false;
		let sAddress	= DeUtilsCore.isPlainObject( oOptions ) ? oOptions.address : null;

		if ( DeUtilsCore.isPlainObjectWithKeys( oSocket, 'url' ) &&
			GossiperUtils.isValidPeerUrl( oSocket.url ) )
		{
			if ( DeUtilsCore.isPlainObject( this.m_oRouterMap[ oSocket.url ] ) )
			{
				//
				//	update
				//
				bRet = true;
				this.m_oRouterMap[ oSocket.url ].socket		= oSocket;
				this.m_oRouterMap[ oSocket.url ].address	= sAddress;
				this.m_oRouterMap[ oSocket.url ].lastTs		= this._getCurrentTimestamp();
			}
			else
			{
				//
				//	create new
				//
				bRet = true;
				this.m_oRouterMap[ oSocket.url ] = {
					socket	: oSocket,
					address	: sAddress,
					lastTs	: this._getCurrentTimestamp(),
				};
			}
		}

		return bRet;
	}

	/**
	 * 	get socket object
	 *
	 *	@param	{string}	sUrl
	 *	@return {*}
	 */
	getSocket( sUrl )
	{
		let oRet = null;

		if ( GossiperUtils.isValidPeerUrl( sUrl ) &&
			DeUtilsCore.isPlainObjectWithKeys( this.m_oRouterMap[ sUrl ], 'socket' ) )
		{
			oRet = this.m_oRouterMap[ sUrl ].socket;
		}

		return oRet;
	}

	/**
	 * 	get socket object by address
	 *
	 *	@param	{string}	sAddress
	 *	@return {*}
	 */
	getSocketByAddress( sAddress )
	{
		let oRet = null;

		if ( DeUtilsCore.isExistingString( sAddress ) )
		{
			for ( let sUrl in this.m_oRouterMap )
			{
				let oPeer = this.m_oRouterMap[ sUrl ];
				if ( DeUtilsCore.isPlainObjectWithKeys( oPeer, 'address' ) &&
					sAddress === oPeer.address )
				{
					oRet = oPeer.socket;
				}
			}
		}

		return oRet;
	}

	/**
	 *	get address
	 *
	 *	@param	{string}	sUrl
	 *	@return {*}
	 */
	getAddress( sUrl )
	{
		let sRet = null;

		if ( GossiperUtils.isValidPeerUrl( sUrl ) &&
			DeUtilsCore.isPlainObjectWithKeys( this.m_oRouterMap[ sUrl ], 'address' ) )
		{
			sRet = this.m_oRouterMap[ sUrl ].address;
		}

		return sRet;
	}

	/**
	 *	get last timestamp
	 *
	 *	@param	{string}	sUrl
	 *	@return {number}
	 */
	getLastTimestamp( sUrl )
	{
		let nRet = 0;

		if ( GossiperUtils.isValidPeerUrl( sUrl ) &&
			DeUtilsCore.isPlainObjectWithKeys( this.m_oRouterMap[ sUrl ], 'lastTs' ) )
		{
			nRet = this.m_oRouterMap[ sUrl ].lastTs;
		}

		return nRet;
	}



	/**
	 * 	get last timestamp
	 *
	 *	@return {number}
	 *	@private
	 */
	_getCurrentTimestamp()
	{
		return Date.now();
	}

	/**
	 * 	handle refresh
	 *
	 *	@private
	 */
	_handleRefresh()
	{
		//
		//	to refresh router
		//
	}

}




/**
 *	@exports
 */
module.exports	=
{
	GossiperRouter	: GossiperRouter
};



