/*jslint node: true */
"use strict";
var async = require('async');
var storage = require('../db/storage.js');
var graph = require('../mc/graph.js');
var main_chain = require('../mc/main_chain.js');
var mc_outputs = require("../mc/mc_outputs.js");
var objectHash = require("../base/object_hash.js");
var objectLength = require("../base/object_length.js");
var db = require('../db/db.js');
var chash = require('../encrypt/chash.js');
var mutex = require('../base/mutex.js');
var constants = require("../config/constants.js");
var ValidationUtils = require("../validation/validation_utils.js");
var Definition = require("../encrypt/definition.js");
var conf = require('../config/conf.js');
var profiler = require('../base/profiler.js');
var breadcrumbs = require('../base/breadcrumbs.js');
var round = require('../pow/round.js');
var pow = require('../pow/pow.js');
var deposit = require('../sc/deposit.js');
var byzantine  = require('../mc/byzantine.js');

var MAX_INT32 = Math.pow(2, 31) - 1;

var hasFieldsExcept = ValidationUtils.hasFieldsExcept;
var isNonemptyString = ValidationUtils.isNonemptyString;
var isStringOfLength = ValidationUtils.isStringOfLength;
var isInteger = ValidationUtils.isInteger;
var isNonnegativeInteger = ValidationUtils.isNonnegativeInteger;
var isPositiveInteger = ValidationUtils.isPositiveInteger;
var isNonemptyArray = ValidationUtils.isNonemptyArray;
var isValidAddress = ValidationUtils.isValidAddress;
var isValidBase64 = ValidationUtils.isValidBase64;

