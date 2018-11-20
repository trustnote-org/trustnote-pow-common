const _async	= require( 'async' );



_async.series
([
	function( pfnNext )
	{
		console.log( `11111111` );
		return pfnNext();
	},
	function( pfnNext )
	{
		console.log( `22222222` );
		return pfnNext( `err 2` );
	},
	function( pfnNext )
	{
		//
		//	will not be executed
		//
		console.log( `33333333` );
		return pfnNext();
	}
], function( err )
{
	if ( err )
	{
		return console.log( `ERROR : `, err );
	}

	console.log( `Finally point.` );
});