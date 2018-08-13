/*jslint node: true */
"use strict";

// pow modi 
//exports.COUNT_WITNESSES		= 12;
exports.COUNT_WITNESSES		= 9;
exports.COUNT_POW_WITNESSES = 8;
exports.TOTAL_WHITEBYTES	= 5e14;
exports.MAJORITY_OF_WITNESSES	= (exports.COUNT_WITNESSES % 2 === 0) ? (exports.COUNT_WITNESSES / 2 + 1) : Math.ceil(exports.COUNT_WITNESSES / 2);
exports.COUNT_MC_BALLS_FOR_PAID_WITNESSING = 100;

exports.version = '1.0';
exports.alt = '1';

exports.GENESIS_UNIT = 'rg1RzwKwnfRHjBojGol3gZaC5w7kR++rOR6O61JRsrQ=';
exports.BLACKBYTES_ASSET = '9qQId3BlWRQHvVy+STWyLKFb3lUd0xfQhX6mPVEHC2c=';
// Pow add
exports.FOUNDATION_ADDRESS = "VIFOO3NSQURCHCPNV2TIHYR5E5JETJO7";

exports.HASH_LENGTH = 44;
exports.PUBKEY_LENGTH = 44;
exports.SIG_LENGTH = 88;

// anti-spam limits
exports.MAX_AUTHORS_PER_UNIT = 16;
exports.MAX_PARENTS_PER_UNIT = 16;
exports.MAX_MESSAGES_PER_UNIT = 128;
exports.MAX_SPEND_PROOFS_PER_MESSAGE = 128;
exports.MAX_INPUTS_PER_PAYMENT_MESSAGE = 128;
exports.MAX_OUTPUTS_PER_PAYMENT_MESSAGE = 128;
exports.MAX_CHOICES_PER_POLL = 128;
exports.MAX_DENOMINATIONS_PER_ASSET_DEFINITION = 64;
exports.MAX_ATTESTORS_PER_ASSET = 64;
exports.MAX_DATA_FEED_NAME_LENGTH = 64;
exports.MAX_DATA_FEED_VALUE_LENGTH = 64;
exports.MAX_AUTHENTIFIER_LENGTH = 4096;
exports.MAX_CAP = 9e15;
exports.MAX_COMPLEXITY = 100;

exports.ROUND_TOTAL_YEAR = 210240;
exports.ROUND_TOTAL_ALL = 4204800;
exports.ROUND_COINBASE = [217.59,
						176.74,
						156.49,
						143.55,
						134.26,
						127.11,
						121.37,
						116.60,
						112.55,
						109.05,
						105.98,
						103.25,
						100.80,
						98.58,
						96.56,
						94.71,
						93.00,
						91.42,
						89.95,
						88.58,
						0];

exports.MIN_INTERVAL_WL_OF_TRUSTME = 3;

/**
 *	pow_type
 */
exports.POW_TYPE_POW_EQUHASH	= 1;
exports.POW_TYPE_TRUSTME	= 2;
exports.POW_TYPE_COIN_BASE	= 3;
