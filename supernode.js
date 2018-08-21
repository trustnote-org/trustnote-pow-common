/*jslint node: true */
"use strict";
var fs = require('fs');
var crypto = require('crypto');
var constants = require('./constants.js');
var composer = require('./composer.js');
var conf = require('./conf.js');
var objectHash = require('./object_hash.js');
var desktopApp = require('./desktop_app.js');
var db = require('./db.js');
var eventBus = require('./event_bus.js');
var ecdsaSig = require('./signature.js');
var Mnemonic = require('bitcore-mnemonic');
var Bitcore = require('bitcore-lib');
var readline = require('readline');
var storage = require('./storage.js');
var mail = require('./mail.js');
var round = require('./round.js');
var pow = require('./pow.js');

var WITNESSING_COST = 600; // size of typical witnessing unit
var my_address;
var bWitnessingUnderWay = false;
var forcedWitnessingTimer;
var count_witnessings_available = 0;

// pow add
var bMining = false; // if miner is mining
var currentRound = 1; // to record current round index

eventBus.on('headless_wallet_ready', function(){
	if (!conf.admin_email || !conf.from_email){
		console.log("please specify admin_email and from_email in your "+desktopApp.getAppDataDir()+'/conf.json');
		process.exit(1);
	}
	supernode.setupChatEventHandlers();
	supernode.readSingleWallet(function(address){
		my_address = address;
		//checkAndWitness();
	});
});

function onError(err){
	throw Error(err);
}

const callbacks = composer.getSavingCallbacks({
	ifNotEnoughFunds: onError,
	ifError: onError,
	ifOk: function(objJoint){
		network.broadcastJoint(objJoint);
		onDone();
	}
})

var appDataDir = desktopApp.getAppDataDir();
var KEYS_FILENAME = appDataDir + '/' + (conf.KEYS_FILENAME || 'keys.json');
var wallet_id;
var xPrivKey;

function readKeys(onDone){
	console.log('-----------------------');
	if (conf.control_addresses)
		console.log("remote access allowed from devices: "+conf.control_addresses.join(', '));
	if (conf.payout_address)
		console.log("payouts allowed to address: "+conf.payout_address);
	console.log('-----------------------');
	fs.readFile(KEYS_FILENAME, 'utf8', function(err, data){
		var rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			//terminal: true
		});
		if (err){ // first start
			console.log('failed to read keys, will gen');
			var suggestedDeviceName = require('os').hostname() || 'Headless';
			rl.question("Please name this device ["+suggestedDeviceName+"]: ", function(deviceName){
				if (!deviceName)
					deviceName = suggestedDeviceName;
				var userConfFile = appDataDir + '/conf.json';
				fs.writeFile(userConfFile, JSON.stringify({deviceName: deviceName}, null, '\t'), 'utf8', function(err){
					if (err)
						throw Error('failed to write conf.json: '+err);
					rl.question(
						'Device name saved to '+userConfFile+', you can edit it later if you like.\n\nPassphrase for your private keys: ',
						function(passphrase){
							rl.close();
							if (process.stdout.moveCursor) process.stdout.moveCursor(0, -1);
							if (process.stdout.clearLine)  process.stdout.clearLine();
							var deviceTempPrivKey = crypto.randomBytes(32);
							var devicePrevTempPrivKey = crypto.randomBytes(32);

							var mnemonic = new Mnemonic(); // generates new mnemonic
							while (!Mnemonic.isValid(mnemonic.toString()))
								mnemonic = new Mnemonic();

							writeKeys(mnemonic.phrase, deviceTempPrivKey, devicePrevTempPrivKey, function(){
								console.log('keys created');
								var xPrivKey = mnemonic.toHDPrivateKey(passphrase);
								createWallet(xPrivKey, function(){
									onDone(mnemonic.phrase, passphrase, deviceTempPrivKey, devicePrevTempPrivKey);
								});
							});
						}
					);
				});
			});
		}
		else{ // 2nd or later start
			// rl.question("Passphrase: ", function(passphrase){
				var passphrase = "";
				rl.close();
				if (process.stdout.moveCursor) process.stdout.moveCursor(0, -1);
				if (process.stdout.clearLine)  process.stdout.clearLine();
				var keys = JSON.parse(data);
				var deviceTempPrivKey = Buffer(keys.temp_priv_key, 'base64');
				var devicePrevTempPrivKey = Buffer(keys.prev_temp_priv_key, 'base64');
				determineIfWalletExists(function(bWalletExists){
					if (bWalletExists)
						onDone(keys.mnemonic_phrase, passphrase, deviceTempPrivKey, devicePrevTempPrivKey);
					else{
						var mnemonic = new Mnemonic(keys.mnemonic_phrase);
						var xPrivKey = mnemonic.toHDPrivateKey(passphrase);
						createWallet(xPrivKey, function(){
							onDone(keys.mnemonic_phrase, passphrase, deviceTempPrivKey, devicePrevTempPrivKey);
						});
					}
				});
			// });
		}
	});
}

