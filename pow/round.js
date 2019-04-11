/*jslint node: true */
"use strict";

// pow add

var constants = require('../config/constants.js');
var db = require('../db/db.js');
var async = require('async');
var conf = require('../config/conf.js');
var validationUtils = require('../validation/validation_utils.js');
var deposit = require('../sc/deposit.js');

var arrInflationRatio = [
                        0.07,  
                        0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07,
                        0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07,
                        0.19,0.181715729,
                        0.175358984,
                        0.17,
                        0.16527864,
                        0.161010205,
                        0.157084974,
                        0.153431458,
                        0.15,
                        0.146754447,
                        0.143667504,
                        0.140717968,
                        0.137888974,
                        0.135166852,
                        0.132540333,
                        0.13,
                        0.127537887,
                        0.125147186,
                        0.122822021,
                        0.120557281,
                        0.118348486,
                        0.116191685,
                        0.11408337,
                        0.11202041,
                        0.11,
                        0.10801961,
                        0.106076952,
                        0.104169948,
                        0.102296704,
                        0.100455488,
                        0.098644713,
                        0.096862915,
                        0.095108747,
                        0.093380962,
                        0.091678404,
                        0.09,
                        0.088344749,
                        0.08671172,
                        0.08510004,
                        0.083508894,
                        0.081937515,
                        0.080385186,
                        0.07885123,
                        0.077335008,
                        0.075835921,
                        0.0743534,
                        0.072886908,
                        0.071435935,
                        0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07,
                        0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07,
                        0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07,
                        0.07,0.07];

var MAX_ROUND_IN_CACHE = 10;
var assocCachedWitnesses = {};
var assocCachedTotalCommission = {};
var assocCachedMaxMci = {};
var assocCachedCoinbaseRatio = {};
var assocCachedRoundInfo = {};

var round_current = 0;


function forwardRound(roundIndex){
    round_current = roundIndex;
}

function getCurrentRoundIndex(conn, callback){
    if(round_current > 0)
        return callback(round_current);
    var conn = conn || db;
    conn.query(
		"SELECT * FROM round ORDER BY round_index DESC LIMIT 1", 
        [],
		function(rows){
			if (rows.length !== 1)
                throw Error("Can not find current round index");
            round_current = rows[0].round_index; 
            callback(rows[0].round_index);
		}
	);
}

function getCycleIdByRoundIndex(roundIndex){
    return Math.ceil(roundIndex/constants.COUNT_ROUNDS_FOR_DIFFICULTY_SWITCH);
}

function getDifficultydByRoundIndex(conn, roundIndex, callback){
    if (roundIndex <= 0)
        throw Error("the round id can not less then 0");
    var cycleId = getCycleIdByRoundIndex(roundIndex);
    conn.query(
		"SELECT bits FROM round_cycle WHERE cycle_id=?",
        [cycleId],
		function(rows){
			if (rows.length !== 1)
                throw Error("Can not find current round bits");
            callback(rows[0].bits);
		}
	);
}

function getDifficultydByCycleID(conn, cycleId, callback){
    if (cycleId <= 0)
        throw Error("the cycle id can not less then 0");
    conn.query(
		"SELECT bits FROM round_cycle WHERE cycle_id=?",
        [cycleId],
		function(rows){
			if (rows.length !== 1)
                throw Error("Can not find current cycle bits");
            callback(rows[0].bits);
		}
	);
}

function getMinRoundIndexByCycleId(cycleId){
    return (cycleId-1)*constants.COUNT_ROUNDS_FOR_DIFFICULTY_SWITCH+1;
}

function getMaxRoundIndexByCycleId(cycleId){
    return cycleId*constants.COUNT_ROUNDS_FOR_DIFFICULTY_SWITCH;
}

function getCurrentRoundInfo(conn, callback){
    getRoundInfoByRoundIndex(conn, round_current, 
        function(round_index, min_wl, seed){
            callback(round_index, min_wl, seed);
        }
    );
}

function getRoundInfoByRoundIndex(conn, roundIndex, callback){
    if (assocCachedRoundInfo[roundIndex]){
        console.log("use cache getRoundInfoByRoundIndex: " + roundIndex);
        return callback(assocCachedRoundInfo[roundIndex].round_index, assocCachedRoundInfo[roundIndex].min_wl, assocCachedRoundInfo[roundIndex].seed);
    }
    var conn = conn || db;
    conn.query(
		"SELECT * FROM round WHERE round_index=?", 
        [roundIndex],
		function(rows){
			if (rows.length !== 1)
                throw Error("Can not find round index");
                assocCachedRoundInfo[roundIndex] = rows[0];
            callback(rows[0].round_index, rows[0].min_wl, rows[0].seed);
		}
	);
}

function removeAssocCachedRoundInfo(roundIndex){
    delete assocCachedRoundInfo[roundIndex];
}

