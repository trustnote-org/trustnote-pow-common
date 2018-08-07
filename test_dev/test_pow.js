// const _pow	= require( '../pow.js' );
//
//
// let bufInput	= _pow.createInputBufferFromObject
// ({
// 	coinBaseList	: {
// 		'4T57ZFLZOMUAMZTXO63XLK5YDQRF5DP2': 10000,
// 		'2SATGZDFDXNNJRVZ52O4J6VYTTMO2EZR': 10000,
// 	},
// 	trustMEBall	: 'rjywtuZ8A70vgIsZ7L4lBR3gz62Nl3vZr2t7I4lzsMU=',
// 	difficulty	: '000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
// 	pubSeed		: 'public key',
// 	superNode	: 'xing.supernode.trustnote.org',
// });
//
// console.log( bufInput.length, bufInput );

let active_hooks	= {
	call_depth	: 0,
	array		: [],
	tmp_array	: null,
};

function restoreActiveHooks() {
	console.log( 'restoreActiveHooks' );
}

function emitHookFactory(symbol, name) {
	// Called from native. The asyncId stack handling is taken care of there
	// before this is called.
	// eslint-disable-next-line func-style
	const fn = function(asyncId)
	{
		console.log( asyncId, arguments );
		active_hooks.call_depth += 1;
		// Use a single try/catch for all hook to avoid setting up one per
		// iteration.
		try {
			for (var i = 0; i < active_hooks.array.length; i++) {
				if (typeof active_hooks.array[i][symbol] === 'function') {
					active_hooks.array[i][symbol](asyncId);
				}
			}
		} catch (e) {
			//fatalError(e);
		} finally {
			active_hooks.call_depth -= 1;
		}

		// Hooks can only be restored if there have been no recursive hook calls.
		// Also the active hooks do not need to be restored if enable()/disable()
		// weren't called during hook execution, in which case
		// active_hooks.tmp_array will be null.
		if (active_hooks.call_depth === 0 && active_hooks.tmp_array !== null) {
			restoreActiveHooks();
		}
	};

	// Set the name property of the anonymous function as it looks good in the
	// stack trace.
	Object.defineProperty(fn, 'name', {
		value: name
	});
	return fn;
}

let arrFunctions	= [];

arrFunctions.push( emitHookFactory( 'func1', 'func_name_1' ) );
arrFunctions.push( emitHookFactory( 'func2', 'func_name_2' ) );
arrFunctions.push( emitHookFactory( 'func3', 'func_name_3' ) );
arrFunctions.push( emitHookFactory( 'func4', 'func_name_4' ) );
arrFunctions.push( emitHookFactory( 'func5', 'func_name_5' ) );

//emitHookFactory( 'symbol', 'name' )   ( 'asyncId' );

arrFunctions[ 0 ]( 'asyncId' );