function writeKeys(mnemonic_phrase, deviceTempPrivKey, devicePrevTempPrivKey, onDone){
	var keys = {
		mnemonic_phrase: mnemonic_phrase,
		temp_priv_key: deviceTempPrivKey.toString('base64'),
		prev_temp_priv_key: devicePrevTempPrivKey.toString('base64')
	};
	fs.writeFile(KEYS_FILENAME, JSON.stringify(keys, null, '\t'), 'utf8', function(err){
		if (err)
			throw Error("failed to write keys file");
		if (onDone)
			onDone();
	});
}

function createWallet(xPrivKey, onDone){
	var devicePrivKey = xPrivKey.derive("m/1'").privateKey.bn.toBuffer({size:32});
	var device = require('./device.js');
	device.setDevicePrivateKey(devicePrivKey); // we need device address before creating a wallet
	var strXPubKey = Bitcore.HDPublicKey(xPrivKey.derive("m/44'/0'/0'")).toString();
	var walletDefinedByKeys = require('./wallet_defined_by_keys.js');
	walletDefinedByKeys.createWalletByDevices(strXPubKey, 0, 1, [], 'any walletName', function(wallet_id){
		walletDefinedByKeys.issueNextAddress(wallet_id, 0, function(addressInfo){
			onDone();
		});
	});
}

function isControlAddress(device_address){
	return (conf.control_addresses && conf.control_addresses.indexOf(device_address) >= 0);
}

function readSingleAddress(handleAddress){
	db.query("SELECT address FROM my_addresses WHERE wallet=?", [wallet_id], function(rows){
		if (rows.length === 0)
			throw Error("no addresses");
		if (rows.length > 1)
			throw Error("more than 1 address");
		handleAddress(rows[0].address);
	});
}

function prepareBalanceText(handleBalanceText){
	var Wallet = require('./wallet.js');
	Wallet.readBalance(wallet_id, function(assocBalances){
		var arrLines = [];
		for (var asset in assocBalances){
			var total = assocBalances[asset].stable + assocBalances[asset].pending;
			var units = (asset === 'base') ? ' bytes' : (' of ' + asset);
			var line = total + units;
			if (assocBalances[asset].pending)
				line += ' (' + assocBalances[asset].pending + ' pending)';
			arrLines.push(line);
		}
		handleBalanceText(arrLines.join("\n"));
	});
}

function readSingleWallet(handleWallet){
	db.query("SELECT wallet FROM wallets", function(rows){
		if (rows.length === 0)
			throw Error("no wallets");
		if (rows.length > 1)
			throw Error("more than 1 wallet");
		handleWallet(rows[0].wallet);
	});
}

function determineIfWalletExists(handleResult){
	db.query("SELECT wallet FROM wallets", function(rows){
		if (rows.length > 1)
			throw Error("more than 1 wallet");
		handleResult(rows.length > 0);
	});
}

function signWithLocalPrivateKey(wallet_id, account, is_change, address_index, text_to_sign, handleSig){
	var path = "m/44'/0'/" + account + "'/"+is_change+"/"+address_index;
	var privateKey = xPrivKey.derive(path).privateKey;
	var privKeyBuf = privateKey.bn.toBuffer({size:32}); // https://github.com/bitpay/bitcore-lib/issues/47
	handleSig(ecdsaSig.sign(text_to_sign, privKeyBuf));
}

