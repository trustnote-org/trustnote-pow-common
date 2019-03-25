/*jslint node: true */
"use strict";
var _ = require('lodash');
var async = require('async');
var db = require('../db/db.js');
var constants = require("../config/constants.js");
var storage = require('../db/storage.js');
var graph = require('../mc/graph.js');
var objectHash = require("../base/object_hash.js");
var eventBus = require('../base/event_bus.js');
var pow = require('../pow/pow.js');
var round = require('../pow/round.js');


function updateUnitsStable(conn, last_trustme_unit, last_mci, onDone){
	
	function goUpAndUpdateMci(){
		var arrUnits = [last_trustme_unit]; 
		
		function goUp(arrStartUnits){
			conn.query(
				"SELECT unit \n\
				FROM parenthoods JOIN units ON parent_unit=unit \n\
				WHERE child_unit IN("+arrStartUnits.map(db.escape).join(', ')+") AND main_chain_index IS NULL",
				function(rows){
					if (rows.length === 0)
						return updateMc();
					var arrNewStartUnits = rows.map(function(row){ return row.unit; });
					arrUnits = arrUnits.concat(arrNewStartUnits);
					goUp(arrNewStartUnits);
				}
			);
		}
		function updateMc(){
			var strUnitList = arrUnits.map(db.escape).join(', ');
			conn.query("UPDATE units SET main_chain_index=?, is_on_main_chain=0, is_stable=1 WHERE is_stable=0 AND unit IN("+strUnitList+")", [last_mci], function(){
				conn.query("UPDATE units SET is_on_main_chain=1 WHERE unit=?", [last_trustme_unit], function(){
					markMcIndexStable(conn, last_mci, finish);
				});
			});
		}
		goUp(arrUnits);
	}
		
	function finish(){
		console.log("done updating MC\n");
		if (onDone)
			onDone();
	}
	
	console.log("\nwill update MC");
	goUpAndUpdateMci();
}