function validateParents(conn, objJoint, objValidationState, callback){
	function checkLastBallDidNotRetreat(){
		conn.query(
			"SELECT MAX(lb_units.main_chain_index) AS max_parent_last_ball_mci \n\
			FROM units JOIN units AS lb_units ON units.last_ball_unit=lb_units.unit \n\
			WHERE units.unit IN(?)",
			[objUnit.parent_units],
			function(rows){
				var max_parent_last_ball_mci = rows[0].max_parent_last_ball_mci;
				if (max_parent_last_ball_mci > objValidationState.last_ball_mci)
					return callback("last ball mci must not retreat, parents: "+objUnit.parent_units.join(', '));
					//checkRoundIndexDidNotRetreat();
					checkRoundIndexDidNotRetreat();
			}
		);
	}

	function checkRoundIndexDidNotRetreat(){
		if(!objUnit.pow_type)
			return callback();
		conn.query(
			"SELECT unit,round_index, level, pow_type,main_chain_index\n\
			FROM units  \n\
			WHERE unit IN(?)", 
			[objUnit.parent_units], 
			function(rows){
				if (rows.length !==  objNewUnit.parent_units.length)
					return callback("got wrong number of parents units");
				var parent_trustmes = rows.filter(function(row){ return row.pow_type === constants.POW_TYPE_TRUSTME});
				if(parent_trustmes.length !== 1)
					return callback("units contains not one trust me unit as parents");
				
				// in the first round, maybe no trust me at early time, then genesis unit is selected as parents
				if(parent_trustmes.length === 0 ){ 
					var hasGenenisUnit = objUnit.parent_units.some(function(parent) {return parent.unit === constants.GENESIS_UNIT});
					if(!hasGenenisUnit || objUnit.round_index > 1 )
						return  callback("neither trustme or genesis unit as parents of unit :" + objUnit.unit);
				}

				if(parent_trustmes[0].round_index > objUnit.round_index)
					return callback("unit round_index is retreated, less than its parents' ");
				callback();
			}
		);
	}

	var objUnit = objJoint.unit;
	if (objUnit.parent_units.length > constants.MAX_PARENTS_PER_UNIT) // anti-spam
		return callback("too many parents: "+objUnit.parent_units.length);
	
	var createError = objJoint.ball ? createJointError : function(err){ return err; };
	// after this point, we can trust parent list as it either agrees with parents_hash or agrees with hash tree
	// hence, there are no more joint errors, except unordered parents or skiplist units
	var last_ball = objUnit.last_ball;
	var last_ball_unit = objUnit.last_ball_unit;
	var prev = "";
	var arrMissingParentUnits = [];
	var arrPrevParentUnitProps = [];
	objValidationState.max_parent_limci = 0;
	var join = objJoint.ball ? 'LEFT JOIN balls USING(unit) LEFT JOIN hash_tree_balls ON units.unit=hash_tree_balls.unit' : '';
	var field = objJoint.ball ? ', IFNULL(balls.ball, hash_tree_balls.ball) AS ball' : '';
	async.eachSeries(
		objUnit.parent_units, 
		function(parent_unit, cb){
			if (parent_unit <= prev)
				return cb(createError("parent units not ordered"));
			prev = parent_unit;
			conn.query("SELECT units.*"+field+" FROM units "+join+" WHERE units.unit=?", [parent_unit], function(rows){
				if (rows.length === 0){
					arrMissingParentUnits.push(parent_unit);
					return cb();
				}
				var objParentUnitProps = rows[0];
				// already checked in validateHashTree that the parent ball is known, that's why we throw
				if (objJoint.ball && objParentUnitProps.ball === null)
					throw Error("no ball corresponding to parent unit "+parent_unit);
				if (objParentUnitProps.latest_included_mc_index > objValidationState.max_parent_limci)
					objValidationState.max_parent_limci = objParentUnitProps.latest_included_mc_index;
				//callback 	async.eachSeries
				cb();
			});
		}, 
		function(err){
			if (err)
				return callback(err);
			if (arrMissingParentUnits.length > 0){
				conn.query("SELECT error FROM known_bad_joints WHERE unit IN(?)", [arrMissingParentUnits], function(rows){
					(rows.length > 0)
						? callback("some of the unit's parents are known bad: "+rows[0].error)
						: callback({error_code: "unresolved_dependency", errorMessage: "some of parents are missing "});
				});
				return;
			}
			// this is redundant check, already checked in validateHashTree()
			if (objJoint.ball){
				var arrParentBalls = arrPrevParentUnitProps.map(function(objParentUnitProps){ return objParentUnitProps.ball; }).sort();
				//if (arrParentBalls.indexOf(null) === -1){
					var hash = objectHash.getBallHash(objUnit.unit, arrParentBalls, objValidationState.arrSkiplistBalls, !!objUnit.content_hash);
					if (hash !== objJoint.ball)
						throw Error("ball hash is wrong"); // shouldn't happen, already validated in validateHashTree()
				//}
			}
			conn.query(
				"SELECT is_stable, pow_type, is_on_main_chain, main_chain_index, ball, (SELECT MAX(main_chain_index) FROM units) AS max_known_mci \n\
				FROM units LEFT JOIN balls USING(unit) WHERE unit=?", 
				[last_ball_unit], 
				function(rows){
					if (rows.length !== 1) // at the same time, direct parents already received
						return callback("last ball unit "+last_ball_unit+" not found");
					var objLastBallUnitProps = rows[0];
					if (objLastBallUnitProps.ball === null && objLastBallUnitProps.is_stable === 1)
						throw Error("last ball unit "+last_ball_unit+" is stable but has no ball");
					if (objLastBallUnitProps.is_on_main_chain !== 1)
						return callback("last ball "+last_ball+" is not on MC");
					// byzantine add
					if (objLastBallUnitProps.pow_type !== constants.POW_TYPE_TRUSTME && !storage.isGenesisBall(objLastBallUnitProps.ball))
						return callback("last ball "+ last_ball +" is not trustmet type ");
					if (objLastBallUnitProps.ball && objLastBallUnitProps.ball !== last_ball)
						return callback("last_ball "+last_ball+" and last_ball_unit "+last_ball_unit+" do not match");
					objValidationState.last_ball_mci = objLastBallUnitProps.main_chain_index;
					objValidationState.max_known_mci = objLastBallUnitProps.max_known_mci;
					// // byzantine del:
					// if (objValidationState.max_parent_limci < objValidationState.last_ball_mci)
					// 	return callback("last ball unit "+last_ball_unit+" is not included in parents, unit "+objUnit.unit);
					if (objLastBallUnitProps.is_stable === 1){
						// if it were not stable, we wouldn't have had the ball at all
						if (objLastBallUnitProps.ball !== last_ball)
							return callback("stable: last_ball "+last_ball+" and last_ball_unit "+last_ball_unit+" do not match");
					}
					checkLastBallDidNotRetreat();
					// byzantine del:
					// main_chain.determineIfStableInLaterUnitsAndUpdateStableMcFlag(conn, last_ball_unit, objUnit.parent_units, objLastBallUnitProps.is_stable, function(bStable){+ 1
				}
			);
		}
	);
}