var signer = {
	readSigningPaths: function(conn, address, handleLengthsBySigningPaths){
		handleLengthsBySigningPaths({r: constants.SIG_LENGTH});
	},
	readDefinition: function(conn, address, handleDefinition){
		conn.query("SELECT definition FROM my_addresses WHERE address=?", [address], function(rows){
			if (rows.length !== 1)
				throw "definition not found";
			handleDefinition(null, JSON.parse(rows[0].definition));
		});
	},
	sign: function(objUnsignedUnit, assocPrivatePayloads, address, signing_path, handleSignature){
		var buf_to_sign = objectHash.getUnitHashToSign(objUnsignedUnit);
		db.query(
			"SELECT wallet, account, is_change, address_index \n\
			FROM my_addresses JOIN wallets USING(wallet) JOIN wallet_signing_paths USING(wallet) \n\
			WHERE address=? AND signing_path=?",
			[address, signing_path],
			function(rows){
				if (rows.length !== 1)
					throw Error(rows.length+" indexes for address "+address+" and signing path "+signing_path);
				var row = rows[0];
				signWithLocalPrivateKey(row.wallet, row.account, row.is_change, row.address_index, buf_to_sign, function(sig){
					handleSignature(null, sig);
				});
			}
		);
	}
};

function handlePairing(from_address){
	var device = require('./device.js');
	prepareBalanceText(function(balance_text){
		device.sendMessageToDevice(from_address, 'text', balance_text);
	});
}

function handleText(from_address, text){

	text = text.trim();
	var fields = text.split(/ /);
	var command = fields[0].trim().toLowerCase();
	var params =['',''];
	if (fields.length > 1) params[0] = fields[1].trim();
	if (fields.length > 2) params[1] = fields[2].trim();

	var device = require('./device.js');
	switch(command){
		case 'address':
			readSingleAddress(function(address){
				device.sendMessageToDevice(from_address, 'text', address);
			});
			break;

		case 'balance':
			prepareBalanceText(function(balance_text){
				device.sendMessageToDevice(from_address, 'text', balance_text);
			});
			break;

		default:
				return device.sendMessageToDevice(from_address, 'text', "unrecognized command");
	}
}


// The below events can arrive only after we read the keys and connect to the hub.
// The event handlers depend on the global var wallet_id being set, which is set after reading the keys

function setupChatEventHandlers(){
	eventBus.on('paired', function(from_address){
		console.log('paired '+from_address);
		if (!isControlAddress(from_address))
			return console.log('ignoring pairing from non-control address');
		handlePairing(from_address);
	});

	eventBus.on('text', function(from_address, text){
		console.log('text from '+from_address+': '+text);
		if (!isControlAddress(from_address))
			return console.log('ignoring text from non-control address');
		handleText(from_address, text);
	});
}

function notifyAdmin(subject, body){
	mail.sendmail({
		to: conf.admin_email,
		from: conf.from_email,
		subject: subject,
		body: body
	});
}

function notifyAdminAboutFailedWitnessing(err){
	console.log('witnessing failed: '+err);
	notifyAdmin('witnessing failed: '+err, err);
}

function notifyAdminAboutWitnessingProblem(err){
	console.log('witnessing problem: '+err);
	notifyAdmin('witnessing problem: '+err, err);
}


function witness(round_index, onDone){
	function onError(err){
		notifyAdminAboutFailedWitnessing(err);
		setTimeout(onDone, 60000); // pause after error
	}
	var network = require('./network.js');
	var composer = require('./composer.js');
	if (!network.isConnected()){
		console.log('not connected, skipping');
		return onDone();
	}
	createOptimalOutputs(function(){
		if (conf.bPostTimestamp) {
			var params = {
				paying_addresses: [my_address],
				outputs: [{address: my_address, amount: 0}],
				pow_type: constants.POW_TYPE_TRUSTME,
				round_index: round_index,
				signer: signer,
				callbacks: callbacks
			}
			var timestamp = Date.now();
			var datafeed = {timestamp: timestamp};
			var objMessage = {
				app: "data_feed",
				payload_location: "inline",
				payload_hash: objectHash.getBase64Hash(datafeed),
				payload: datafeed
			};
			params.messages = [objMessage];
			return composer.composeJoint(params);
		}
		composer.composeTrustMEJoint(my_address, round_index, signer, callbacks);
	});
}