function markMcIndexStable(conn, mci, onDone){
	handlePowUnits();
	// pow add
	function handlePowUnits(){
		round.getCurrentRoundInfo(conn, function(round_index, min_wl){
			async.series([
				function(cb){ // min wl
					if(min_wl != null)
						return cb();
					conn.query(
						"SELECT witnessed_level FROM units WHERE round_index=?  \n\
						AND is_stable=1 AND is_on_main_chain=1 AND pow_type=? ORDER BY main_chain_index LIMIT 1", 
						[round_index, constants.POW_TYPE_TRUSTME], 
						function(rowTrustME){
							if (rowTrustME.length === 0)
								return cb(); // next op
							conn.query(
								"UPDATE round SET min_wl=? WHERE round_index=?", 
								[rowTrustME[0].witnessed_level, round_index], 
								function(){			
									round.removeAssocCachedRoundInfo(round_index);						
									eventBus.emit("launch_pow", round_index);									
									cb();
								}
							);
						}
					);
				},
				function(cb){ // switch round
					conn.query(
						"SELECT distinct(address) \n\
						FROM units JOIN unit_authors using (unit) \n\
						WHERE round_index=? AND is_stable=1 AND pow_type=? AND sequence='good'", 
						[round_index, constants.POW_TYPE_POW_EQUHASH], 
						function(rowsPow){
							if (rowsPow.length < constants.COUNT_POW_WITNESSES)
								return cb();
							async.series([
								function(cb1){    // calculate seed
									pow.calculatePublicSeedByRoundIndex( conn, round_index+1, function(err, newSeed){
										if(err)
											throw Error(" calculate new seed error !");
										conn.query(
											"INSERT INTO round (round_index, min_wl, seed, total_mine, total_commission)  \n\
											VALUES (?, null, ?, 0, 0)", 
											[round_index+1, newSeed], 
											function(){
												cb1();
											}
										);
									});			
								},
								function(cb1){    // calculate difficulty
									if(round.getCycleIdByRoundIndex(round_index+1) === round.getCycleIdByRoundIndex(round_index))
										return cb1();
									pow.calculateBitsValueByRoundIndexWithDeposit( conn, round_index+1, 0, function(err, nBits){
										if(err)
											throw Error(" calculate bits error " + err);
										conn.query(
											"INSERT INTO round_cycle (cycle_id, bits) VALUES (?, ?)", 
											[round.getCycleIdByRoundIndex(round_index+1), nBits], 
											function(){
												infoMiningSuccess(round_index+1, nBits);
												cb1();
											}
										);
									});
								},
								function(cb1){    // calculate total mine and commission and burn
									round.getTotalMineAndCommissionByRoundIndex(conn, round_index, function(totalMine, totalCommission, totalBurn){
										conn.query(
											"UPDATE round set total_mine=?, total_commission=?, total_burn=?  \n\
											where round_index=?", 
											[totalMine, totalCommission, totalBurn, round_index], 
											function(){
												cb1();
											}
										);
									});
								},
							], 
							function(err){
								round.forwardRound(round_index+1);
								eventBus.emit("round_switch", round_index+1);
								cb();
							});	
						}
					);
				}
			], function(err){
				handleNonserialUnits();
			});			
		});
	}

	function handleNonserialUnits(){
		conn.query(
			"SELECT * FROM units WHERE main_chain_index=? AND sequence!='good' ORDER BY unit", [mci], 
			function(rows){
				async.eachSeries(
					rows,
					function(row, cb){
						if (row.sequence === 'final-bad')
							return row.content_hash ? cb() : setContentHash(row.unit, cb);
						// temp-bad
						if (row.content_hash)
							throw Error("temp-bad and with content_hash?");
						findStableConflictingUnits(row, function(arrConflictingUnits){
							var sequence = (arrConflictingUnits.length > 0) ? 'final-bad' : 'good';
							console.log("unit "+row.unit+" has competitors "+arrConflictingUnits+", it becomes "+sequence);
							conn.query("UPDATE units SET sequence=? WHERE unit=?", [sequence, row.unit], function(){
								if (sequence === 'good')
									conn.query("UPDATE inputs SET is_unique=1 WHERE unit=?", [row.unit], function(){ cb(); });
								else
									setContentHash(row.unit, cb);
							});
						});
					},
					function(){
						// next op
						addBalls();
					}
				);
			}
		);
	}

	function setContentHash(unit, onSet){
		storage.readJoint(conn, unit, {
			ifNotFound: function(){
				throw Error("bad unit not found: "+unit);
			},
			ifFound: function(objJoint){
				var content_hash = objectHash.getUnitContentHash(objJoint.unit);
				conn.query("UPDATE units SET content_hash=?,headers_commission=0,payload_commission=0 WHERE unit=?", [content_hash, unit], function(){
					onSet();
				});
			}
		});
	}

	function findStableConflictingUnits(objUnitProps, handleConflictingUnits){
		// find potential competitors.
		// units come here sorted by original unit, so the smallest original on the same MCI comes first and will become good, all others will become final-bad

		conn.query(
			"SELECT competitor_units.* \n\
			FROM unit_authors AS this_unit_authors \n\
			JOIN unit_authors AS competitor_unit_authors USING(address) \n\
			JOIN units AS competitor_units ON competitor_unit_authors.unit=competitor_units.unit \n\
			JOIN units AS this_unit ON this_unit_authors.unit=this_unit.unit \n\
			WHERE this_unit_authors.unit=? AND competitor_units.is_stable=1 AND +competitor_units.sequence='good' \n\
				-- if it were main_chain_index <= this_unit_limci, the competitor would've been included \n\
				AND (competitor_units.main_chain_index > this_unit.latest_included_mc_index) \n\
				AND (competitor_units.main_chain_index <= this_unit.main_chain_index)",
			// if on the same mci, the smallest unit wins becuse it got selected earlier and was assigned sequence=good
			[objUnitProps.unit],
			function(rows){
				var arrConflictingUnits = [];
				async.eachSeries(
					rows,
					function(row, cb){
						graph.compareUnitsByProps(conn, row, objUnitProps, function(result){
							if (result === null)
								arrConflictingUnits.push(row.unit);
							cb();
						});
					},
					function(){
						handleConflictingUnits(arrConflictingUnits);
					}
				);
			}
		);
	}
	
	function addBalls(){
		conn.query(
			"SELECT units.*, ball FROM units LEFT JOIN balls USING(unit) \n\
			WHERE main_chain_index=? ORDER BY level", [mci], 
			function(unit_rows){
				async.eachSeries(
					unit_rows,
					function(objUnitProps, cb){
						var unit = objUnitProps.unit;
						conn.query(
							"SELECT ball FROM parenthoods LEFT JOIN balls ON parent_unit=unit WHERE child_unit=? ORDER BY ball", 
							[unit], 
							function(parent_ball_rows){
								if (parent_ball_rows.some(function(parent_ball_row){ return (parent_ball_row.ball === null); }))
									throw Error("some parent balls not found for unit "+unit);
								var arrParentBalls = parent_ball_rows.map(function(parent_ball_row){ return parent_ball_row.ball; });
								var arrSimilarMcis = getSimilarMcis(mci);
								var arrSkiplistUnits = [];
								var arrSkiplistBalls = [];
								if (objUnitProps.is_on_main_chain === 1 && arrSimilarMcis.length > 0){
									conn.query(
										"SELECT units.unit, ball FROM units LEFT JOIN balls USING(unit) \n\
										WHERE is_on_main_chain=1 AND main_chain_index IN(?)", 
										[arrSimilarMcis],
										function(rows){
											rows.forEach(function(row){
												var skiplist_unit = row.unit;
												var skiplist_ball = row.ball;
												if (!skiplist_ball)
													throw Error("no skiplist ball");
												arrSkiplistUnits.push(skiplist_unit);
												arrSkiplistBalls.push(skiplist_ball);
											});
											addBall();
										}
									);
								}
								else
									addBall();
								
								function addBall(){
									var ball = objectHash.getBallHash(unit, arrParentBalls, arrSkiplistBalls.sort(), objUnitProps.sequence === 'final-bad');
									if (objUnitProps.ball){ // already inserted
										if (objUnitProps.ball !== ball)
											throw Error("stored and calculated ball hashes do not match, ball="+ball+", objUnitProps="+JSON.stringify(objUnitProps));
										return cb();
									}
									conn.query("INSERT INTO balls (ball, unit) VALUES(?,?)", [ball, unit], function(){
										conn.query("DELETE FROM hash_tree_balls WHERE ball=?", [ball], function(){
											if (arrSkiplistUnits.length === 0)
												return cb();
											conn.query(
												"INSERT INTO skiplist_units (unit, skiplist_unit) VALUES "
												+arrSkiplistUnits.map(function(skiplist_unit){
													return "("+conn.escape(unit)+", "+conn.escape(skiplist_unit)+")"; 
												}), 
												function(){ cb(); }
											);
										});
									});
								}
							}
						);
					},
					function(){
						// next op
						updateRetrievable();
					}
				);
			}
		);
	}

	function updateRetrievable(){
		storage.updateMinRetrievableMciAfterStabilizingMci(conn, mci, function(min_retrievable_mci){
			process.nextTick(function(){ // don't call it synchronously with event emitter
				eventBus.emit("mci_became_stable", mci);
			});
			onDone();
		});
	}
	
}

// returns list of past MC indices for skiplist
function getSimilarMcis(mci){
	var arrSimilarMcis = [];
	var divisor = 10;
	while (true){
		if (mci % divisor === 0){
			arrSimilarMcis.push(mci - divisor);
			divisor *= 10;
		}
		else
			return arrSimilarMcis;
	}
}

function infoMiningSuccess(round_index, newDifficulty){
	console.info("--------------------Difficulty Adjustment---------------------");
	console.info("       Round Index: " + round_index);
	console.info("    Difficulty New: " + newDifficulty);
	console.info("");
}



exports.updateUnitsStable = updateUnitsStable;

