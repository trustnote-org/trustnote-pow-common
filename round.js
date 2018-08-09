/*jslint node: true */
"use strict";

// pow add

var constants = require('./constants.js');
var db = require('./db.js');
var conf = require('./conf.js');


function getCurrentRoundIndex(callback){
    db.query(
		"SELECT MAX(round_index) AS ci FROM round", 
        [],
		function(rows){
			if (rows.length !== 1)
                throw Error("Can not find current round index");
            callback(rows[0]["ci"]);
		}
	);
}

// the MinWl and MaxWl maybe null
function getMinWlAndMaxWlByRoundIndex(roundIndex, callback){
    db.query(
		"SELECT min_wl, max_wl FROM round where round_index=?", 
        [roundIndex],
		function(rows){
			if (rows.length !== 1)
                throw Error("Can not find the right round index");
            callback(rows[0]["min_wl"], rows[0]["max_wl"]);
		}
	);
}

function getCoinbaseByRoundIndex(roundIndex){
    if(roundIndex < 1 || roundIndex > constants.ROUND_TOTAL_ALL)
        return 0;
	return constants.ROUND_COINBASE[Math.ceil(roundIndex/constants.ROUND_TOTAL_YEAR)-1];
}

function getWitnessesByRoundIndex(roundIndex, callback){
    // TODO ：cache the witnesses of recent rounds
    db.query(
		"SELECT distinct(address) \n\
		FROM units JOIN unit_authors using (unit)\n\
        WHERE is_stable=1 AND sequence='good' AND pow_type=? AND round_index=? ORDER BY main_chain_index,unit  \n\
        LIMIT ?", 
        [constants.POW_TYPE_POW_EQUHASH, roundIndex, constants.COUNT_WITNESSES],
		function(rows){
			if (rows.length !==  constants.COUNT_WITNESSES)
                throw Error("Can not find enough witnesses ");
            var witnesses = rows.map(function(row) { return row.address; } );
            callback(witnesses.push(constants.FOUNDATION_ADDRESS));
		}
	);
}

function checkIfCoinBaseUnitByRoundIndexAndAddressExists(roundIndex, address, callback){
    // TODO ：cache the witnesses of recent rounds
    db.query(
		"SELECT  units.unit \n\
		FROM units JOIN unit_authors using (unit)\n\
        WHERE is_stable=1 AND sequence='good' AND pow_type=? AND round_index=? AND address=? ", 
        [constants.POW_TYPE_COIN_BASE, roundIndex, address],
		function(rows){
			callback(rows.length > 0 );
		}
	);
}


exports.getCurrentRoundIndex = getCurrentRoundIndex;
exports.getMinWlAndMaxWlByRoundIndex = getMinWlAndMaxWlByRoundIndex;
exports.getCoinbaseByRoundIndex = getCoinbaseByRoundIndex;
exports.getWitnessesByRoundIndex = getWitnessesByRoundIndex;
exports.checkIfCoinBaseUnitByRoundIndexAndAddressExists = checkIfCoinBaseUnitByRoundIndexAndAddressExists;

// console.log("roundIndex:0-"+getCoinbaseByRoundIndex(0));
// console.log("roundIndex:1-"+getCoinbaseByRoundIndex(1));
// console.log("roundIndex:2156-"+getCoinbaseByRoundIndex(2156));
// console.log("roundIndex:210240-"+getCoinbaseByRoundIndex(210240));
// console.log("roundIndex:210241-"+getCoinbaseByRoundIndex(210241));
// console.log("roundIndex:420480-"+getCoinbaseByRoundIndex(420480));
// console.log("roundIndex:420481-"+getCoinbaseByRoundIndex(420481));
// console.log("roundIndex:721212-"+getCoinbaseByRoundIndex(721212));
// console.log("roundIndex:3153600-"+getCoinbaseByRoundIndex(3153600));
// console.log("roundIndex:3153601-"+getCoinbaseByRoundIndex(3153601));
// console.log("roundIndex:4204800-"+getCoinbaseByRoundIndex(4204800));
// console.log("roundIndex:4204801-"+getCoinbaseByRoundIndex(4204801));
// console.log("roundIndex:4212121201-"+getCoinbaseByRoundIndex(4212121201));


