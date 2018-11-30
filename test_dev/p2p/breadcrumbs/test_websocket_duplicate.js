/*jslint node: true */
"use strict";

/**
 *	@boss	XING
 */
const WebSocket		= process.browser ? global.WebSocket : require( 'ws' );
const socks		= process.browser ? null : require( 'socks' + '' );




let oWsServer1 = new WebSocket.Server
({
	port : 50001
});
let oWsServer2 = new WebSocket.Server
({
	port : 50002
});
let oWsServer3 = new WebSocket.Server
({
	port : 50003
});


let arrContainers	= [ oWsServer1, oWsServer2 ];

console.log
(
	arrContainers.includes( oWsServer1 ),
	arrContainers.includes( oWsServer2 ),
	arrContainers.includes( oWsServer3 )
);
console.log( oWsServer1 === oWsServer2 );