/*jslint node: true */
"use strict";

if (global._bTrustnoteCoreLoaded)
	throw Error("Looks like you are loading multiple copies of trustnote-common, which is not supported.\nRunnung 'npm dedupe' might help.");

global._bTrustnoteCoreLoaded = true;