function getDurationByCycleId(conn, cycleId, callback){
    if(cycleId <= constants.COUNT_CYCLES_FOR_DIFFICULTY_DURATION) 
        throw Error("The first " + constants.COUNT_CYCLES_FOR_DIFFICULTY_DURATION + " cycles do not need to calculate duration");
    var minRoundIndex = getMinRoundIndexByCycleId(cycleId-constants.COUNT_CYCLES_FOR_DIFFICULTY_DURATION);
    var maxRoundIndex = getMaxRoundIndexByCycleId(cycleId-1)-1;
    if(maxRoundIndex - minRoundIndex + 1 != constants.COUNT_CYCLES_FOR_DIFFICULTY_DURATION*constants.COUNT_ROUNDS_FOR_DIFFICULTY_SWITCH-1) 
        throw Error("calculate duration error on minRoundIndex or maxRoundIndex");    
    conn.query(
        "SELECT int_value AS min_timestamp FROM data_feeds CROSS JOIN units USING(unit) CROSS JOIN unit_authors USING(unit) \n\
        WHERE feed_name='timestamp' AND pow_type=? AND is_on_main_chain=1 \n\
            AND sequence='good' AND is_stable=1 AND round_index>=? ORDER BY main_chain_index LIMIT 1",
        [constants.POW_TYPE_TRUSTME, minRoundIndex],
        function(rowsMin){
            if (rowsMin.length !== 1)
                return callback(0);
            if (rowsMin[0].min_timestamp === null || isNaN(rowsMin[0].min_timestamp))
                return callback(0);
            conn.query(
                "SELECT int_value AS max_timestamp FROM data_feeds CROSS JOIN units USING(unit) CROSS JOIN unit_authors USING(unit) \n\
                WHERE feed_name='timestamp' AND pow_type=? AND is_on_main_chain=1 \n\
                    AND sequence='good' AND is_stable=1 AND round_index<=? ORDER BY main_chain_index DESC LIMIT 1",
                [constants.POW_TYPE_TRUSTME, maxRoundIndex],
                function(rowsMax){
                    if (rowsMax.length !== 1)
                        return callback(0);
                    if (rowsMax[0].max_timestamp === null || isNaN(rowsMax[0].max_timestamp))
                        return callback(0);

                    callback(Math.floor((rowsMax[0].max_timestamp - rowsMin[0].min_timestamp)/1000));
                }
            );            
        }
    );
}


function getDurationByRoundIndex(conn, roundIndex, callback){
    if(!validationUtils.isPositiveInteger(roundIndex))
        return callback(0);
    if(roundIndex > constants.ROUND_TOTAL_ALL) 
        return callback(0);
    
    conn.query(
        "SELECT int_value AS min_timestamp FROM data_feeds CROSS JOIN units USING(unit) CROSS JOIN unit_authors USING(unit) \n\
        WHERE feed_name='timestamp' AND pow_type=? AND is_on_main_chain=1 \n\
            AND sequence='good' AND is_stable=1 AND round_index=? ORDER BY main_chain_index DESC LIMIT 1",
        [constants.POW_TYPE_TRUSTME, roundIndex-1],
        function(rowsMin){
            if (rowsMin.length !== 1)
                return callback(0);
            if (rowsMin[0].min_timestamp === null || isNaN(rowsMin[0].min_timestamp))
                return callback(0);
            conn.query(
                "SELECT int_value AS max_timestamp FROM data_feeds CROSS JOIN units USING(unit) CROSS JOIN unit_authors USING(unit) \n\
                WHERE feed_name='timestamp' AND pow_type=? AND is_on_main_chain=1 \n\
                    AND sequence='good' AND is_stable=1 AND round_index=? ORDER BY main_chain_index DESC LIMIT 1",
                [constants.POW_TYPE_TRUSTME, roundIndex],
                function(rowsMax){
                    if (rowsMax.length !== 1)
                        return callback(0);
                    if (rowsMax[0].max_timestamp === null || isNaN(rowsMax[0].max_timestamp))
                        return callback(0);

                    callback(Math.floor((rowsMax[0].max_timestamp - rowsMin[0].min_timestamp)/1000));
                }
            );            
        }
    );
}


function getStandardDuration(){
    return constants.DURATION_PER_ROUND*(constants.COUNT_CYCLES_FOR_DIFFICULTY_DURATION*constants.COUNT_ROUNDS_FOR_DIFFICULTY_SWITCH-1);
}

function getAverageDifficultyByCycleId(conn, cycleId, callback){
    if(cycleId <= constants.COUNT_CYCLES_FOR_DIFFICULTY_DURATION) 
        throw Error("The first " + constants.COUNT_CYCLES_FOR_DIFFICULTY_DURATION + " cycles can not calculate average difficult");
    conn.query(
        "SELECT SUM(bits) AS sumAverageDifficulty FROM round_cycle WHERE cycle_id>=? AND cycle_id<=?",
        [cycleId-constants.COUNT_CYCLES_FOR_DIFFICULTY_DURATION, cycleId-1],
        function(rowsAverageDifficulty){
            if (rowsAverageDifficulty.length !== 1)
                throw Error(" calculate average difficult error");
            if (rowsAverageDifficulty[0].sumAverageDifficulty === null || isNaN(rowsAverageDifficulty[0].sumAverageDifficulty))
                throw Error(" calculate average is null or is not number");
            callback(Math.floor(rowsAverageDifficulty[0].sumAverageDifficulty/constants.COUNT_CYCLES_FOR_DIFFICULTY_DURATION));
        }
    );
}

