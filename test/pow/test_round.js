/*jslint node: true */
"use strict";

const round = require( '../../pow/round.js' );
const db = require('../../db/db.js');

// test getLastCoinbaseUnitRoundIndex function begin
const getLastCoinbaseUnitRoundIndexCb = function(err, roundIndex){
    if(err)
        return console.log(" getLastCoinbaseUnitRoundIndexCb err:" + err);
    console.log(" getLastCoinbaseUnitRoundIndexCb result: " + roundIndex);
}
round.getLastCoinbaseUnitRoundIndex(null, null, getLastCoinbaseUnitRoundIndexCb);
round.getLastCoinbaseUnitRoundIndex(null, "", getLastCoinbaseUnitRoundIndexCb);
let address = "CAGSFKGJDODHWFJF5LS7577TKVPLH7K0";   // error address
round.getLastCoinbaseUnitRoundIndex(null, address, getLastCoinbaseUnitRoundIndexCb);
address = "CAGSFKGJDODHWFJF5LS7577TKVPLH7KG";   // has no coinbase
round.getLastCoinbaseUnitRoundIndex(null, address, getLastCoinbaseUnitRoundIndexCb);
address = "7RR5E6BRHE55FHE76HO6RT2E4ZP3CHYA";   // should return 3
round.getLastCoinbaseUnitRoundIndex(null, address, getLastCoinbaseUnitRoundIndexCb);
db.takeConnectionFromPool(function(conn) {
    address = "CAGSFKGJDODHWFJF5LS7577TKVPLH7KG";   // has no coinbase
    round.getLastCoinbaseUnitRoundIndex(conn, address,function(err, roundIndex){
        conn.release();
        getLastCoinbaseUnitRoundIndexCb(err, roundIndex);
    });
});
db.takeConnectionFromPool(function(conn) {
    address = "7RR5E6BRHE55FHE76HO6RT2E4ZP3CHYA";   // has no coinbase
    round.getLastCoinbaseUnitRoundIndex(conn, address, function(err, roundIndex){
        conn.release();
        getLastCoinbaseUnitRoundIndexCb(err, roundIndex);
    });
});

// test getLastCoinbaseUnitRoundIndex function end




