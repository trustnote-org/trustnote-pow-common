/*jslint node: true */
"use strict";

// pow add

var constants = require('./constants.js');
var db = require('./db.js');
var conf = require('./conf.js');

var ROUNDYEAR_TOTAL = 210240;


function getCoinbaseByRoundIndex(roundIndex){
    if(roundIndex < 1 || roundIndex > 4204800)
        return 0;
	return constants.ROUND_COINBASE[Math.ceil(roundIndex/ROUNDYEAR_TOTAL)-1];
}

function getWitnessesByRoundIndex(round, callback){
    // TODO ：cache the witnesses of recent rounds
    db.query(
		"SELECT distinc(address) \n\
		FROM units JOIN unit_authors using (unit)\n\
        WHERE is_stable=1 and pow_type=1 and round_index=? order by main_chain_index,unit  \n\
        LIMIT ?", 
        [round, constants.COUNT_WITNESSES],
		function(rows){
			if (rows.length !==  constants.COUNT_WITNESSES)
                throw Error("Can not find enough witnesses ");
            var witnesses = rows.map(function(row) { return row.address; } );
            callback(witnesses.push(constants.FOUNDATION_ADDRESS));
		}
	);
}

function checkIfCoinBaseUnitByRoundIndexAndAddressExists(round, address, callback){
    // TODO ：cache the witnesses of recent rounds
    db.query(
		"SELECT  units.unit \n\
		FROM units JOIN unit_authors using (unit)\n\
        WHERE pow_type=3 and round_index=? and address=? ", 
        [round, address],
		function(rows){
			callback(rows.length > 0 );
		}
	);
}


exports.getCoinbaseByRoundIndex = getCoinbaseByRoundIndex;

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