// the MinWl maybe null
function getMinWlByRoundIndex(conn, roundIndex, callback){
    conn.query(
		"SELECT min_wl FROM round where round_index=?", 
        [roundIndex],
		function(rows){
			if (rows.length !== 1)
                throw Error("Can not find the right round index");
            callback(rows[0].min_wl);
		}
	);
}


function getWitnessesByRoundIndex(conn, roundIndex, callback){
    if (assocCachedWitnesses[roundIndex]){
        console.log("RoundCacheLog:use:getWitnessesByRoundIndex->assocCachedWitnesses,roundIndex:" + roundIndex);
        return callback(assocCachedWitnesses[roundIndex]);
    }
    var witnesses  = [];
	if (roundIndex === 1){// first round
		witnesses = witnesses.concat(conf.initialWitnesses);
		if(witnesses.length != constants.TOTAL_COORDINATORS)
			throw Error("Can not find enough witnesses in conf initialWitnesses");
		return callback(witnesses);
    }

    var conn = conn || db;
    conn.query(
            "SELECT distinct(address) \n\
            FROM units JOIN unit_authors using (unit)\n\
            WHERE is_stable=1 AND sequence='good' AND pow_type=? AND round_index=? ORDER BY main_chain_index,unit  \n\
            LIMIT ?",  
        [constants.POW_TYPE_POW_EQUHASH, roundIndex - 1, constants.TOTAL_COORDINATORS],
		function(rows){
			if (rows.length !==  constants.TOTAL_COORDINATORS)
                throw Error("Can not find enough witnesses of round" + roundIndex);
            witnesses = rows.map(function(row) { return row.address; } );
            // witnesses.push(constants.FOUNDATION_ADDRESS);
            console.log("RoundCacheLog:push:getWitnessesByRoundIndex->assocCachedWitnesses,roundIndex:" + roundIndex);
            assocCachedWitnesses[roundIndex] = witnesses;
            callback(witnesses);
		}
	);
}

function getRoundIndexByNewMci(conn, mci, callback){
    if(!validationUtils.isPositiveInteger(mci))
        throw Error("param mci is not a positive integer");
    if(mci <= 1)
        return callback(1);
    
    conn.query(
        "SELECT round_index FROM units \n\
		WHERE is_on_main_chain=1 AND is_stable=1 AND +sequence='good' AND pow_type=? AND main_chain_index=? \n\
		LIMIT 1",  
    [constants.POW_TYPE_TRUSTME, mci - 1],
    function(rows){
        if (rows.length === 0)
            return callback(-1); //have not get the last mci yet 
        if (rows.length !== 1)
            throw Error("Can not find right witnesses of mci" + mci);
        var roundIndexOfLastMci = rows[0].round_index;
        if(roundIndexOfLastMci === round_current)
            callback(roundIndexOfLastMci);
        else
            callback(roundIndexOfLastMci+1);
    });
}

function checkIfCoinBaseUnitByRoundIndexAndAddressExists(conn, roundIndex, address, callback){
    conn.query(
		"SELECT  units.unit \n\
		FROM units JOIN unit_authors using (unit)\n\
        WHERE pow_type=? AND round_index=? AND address=? ", 
        [constants.POW_TYPE_COIN_BASE, roundIndex, address],
		function(rows){
			callback(rows.length > 0 );
		}
	);
}

function checkIfPowUnitByRoundIndexAndAddressExists(conn, roundIndex, address, callback){
    conn.query(
		"SELECT units.unit \n\
		FROM units JOIN unit_authors using (unit)\n\
        WHERE pow_type=? AND round_index=? AND address=? ", 
        [constants.POW_TYPE_POW_EQUHASH, roundIndex, address],
		function(rows){
			callback(rows.length > 0 );
		}
	);
}

function checkIfTrustMeAuthorByRoundIndex(conn, roundIndex, address, callback){
    getWitnessesByRoundIndex(conn, roundIndex , function(witnesses){
        if(witnesses.indexOf(address) === -1){
            return callback(false);
        }
        callback(true);
    });
}

// coinbase begin

// old function
function getCoinbaseByRoundIndex(roundIndex){
    if(roundIndex < 1 || roundIndex > constants.ROUND_TOTAL_ALL)
        return 0;
	return constants.ROUND_COINBASE[Math.ceil(roundIndex/constants.ROUND_TOTAL_YEAR)-1];
}


