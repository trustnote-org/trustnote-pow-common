const storage				= require( '../../db/storage.js' );
const joint_storage			= require( '../../db/joint_storage.js' );


joint_storage.purgeUncoveredNonserialJointsUnderLock();