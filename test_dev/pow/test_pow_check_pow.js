/**
 * 	set process env
 */
process.env.ENV_UNIT_TEST	= true;


/**
 * 	...
 */
const _pow	= require( '../../pow/pow.js' );

let objInput	= {
	roundIndex		: 50,
	firstTrustMEBall	: "EzirA5xb37NB7QJfszPiETj+y71JcTmeFZvG4UVLhnM=",
	bits			: 523973461,
	publicSeed		: "1e6b5809bee358d45b493d3ae1aa5e55481de3c874ab75166a91017ed06a1108",
	superNodeAuthor		: "A4BRUVOW2LSLH6LVQ3TWFOCAM6JPFWOK"
};
let sHash	= '00082504848696bddcead41792d1695e7066af24434ab885f1ad40f06e42a7ef';
let nNonce	= 54;


_pow.checkProofOfWork( null, objInput, sHash, nNonce, function( err, objResult )
{
	console.log( err, objResult );
});