function getStatisticsByRoundIndex(conn, roundIndex, cb){
    if(roundIndex < 1 || roundIndex > constants.ROUND_TOTAL_ALL)
        return cb("getStatisticsByRoundIndex error");
    conn.query(
        "SELECT total_mine, total_commission, total_burn FROM round \n\
        WHERE round_index=?",
        [roundIndex],
        function(rowsTotal){
            if (rowsTotal.length !== 1)
                return cb("get total mine error, result count is 1");
            var totalMine = parseInt(rowsTotal[0].total_mine);
            var totalCommission = parseInt(rowsTotal[0].total_commission);
            var totalBurn = parseInt(rowsTotal[0].total_burn);
            if(!validationUtils.isNonnegativeInteger(totalMine) || 
                !validationUtils.isNonnegativeInteger(totalCommission) ||
                !validationUtils.isNonnegativeInteger(totalBurn))
                return cb("mine or commission or burn deposit is not a positive integer");
            
            var totalPublishCoin = constants.TOTAL_WHITEBYTES + totalMine - totalCommission - totalBurn;
            if(totalPublishCoin > constants.TOTAL_WHITEBYTES_AND_MINE)
                return cb("getStatisticsByRoundIndex error");
            deposit.getBalanceOfAllDepositContract(conn, roundIndex, function(err, depositBalance){
                if(err)
                    return cb("Can not get deposit balance, so can not get total coin by round index");
                if(!validationUtils.isNonnegativeInteger(depositBalance))
                    return cb("all deposit balance is not a positive integer");
                var depositRatio = Math.round((depositBalance*100)/totalPublishCoin);
                var inflationRatio = arrInflationRatio[depositRatio];
                cb(null, totalMine, totalPublishCoin, depositRatio, inflationRatio)
            });  
        }
    );
}

function getTotalCoinByRoundIndex(conn, roundIndex, cb){
    if(roundIndex < 1 || roundIndex > constants.ROUND_TOTAL_ALL)
        return cb(0);
    conn.query(
        "SELECT total_mine, total_commission, total_burn FROM round \n\
        WHERE round_index=?",
        [roundIndex],
        function(rowsTotal){
            if (rowsTotal.length !== 1)
                throw Error("get total mine error, result count is 1");
            var totalMine = parseInt(rowsTotal[0].total_mine);
            var totalCommission = parseInt(rowsTotal[0].total_commission);
            var totalBurn = parseInt(rowsTotal[0].total_burn);
            if(!validationUtils.isNonnegativeInteger(totalMine) || 
                !validationUtils.isNonnegativeInteger(totalCommission) ||
                !validationUtils.isNonnegativeInteger(totalBurn))
                throw Error("mine or commission or burn deposit is not a positive integer");
            
            var totalPublishCoin = constants.TOTAL_WHITEBYTES + totalMine - totalCommission - totalBurn;
            if(totalPublishCoin > constants.TOTAL_WHITEBYTES_AND_MINE)
                return cb(0);
            deposit.getBalanceOfAllDepositContract(conn, roundIndex, function(err, depositBalance){
                if(err)
                    throw Error("Can not get deposit balance, so can not get total coin by round index");
                if(!validationUtils.isNonnegativeInteger(depositBalance))
                    throw Error("all deposit balance is not a positive integer");
                var depositRatio = Math.round((depositBalance*100)/totalPublishCoin);
                
                var inflationRatio = arrInflationRatio[depositRatio];
                console.log("coinbasecalcute round_index:" + roundIndex +
                            ", totalMine:" + totalMine + ", totalCommission:" + totalCommission + ", totalBurn:" + totalBurn + 
                            ", totalPublishCoin:" + totalPublishCoin +  ", depositBalance:" + depositBalance +
                            ", depositRatio:" + depositRatio + ", inflationRatio:" + inflationRatio +
                            ", totalcoin:" + Math.floor((inflationRatio*totalPublishCoin)/constants.ROUND_TOTAL_YEAR));
                cb(Math.floor((inflationRatio*totalPublishCoin)/constants.ROUND_TOTAL_YEAR));
            });  
        }
    );
}

//used by explorer 
// function getSumCoinbaseByEndRoundIndex(endRoundIndex){
//     var sum = 0;
//     for (var beginRound = 1; beginRound <= endRoundIndex; beginRound++){
//        sum = sum + getCoinbaseByRoundIndex(beginRound);
//     }
//     return sum;
// }


function getMaxMciByRoundIndex(conn, roundIndex, callback){
    if(roundIndex === 0)
        return callback(0);
    if (assocCachedMaxMci[roundIndex]){
        console.log("RoundCacheLog:use:getMaxMciByRoundIndex->assocCachedMaxMci,roundIndex:" + roundIndex);
        return callback(assocCachedMaxMci[roundIndex]);
    }
    conn.query(
        "select max(main_chain_index) AS max_mci from units \n\
        where is_on_main_chain=1 AND is_stable=1 AND pow_type=? AND round_index=?", 
        [constants.POW_TYPE_TRUSTME, roundIndex],
        function(rows){
            if (rows.length !== 1)
                throw Error("Can not find max mci ");
            console.log("RoundCacheLog:push:getMaxMciByRoundIndex->assocCachedMaxMci,roundIndex:" + roundIndex);
            assocCachedMaxMci[roundIndex] = rows[0].max_mci;
            callback(rows[0].max_mci);
        }
    );
}

