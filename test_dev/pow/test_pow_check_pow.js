/**
 * 	set process env
 */
process.env.ENV_UNIT_TEST	= true;


/**
 * 	...
 */
const _pow	= require( '../../pow/pow.js' );

let objInput	= {
	roundIndex	: 1,
	firstTrustMEBall	: "zd+E/jN0E7wyKASy7A/D0llRMiNQTtd3OaPhBbMF/uc=",
	bits			: 528482303,
	publicSeed		: "27859fd336472cdfd8054d9aaa2057d6953e9a87d300cfc8a81f43121aaa918e",
	superNodeAuthor		: "2G6WV4QQVF75EPKSXTVRKRTZYSXNIWLU"
};
let sHash	= '00198bb0606e5a8b5d47577bc96de488116af886815f4dccc5ad1ebd78d1b14e';
let nNonce	= 65;

_pow.checkProofOfWork( null, objInput, sHash, nNonce, function( err, objResult )
{
	console.log( err, objResult );
});