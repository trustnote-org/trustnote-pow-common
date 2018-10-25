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
 * 	@param	{string}	address
 * 	@param	{function}	cb( err, hasInvalidUnits ) 
 *              callback function
 *              If there's error, err is the error message and hasInvalidUnits is null.
 *              If there's no error and there's invalid units, then hasInvalidUnits is true, otherwise false.
 */
function hasInvalidUnitsFromHistory(address, cb){
    if(!validationUtils.isNonemptyString(address))
        return cb("param address is null or empty string");
    if(!validationUtils.isValidAddress(address))
        return cb("param address is not a valid address");
    db.query(
        "SELECT address FROM units JOIN unit_authors USING(unit)  \n\
        WHERE is_stable=1 AND sequence!='good' AND address=?", 
        [address],
        function(rows){
            cb(null, rows.length > 0 ?  true : false);
        }
    );
}

exports.isDepositDefinition = isDepositDefinition;
exports.hasInvalidUnitsFromHistory = hasInvalidUnitsFromHistory;