function getTotalMineAndCommissionByRoundIndex(conn, roundIndex, callback){
    if(roundIndex <= 0) 
        throw Error("The first round have no commission ");

    getMaxMciByRoundIndex(conn, roundIndex-1, function(lastRoundMaxMci){
        getMaxMciByRoundIndex(conn, roundIndex, function(currentRoundMaxMci){
            // get total mine of last round
            conn.query(
                "SELECT sum(amount) AS total_mine FROM inputs JOIN units using(unit) \n\
                WHERE is_stable=1 AND sequence='good' AND pow_type=? \n\
                AND round_index=?", 
                [constants.POW_TYPE_COIN_BASE, roundIndex],
                function(rowsMine){
                    if (rowsMine.length !== 1)
                        throw Error("Can not calculate the total mine of round index " + roundIndex);
                    var lastTotalMine = 0;
                    if(rowsMine[0].total_mine)
                        lastTotalMine = parseInt(rowsMine[0].total_mine);
                    // get total commission of last round
                    conn.query(
                        "SELECT sum(headers_commission+payload_commission) AS total_commission FROM units \n\
                        WHERE is_stable=1 AND sequence='good' \n\
                        AND main_chain_index>? AND main_chain_index<=?", 
                        [lastRoundMaxMci, currentRoundMaxMci],
                        function(rowsCommission){
                            if (rowsCommission.length !== 1)
                                throw Error("Can not calculate the total commision of round index " + roundIndex);
                            var lastTotalCommission = 0;
                            if(rowsCommission[0].total_commission)
                                lastTotalCommission = parseInt(rowsCommission[0].total_commission);
                            conn.query("SELECT sum(amount) AS total_burn  \n\
                                FROM outputs JOIN units USING(unit) \n\
                                WHERE asset IS NULL AND address=? AND sequence='good' AND is_stable=1 \n\
                                AND main_chain_index>? AND main_chain_index<=?", 
                                [constants.DEPOSIT_BURN_ADDRESS, lastRoundMaxMci, currentRoundMaxMci], 
                                function(rowsBurn){
                                    if (rowsBurn.length !== 1)
                                        throw Error("Can not calculate the total brun of round index " + roundIndex);
                                    var lastTotalBurn = 0;
                                    if(rowsBurn[0].total_burn)                                        
                                        lastTotalBurn = parseInt(rowsBurn[0].total_burn);
                                    // get total mine and total commission before last round
                                    conn.query(
                                        "SELECT total_mine, total_commission, total_burn FROM round \n\
                                        WHERE round_index = ?", 
                                        [roundIndex-1],
                                        function(rowsAccumulate){
                                            var accuMine = 0;
                                            var accuCommission = 0;
                                            var accuBurn = 0;
                                            if (rowsAccumulate.length === 1){
                                                accuMine = parseInt(rowsAccumulate[0].total_mine);
                                                accuCommission = parseInt(rowsAccumulate[0].total_commission);
                                                accuBurn = parseInt(rowsAccumulate[0].total_burn);
                                            }                                        
                                            return callback(accuMine+lastTotalMine, accuCommission+lastTotalCommission, accuBurn+lastTotalBurn);
                                        }
                                    );   
                                }
                            );           
                        }
                    );            
                }
            );
        });
    });
}

// function getTotalCommissionByRoundIndex(conn, roundIndex, callback){
//     if(roundIndex <= 0) 
//         throw Error("The first round have no commission ");
//     if (assocCachedTotalCommission[roundIndex]){
//         console.log("RoundCacheLog:use:getTotalCommissionByRoundIndex->assocCachedTotalCommission,roundIndex:" + roundIndex);
//         return callback(assocCachedTotalCommission[roundIndex]);
//     }
//     getMinWlByRoundIndex(conn, roundIndex+1, function(minWl){
//         if(minWl === null)
//             throw Error("Can't get commission before the round switch.");
//         getMaxMciByRoundIndex(conn, roundIndex-1, function(lastRoundMaxMci){
//             getMaxMciByRoundIndex(conn, roundIndex, function(currentRoundMaxMci){
//                 conn.query(
//                     "select sum(headers_commission+payload_commission) AS total_commission from units \n\
//                     where is_stable=1 AND sequence='good'\n\
//                     AND main_chain_index>? AND main_chain_index<=?", 
//                     [lastRoundMaxMci, currentRoundMaxMci],
//                     function(rows){
//                         if (rows.length !== 1)
//                             throw Error("Can not calculate the total commision of round index " + roundIndex);
//                         console.log("RoundCacheLog:push:getTotalCommissionByRoundIndex->assocCachedTotalCommission,roundIndex:" + roundIndex);
//                         assocCachedTotalCommission[roundIndex] = rows[0].total_commission;
//                         callback(rows[0].total_commission);
//                     }
//                 );
//             });
//         });
//     });
// }

