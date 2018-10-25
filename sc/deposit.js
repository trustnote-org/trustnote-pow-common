/*jslint node: true */
"use strict";

var constants = require('../config/constants.js');
// var conf = require('../config/conf.js');
var db = require('../db/db.js');

var validationUtils = require("../validation/validation_utils.js");

/**
 *	verify if a deposit definition is valid.
 *
 * 	@param	{Array}	arrDefinition
 *	@return	{boolean}
 */
function isDepositDefinition(arrDefinition){
    if (!validationUtils.isArrayOfLength(arrDefinition, 2))
        return false;
    if (arrDefinition[0] !== 'or')
        return false;
    if (!validationUtils.isArrayOfLength(arrDefinition[1], 2))
        return false;
    if (!validationUtils.isArrayOfLength(arrDefinition[1][0], 2))
        return false;
    if (!validationUtils.isArrayOfLength(arrDefinition[1][1], 2))
        return false;
    if (arrDefinition[1][0][1] !== constants.FOUNDATION_SAFE_ADDRESS)
        return false;
    if(!validationUtils.isValidAddress(arrDefinition[1][1][1]))
        return false;
    
    return true;    
}

/**
 *	Check if an address has sent invalid unit.
 *
 * 	@param	{obj}	    conn      if conn is null, use db query, otherwise use conn.
 * 	@param	{string}	address
 * 	@param	{function}	cb( err, hasInvalidUnits ) callback function
 *              If there's error, err is the error message and hasInvalidUnits is null.
 *              If there's no error and there's invalid units, then hasInvalidUnits is true, otherwise false.
 */
function hasInvalidUnitsFromHistory(conn, address, cb){
    if (!conn)
        return hasInvalidUnitsFromHistory(db, address, cb);
    if(!validationUtils.isNonemptyString(address))
        return cb("param address is null or empty string");
    if(!validationUtils.isValidAddress(address))
        return cb("param address is not a valid address");
    conn.query(
        "SELECT address FROM units JOIN unit_authors USING(unit)  \n\
        WHERE is_stable=1 AND sequence!='good' AND address=?", 
        [address],
        function(rows){
            cb(null, rows.length > 0 ?  true : false);
        }
    );
}

/**
 * Returns deposit address balance(stable and pending).
 * 
 * @param	{obj}	    conn      if conn is null, use db query, otherwise use conn.
 * @param   {String}    depositAddress
 * @param   {function}	cb( err, balance ) callback function
 *                      If address is invalid, then returns err "invalid address".
 *                      If address is not a deposit, then returns err "address is not a deposit".
 *                      If can not find the address, then returns err "address not found".
 * @return {"base":{"stable":{Integer},"pending":{Integer}}} balance
 */
function getBalanceOfDepositContract(conn, depositAddress, cb){
    if (!conn)
        return getBalanceOfDepositContract(db, depositAddress, cb);
    if(!validationUtils.isNonemptyString(depositAddress))
        return cb("param depositAddress is null or empty string");
    if(!validationUtils.isValidAddress(depositAddress))
        return cb("param depositAddress is not a valid address");
    conn.query("SELECT definition FROM shared_addresses WHERE shared_address = ?", [depositAddress], 
        function(rows) {
        if (rows.length !== 1 )
            return cb("param depositAddress is not found");
        if(!isDepositDefinition(JSON.parse(rows[0].definition)))
            return cb("param depositAddress is not a deposit");
        conn.query(
            "SELECT asset, is_stable, SUM(amount) AS balance \n\
            FROM outputs JOIN units USING(unit) \n\
            WHERE is_spent=0 AND address=? AND sequence='good' AND asset IS NULL \n\
            GROUP BY is_stable", [depositAddress],
            function(rows) {
                var balance = {
                    base: {
                        stable: 0,
                        pending: 0
                    }
                };
                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i];
                    balance.base[row.is_stable ? 'stable' : 'pending'] = row.balance;
                }
                cb(null, balance);
            }
        );
    });
}

exports.isDepositDefinition = isDepositDefinition;
exports.hasInvalidUnitsFromHistory = hasInvalidUnitsFromHistory;
exports.getBalanceOfDepositContract = getBalanceOfDepositContract;