function checkAndWitness(){
	console.log('checkAndWitness');
	clearTimeout(forcedWitnessingTimer);
	if (bWitnessingUnderWay)
		return console.log('witnessing under way');
	bWitnessingUnderWay = true;
	// abort if there are my units without an mci
	determineIfThereAreMyUnitsWithoutMci(function(bMyUnitsWithoutMci){
		if (bMyUnitsWithoutMci){
			bWitnessingUnderWay = false;
			return console.log('my units without mci');
		}
		// pow add
		round.getCurrentRoundIndexByDb(function(round_index){
			determineIfIAmWitness(round_index, function(bWitness){
				// pow add
				if (!bWitness){
					bWitnessingUnderWay = false;
					return console.log('I am not an attestor for now')
				}
				storage.readLastMainChainIndex(function(max_mci){
					let col = (conf.storage === 'mysql') ? 'main_chain_index' : 'unit_authors.rowid';
					db.query(
						"SELECT main_chain_index AS max_my_mci FROM units JOIN unit_authors USING(unit) WHERE address=? ORDER BY "+col+" DESC LIMIT 1",
						[my_address],
						function(rows){
							var max_my_mci = (rows.length > 0) ? rows[0].max_my_mci : -1000;
							var distance = max_mci - max_my_mci;
							console.log("distance="+distance);
							setTimeout(function(){
								witness(round_index, function(){
									bWitnessingUnderWay = false;
								});
							}, Math.round(Math.random()*3000));
						}
					);
				});
			});
		});
	});
}

// pow add
function determineIfIAmWitness(round_index, handleResult){
	round.getWitnessesByRoundIndexByDb(round_index, function(arrWitnesses){
		db.query(
			"SELECT 1 FROM my_addresses where address IN(?)", [arrWitnesses], function(rows) {
				if(rows.length===0) {
					return handleResult(false)
				}
				return handleResult(true)
			}
		)
	})
}

function determineIfThereAreMyUnitsWithoutMci(handleResult){
	db.query("SELECT 1 FROM units JOIN unit_authors USING(unit) WHERE address=? AND main_chain_index IS NULL LIMIT 1", [my_address], function(rows){
		handleResult(rows.length > 0);
	});
}

function checkForUnconfirmedUnits(distance_to_threshold){
	db.query( // look for unstable non-witness-authored units
		// pow modi
		"SELECT 1 FROM units CROSS JOIN unit_authors USING(unit)\n\
		WHERE (main_chain_index>? OR main_chain_index IS NULL AND sequence='good') \n\
			AND NOT ( \n\
				(SELECT COUNT(*) FROM messages WHERE messages.unit=units.unit)=1 \n\
				AND (SELECT COUNT(*) FROM unit_authors WHERE unit_authors.unit=units.unit)=1 \n\
				AND (SELECT COUNT(DISTINCT address) FROM outputs WHERE outputs.unit=units.unit)=1 \n\
				AND (SELECT address FROM outputs WHERE outputs.unit=units.unit LIMIT 1)=unit_authors.address \n\
			) \n\
		LIMIT 1",
		[storage.getMinRetrievableMci()], // light clients see all retrievable as unconfirmed
		function(rows){
			if (rows.length === 0)
				return;
			var timeout = Math.round((distance_to_threshold + Math.random())*10000);
			console.log('scheduling unconditional witnessing in '+timeout+' ms unless a new unit arrives');
			forcedWitnessingTimer = setTimeout(witnessBeforeThreshold, timeout);
		}
	);
}

//add winess payment victor
function checkForUnconfirmedUnitsAndWitness(distance_to_threshold){
	db.query( // look for unstable non-witness-authored units 
		// pow modi
		"SELECT 1 FROM units CROSS JOIN unit_authors USING(unit)\n\
		WHERE (main_chain_index>? OR main_chain_index IS NULL AND sequence='good') \n\
			AND NOT ( \n\
				(SELECT COUNT(*) FROM messages WHERE messages.unit=units.unit)=1 \n\
				AND (SELECT COUNT(*) FROM unit_authors WHERE unit_authors.unit=units.unit)=1 \n\
				AND (SELECT COUNT(DISTINCT address) FROM outputs WHERE outputs.unit=units.unit)=1 \n\
				AND (SELECT address FROM outputs WHERE outputs.unit=units.unit LIMIT 1)=unit_authors.address \n\
			) \n\
		LIMIT 1",
		[storage.getMinRetrievableMci()], // light clients see all retrievable as unconfirmed
		function(rows){
			if (rows.length === 0)
				return;
			var timeout = Math.round((distance_to_threshold + Math.random())*1000);
			console.log('scheduling unconditional witnessing in '+timeout+' ms unless a new unit arrives');
			forcedWitnessingTimer = setTimeout(witnessBeforeThreshold, timeout);
		}
	);
}

