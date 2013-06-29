var cluster = require( 'cluster' ),
    shouldFork = true,
    shouldRestart = process.env.RESTART == 1,
    forks = ( process.env.FORKS|0 ) || 1;

// Only (re)fork if we're a) starting up; or
// b) had a worker get to 'listening'. Don't
// refork in an endless loop if the process
// is bad.
function fork( force ) {
  if ( !shouldFork && !force ) {
    return;
  }

  console.log( 'Starting server worker...' );
  shouldFork = false;
  cluster.fork().on( 'listening', function() {
    console.log( 'Server worker started.' );
    shouldFork = true;
  });
}

cluster.setupMaster({ exec: 'server.js' });
cluster.on( 'disconnect', function( worker ) {
  console.error( 'Server worker %s disconnected.', worker.id );

  // Restart server worker only if we've been configured that way.
  if ( shouldRestart ) {
    fork();
  }

  // If there are no more workers running, shut down cluster process.
  if ( !Object.keys( cluster.workers ).length ) {
    console.error( 'No more server workers running, shutting down.' );
    process.exit( 1 );
  }
});

while( forks-- ) {
  fork( true );
}
