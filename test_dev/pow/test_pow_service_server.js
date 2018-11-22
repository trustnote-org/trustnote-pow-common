const _pow_client	= require( '../../pow/pow_service.js' );


/**
 *	options
 */
const _oOptions		= {
	port		: 1302,
	onStart		: ( err, oWsServer ) =>
	{
		if ( err )
		{
			return console.error( err );
		}

		console.log( `TEST >> socket server started:${ oWsServer }.` );
	},
	onConnection	: ( err, oWs ) =>
	{
		if ( err )
		{
			return console.error( err );
		}

		console.log( `TEST >> a new client connected in.` );
	},
	onMessage	: ( oWs, sMessage ) =>
	{
		console.log( `TEST >> received a message: ${ sMessage }` );
	},
	onError		: ( oWs, vError ) =>
	{
		console.error( `TEST >> occurred an error: `, vError );
	},
	onClose		: ( oWs, sReason ) =>
	{
		console.log( `TEST >> socket was closed(${ sReason })` );
	}
};


_pow_client.server.createServer( _oOptions );



