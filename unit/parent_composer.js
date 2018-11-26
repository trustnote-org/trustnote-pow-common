/*jslint node: true */
"use strict";
var db = require('../db/db.js');
var constants = require("../config/constants.js");
var conf = require("../config/conf.js");
var storage = require("../db/storage.js");
var main_chain = require("../mc/main_chain.js");

function pickParentUnits(conn, onDone){
	conn.query(
		"SELECT \n\
			unit, version, alt \n\
		FROM units "+(conf.storage === 'sqlite' ? "INDEXED BY byFree" : "")+" \n\
		LEFT JOIN archived_joints USING(unit) \n\
		WHERE +sequence='good' AND is_free=1 AND archived_joints.unit IS NULL ORDER BY unit LIMIT ?", 
		// exclude potential parents that were archived and then received again
		[ constants.MAX_PARENTS_PER_UNIT], 
		function(rows){
			if (rows.some(function(row){ return (row.version !== constants.version || row.alt !== constants.alt); }))
				throw Error('wrong network');
			if (rows.length === 0)
				return pickDeepParentUnits(conn, onDone);
			onDone(null, rows.map(function(row){ return row.unit; }));
		}
	);
}
function pickTrustParentUnits(conn, onDone){
	// trustme unit's parent must include the last trustme unit
	var parentUnits = [];
	conn.query(
		"SELECT \n\
			unit, version, alt \n\
		FROM units "+(conf.storage === 'sqlite' ? "INDEXED BY byFree" : "")+" \n\
		LEFT JOIN archived_joints USING(unit) \n\
		WHERE +sequence='good' AND pow_type=? AND archived_joints.unit IS NULL ORDER BY main_chain_index DESC LIMIT 1", 
		[constants.POW_TYPE_TRUSTME], 
		function(rowsTrustMe){
			if (rowsTrustMe.some(function(row){ return (row.version !== constants.version || row.alt !== constants.alt); }))
				throw Error('wrong network');
			if(rowsTrustMe.length === 0){  // if there is no trustme unit，then select genesis unit as parent
				return onDone([constants.GENESIS_UNIT]);
			}
			if(rowsTrustMe.length !== 1){  
				throw Error('error trustme unit');
			}
			parentUnits.push(rowsTrustMe[0].unit);
			conn.query(
				"SELECT \n\
					unit, version, alt \n\
				FROM units "+(conf.storage === 'sqlite' ? "INDEXED BY byFree" : "")+" \n\
				LEFT JOIN archived_joints USING(unit) \n\
				WHERE +sequence='good' AND is_free=1 AND archived_joints.unit IS NULL ORDER BY unit LIMIT ?", 
				// exclude potential parents that were archived and then received again
				[ constants.MAX_PARENTS_PER_UNIT-1], 
				function(rows){
					if (rows.some(function(row){ return (row.version !== constants.version || row.alt !== constants.alt); }))
						throw Error('wrong network');
					if (rows.length > 0)
						rows.map(function(row){ parentUnits.push(row.unit); });
					onDone(null, parentUnits);
				}
			);
		}
	);
}

// if we failed to find compatible parents among free units. 
// (This may be the case if an attacker floods the network trying to shift the witness list)
function pickDeepParentUnits(conn, onDone){
	conn.query(
		"SELECT unit \n\
		FROM units \n\
		WHERE +sequence='good' \n\
		ORDER BY main_chain_index DESC LIMIT 1", 
		[], 
		function(rows){
			if (rows.length === 0)
				return onDone("failed to find compatible parents: no deep units");
			onDone(null, rows.map(function(row){ return row.unit; }));
		}
	);
}

function findLastStableMcBall(conn, onDone){
	conn.query(
		"SELECT ball, unit, main_chain_index FROM units JOIN balls USING(unit) \n\
		WHERE is_on_main_chain=1 AND is_stable=1 AND +sequence='good' \n\
		ORDER BY main_chain_index DESC LIMIT 1", 
		[], 
		function(rows){
			if (rows.length === 0)
				return onDone("failed to find last stable ball");
			onDone(null, rows[0].ball, rows[0].unit, rows[0].main_chain_index);
		}
	);
}

