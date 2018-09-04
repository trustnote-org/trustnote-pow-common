/*jslint node: true */
"use strict";

/**
 *	@boss	XING
 */

require('./enforce_singleton.js');

const EventEmitter		= require( 'events' ).EventEmitter;
const MAX_LISTENER_COUNT	= 25;



/**
 * 	hack the original class
 */
const _originalAddListener = EventEmitter.prototype.addListener;
const _fnAddListener = function( sEventName )
{
	_originalAddListener.apply( this, arguments );

	const nListenersCount	= this.listenerCount( sEventName );
	const nMaxCount		= typeof( this._maxListeners ) === 'number' ? this._maxListeners : MAX_LISTENER_COUNT;

	if ( nMaxCount > 0 && nListenersCount > nMaxCount )
	{
		const oError = new Error( `|||||||||| Too many listeners of type '${ sEventName }' added to EventEmitter. Max is ${ nMaxCount } and we've added ${ nListenersCount }.` );
		console.error( oError );
		throw oError;
	}

	return this;
};
EventEmitter.prototype.addListener	= _fnAddListener;
EventEmitter.prototype.on		= _fnAddListener;





/**
 *	create instance
 */
const _eventEmitter = new EventEmitter();
_eventEmitter.setMaxListeners( MAX_LISTENER_COUNT );


/**
 * 	exports
 *	@type {EventEmitter|*}
 */
module.exports	= _eventEmitter;
