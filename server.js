// New Relic Server monitoring support
if ( process.env.NEW_RELIC_ENABLED ) {
  require( 'newrelic' );
}

var express = require( 'express' ),
    request = require( 'request' ),
    util = require( 'util' ),
    app = express(),
    port = process.env.PORT || 8888,
    routes,
    messina,
    logger,
    server;

app.disable( "x-powered-by" );

if ( process.env.ENABLE_GELF_LOGS ) {
  messina = require( 'messina' );
  logger = messina( 'node-hubble.webmaker.org-' + port || 'development' );
  logger.init();
  logger.catchFatal();
  app.use( logger.middleware() );
} else {
  logger = {
    error: function() {
      process.stderr.write( util.format.apply( this, arguments ) + '\n' );
    }
  };
  app.use( express.logger("dev") );
}

app.use( express.compress());
app.use( app.router );

routes = require( './routes')( logger );
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
