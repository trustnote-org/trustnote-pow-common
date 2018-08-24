/*jslint node: true */
"use strict";

// pow add

var constants = require('./constants.js');
var db = require('./db.js');
var conf = require('./conf.js');

var async = require('async');
var MAX_ROUND_IN_CACHE = 10;
var assocCachedWitnesses = {};
var assocCachedTotalCommission = {};
var assocCachedMaxMci = {};
var assocCachedCoinbaseRatio = {};

function getCurrentRoundIndex(conn, callback){
    conn.query(
		"SELECT * FROM round ORDER BY round_index DESC LIMIT 1", 
        [],
		function(rows){
			if (rows.length !== 1)
                throw Error("Can not find current round index");
            callback(rows[0].round_index);
		}
	);
}

function getCurrentRoundIndexByDb(callback){
    db.query(
		"SELECT * FROM round ORDER BY round_index DESC LIMIT 1", 
        [],
		function(rows){
			if (rows.length !== 1)
                throw Error("Can not find current round index");
            callback(rows[0].round_index);
		}
	);
}

function getCycleIdByRoundIndex(roundIndex){
    return Math.ceil(roundIndex/constants.COUNT_ROUNDS_FOR_DIFFICULTY_SWITCH);
}

function getDifficultydByRoundIndex(conn, roundIndex, callback){
    var cycleId = getCycleIdByRoundIndex(roundIndex);
    conn.query(
		"SELECT difficulty FROM round_cycle WHERE cycle_id=?", 
        [cycleId],
		function(rows){
			if (rows.length !== 1)
                throw Error("Can not find current round difficulty");
            callback(rows[0].difficulty);
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
    conn.query(
		"SELECT * FROM round ORDER BY round_index DESC LIMIT 1", 
        [],
		function(rows){
			if (rows.length !== 1)
                throw Error("Can not find current round index");
            callback(rows[0].round_index, rows[0].min_wl, rows[0].max_wl, rows[0].seed);
		}
	);
}

function getRoundInfoByRoundIndex(conn, roundIndex, callback){
    conn.query(
		"SELECT * FROM round WHERE round_index=?", 
        [roundIndex],
		function(rows){
			if (rows.length !== 1)
                throw Error("Can not find round index");
            callback(rows[0].round_index, rows[0].min_wl, rows[0].max_wl, rows[0].seed);
		}
	);
}

function getDurationByCycleId(conn, cycleId, callback){
    conn.query(
        "SELECT min(int_value) AS min_timestamp FROM data_feeds CROSS JOIN units USING(unit) CROSS JOIN unit_authors USING(unit) \n\
        WHERE address=? AND feed_name='timestamp' AND pow_type=? \n\
            AND sequence='good' AND is_stable=1 AND round_index=?",
        [constants.FOUNDATION_ADDRESS, constants.POW_TYPE_TRUSTME, getMinRoundIndexByCycleId(cycleId)],
        function(rowsMin){
            if (rowsMin.length !== 1)
                throw Error("Can not find min timestamp of cycle " + cycleId);
            conn.query(
                "SELECT max(int_value) AS max_timestamp FROM data_feeds CROSS JOIN units USING(unit) CROSS JOIN unit_authors USING(unit) \n\
                WHERE address=? AND feed_name='timestamp' AND pow_type=? \n\
                    AND sequence='good' AND is_stable=1 AND round_index=?",
                [constants.FOUNDATION_ADDRESS, constants.POW_TYPE_TRUSTME, getMaxRoundIndexByCycleId(cycleId)],
                function(rowsMax){
                    if (rowsMax.length !== 1)
                        throw Error("Can not find max timestamp of cycle " + cycleId);
                    callback(rowsMax[0].max_timestamp - rowsMin[0].min_timestamp);
                }
            );            
        }
    );
}

function getPowEquhashUnitsByRoundIndex( oConn, nRoundIndex, pfnCallback )
{
	return getUnitsWithTypeByRoundIndex( oConn, nRoundIndex, constants.POW_TYPE_POW_EQUHASH, pfnCallback );
}
function getTrustMEUnitsByRoundIndex( oConn, nRoundIndex, pfnCallback )
{
	return getUnitsWithTypeByRoundIndex( oConn, nRoundIndex, constants.POW_TYPE_TRUSTME, pfnCallback );
}
function getCoinBaseUnitsByRoundIndex( oConn, nRoundIndex, pfnCallback )
{
	return getUnitsWithTypeByRoundIndex( oConn, nRoundIndex, constants.POW_TYPE_COIN_BASE, pfnCallback );
}

/**
 *	get units with type by round index
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	nRoundIndex
 *	@param	{number}	nType
 *	@param	{function}	pfnCallback( err, arrRows )
 *	@return {*}
 */
function getUnitsWithTypeByRoundIndex( oConn, nRoundIndex, nType, pfnCallback )
{
	if ( ! oConn )
	{
		return pfnCallback( `call getUnitsWithTypeByRoundIndex with invalid oConn` );
	}
	if ( 'number' !== typeof nRoundIndex || nRoundIndex < 0 )
	{
		return pfnCallback( `call getUnitsWithTypeByRoundIndex with invalid nRoundIndex` );
	}
	if ( 'number' !== typeof nType )
	{
		return pfnCallback( `call getUnitsWithTypeByRoundIndex with invalid nType` );
	}

	oConn.query
	(
		"SELECT * FROM units \
		WHERE round_index = ? AND is_stable=1 AND is_on_main_chain=1 AND pow_type=? \
		ORDER BY main_chain_index",
		[ nRoundIndex, nType ],
		function( arrRows )
		{
			pfnCallback( null, arrRows );
		}
	);
}


function checkIfHaveFirstTrustMEByRoundIndex(conn, round_index, callback){
    conn.query(
		"SELECT witnessed_level FROM units WHERE round_index=?  \n\
		AND is_stable=1 AND is_on_main_chain=1 AND pow_type=? ORDER BY main_chain_index LIMIT 1", 
        [round_index, constants.POW_TYPE_TRUSTME],
		function(rows){
            callback(rows.length === 1);
		}
	);
}

// the MinWl and MaxWl maybe null
function getMinWlAndMaxWlByRoundIndex(conn, roundIndex, callback){
    conn.query(
		"SELECT min_wl, max_wl FROM round where round_index=?", 
        [roundIndex],
		function(rows){
			if (rows.length !== 1)
                throw Error("Can not find the right round index");
            callback(rows[0].min_wl, rows[0].max_wl);
		}
	);
}

function getCoinbaseByRoundIndex(roundIndex){
    if(roundIndex < 1 || roundIndex > constants.ROUND_TOTAL_ALL)
        return 0;
	return constants.ROUND_COINBASE[Math.ceil(roundIndex/constants.ROUND_TOTAL_YEAR)-1];
}

function getWitnessesByRoundIndex(conn, roundIndex, callback){
	// TODO ：cache the witnesses of recent rounds
	var witnesses  = [];
	if (roundIndex === 1){// first round
		witnesses = witnesses.concat(conf.initialWitnesses);
		if(witnesses.length != constants.COUNT_WITNESSES)
			throw Error("Can not find enough witnesses in conf initialWitnesses");
		return callback(witnesses);
    }
    
    if (assocCachedWitnesses[roundIndex])
        return callback(assocCachedWitnesses[roundIndex]);
    conn.query(
		"SELECT distinct(address) \n\
		FROM units JOIN unit_authors using (unit)\n\
        WHERE is_stable=1 AND sequence='good' AND pow_type=? AND round_index=? ORDER BY main_chain_index,unit  \n\
        LIMIT ?", 
        [constants.POW_TYPE_POW_EQUHASH, roundIndex - 1, constants.COUNT_POW_WITNESSES],
		function(rows){
			if (rows.length !==  constants.COUNT_POW_WITNESSES)
                throw Error("Can not find enough witnesses ");
            witnesses = rows.map(function(row) { return row.address; } );
            witnesses.push(constants.FOUNDATION_ADDRESS);
            assocCachedWitnesses[roundIndex] = witnesses;
            callback(witnesses);
		}
	);
}


function getWitnessesByRoundIndexByDb(roundIndex, callback){
	// TODO ：cache the witnesses of recent rounds
	var witnesses  = [];
	if (roundIndex === 1){// first round
		witnesses = witnesses.concat(conf.initialWitnesses);
		if(witnesses.length != constants.COUNT_WITNESSES)
			throw Error("Can not find enough witnesses in conf initialWitnesses");
		return  callback(witnesses);
    }
    
    if (assocCachedWitnesses[roundIndex])
      return callback(assocCachedWitnesses[roundIndex]);
    db.query(
		"SELECT distinct(address) \n\
		FROM units JOIN unit_authors using (unit)\n\
        WHERE is_stable=1 AND sequence='good' AND pow_type=? AND round_index=? ORDER BY main_chain_index,unit  \n\
        LIMIT ?", 
        [constants.POW_TYPE_POW_EQUHASH, roundIndex - 1, constants.COUNT_POW_WITNESSES],
		function(rows){
			if (rows.length !==  constants.COUNT_POW_WITNESSES)
                throw Error("Can not find enough witnesses ");
            witnesses = rows.map(function(row) { return row.address; } );
            witnesses.push(constants.FOUNDATION_ADDRESS);
            assocCachedWitnesses[roundIndex] = witnesses;
            callback(witnesses);
		}
	);
}

function checkIfCoinBaseUnitByRoundIndexAndAddressExists(conn, roundIndex, address, callback){
    // TODO ：cache the witnesses of recent rounds
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
    // TODO ：cache the witnesses of recent rounds
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

function getMaxMciByRoundIndex(conn, roundIndex, callback){
    if(roundIndex === 0)
        return callback(0);
    if (assocCachedMaxMci[roundIndex])
        return callback(assocCachedMaxMci[roundIndex]);
    conn.query(
        "select max(main_chain_index) AS max_mci from units \n\
        where is_on_main_chain=1 AND is_stable=1 AND pow_type=? AND round_index=?", 
        [constants.POW_TYPE_TRUSTME, roundIndex],
        function(rows){
            if (rows.length !== 1)
                throw Error("Can not find max mci ");
            assocCachedMaxMci[roundIndex] = rows[0].max_mci;
            callback(rows[0].max_mci);
        }
    );
}

function getTotalCommissionByRoundIndex(conn, roundIndex, callback){
    if(roundIndex <= 0) 
        throw Error("The first round have no commission ");
    if (assocCachedTotalCommission[roundIndex])
        return callback(assocCachedTotalCommission[roundIndex]);
    getMinWlAndMaxWlByRoundIndex(conn, roundIndex, function(minWl, maxWl){
        if(minWl === null || maxWl === null)
            throw Error("Can't get commission before the round switch.");
        getMaxMciByRoundIndex(conn, roundIndex-1, function(lastRoundMaxMci){
            getMaxMciByRoundIndex(conn, roundIndex, function(currentRoundMaxMci){
                conn.query(
                    "select sum(headers_commission+payload_commission) AS total_commission from units \n\
                    where  is_stable=1 \n\
                    AND main_chain_index>? AND main_chain_index<=?", 
                    [lastRoundMaxMci, currentRoundMaxMci],
                    function(rows){
                        if (rows.length !== 1)
                            throw Error("Can not calculate the total commision of round index " + roundIndex);
                        assocCachedTotalCommission[roundIndex] = rows[0].total_commission;
                        callback(rows[0].total_commission);
                    }
                );
            });
        });
    });
}

function getAllCoinbaseRatioByRoundIndex(conn, roundIndex, callback){
    if(roundIndex <= 0) 
        throw Error("The first round have no commission ");
    if (assocCachedCoinbaseRatio[roundIndex])
        return callback(assocCachedCoinbaseRatio[roundIndex]);
    getMinWlAndMaxWlByRoundIndex(conn, roundIndex, function(minWl, maxWl){
        if(minWl === null || maxWl === null)
            throw Error("Can't get commission before the round switch.");
        getWitnessesByRoundIndex(conn, roundIndex, function(witnesses){
            conn.query(
                "SELECT unit, witnessed_level, address \n\
                FROM units JOIN unit_authors using (unit)\n\
                WHERE is_stable=1 AND is_on_main_chain=1 AND sequence='good' AND pow_type=? AND round_index=?", 
                [constants.POW_TYPE_TRUSTME, roundIndex],
                function(rows){
                    if (rows.length === 0 )
                        throw Error("Can not find any trustme units ");
                    var totalCountOfTrustMe = 0;
                    var witnessRatioOfTrustMe = {};
                    var addressTrustMeWl = {};
                    for (var i=0; i<rows.length; i++){
                        var row = rows[i];
                        if(witnesses.indexOf(row.address) === -1)
                            throw Error("wrong trustme unit exit ");
                        if(addressTrustMeWl[row.address] && row.witnessed_level - addressTrustMeWl[row.address] <= constants.MIN_INTERVAL_WL_OF_TRUSTME)
                            continue;                            
                        
                        addressTrustMeWl[row.address] = row.witnessed_level;

                        totalCountOfTrustMe++;
                        if(!witnessRatioOfTrustMe[row.address])
                            witnessRatioOfTrustMe[row.address]=1;
                        else
                            witnessRatioOfTrustMe[row.address]++;
                    }

                    Object.keys(witnessRatioOfTrustMe).forEach(function(address){
                        witnessRatioOfTrustMe[address] = witnessRatioOfTrustMe[address]/totalCountOfTrustMe;
                    });
                    assocCachedCoinbaseRatio[roundIndex] = witnessRatioOfTrustMe;
                    callback(witnessRatioOfTrustMe);
                }
            );    
        });        
    });
}

function getCoinbaseRatioByRoundIndexAndAddress(conn, roundIndex, witnessAddress, callback){
    getAllCoinbaseRatioByRoundIndex(conn, roundIndex, function(witnessRatioOfTrustMe){
        callback(witnessRatioOfTrustMe[witnessAddress]);
    });
}

function getCoinbaseByRoundIndexAndAddress(conn, roundIndex, witnessAddress, callback){
    var coinbase = getCoinbaseByRoundIndex(roundIndex);
    getTotalCommissionByRoundIndex(conn, roundIndex, function(totalCommission){
        getCoinbaseRatioByRoundIndexAndAddress(conn, roundIndex, witnessAddress, function(witnessRatioOfTrustMe){
            callback(Math.floor((coinbase+totalCommission)*witnessRatioOfTrustMe));
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
                    if(arrResult.length != constants.COUNT_WITNESSES)
                        throw Error("Can not find enough coinbase witness");
                    return callback(null, arrResult);
                }
            );
        }
    );
}


// coinbase end

// cache begin
function shrinkRoundCacheObj(roundIndex, arrIndex, assocCachedObj){
    var minIndex = Math.min.apply(Math, arrIndex);
    if(roundIndex - minIndex > 10000){
        assocCachedObj = {};
    }
    else{
        for (var offset = minIndex; offset < roundIndex - MAX_ROUND_IN_CACHE; offset++){
            delete assocCachedObj[offset];
        }
    }
}
function shrinkRoundCache(){
    var arrWitnesses = Object.keys(assocCachedWitnesses);
	var arrTotalCommission = Object.keys(assocCachedTotalCommission);
	var arrMaxMci = Object.keys(assocCachedMaxMci);
	var arrCoinbaseRatio = Object.keys(assocCachedCoinbaseRatio);
    if (arrWitnesses.length < MAX_ROUND_IN_CACHE && arrTotalCommission.length < MAX_ROUND_IN_CACHE && 
        arrMaxMci.length < MAX_ROUND_IN_CACHE && arrCoinbaseRatio.length < MAX_ROUND_IN_CACHE)
		return console.log('round cache is small, will not shrink');
	getCurrentRoundIndex(db, function(roundIndex){
        shrinkRoundCacheObj(roundIndex, arrWitnesses, assocCachedWitnesses);        
        shrinkRoundCacheObj(roundIndex, arrTotalCommission, assocCachedTotalCommission);        
        shrinkRoundCacheObj(roundIndex, arrMaxMci, assocCachedMaxMci);        
        shrinkRoundCacheObj(roundIndex, arrCoinbaseRatio, assocCachedCoinbaseRatio);        
	});
}

setInterval(shrinkRoundCache, 1000*1000);

// cache end


/**
 *	@exports
 */
exports.getCurrentRoundIndex = getCurrentRoundIndex;
exports.getCurrentRoundIndexByDb = getCurrentRoundIndexByDb;
exports.getMinWlAndMaxWlByRoundIndex = getMinWlAndMaxWlByRoundIndex;
exports.getCoinbaseByRoundIndex = getCoinbaseByRoundIndex;

exports.getCycleIdByRoundIndex = getCycleIdByRoundIndex;
exports.getDurationByCycleId = getDurationByCycleId;
exports.getDifficultydByRoundIndex = getDifficultydByRoundIndex;

exports.getPowEquhashUnitsByRoundIndex	= getPowEquhashUnitsByRoundIndex;
exports.getTrustMEUnitsByRoundIndex	= getTrustMEUnitsByRoundIndex;
exports.getCoinBaseUnitsByRoundIndex	= getCoinBaseUnitsByRoundIndex;
exports.getUnitsWithTypeByRoundIndex	= getUnitsWithTypeByRoundIndex;
exports.getCurrentRoundInfo = getCurrentRoundInfo;
exports.getRoundInfoByRoundIndex = getRoundInfoByRoundIndex;

exports.checkIfHaveFirstTrustMEByRoundIndex = checkIfHaveFirstTrustMEByRoundIndex;
exports.getWitnessesByRoundIndex = getWitnessesByRoundIndex;
exports.getWitnessesByRoundIndexByDb = getWitnessesByRoundIndexByDb;
exports.checkIfCoinBaseUnitByRoundIndexAndAddressExists = checkIfCoinBaseUnitByRoundIndexAndAddressExists;
exports.checkIfPowUnitByRoundIndexAndAddressExists = checkIfPowUnitByRoundIndexAndAddressExists;

exports.getCoinbaseByRoundIndexAndAddress = getCoinbaseByRoundIndexAndAddress;
exports.checkIfTrustMeAuthorByRoundIndex = checkIfTrustMeAuthorByRoundIndex;

exports.queryCoinBaseListByRoundIndex = queryCoinBaseListByRoundIndex;

