const _eventBus	= require( '../../event_bus.js' );


for ( let i = 0; i < 20; i ++ )
{
	_eventBus.on( 'my-event', () =>
	{
		console.log( `my-event (${ i }).` );

		//	...
		printEventBusStatus();
	});
}

_eventBus.emit( 'my-event' );




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