function validateProposer(conn, objAuthor, objUnit, objValidationState, callback){
	if (!isStringOfLength(objAuthor.address, 32))
		return callback("wrong address length");
	if (hasFieldsExcept(objAuthor, ["address", "authentifiers", "definition"]))
		return callback("unknown fields in author");
	if (!ValidationUtils.isNonemptyObject(objAuthor.authentifiers) && !objUnit.content_hash)
		return callback("no authentifiers");
	for (var path in objAuthor.authentifiers){
		if (!isNonemptyString(objAuthor.authentifiers[path]))
			return callback("authentifiers must be nonempty strings");
		if (objAuthor.authentifiers[path].length > constants.MAX_AUTHENTIFIER_LENGTH)
			return callback("authentifier too long");
	}
	
	var arrAddressDefinition = objAuthor.definition;
	if (isNonemptyArray(arrAddressDefinition)){
		// todo: check that the address is really new?
		// Todo :deposit add: check if deposit contract, if yes, validate only one deposit contract created for supernode address

		validateAuthentifiers(arrAddressDefinition);
	}
	else if (!("definition" in objAuthor)){
		if (!chash.isChashValid(objAuthor.address))
			return callback("address checksum invalid");
		if (objUnit.content_hash){ // nothing else to check
			objValidationState.sequence = 'final-bad';
			return callback();
		}
		// we check signatures using the latest address definition before last ball
		storage.readDefinitionByAddress(conn, objAuthor.address, objValidationState.last_ball_mci, {
			ifDefinitionNotFound: function(definition_chash){
				callback("definition "+definition_chash+" bound to address "+objAuthor.address+" is not defined");
			},
			ifFound: function(arrAddressDefinition){
				validateAuthentifiers(arrAddressDefinition);
			}
		});
	}
	else
		return callback("bad type of definition");

	function validateAuthentifiers(arrAddressDefinition){
		Definition.validateAuthentifiers(
			conn, objAuthor.address, null, arrAddressDefinition, objUnit, objValidationState, objAuthor.authentifiers, 
			function(err, res){
				if (err) // error in address definition
					return callback(err);
				if (!res) // wrong signature or the like
					return callback("authentifier verification failed");
				callback();
			}
		);
	}
}

function validateDataFeedMessage(conn, objMessage, objUnit, objValidationState, callback) {
	if (typeof objMessage.app !== "string" ||  objMessage.app !== "data_feed")
		return callback("no or invalid app");
	if (!isStringOfLength(objMessage.payload_hash, constants.HASH_LENGTH))
		return callback("wrong payload hash size");
	if (typeof objMessage.payload_location !== "string")
		return callback("no payload_location");
	
	if (hasFieldsExcept(objMessage, ["app", "payload_hash","payload_location", "payload"]))
		return callback("unknown fields in message");
	
	if (objMessage.payload_location !== "inline")
		return callback("wrong payload location: "+objMessage.payload_location);
	// validate payload
	var payload = objMessage.payload;
	if (typeof payload === "undefined")
		return callback("no inline payload");
	if (objectHash.getBase64Hash(payload) !== objMessage.payload_hash)
		return callback("wrong payload hash: expected "+objectHash.getBase64Hash(payload)+", got "+objMessage.payload_hash);

	if (typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).length === 0)
		return callback("data feed payload must be non-empty object");

	// verify timestamp value
	
	var proposal_time = payload["timestamp"];
    
    if (typeof proposal_time !== 'number' || !isInteger(proposal_time)){
			return callback("timestamp value is not numbers ");
	}
	
	// compare to local time stamp 
	var now = Date.now();
	var diff =Math.abs(Math.round(now -proposal_time))
	if (diff > constants.TRUSTME_TIMESTAMP_TOLERANT )
		return callback("too big diffrence between proposal time and local time ");
	// OK condition 
	callback();
}

