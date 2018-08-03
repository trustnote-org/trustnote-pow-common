/*jslint node: true */
"use strict";

// pow add

var constants = require('./constants.js');

var ROUNDYEAR_TOTAL = 210240;


function getCoinbaseByRoundIndex(roundIndex){
    if(roundIndex < 1 || roundIndex > 4204800)
        return 0;
	return constants.ROUND_COINBASE[Math.ceil(roundIndex/ROUNDYEAR_TOTAL)-1];
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


