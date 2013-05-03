// New Relic Server monitoring support
if ( process.env.NEW_RELIC_ENABLED ) {
  require( "newrelic" );
}

var express = require( 'express' ),
    request = require( 'request' ),
    routes = require( './routes' ),
    util = require( 'util' ),
    app = express(),
    port = process.env.PORT || 8888,
    server;

app.disable( "x-powered-by" );
app.use( express.logger());
app.use( express.compress());
app.use( app.router );

app.get( '/mime/*', routes.mime );
app.get( '/meta/*', routes.meta );
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