function witnessBeforeThreshold(){
	if (bWitnessingUnderWay)
		return;
	bWitnessingUnderWay = true;
	determineIfThereAreMyUnitsWithoutMci(function(bMyUnitsWithoutMci){
		if (bMyUnitsWithoutMci){
			bWitnessingUnderWay = false;
			return console.log('my units without mci');
		}
		// pow add
		round.getCurrentRoundIndexByDb(function(round_index){
			determineIfIAmWitness(round_index, function(bWitness){
				// pow add
				if (!bWitness){
					bWitnessingUnderWay = false;
					return console.log('I am not an attestor for now')
				}
				console.log('will witness before threshold');
				witness(function(){
					bWitnessingUnderWay = false;
				});
			});
		});
	});
}

function readNumberOfWitnessingsAvailable(handleNumber){
	count_witnessings_available--;
	if (count_witnessings_available > conf.MIN_AVAILABLE_WITNESSINGS)
		return handleNumber(count_witnessings_available);
	db.query(
		"SELECT COUNT(*) AS count_big_outputs FROM outputs JOIN units USING(unit) \n\
		WHERE address=? AND is_stable=1 AND amount>=? AND asset IS NULL AND is_spent=0",
		[my_address, WITNESSING_COST],
		function(rows){
			var count_big_outputs = rows[0].count_big_outputs;
			db.query(
				"SELECT SUM(amount) AS total FROM outputs JOIN units USING(unit) \n\
				WHERE address=? AND is_stable=1 AND amount<? AND asset IS NULL AND is_spent=0",
				[my_address, WITNESSING_COST],
				function(rows){
					var total = rows.reduce(function(prev, row){ return (prev + row.total); }, 0);
					var count_witnessings_paid_by_small_outputs_and_commissions = Math.round(total / WITNESSING_COST);
					count_witnessings_available = count_big_outputs + count_witnessings_paid_by_small_outputs_and_commissions;
					handleNumber(count_witnessings_available);
				}
			);
		}
	);
}

// make sure we never run out of spendable (stable) outputs. Keep the number above a threshold, and if it drops below, produce more outputs than consume.
function createOptimalOutputs(handleOutputs){
	readNumberOfWitnessingsAvailable(function(count){
		if (count > conf.MIN_AVAILABLE_WITNESSINGS)
			return handleOutputs();
		// try to split the biggest output in two
		db.query(
			"SELECT amount FROM outputs JOIN units USING(unit) \n\
			WHERE address=? AND is_stable=1 AND amount>=? AND asset IS NULL AND is_spent=0 \n\
			ORDER BY amount DESC LIMIT 1",
			[my_address, 2*WITNESSING_COST],
			function(rows){
				if (rows.length === 0){
					notifyAdminAboutWitnessingProblem('only '+count+" spendable outputs left, and can't add more");
					return handleOutputs();
				}
				var amount = rows[0].amount;
				notifyAdminAboutWitnessingProblem('only '+count+" spendable outputs left, will split an output of "+amount);
				arrOutputs.push({amount: Math.round(amount/2), address: my_address});
				handleOutputs();
			}
		);
	});
}

function notifyMinerStopCurrentMiningAndRestart() {
	// TODO
	pow.startMining(function(err) {
		if (err) {
			notifyAdminAboutWitnessingProblem(err)
			setTimeout(notifyMinerStopCurrentMiningAndRestart, 10*1000);
		}
	})
}

function notifyMinerStartMining() {
	pow.startMining(function(err) {
		if (err) {
			notifyAdminAboutWitnessingProblem(err)
			setTimeout(notifyMinerStartMining, 10*1000);
		}
	})
}

function checkTrustMEAndStartMining(round_index) {
	let lastRound = currentRound;
	if (currentRound !== round_index) {
		currentRound = round_index;
		if (bMining) {
			notifyMinerStopCurrentMiningAndRestart()
		} else {
			notifyMinerStartMining()
			bMining = true;
		}
		determineIfIAmWitness(lastRound, function(bWitness){
			if(bWitness) {
				composer.composeCoinbaseJoint(my_address, lastRound, signer, callbacks)
			}
		})
	}
}

exports.readKeys = readKeys;
exports.writeKeys = writeKeys;
exports.readSingleWallet = readSingleWallet;
exports.checkTrustMEAndStartMinig = checkTrustMEAndStartMining;
exports.checkAndWitness = checkAndWitness;
exports.setupChatEventHandlers = setupChatEventHandlers;
