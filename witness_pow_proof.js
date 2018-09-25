/*jslint node: true */
"use strict";

/**
 *	@boss	XING
 */

const _async		= require( 'async' );
const _storage		= require( './storage.js' );
const _object_hash	= require( './object_hash.js' );
const _db		= require( './db.js' );
const _constants	= require( './constants.js' );
const _validation	= require( './validation.js' );



/**
 *	POW ADD
 *
 *	@param	{number}	last_stable_mci
 *	@param	{function}	handleResult	function( err, arrUnstableMcJoints, sLastBallUnit, nLastBallMci )
 *	@return	{void}
 */
function preparePowWitnessProof( last_stable_mci, handleResult )
{
	let arrUnstableMcJoints			= [];

	let arrLastMajorityWitnessedBallUnits	= []; // last ball units referenced from MC-majority-witnessed unstable MC units
	let sLastBallUnit			= null;
	let nLastBallMci			= null;

	_async.series
	([
		function( cb )
		{
			//	collect all unstable MC units
			let arrFoundTrustMEAuthors = [];
			_db.query
			(
				"SELECT unit, pow_type FROM units WHERE is_on_main_chain=1 AND is_stable=0 ORDER BY main_chain_index DESC",
				function( rows )
				{
					_async.eachSeries( rows, function( row, cb2 )
					{
						_storage.readJointWithBall( _db, row.unit, function( objJoint )
						{
							delete objJoint.ball; // the unit might get stabilized while we were reading other units

							//
							//	* unstable mc joints
							//
							arrUnstableMcJoints.push( objJoint );

							for ( let i = 0; i < objJoint.unit.authors.length; i++ )
							{
								let address = objJoint.unit.authors[ i ].address;
								if ( _constants.POW_TYPE_TRUSTME === row.pow_type && -1 === arrFoundTrustMEAuthors.indexOf( address ) )
								{
									arrFoundTrustMEAuthors.push( address );
								}
							}

							//	collect last balls of majority witnessed units
							//	( genesis lacks sLastBallUnit )
							if ( objJoint.unit.last_ball_unit && arrFoundTrustMEAuthors.length >= _constants.MAJORITY_OF_WITNESSES )
							{
								arrLastMajorityWitnessedBallUnits.push( objJoint.unit.last_ball_unit );
							}

							//	...
							cb2();
						});
					}, cb );
				}
			);
		},
		function( cb )
		{
			//	select the newest last ball unit
			if ( arrLastMajorityWitnessedBallUnits.length === 0 )
			{
				return cb( "your witness list might be too much off, too few witness authored units" );
			}

			_db.query
			(
				"SELECT unit, main_chain_index FROM units WHERE unit IN(?) ORDER BY main_chain_index DESC LIMIT 1",
				[ arrLastMajorityWitnessedBallUnits ],
				function( rows )
				{
					//
					//	* last ball mci and unit
					//
					sLastBallUnit	= rows[ 0 ].unit;
					nLastBallMci	= rows[ 0 ].main_chain_index;

					( last_stable_mci >= nLastBallMci )
						? cb( "already_current" )
						: cb();
				}
			);
		}
	], function( err )
	{
		if ( err )
		{
			return handleResult(err);
		}

		//	...
		handleResult( null, arrUnstableMcJoints, sLastBallUnit, nLastBallMci );
	});
}


/**
 *	process witness proof received from server in client side
 *	@param	arrUnstableMcJoints
 *	@param	bFromCurrent
 *	@param	handleResult	function( err, arrLastBallUnits, assocLastBallByLastBallUnit )
 *	@return {*}
 */
