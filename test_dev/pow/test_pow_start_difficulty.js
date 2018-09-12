/**
 * 	set process env
 */
process.env.ENV_UNIT_TEST	= true;


/**
 * 	...
 */
const _db			= require( '../../db.js' );
const _pow			= require( '../../pow.js' );

_db.takeConnectionFromPool( function( oNewConn )
{
	_pow.calculateDifficultyValueByCycleIndex( oNewConn, 2, function( err, nNewDifficultyValue )
	{
		console.log( err, nNewDifficultyValue );
	});
});
