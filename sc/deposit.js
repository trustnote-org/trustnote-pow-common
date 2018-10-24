/*jslint node: true */
"use strict";

var constants = require('../config/constants.js');
// var conf = require('../config/conf.js');
// var db = require('../db/db.js');

var validationUtils = require("../validation/validation_utils.js");

/**
 *	verify if a deposit definition is valid
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

exports.isDepositDefinition = isDepositDefinition;