function processPowWitnessProof( arrUnstableMcJoints, bFromCurrent, handleResult )
{
	//	unstable MC joints
	let arrParentUnits			= null;
	let arrFoundTrustMEAuthors		= [];
	let arrLastMajorityWitnessedBallUnits	= [];
	let assocLastBallByLastBallUnit		= {};
	let arrTrustMEJoints			= [];

	//
	//	arrUnstableMcJoints were collected by SQL below:
	//	SELECT unit, pow_type FROM units WHERE is_on_main_chain=1 AND is_stable=0 ORDER BY main_chain_index DESC
	//
	for ( let i = 0; i < arrUnstableMcJoints.length; i ++ )
	{
		let objJoint	= arrUnstableMcJoints[ i ];
		let objUnit	= objJoint.unit;

		if ( objJoint.ball )
		{
			return handleResult( "unstable mc but has ball" );
		}
		if ( ! _validation.hasValidHashes( objJoint ) )
		{
			return handleResult( "invalid hash" );
		}
		if ( arrParentUnits && arrParentUnits.indexOf( objUnit.unit ) === -1 )
		{
			return handleResult( "not in parents" );
		}

		//	...
		let bAddedJoint = false;
		if ( _constants.POW_TYPE_TRUSTME === objUnit.pow_type )
		{
			for ( let j = 0; j < objUnit.authors.length; j++ )
			{
				let address = objUnit.authors[ j ].address;

				if ( -1 === arrFoundTrustMEAuthors.indexOf( address ) )
				{
					arrFoundTrustMEAuthors.push( address );
				}

				//
				//	TODO
				//	@20180902 17:53 by XING
				//	move line "bAddedJoint = true;" into braces above
				//
				if ( ! bAddedJoint )
				{
					arrTrustMEJoints.push( objJoint );
				}
				bAddedJoint = true;
			}
		}

		arrParentUnits = objUnit.parent_units;
		if ( objUnit.last_ball_unit && arrFoundTrustMEAuthors.length >= _constants.MAJORITY_OF_WITNESSES )
		{
			arrLastMajorityWitnessedBallUnits.push( objUnit.last_ball_unit );
			assocLastBallByLastBallUnit[ objUnit.last_ball_unit ] = objUnit.last_ball;
		}
	}
	return handleResult(null, null, assocLastBallByLastBallUnit);
	//	end of forEach arrUnstableMcJoints


	if ( arrFoundTrustMEAuthors.length < _constants.MAJORITY_OF_WITNESSES )
	{
		return handleResult( "not enough witnesses" );
	}
	if ( 0 === arrLastMajorityWitnessedBallUnits.length )
	{
		throw Error( "processWitnessProof: no last ball units" );
	}


	let assocDefinitions		= {};	//	keyed by definition chash
	let assocDefinitionChashes	= {};	//	keyed by address

	//
	//	checks signatures and updates definitions
	//
	function validateUnit( objUnit, bRequireDefinitionOrChange, cb2 )
	{
		let bFound = false;
		_async.eachSeries
		(
			objUnit.authors,
			function( author, cb3 )
			{
				let sAddress = author.address;
				if ( -1 === arrFoundTrustMEAuthors.indexOf( sAddress ) )
				{
					//	not a witness - skip it
					return cb3();
				}

				//
				//	the latest definition chash of the witness
				//
				let definition_chash = assocDefinitionChashes[ sAddress ];
				if ( ! definition_chash )
				{
					throw Error( "definition chash not known for address " + sAddress );
				}
				if ( author.definition )
				{
					//
					//	do transaction for the first time
					//
					if ( _object_hash.getChash160( author.definition ) !== definition_chash )
					{
						return cb3( "definition doesn't hash to the expected value" );
					}

					assocDefinitions[ definition_chash ] = author.definition;
					bFound = true;
				}


				function handleAuthor()
				{
					//	FIX
					_validation.validateAuthorSignaturesWithoutReferences
					(
						author,
						objUnit,
						assocDefinitions[ definition_chash ],	//	definition JSON
						function( err )
						{
							if ( err )
							{
								return cb3( err );
							}

							//
							//	okay, definition is valid
							//
							for ( let i = 0; i < objUnit.messages.length; i++ )
							{
								let message = objUnit.messages[ i ];
								if ( 'address_definition_change' === message.app
									&& ( message.payload.address === sAddress ||
										1 === objUnit.authors.length && objUnit.authors[ 0 ].address === sAddress ) )
								{
									assocDefinitionChashes[ sAddress ] = message.payload.definition_chash;
									bFound = true;
								}
							}

							//	...
							cb3();
						}
					);
				}

				if ( assocDefinitions[ definition_chash ] )
				{
					return handleAuthor();
				}

				//
				//	only an address with money
				//	there is no transaction any more
				//
				_storage.readDefinition( _db, definition_chash,
				{
					ifFound : function( arrDefinition )
					{
						assocDefinitions[ definition_chash ] = arrDefinition;
						handleAuthor();
					},
					ifDefinitionNotFound : function( sDefinitionCHash )
					{
						throw Error( "definition " + definition_chash + " not found, address " + sAddress );
					}
				});
			},
			function( err )
			{
				if ( err )
				{
					return cb2( err );
				}

				if ( bRequireDefinitionOrChange && ! bFound )
				{
					//
					//	bRequireDefinitionOrChange always be false
					//	so, you will never arrive here so far
					//
					return cb2( "neither definition nor change" );
				}

				//	...
				cb2();
			}

		); // each authors
	}


	//
	//	...
	//
	let unlock = null;
	_async.series
	([
		function( cb )
		{
			//	read latest known definitions of witness addresses
			if ( ! bFromCurrent )
			{
				for ( let i = 0; i < arrFoundTrustMEAuthors.length; i ++ )
				{
					let address = arrFoundTrustMEAuthors[ i ];
					assocDefinitionChashes[ address ] = address;
				}
				return cb();
			}

			//
			//	try to obtain definitions
			//
			_async.eachSeries
			(
				arrFoundTrustMEAuthors,
				function( sAddress, cb2 )
				{
					_storage.readDefinitionByAddress( _db, sAddress, null,
					{
						ifFound : function( arrDefinition )
						{
							let definition_chash = _object_hash.getChash160( arrDefinition );
							assocDefinitions[ definition_chash ]	= arrDefinition;
							assocDefinitionChashes[ sAddress ]	= definition_chash;
							cb2();
						},
						ifDefinitionNotFound : function( definition_chash )
						{
							assocDefinitionChashes[ sAddress ]	= definition_chash;
							cb2();
						}
					});
				},
				cb
			);
		},
		function( cb )
		{
			//
			//	check signatures of unstable witness joints
			//
			_async.eachSeries
			(
				arrTrustMEJoints.reverse(),	//	they came in reverse chronological order, reverse() reverses in place
				function( objJoint, pfnEachNext )
				{
					validateUnit( objJoint.unit, false, pfnEachNext );
				},
				cb
			);
		},
	], function( err )
	{
		err ? handleResult( err ) : handleResult( null, arrLastMajorityWitnessedBallUnits, assocLastBallByLastBallUnit );
	});
}





/**
 * 	@exports
 */
exports.preparePowWitnessProof	= preparePowWitnessProof;
exports.processPowWitnessProof	= processPowWitnessProof;