function getAllCoinbaseRatioByRoundIndex(conn, roundIndex, callback){
    if(roundIndex <= 0) 
        throw Error("The first round have no coinbase ");
    if (assocCachedCoinbaseRatio[roundIndex]){
        console.log("RoundCacheLog:use:getAllCoinbaseRatioByRoundIndex->assocCachedCoinbaseRatio,roundIndex:" + roundIndex);
        return callback(assocCachedCoinbaseRatio[roundIndex]);
    }
    getMinWlByRoundIndex(conn, roundIndex+1, function(minWl){
        if(minWl === null)
            throw Error("Can't get coinbase before the round switch.");
        getWitnessesByRoundIndex(conn, roundIndex, function(witnesses){
            conn.query(
                "SELECT unit, address \n\
                FROM units JOIN coordinator_authentifiers using (unit)\n\
                WHERE is_stable=1 AND is_on_main_chain=1 AND sequence='good' AND pow_type=? AND round_index=? ORDER BY level, address", 
                [constants.POW_TYPE_TRUSTME, roundIndex],
                function(rows){
                    if (rows.length === 0 )
                        throw Error("Can not find any trustme units ");
                    var totalCountOfTrustMe = 0;
                    var witnessRatioOfTrustMe = {};
                    witnesses.forEach(function(witness){
                        witnessRatioOfTrustMe[witness]=0;
                    });
                    // var addressTrustMeWl = {};
                    for (var i=0; i<rows.length; i++){
                        var row = rows[i];
                        if(witnesses.indexOf(row.address) === -1)
                            throw Error("wrong trustme unit exit ");
                        // if(row.address === constants.FOUNDATION_ADDRESS)  // except foundation supernode
                        //     continue;
                        //if(addressTrustMeWl[row.address] != null && row.witnessed_level - addressTrustMeWl[row.address] <= constants.MIN_INTERVAL_WL_OF_TRUSTME)
                        //    continue;          
                        //addressTrustMeWl[row.address] = row.witnessed_level;                  
                        
                        totalCountOfTrustMe++;
                        witnessRatioOfTrustMe[row.address]++;
                    }
                    
                    Object.keys(witnessRatioOfTrustMe).forEach(function(address){
                        witnessRatioOfTrustMe[address] = witnessRatioOfTrustMe[address]/totalCountOfTrustMe;
                    });
                    if (!assocCachedCoinbaseRatio[roundIndex]){
                        console.log("RoundCacheLog:push:getAllCoinbaseRatioByRoundIndex->assocCachedCoinbaseRatio,roundIndex:" + roundIndex);
                        assocCachedCoinbaseRatio[roundIndex] = witnessRatioOfTrustMe;
                    }
                    callback(witnessRatioOfTrustMe);
                }
            );    
        });        
    });
}

function getCoinbaseRatioByRoundIndexAndAddress(conn, roundIndex, witnessAddress, callback){
    // if(witnessAddress === constants.FOUNDATION_ADDRESS)  // foundation supernode return 0
    //     return callback(0);
    getAllCoinbaseRatioByRoundIndex(conn, roundIndex, function(witnessRatioOfTrustMe){
        if(witnessRatioOfTrustMe === null || typeof witnessRatioOfTrustMe ===  'undefined')
            throw Error("witnessRatioOfTrustMe is null " + JSON.stringify(witnessRatioOfTrustMe));
        if(witnessRatioOfTrustMe[witnessAddress] === null || typeof witnessRatioOfTrustMe[witnessAddress] ===  'undefined' || isNaN(witnessRatioOfTrustMe[witnessAddress]))
            throw Error("witnessRatioOfTrustMe[witnessAddress] is null or NaN" + JSON.stringify(witnessRatioOfTrustMe[witnessAddress]));
        callback(witnessRatioOfTrustMe[witnessAddress]);
    });
}

function getCoinbaseByRoundIndexAndAddress(conn, roundIndex, witnessAddress, callback){
    getWitnessesByRoundIndex(conn, roundIndex, function(witnesses){
        if(witnesses.indexOf(witnessAddress) === -1)
            throw Error("the witness " + witnessAddress + " is not the right witness of round " + roundIndex);
        getTotalCoinByRoundIndex(conn, roundIndex, function(totalCoinbase){
            if(!validationUtils.isInteger(totalCoinbase))
                throw Error("coinbase is not number");
            if(0 === totalCoinbase)
                return callback(0);
            // getTotalCommissionByRoundIndex(conn, roundIndex, function(totalCommission){
            //     if(!validationUtils.isInteger(totalCommission))
            //         throw Error("totalCommission is not number ");
            //     var totalCoinbase = coinbase + totalCommission;
                
            getCoinbaseRatioByRoundIndexAndAddress(conn, roundIndex, witnessAddress, function(witnessRatioOfTrustMe){
                if(witnessRatioOfTrustMe === null || typeof witnessRatioOfTrustMe ===  'undefined' || isNaN(witnessRatioOfTrustMe))
                    throw Error("witnessRatioOfTrustMe is null or NaN" + JSON.stringify(witnessRatioOfTrustMe));
                return callback(Math.floor(totalCoinbase*witnessRatioOfTrustMe));
            });            
            // });
        });
    });    
}

