/*jslint node: true */
"use strict";

const round = require( '../../pow/round.js' );

// test getLastCoinbaseUnitRoundIndex function begin
const getLastCoinbaseUnitRoundIndexCb = function(err, roundIndex){
    if(err)
        return console.log(" getLastCoinbaseUnitRoundIndexCb err:" + err);
    console.log(" getLastCoinbaseUnitRoundIndexCb result: " + roundIndex);
}
round.getLastCoinbaseUnitRoundIndex(null, getLastCoinbaseUnitRoundIndexCb);
round.getLastCoinbaseUnitRoundIndex("", getLastCoinbaseUnitRoundIndexCb);
let address = "CAGSFKGJDODHWFJF5LS7577TKVPLH7K0";   // error address
round.getLastCoinbaseUnitRoundIndex(address, getLastCoinbaseUnitRoundIndexCb);
address = "CAGSFKGJDODHWFJF5LS7577TKVPLH7KG";   // has no coinbase
round.getLastCoinbaseUnitRoundIndex(address, getLastCoinbaseUnitRoundIndexCb);
address = "7RR5E6BRHE55FHE76HO6RT2E4ZP3CHYA";   // should return 3
round.getLastCoinbaseUnitRoundIndex(address, getLastCoinbaseUnitRoundIndexCb);

// test getLastCoinbaseUnitRoundIndex function end




