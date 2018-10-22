const _eventBus	= require( '../../base/event_bus.js' );


for ( let i = 0; i < 25; i ++ )
{
	_eventBus.once( 'my-event', () =>
	{
		console.log( `my-event (${ i }).` );
	});
}

//	...
printEventBusStatus();

//	...
//_eventBus.emit( 'my-event' );

//	...
setTimeout( () => {
	printEventBusStatus();
}, 1000 );


const oError = new Error( `|||||||||| Too many listeners of type added to EventEmitter.` );
console.log( oError );



function printEventBusStatus()
{
	//
	//	watching all events in eventBus.
	//
	console.log( `||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||` );
	let arrAllEventNames	= _eventBus.eventNames();
	if ( Array.isArray( arrAllEventNames ) )
	{
		for ( let i = 0; i < arrAllEventNames.length; i ++ )
		{
			let sEventName  = arrAllEventNames[ i ];
			console.log( `|||||||||| '${ sEventName }' listener count : ${ _eventBus.listenerCount( sEventName ) }.` );
		}
	}
	console.log( `||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||` );
}
