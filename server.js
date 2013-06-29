// New Relic Server monitoring support
if ( process.env.NEW_RELIC_ENABLED ) {
  require( "newrelic" );
}

var express = require( 'express' ),
    request = require( 'request' ),
    domain = require( 'domain' ),
    cluster = require( 'cluster' ),
    routes = require( './routes' ),
    util = require( 'util' ),
    app = express(),
    port = process.env.PORT || 8888,
    server;

app.disable( "x-powered-by" );
app.use( express.logger());
app.use( express.compress());
app.use( function( req, res, next ) {
  var d = domain.create();
  d.add( req );
  d.add( res );

  d.on( 'error', function( err ) {
    console.error( 'Error:', err.stack );
    try {
      // make sure we close down within 30 seconds
      var killtimer = setTimeout( function() {
        process.exit(1);
      }, 30000);
      // But don't keep the process open just for that!
      killtimer.unref();

      server.close();

      if ( cluster.worker ) {
        cluster.worker.disconnect();
      }

      res.statusCode = 500;
      res.setHeader( 'content-type', 'text/plain' );
      res.end( 'There was an error.' );

      d.dispose();
    } catch( err2 ) {
      console.error( 'Error: unable to send 500', err2.stack );
    }
  });

  d.run( next );
});
app.use( app.router );

app.get( '/mime/*', routes.mime );
app.get( '/meta/*', routes.meta );
app.get( '/img/*', routes.img );
app.get( '/healthcheck', routes.healthcheck );

server = app.listen( port, function() {
  var addy = server.address();
  util.log( 'HTTP Server started on port ' + addy.port );
  util.log( 'Press Ctrl+C to stop' );

  // If we're running as a child process, let our parent know we're ready.
  if ( process.send ) {
    process.send( 'Started' );
  }
});
