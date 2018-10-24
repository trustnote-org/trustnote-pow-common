/*jslint node: true */
"use strict";

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

