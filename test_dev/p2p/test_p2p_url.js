const Url	= require( 'url-parse' );

let url	= new Url( 'https://github.com/foo/bar' );
let ws	= new Url( 'ws://127.0.0.1:9000/' );
let wss	= new Url( 'wss://github.com:9000/' );

console.log( url );
console.log( ws );
console.log( wss );
