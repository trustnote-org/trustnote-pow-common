const _pow_client	= require( '../../pow/pow_service.js' );


/**
 *	options
 */
const _oOptions		= {
	minerGateway	: 'ws://127.0.0.1:1302',
	// minerGateway	: 'ws://192.168.18.128:9000',
	onOpen		: ( err, oWs ) =>
	{
		if ( err )
		{
			return console.error( err );
		}

		console.log( `TEST >> we have connected to ${ oWs.host } successfully.` );
		_pow_client.sendMessageOnce( oWs, 'pow/task', {} );
	},
	onMessage	: ( oWs, sMessage ) =>
	{
		console.log( `TEST >> received a message : ${ sMessage }` );
	},
	onError		: ( oWs, vError ) =>
	{
		console.error( `TEST >> error from server ${ _oOptions.minerGateway }: `, vError );
	},
	onClose		: ( oWs, sReason ) =>
	{
		console.log( `TEST >> socket was closed(${ sReason })` );
	}
};


_pow_client.client.connectToServer( _oOptions );



