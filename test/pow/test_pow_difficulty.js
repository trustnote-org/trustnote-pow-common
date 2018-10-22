/**
 * 	set process env
 */
process.env.ENV_UNIT_TEST	= true;


/**
 * 	...
 */
const _fs	= require( 'fs' );
const _db	= require( '../../db/db.js' );
const _pow	= require( '../../pow/pow.js' );
const _round	= require( '../../pow/round.js' );
const constants	= require( '../../config/constants.js' );
const _async	= require( 'async' );




_db.takeConnectionFromPool( function( oNewConn )
{
	let arrComputeList	= [];
	let nStart		= 19;
	let nEnd		= 900;

	for ( let i = nStart; i < nEnd; i ++ )
	{
		arrComputeList.push
		(
			pfnNext =>
			{
				_pow.calculateDifficultyValueByCycleIndex( oNewConn, i, function( err, nNewDifficultyValue )
				{
					if ( null === err )
					{
						console.log( `[${ i }]@@@ new difficulty: ${ nNewDifficultyValue }` );

						//	...
						_fs.writeFileSync( `result.txt`, `cycle ${ i }, ${ nNewDifficultyValue }\n`, { flag : 'a' } );

					}
					else
					{
						console.log( `### occurred error : ${ err }` );
					}

					//	...
					pfnNext();
				});
			}
		);
	}

	_async.series
	(
		arrComputeList
		, function( err )
		{
			oNewConn.release();

			if ( err )
			{
				return console.log( `||| occurred errors :`, err );
			}

			console.log( `all computer done!` );
		}
	);
});











function getMinRoundIndexByCycleId(cycleId)
{
	return (cycleId-1)*constants.COUNT_ROUNDS_FOR_DIFFICULTY_SWITCH+1;
}
function getMaxRoundIndexByCycleId(cycleId)
{
	return cycleId*constants.COUNT_ROUNDS_FOR_DIFFICULTY_SWITCH;
}


function getDurationByCycleId(conn, cycleId, callback){
	if(cycleId <= 0)
		throw Error("The first cycle do not need calculate duration ");
	conn.query(
		"SELECT min(int_value) AS min_timestamp FROM data_feeds CROSS JOIN units USING(unit) CROSS JOIN unit_authors USING(unit) \n\
		WHERE address=? AND feed_name='timestamp' AND pow_type=? \n\
		    AND sequence='good' AND is_stable=1 AND round_index=?",
		['72FZXZMFPESCMUHUPWTZJ2F57YV32JCI', constants.POW_TYPE_TRUSTME, getMinRoundIndexByCycleId(cycleId)],
		function(rowsMin){
			if (rowsMin.length !== 1)
				throw Error("Can not find min timestamp of cycle " + cycleId);
			if (rowsMin[0].min_timestamp === null || isNaN(rowsMin[0].min_timestamp))
				throw Error("min timestamp of cycle " + cycleId + " is not number");
			conn.query(
				"SELECT max(int_value) AS max_timestamp FROM data_feeds CROSS JOIN units USING(unit) CROSS JOIN unit_authors USING(unit) \n\
				WHERE address=? AND feed_name='timestamp' AND pow_type=? \n\
				    AND sequence='good' AND is_stable=1 AND round_index=?",
				['72FZXZMFPESCMUHUPWTZJ2F57YV32JCI', constants.POW_TYPE_TRUSTME, getMaxRoundIndexByCycleId(cycleId)],
				function(rowsMax){
					if (rowsMax.length !== 1)
						throw Error("Can not find max timestamp of cycle " + cycleId);
					if (rowsMax[0].max_timestamp === null || isNaN(rowsMax[0].max_timestamp))
						throw Error("max timestamp of cycle " + cycleId + " is not number");
					callback(rowsMax[0].max_timestamp - rowsMin[0].min_timestamp);
				}
			);
		}
	);
}



// _db.takeConnectionFromPool( function( oNewConn )
// {
// 	for ( let i = 1; i < 51; i ++ )
// 	{
// 		getDurationByCycleId
// 		(
// 			oNewConn,
// 			i,
// 			function( nTimeUsedInMillisecond )
// 			{
// 				let nTimeUsed = Math.floor( nTimeUsedInMillisecond / 1000 );
// 				console.log( `####### time used in cycle ${ i } : ${ nTimeUsed }.` )
// 			}
// 		);
// 	}
// });