function queryCoinBaseListByRoundIndex(conn, roundIndex, callback) {
    if(roundIndex <= 1) 
        throw Error("The first round have no coin base ");
    getWitnessesByRoundIndex(conn, roundIndex-1, function(witnesses){
            var arrResult = [];
            async.eachSeries(
                witnesses,
                function(witnessAddress, cb){
                    getCoinbaseByRoundIndexAndAddress(conn, roundIndex-1, witnessAddress, function(coinbaseAmount){
                        arrResult.push({address : witnessAddress, amount : coinbaseAmount});
                        return cb();
                    });                    
                },
                function(){
                    if(arrResult.length != constants.TOTAL_COORDINATORS)
                        throw Error("Can not find enough coinbase witness");
                    return callback(null, arrResult);
                }
            );
        }
    );
}

// coinbase end


/**
 *	obtain ball address of the first TrustME unit
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	nRoundIndex
 *	@param	{function}	pfnCallback( err, arrCoinBaseList )
 */
function queryFirstTrustMEBallOnMainChainByRoundIndex( oConn, nRoundIndex, pfnCallback )
{
	if ( ! oConn )
	{
		return pfnCallback( `call queryFirstTrustMEBallOnMainChainByRoundIndex with invalid oConn` );
	}
	if ( 'number' !== typeof nRoundIndex )
	{
		return pfnCallback( `call queryFirstTrustMEBallOnMainChainByRoundIndex with invalid nRoundIndex, must be a number` );
	}
	if ( nRoundIndex <= 0 )
	{
		return pfnCallback( `call queryFirstTrustMEBallOnMainChainByRoundIndex with invalid nRoundIndex, must be greater than zero.` );
	}

	//	...
	oConn.query
	(
		"SELECT ball \
		FROM balls JOIN units USING(unit) \
		WHERE units.round_index = ? AND units.is_stable=1 AND units.is_on_main_chain=1 AND units.sequence='good' AND units.pow_type=? \
		ORDER BY units.main_chain_index ASC \
		LIMIT 1",
		[
			nRoundIndex,
			constants.POW_TYPE_TRUSTME
		],
		function( arrRows )
		{
			if ( 1 !== arrRows.length )
			{
				return pfnCallback( `Can not find a suitable ball for calculation pow.` );
			}

			//	...
			return pfnCallback( null, arrRows[ 0 ][ 'ball' ] );
		}
	);
}




/**
 *	Get the round index of address's last coinbase unit.
 *
 * 	@param	{obj}	    conn      if conn is null, use db query, otherwise use conn.
 * 	@param	{string}	address
 * 	@param	{function}	cb( err, roundIndex ) callback function
 *              If there's error, err is the error message and roundIndex is null.
 *              If the address hasn't launch coinbase unit, roundIndex is 0.
 *              If there's no error, roundIndex is the result.
 */
function getLastCoinbaseUnitRoundIndex(conn, address, cb){
    if (!conn)
        return getLastCoinbaseUnitRoundIndex(db, address, cb);
    if(!validationUtils.isNonemptyString(address))
        return cb("param address is null or empty string");
    if(!validationUtils.isValidAddress(address))
        return cb("param address is not a valid address");
        conn.query(
        "SELECT round_index FROM units JOIN unit_authors USING(unit)  \n\
        WHERE is_stable=1 AND sequence='good' AND pow_type=? \n\
         AND address=? ORDER BY round_index DESC LIMIT 1", 
         [constants.POW_TYPE_COIN_BASE, address],
        function(rows){
            if(rows.length === 0)
                return cb(null, 0);
            cb(null, rows[0].round_index);
        }
    );
}

