/*jslint node: true */
"use strict";

//var constants = require('../config/constants.js');
//var conf = require('../config/conf.js');
//var db = require('../db/db.js');
//var async = require('async');
//var validationUtils = require('../validation/validation_utils.js');
var objectHash = require('../base/object_hash.js');

var MAX_GST_ = 3000;
var EACH_DELTA = 500;
var MAX_BYZANTINE_IN_CACHE = 100;

// Initialization:
var H_p           = 0;
var Phase_p       = 0;   //  current phase number
var step_p        = "";  // propose,prevote,precommit
var lockedValue_p = {};
var lockedRound_p = -1;
var validValue_p  = {};
var validRound_p  = -1;

var assocByzantinePhase = {};
var assocDecision = {};




// cache begin

// function shrinkRoundCacheObj(roundIndex, arrIndex, assocByzantinePhase){
//     var minIndex = Math.min.apply(Math, arrIndex);
//     if(roundIndex - minIndex > 10000){
//         console.log("RoundCacheLog:shrinkRoundCacheObj:assocCachedObj,delete all");
//         assocByzantinePhase = {};
//     }
//     else{
//         for (var offset = minIndex; offset < roundIndex - MAX_ROUND_IN_CACHE; offset++){
//             console.log("RoundCacheLog:shrinkRoundCacheObj:assocCachedObj,roundIndex:" + offset);
//             delete assocCachedObj[offset];
//         }
//     }
// }
// function shrinkByzantineCache(){
//     var arrByzantinePhases = Object.keys(assocByzantinePhase);
// 	if (arrByzantinePhases.length < MAX_BYZANTINE_IN_CACHE){
//         console.log("ByzantinePhases:shrinkByzantineCache,assocByzantinePhase.length:" + assocByzantinePhase.length);
//         return console.log('byzantine cache is small, will not shrink');
//     }
//     var minIndex = Math.min.apply(Math, arrByzantinePhases);
//     if(minIndex !== assocByzantinePhase)
//     for (var offset = minIndex; offset < roundIndex - MAX_ROUND_IN_CACHE; offset++){
//         console.log("RoundCacheLog:shrinkRoundCacheObj:assocCachedObj,roundIndex:" + offset);
//         delete assocCachedObj[offset];
//     }
// }

// setInterval(shrinkByzantineCache, 500*1000);

// cache end


/**
 *	@exports
 */


// test code
var testValue = {
    "version": "1.0",
    "alt": "1",
    "messages": [
      {
        "app": "data_feed",
        "payload_location": "inline",
        "payload_hash": "t0PkoqSbe0Tm6/3i8kv72K/hkWcruLHg+tY/DvzGR0g=",
        "payload": {
          "timestamp": 1542593986179
        }
      }
    ],
    "round_index": 100,
    "pow_type": 2,
    "parent_units": [
      "CzONNx8NbqIbjULi/Xt2rgRJws7Dg8TR7lCIIeJzSMQ="
    ],
    "last_ball": "XCcD+vZcbe025xn4VZRAwowtXBqU8JS/WIB43vYpzYA=",
    "last_ball_unit": "AxH3SWNh/9dwRpuphZVPGAzbO/Md8AJpj7Q1C6JxBM4=",
};
var testIdv = objectHash.getProposalUnitHash(testValue);
var testProposal = {
    address: "JNA6YWLKFQG7PFF6F32KTXBUAHRAFSET",
    unit: testValue,
    idv: testIdv,
    validRoundP: 1,
    isValid: 1
};
var testProvote1 = {
    "D55F4JL2R3S4UHX4UXVFGOWTZPZR2YXO":{
        idv:testIdv,
        result:1
    }
};
var testProvote2 = {
    "ZW35QKXIKK47A7HW3YRIV6TU3DYDTIVR":{
        idv:testIdv,
        result:1
    }
};
var testProvote3 = {
    "YYPCNIE34QFXXCNTQ274TP3B5DVRHWSY":{
        idv:testIdv,
        result:1
    }
};
var testProcommit1 = {
    "D55F4JL2R3S4UHX4UXVFGOWTZPZR2YXO":{
        idv:testIdv,
        result:1
    }
};
var testProcommit2 = {
    "ZW35QKXIKK47A7HW3YRIV6TU3DYDTIVR":{
        idv:testIdv,
        result:1
    }
};
var testProcommit3 = {
    "YYPCNIE34QFXXCNTQ274TP3B5DVRHWSY":{
        idv:testIdv,
        result:1
    }
};

var assocByzantinePhase = {
    1000:{
        0:{
            proposal:testProposal,
            prevote:[testProvote1, testProvote2, testProvote3],
            precommit:[testProcommit1, testProcommit2],
        }
    }
};

var hp_test=1000;
console.log(JSON.stringify(assocByzantinePhase));
console.log(JSON.stringify(assocByzantinePhase[hp_test]));
console.log(JSON.stringify(assocByzantinePhase[hp_test][0].proposal));
console.log(JSON.stringify(assocByzantinePhase[hp_test][0].prevote));
console.log(JSON.stringify(assocByzantinePhase[hp_test][0].precommit));
console.log(JSON.stringify(assocByzantinePhase[hp_test][0].prevote.length));
console.log(JSON.stringify(assocByzantinePhase[hp_test][0].precommit.length));

assocByzantinePhase[hp_test][1]={
    proposal:testProposal,
    prevote:[testProvote1, testProvote2],
    precommit:[testProcommit1, testProcommit2],
};
//console.log(JSON.stringify(assocByzantinePhase[hp_test]));
