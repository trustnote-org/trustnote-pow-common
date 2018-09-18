const _crypto		= require( 'crypto' );


console.log( _crypto.createHash( 'sha256' ).update( String( Date.now() ), 'utf8' ).digest( 'hex' ) );