// cache begin
function shrinkRoundCacheObj(roundIndex, arrIndex, assocCachedObj){
    console.log("shrink Round Cache , begin roundIndex:" + roundIndex);
    var minIndex = Math.min.apply(Math, arrIndex);
    if(roundIndex - minIndex > 10000){
        console.log("shrink Round Cache, remove all");
        assocCachedObj = {};
    }
    else{
        for (var offset = minIndex; offset < roundIndex - MAX_ROUND_IN_CACHE; offset++){
            console.log("shrink Round Cache, remove roundIndex:" + offset);
            delete assocCachedObj[offset];
        }
    }
}
function shrinkRoundCache(){
    var arrWitnesses = Object.keys(assocCachedWitnesses);
	var arrTotalCommission = Object.keys(assocCachedTotalCommission);
	var arrMaxMci = Object.keys(assocCachedMaxMci);
    var arrCoinbaseRatio = Object.keys(assocCachedCoinbaseRatio);
    var arrRoundInfo = Object.keys(assocCachedRoundInfo);
    if (arrWitnesses.length < MAX_ROUND_IN_CACHE && arrTotalCommission.length < MAX_ROUND_IN_CACHE && 
        arrMaxMci.length < MAX_ROUND_IN_CACHE && arrCoinbaseRatio.length < MAX_ROUND_IN_CACHE){
        console.log("shrink Round Cache, arrWitnesses.length:" + arrWitnesses.length +
                ",arrTotalCommission.length:" + arrTotalCommission.length +
                ",arrMaxMci.length:" + arrMaxMci.length +
                ",arrCoinbaseRatio.length:" + arrCoinbaseRatio.length +
                ",arrRoundInfo.length:" + arrRoundInfo.length);
        return console.log('round cache is small, will not shrink');
    }
	getCurrentRoundIndex(db, function(roundIndex){
        shrinkRoundCacheObj(roundIndex, arrWitnesses, assocCachedWitnesses);        
        shrinkRoundCacheObj(roundIndex, arrTotalCommission, assocCachedTotalCommission);        
        shrinkRoundCacheObj(roundIndex, arrMaxMci, assocCachedMaxMci);        
        shrinkRoundCacheObj(roundIndex, arrCoinbaseRatio, assocCachedCoinbaseRatio);        
        shrinkRoundCacheObj(roundIndex, arrRoundInfo, assocCachedRoundInfo);     
	});
}

setInterval(shrinkRoundCache, 1000*1000);

// cache end


/**
 *	@exports
 */
exports.forwardRound = forwardRound;
exports.getCurrentRoundIndex = getCurrentRoundIndex;
exports.getMinWlByRoundIndex = getMinWlByRoundIndex;
exports.getCoinbaseByRoundIndex = getCoinbaseByRoundIndex;

exports.getCycleIdByRoundIndex = getCycleIdByRoundIndex;
exports.getDurationByCycleId = getDurationByCycleId;
exports.getDurationByRoundIndex = getDurationByRoundIndex;

exports.getDifficultydByRoundIndex = getDifficultydByRoundIndex;
exports.getDifficultydByCycleID = getDifficultydByCycleID;
exports.getStandardDuration = getStandardDuration;
exports.getAverageDifficultyByCycleId = getAverageDifficultyByCycleId;

exports.getCurrentRoundInfo = getCurrentRoundInfo;
exports.getRoundInfoByRoundIndex = getRoundInfoByRoundIndex;
exports.removeAssocCachedRoundInfo = removeAssocCachedRoundInfo;

exports.getWitnessesByRoundIndex = getWitnessesByRoundIndex;
exports.getRoundIndexByNewMci = getRoundIndexByNewMci;
exports.checkIfCoinBaseUnitByRoundIndexAndAddressExists = checkIfCoinBaseUnitByRoundIndexAndAddressExists;
exports.checkIfPowUnitByRoundIndexAndAddressExists = checkIfPowUnitByRoundIndexAndAddressExists;

exports.getMaxMciByRoundIndex = getMaxMciByRoundIndex;
exports.getCoinbaseByRoundIndexAndAddress = getCoinbaseByRoundIndexAndAddress;
exports.checkIfTrustMeAuthorByRoundIndex = checkIfTrustMeAuthorByRoundIndex;

exports.queryCoinBaseListByRoundIndex = queryCoinBaseListByRoundIndex;
exports.queryFirstTrustMEBallOnMainChainByRoundIndex	= queryFirstTrustMEBallOnMainChainByRoundIndex;
// exports.getSumCoinbaseByEndRoundIndex	= getSumCoinbaseByEndRoundIndex;

exports.getTotalMineAndCommissionByRoundIndex	= getTotalMineAndCommissionByRoundIndex;

exports.getLastCoinbaseUnitRoundIndex	= getLastCoinbaseUnitRoundIndex;

exports.getStatisticsByRoundIndex	= getStatisticsByRoundIndex;


// var roundIndex =1;

// setInterval(shrinkRoundCache, 10*1000);

// function addshrinkRoundCache(){
//     assocCachedWitnesses[roundIndex] = roundIndex;
//     console.log("add assocCachedWitnesses       : " + JSON.stringify(assocCachedWitnesses));
//     assocCachedTotalCommission[roundIndex] = roundIndex;
//     console.log("add assocCachedTotalCommission : " + JSON.stringify(assocCachedTotalCommission));
//     assocCachedMaxMci[roundIndex] = roundIndex;
//     console.log("add assocCachedMaxMci          : " + JSON.stringify(assocCachedMaxMci));
//     assocCachedCoinbaseRatio[roundIndex] = roundIndex;
//     console.log("add assocCachedCoinbaseRatio   : " + JSON.stringify(assocCachedCoinbaseRatio));
//     roundIndex++;
// }
// setInterval(addshrinkRoundCache, 1*1000);