function findLastTrustBall(conn, onDone){
	conn.query(
		"SELECT ball, unit, main_chain_index FROM units JOIN balls USING(unit) \n\
		WHERE is_on_main_chain=1 AND is_stable=1 AND +sequence='good' AND pow_type=? \n\
		ORDER BY main_chain_index DESC LIMIT 1", 
		[constants.POW_TYPE_TRUSTME], 
		function(rows){
			if (rows.length === 0)
				return onDone("failed to find last trust ball");
			onDone(null, rows[0].ball, rows[0].unit, rows[0].main_chain_index);
		}
	);
}

function adjustLastStableMcBallAndParents(conn, last_stable_mc_ball_unit, arrParentUnits, handleAdjustedLastStableUnit){
	main_chain.determineIfStableInLaterUnits(conn, last_stable_mc_ball_unit, arrParentUnits, function(bStable){
		if (bStable){
			conn.query("SELECT ball, main_chain_index FROM units JOIN balls USING(unit) WHERE unit=?", [last_stable_mc_ball_unit], function(rows){
				if (rows.length !== 1)
					throw Error("not 1 ball by unit "+last_stable_mc_ball_unit);
				var row = rows[0];
				handleAdjustedLastStableUnit(row.ball, last_stable_mc_ball_unit, row.main_chain_index, arrParentUnits);
			});
			return;
		}
		console.log('will adjust last stable ball because '+last_stable_mc_ball_unit+' is not stable in view of parents '+arrParentUnits.join(', '));
		if (arrParentUnits.length > 1){ // select only one parent
			pickDeepParentUnits(conn, function(err, arrAdjustedParentUnits){
				if (err)
					throw Error("pickDeepParentUnits in adjust failed: "+err);
				adjustLastStableMcBallAndParents(conn, last_stable_mc_ball_unit, arrAdjustedParentUnits, handleAdjustedLastStableUnit);
			});
			return;
		}
		storage.readStaticUnitProps(conn, last_stable_mc_ball_unit, function(objUnitProps){
			if (!objUnitProps.best_parent_unit)
				throw Error("no best parent of "+last_stable_mc_ball_unit);
			adjustLastStableMcBallAndParents(conn, objUnitProps.best_parent_unit, arrParentUnits, handleAdjustedLastStableUnit);
		});
	});
}

function pickParentUnitsAndLastBall(conn, onDone){
	pickParentUnits(conn, function(err, arrParentUnits){
	if (err)
		return onDone(err);
	findLastStableMcBall(conn, function(err, last_stable_mc_ball, last_stable_mc_ball_unit, last_stable_mc_ball_mci){
			if (err)
				return onDone(err);
			adjustLastStableMcBallAndParents(
				conn, last_stable_mc_ball_unit, arrParentUnits,  
				function(last_stable_ball, last_stable_unit, last_stable_mci, arrAdjustedParentUnits){
					onDone(null, arrAdjustedParentUnits, last_stable_ball, last_stable_unit, last_stable_mci);
				}
			);
		});
	});
}

function pickTrustParentUnitsAndLastBall(conn, onDone){
	pickTrustParentUnits(conn, function(err, arrParentUnits){
	if (err)
		return onDone(err);
		findLastTrustBall(conn, function(err, last_trust_ball, last_trust_ball_unit, last_trust_ball_mci){
			if (err)
				return onDone(err);
			onDone(null, arrParentUnits, last_trust_ball, last_trust_ball_unit, last_trust_ball_mci);	
		});
	});
}

exports.pickParentUnitsAndLastBall = pickParentUnitsAndLastBall;
exports.pickTrustParentUnitsAndLastBall = pickTrustParentUnitsAndLastBall;
