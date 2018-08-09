/*jslint node: true */
"use strict";

/**
 *	@boss	XING
 */


var async		= require('async');
var storage		= require('./storage.js');
var myWitnesses		= require('./my_witnesses.js');
var objectHash		= require("./object_hash.js");
var db			= require('./db.js');
var constants		= require("./constants.js");
var validation		= require('./validation.js');



/**
 *	POW ADD
 *
 *	@param	{number}	last_stable_mci
 *	@param	{function}	handleResult
 *	@return	{void}
 */
function preparePowWitnessProof( last_stable_mci, handleResult )
{
	var arrUnstableMcJoints			= [];

	var arrLastBallUnits			= []; // last ball units referenced from MC-majority-witnessed unstable MC units
	var sLastBallUnit			= null;
	var nLastBallMci			= null;

	async.series
	([
		function( cb )
		{
			//	collect all unstable MC units
			var arrFoundTrustMEAuthors = [];
			db.query
			(
				"SELECT unit, pow_type FROM units WHERE is_on_main_chain=1 AND is_stable=0 ORDER BY main_chain_index DESC",
				function( rows )
				{
					async.eachSeries( rows, function( row, cb2 )
					{
						storage.readJointWithBall( db, row.unit, function( objJoint )
						{
							delete objJoint.ball; // the unit might get stabilized while we were reading other units

							//
							//	* unstable mc joints
							//
							arrUnstableMcJoints.push( objJoint );

							for ( var i = 0; i < objJoint.unit.authors.length; i++ )
							{
								var address = objJoint.unit.authors[ i ].address;
								if ( constants.POW_TYPE_TRUSTME === row.pow_type && -1 === arrFoundTrustMEAuthors.indexOf( address ) )
								{
									arrFoundTrustMEAuthors.push( address );
								}
							}

							//	collect last balls of majority witnessed units
							//	( genesis lacks sLastBallUnit )
							if ( objJoint.unit.last_ball_unit && arrFoundTrustMEAuthors.length >= constants.MAJORITY_OF_WITNESSES )
							{
								arrLastBallUnits.push( objJoint.unit.last_ball_unit );
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
			if ( arrLastBallUnits.length === 0 )
			{
				return cb( "your witness list might be too much off, too few witness authored units" );
			}

			db.query
			(
				"SELECT unit, main_chain_index FROM units WHERE unit IN(?) ORDER BY main_chain_index DESC LIMIT 1",
				[ arrLastBallUnits ],
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


function processPowWitnessProof( arrUnstableMcJoints, bFromCurrent, handleResult )
{
	//	unstable MC joints
	var arrParentUnits = null;
	var arrFoundTrustMEAuthors = [];
	var arrLastBallUnits = [];
	var assocLastBallByLastBallUnit = {};
	var arrWitnessJoints = [];

	for ( var i = 0; i < arrUnstableMcJoints.length; i ++ )
	{
		var objJoint = arrUnstableMcJoints[i];
		var objUnit = objJoint.unit;

		if ( objJoint.ball )
			return handleResult("unstable mc but has ball");
		if ( ! validation.hasValidHashes( objJoint ) )
			return handleResult("invalid hash");
		if ( arrParentUnits && arrParentUnits.indexOf( objUnit.unit ) === -1 )
			return handleResult("not in parents");

		//	...
		var bAddedJoint = false;
		if ( constants.POW_TYPE_TRUSTME === objUnit.pow_type )
		{
			for ( var j = 0; j < objUnit.authors.length; j++ )
			{
				var address = objUnit.authors[ j ].address;
				if ( arrFoundTrustMEAuthors.indexOf( address ) === -1 )
					arrFoundTrustMEAuthors.push( address );
				if ( ! bAddedJoint )
					arrWitnessJoints.push( objJoint );
				bAddedJoint = true;
			}
		}

		arrParentUnits = objUnit.parent_units;
		if ( objUnit.last_ball_unit && arrFoundTrustMEAuthors.length >= constants.MAJORITY_OF_WITNESSES )
		{
			arrLastBallUnits.push( objUnit.last_ball_unit );
			assocLastBallByLastBallUnit[ objUnit.last_ball_unit ] = objUnit.last_ball;
		}
	}

	if ( arrFoundTrustMEAuthors.length < constants.MAJORITY_OF_WITNESSES )
		return handleResult( "not enough witnesses" );


	if ( arrLastBallUnits.length === 0 )
		throw Error("processWitnessProof: no last ball units");


	var assocDefinitions		= {};	//	keyed by definition chash
	var assocDefinitionChashes	= {};	//	keyed by address

	//	checks signatures and updates definitions
	function validateUnit( objUnit, bRequireDefinitionOrChange, cb2 )
	{
		var bFound = false;
		async.eachSeries
		(
			objUnit.authors,
			function( author, cb3 )
			{
				var address = author.address;
				if ( arrFoundTrustMEAuthors.indexOf( address ) === -1 )	//	not a witness - skip it
					return cb3();

				var definition_chash = assocDefinitionChashes[address];
				if ( ! definition_chash )
					throw Error( "definition chash not known for address " + address );

				if ( author.definition )
				{
					if ( objectHash.getChash160( author.definition ) !== definition_chash )
						return cb3( "definition doesn't hash to the expected value" );
					assocDefinitions[ definition_chash ] = author.definition;
					bFound = true;
				}

				function handleAuthor()
				{
					// FIX
					validation.validateAuthorSignaturesWithoutReferences
					(
						author,
						objUnit,
						assocDefinitions[ definition_chash ],
						function( err )
						{
							if ( err )
								return cb3(err);

							for ( var i = 0; i < objUnit.messages.length; i++ )
							{
								var message = objUnit.messages[i];
								if ( message.app === 'address_definition_change'
									&& (message.payload.address === address || objUnit.authors.length === 1 && objUnit.authors[0].address === address) )
								{
									assocDefinitionChashes[address] = message.payload.definition_chash;
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

				storage.readDefinition( db, definition_chash,
				{
					ifFound : function( arrDefinition )
					{
						assocDefinitions[ definition_chash ] = arrDefinition;
						handleAuthor();
					},
					ifDefinitionNotFound : function(d)
					{
						throw Error( "definition " + definition_chash + " not found, address " + address );
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
	var unlock = null;
	async.series
	([
		function( cb )
		{
			//	read latest known definitions of witness addresses
			if ( ! bFromCurrent )
			{
				arrWitnesses.forEach( function( address )
				{
					assocDefinitionChashes[ address ] = address;
				});
				return cb();
			}

			async.eachSeries
			(
				arrWitnesses,
				function( address, cb2 )
				{
					storage.readDefinitionByAddress( db, address, null,
					{
						ifFound : function( arrDefinition )
						{
							var definition_chash = objectHash.getChash160(arrDefinition);
							assocDefinitions[ definition_chash ]	= arrDefinition;
							assocDefinitionChashes[ address ]	= definition_chash;
							cb2();
						},
						ifDefinitionNotFound : function( definition_chash )
						{
							assocDefinitionChashes[ address ]	= definition_chash;
							cb2();
						}
					});
				},
				cb
			);
		},
		function( cb )
		{
			//	check signatures of unstable witness joints
			async.eachSeries
			(
				arrWitnessJoints.reverse(),	//	they came in reverse chronological order, reverse() reverses in place
				function( objJoint, cb2 )
				{
					validateUnit( objJoint.unit, false, cb2 );
				},
				cb
			);
		},
	], function( err )
	{
		err ? handleResult( err ) : handleResult( null, arrLastBallUnits, assocLastBallByLastBallUnit );
	});
}





/**
 * 	@exports
 */
exports.preparePowWitnessProof	= preparePowWitnessProof;
exports.processPowWitnessProof	= processPowWitnessProof;