// validate proposed value
function validateProposalJoint(objJoint, callbacks){
	var objUnit = objJoint.unit;
	if (typeof objUnit !== "object" || objUnit === null)
		return callbacks.ifInvalid("no unit object");
	
	console.log("\nvalidating joint identified by unit "+objJoint.unit.unit);
	
	if (!isStringOfLength(objUnit.unit, constants.HASH_LENGTH))
		return callbacks.ifInvalid("wrong unit length");
	
	// UnitError is linked to objUnit.unit, so we need to ensure objUnit.unit is true before we throw any UnitErrors
	if (objectHash.getProposalUnitHash(objUnit) !== objUnit.unit){
		console.log("888888888888888888888888--Proposal joint : " + JSON.stringify(objJoint));
		return callbacks.ifInvalid("wrong proposal unit hash: "+objectHash.getProposalUnitHash(objUnit)+" != "+objUnit.unit);
	}
		
	if (hasFieldsExcept(objUnit, ["unit", "version", "alt", "round_index","pow_type","timestamp", "parent_units", "last_ball", "last_ball_unit","messages", "hp"]))
		return callbacks.ifInvalid("unknown fields in nonserial unit");
	
	if (objUnit.version !== constants.version)
		return callbacks.ifInvalid("wrong version");
	if (objUnit.alt !== constants.alt)
		return callbacks.ifInvalid("wrong alt");
	if (typeof objUnit.round_index !== "number")
		return callbacks.ifInvalid("no round index");
	if (typeof objUnit.pow_type !== "number")
		return callbacks.ifInvalid("no pow_type type");
	if (typeof objUnit.hp !== "number")
		return callbacks.ifInvalid("no hp type");
	
	// pow_type type should be 2 for trustme 
	if ( objUnit.pow_type !==  constants.POW_TYPE_TRUSTME)
		return callbacks.ifInvalid("invalid unit type");
	// unity round index should be in range of [1,4204800]
	if ( objUnit.round_index < 1 || objUnit.round_index > 4204800)
		return callbacks.ifInvalid("invalid unit round index");
	
	if (!isNonemptyArray(objUnit.messages))
		return callbacks.ifInvalid("missing or empty messages array");
	// only one 'data_feed' message allowed in trust me units.
	if (objUnit.messages.length !== 1) 
		return callbacks.ifInvalid("only one message allowed in proposal unit");
	
	// Joint fields validation 
	if (hasFieldsExcept(objJoint, ["unit", "proposer", "phase"]))
		return callbacks.ifInvalid("unknown fields in joint unit");
	
	if (typeof objJoint.phase !== "number" || objJoint.phase < 0 )
		return callbacks.ifInvalid("joint phase invalid");
	if(objJoint.proposer && objJoint.proposer.length !== 1)
		return callbacks.ifInvalid("multiple proposers are not allowed");
		
	var conn = null;
	var objValidationState = { };
	async.series(
		[
			function(cb){
				db.takeConnectionFromPool(function(new_conn){
					conn = new_conn;
					conn.query("BEGIN", function(){cb();});
				});
			},
			function(cb){
				//validate roundIndex and hp (mci) to see if I am sync with proposer mci
				//if not, return -1 to let caller knows .
				round.getCurrentRoundIndex(conn, function(curRoundIndex){
					if(objUnit.round_index < curRoundIndex)
						return cb("proposer's round_index is too old, curRoundIndex: " + curRoundIndex + " proposer round_index: " +objUnit.round_index );
					if(objUnit.round_index > curRoundIndex);
						return cb({error_code: "unresolved_dependency", errorMessage:"propose round_index is ahead of me , curRoundIndex: " + curRoundIndex + " proposer round_index: " +objUnit.round_index });
					storage.getMaxMci(conn,function(curMCI){
						if(objUnit.hp < curMCI + 1) // recieve old proposal
							return cb("proposal hp is old, will discard it");
						if(objUnit.hp > curMCI + 1 ) // propose mci is ahead of me 
							return cb({error_code: "unresolved_dependency", errorMessage:"propose mci is ahead of me, will handle it once come up with it " });
						cb();
					});
				});
			},
			function(cb){
				validateParents(conn, objJoint, objValidationState, cb);
			},
			// function(cb){
			// 	profiler.stop('validation-parents');
			// 	profiler.start();
			// 	!objJoint.skiplist_units
			// 		? cb()
			// 		: validateSkiplist(conn, objJoint.skiplist_units, cb);
			// },
			function(cb){
				// validate proposer ID
				byzantine.getProposer(conn, objUnit.hp, objJoint.phase, function(err, proposer, round_index, witnesses){				
					if(proposer !== objJoint.proposer[0].address)
						return cb("proposer incorrect ,Expected: "+ proposer +" Actual :" + objJoint.proposer[0].address);
					if(round_index !== objUnit.round_index)
						return cb("proposer round_index incorrect ,Expected: "+ round_index +" Actual :" + objUnit.round_index);
					objValidationState.unit_hash_to_sign = objectHash.getUnitHashToSign(objUnit);
					//validate proposer signature
					validateProposer(conn, objJoint.proposer[0], objUnit, objValidationState, cb);
				});
			},
			function(cb){ // check timestamp is near to mine in data feed message 
			 	validateDataFeedMessage(conn, objUnit.messages[0], objUnit, objValidationState, cb);
			},
		], 
		function(err){
			if(!err){
				conn.query("COMMIT", function(){
					conn.release();
					callbacks.ifOk();
				});
			}
			else{
			//Error occured here
			conn.query("ROLLBACK", function(){
				conn.release();
				if (typeof err === "object"){
					if (err.error_code === "unresolved_dependency"){
						console.log(err.errorMessage);
						callbacks.ifNeedWaiting(err.errorMessage);
					}
					else
						throw Error("unknown error code");
				}
				else
					callbacks.ifInvalid(err);
				});
			}
			
		}
	); // async.series
	
	
}


exports.validateParents = validateParents;
exports.validateProposalJoint = validateProposalJoint;
