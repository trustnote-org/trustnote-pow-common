/*jslint node: true */
"use strict";

const db = require('../../db/db.js');
const deposit = require( '../../sc/deposit.js' );

// test isDepositDefinition function begin

// right, return true
let arrDefinition = ['or',[['address','72FZXZMFPESCMUHUPWTZJ2F57YV32JCI'],['address', 'H3IS6DWI52EYVS7RUIX3DIZV2SBO6L3M']]];
console.log(deposit.isDepositDefinition(arrDefinition));
// wrong FOUNDATION_SAFE_ADDRESS, return false
arrDefinition = ['or',[['address','2SATGZDFDXNNJRVZ52O4J6VYTTMO2EZR'],['address', 'H3IS6DWI52EYVS7RUIX3DIZV2SBO6L3M']]];
console.log(deposit.isDepositDefinition(arrDefinition));
// wrong supernode address H3IS6DWI52EYVS7RUIX3DIZV1SBO6L3M , return false
arrDefinition = ['or',[['address','72FZXZMFPESCMUHUPWTZJ2F57YV32JCI'],['address', 'H3IS6DWI52EYVS7RUIX3DIZV1SBO6L3M']]];
console.log(deposit.isDepositDefinition(arrDefinition));
// wrong op , return false
arrDefinition = ['and',[['address','72FZXZMFPESCMUHUPWTZJ2F57YV32JCI'],['address', 'H3IS6DWI52EYVS7RUIX3DIZV2SBO6L3M']]];
console.log(deposit.isDepositDefinition(arrDefinition));
// address count big than 2 , return false
arrDefinition = ['or',[['address','72FZXZMFPESCMUHUPWTZJ2F57YV32JCI'],['address', 'H3IS6DWI52EYVS7RUIX3DIZV2SBO6L3M'],['address', 'WG2VYJTWOKOHPY7727R6UTVAQSI6K3NS']]];
console.log(deposit.isDepositDefinition(arrDefinition));

// test isDepositDefinition function end

// test hasInvalidUnitsFromHistory function begin
const hasInvalidUnitsFromHistoryCb = function(err, hasInvlid){
    if(err)
        return console.log(" hasInvalidUnitsFromHistory err:" + err);
    console.log(" hasInvalidUnitsFromHistory result: " + hasInvlid);
}
deposit.hasInvalidUnitsFromHistory(null, null, hasInvalidUnitsFromHistoryCb);
deposit.hasInvalidUnitsFromHistory(null, "", hasInvalidUnitsFromHistoryCb);
let invalidAddress = "CAGSFKGJDODHWFJF5LS7577TKVPLH7K0";   // error address
deposit.hasInvalidUnitsFromHistory(null, invalidAddress, hasInvalidUnitsFromHistoryCb);
invalidAddress = "7RR5E6BRHE55FHE76HO6RT2E4ZP3CHYA";   // has invalid address
deposit.hasInvalidUnitsFromHistory(null, invalidAddress, hasInvalidUnitsFromHistoryCb);
invalidAddress = "SAHCPBJAAOXRJ6KRSM3OGATIRSWIWOQA";   // good address
deposit.hasInvalidUnitsFromHistory(null, invalidAddress, hasInvalidUnitsFromHistoryCb);

db.takeConnectionFromPool(function(conn) {
    invalidAddress = "7RR5E6BRHE55FHE76HO6RT2E4ZP3CHYA";   // has invalid address
    deposit.hasInvalidUnitsFromHistory(conn, invalidAddress,function(err, hasInvlid){
        conn.release();
        hasInvalidUnitsFromHistoryCb(err, hasInvlid);
    });
});
db.takeConnectionFromPool(function(conn) {
    invalidAddress = "SAHCPBJAAOXRJ6KRSM3OGATIRSWIWOQA";   // good address
    deposit.hasInvalidUnitsFromHistory(conn, invalidAddress, function(err, hasInvlid){
        conn.release();
        hasInvalidUnitsFromHistoryCb(err, hasInvlid);
    });
});

// test hasInvalidUnitsFromHistory function end




