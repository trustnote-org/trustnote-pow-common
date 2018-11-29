const UrlParser			= require( 'url-parse' );
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
	 * 	parse peer url
	 *
	 *	@param	{string}	sUrl
	 *	@return	{ { hostname : {string}, port : {number}, protocol : {string} }|null }
	 */
	static parsePeerUrl( sUrl )
	{
		let sHostname	= null;
		let nPort	= null;
		let sProtocol	= null;

		if ( DeUtilsCore.isExistingString( sUrl ) )
		{
			//
			//	{
			// 		slashes: true,
			//		protocol: 'ws:',
			//		hash: '',
			//		query: '',
			//		pathname: '/',
			//		auth: '',
			//		host: '127.0.0.1:9000',
			//		port: '9000',
			//		hostname: '127.0.0.1',
			//		password: '',
			//		username: '',
			//		origin: 'ws://127.0.0.1:9000',
			//		href: 'ws://127.0.0.1:9000/'
			// 	}
			//
			let oUrl	= new UrlParser( sUrl );

			sHostname	= oUrl.hostname;
			nPort		= oUrl.port;
			sProtocol	= oUrl.protocol;
		}

		return {
			hostname	: sHostname,
			port		: nPort,
			protocol	: sProtocol,
		};
	}

	/**
	 * 	check if the sPeerUrl is a valid peer name
	 *
	 *	@param	{string}	sPeerUrl	- 'wss://127.0.0.1:8000'
	 *	@return	{boolean}
	 */
	static isValidPeerUrl( sPeerUrl )
	{
		let oPeerUrl = this.parsePeerUrl( sPeerUrl );
		return null !== oPeerUrl.hostname && null !== oPeerUrl.port && null !== oPeerUrl.protocol;
	}


}





/**
 *	@exports
 */
module.exports	=
{
	GossiperUtils	: GossiperUtils
};
