const { DeUtilsCore }		= require( 'deutils.js' );
const { DeUtilsNetwork }	= require( 'deutils.js' );



/**
 * 	@class GossiperScuttle
 *	@type {GossiperScuttle}
 */
class GossiperUtils
{
	constructor()
	{
	}

	/**
	 *	assemble peer name
	 *
	 *	@param	{string}	sIp
	 *	@param	{number}	nPort
	 *	@return {string}
	 */
	static assemblePeerName( sIp, nPort )
	{
		let sRet	= null;

		if ( DeUtilsNetwork.isValidIpV4( sIp ) &&
			DeUtilsNetwork.isValidPort( nPort ) )
		{
			sRet = `${ String( sIp ) }:${ String( nPort ) }`;
		}

		return sRet;
	}

	/**
	 * 	parse peer name
	 *
	 *	@param	{string}	sName
	 *	@return	{ { ip : {string}, port : {number} }|null }
	 */
	static parsePeerName( sName )
	{
		let sIp		= null;
		let nPort	= null;

		if ( DeUtilsCore.isExistingString( sName ) )
		{
			let arrPeerSplit = sName.split( ":" );
			if ( Array.isArray( arrPeerSplit ) && arrPeerSplit.length >= 2 )
			{
				if ( DeUtilsNetwork.isValidIpV4( arrPeerSplit[ 0 ] ) &&
					DeUtilsNetwork.isValidPort( arrPeerSplit[ 1 ] ) )
				{
					sIp	= String( arrPeerSplit[ 0 ] );
					nPort	= parseInt( arrPeerSplit[ 1 ] );
				}
			}
		}

		return {
			ip	: sIp,
			port	: nPort,
		};
	}

	/**
	 * 	check if the sPeerName is a valid peer name
	 *
	 *	@param	{string}	sPeerName	- '127.0.0.1:8000'
	 *	@return	{boolean}
	 */
	static isValidPeerName( sPeerName )
	{
		let oPeerName	= this.parsePeerName( sPeerName );
		return null !== oPeerName.ip && null !== oPeerName.port;
	}


}





/**
 *	@exports
 */
module.exports	=
{
	GossiperUtils	: GossiperUtils
};
