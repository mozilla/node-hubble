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
    report = function(){},
    server;

// If we are configured to use a Graylog2 server, setup report()
// to actually do something.
if ( process.env.GRAYLOG_HOST ) {
  require( 'graylog' );
  report = function( err, isFatal ) {
    log( "[CRASH] node-hubble worker crashed",
         err.message,
         {
           host: process.env.GRAYLOG_HOST,
           level: isFatal ? LOG_CRIT : LOG_ERR,
           facility: 'node-hubble',
           stack: err.stack,
           _serverVersion: require( './package.json' ).version
         }
       );
  };
}

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
        process.exit( 1 );
      }, 30000);
      // But don't keep the process open just for that!
      killtimer.unref();

      server.close();

      if ( cluster.worker ) {
        cluster.worker.disconnect();
      }

      // If we know about a Graylog2 server, tell it we died.
      report( err, true );

      res.statusCode = 500;
      res.setHeader( 'content-type', 'text/plain' );
      res.end( 'There was an error.' );

      d.dispose();
      process.exit( 1 );
    } catch( err2 ) {
      console.error( 'Error: unable to send 500', err2.stack );
    }
  });

  d.run( next );
});
app.use( app.router );
// Additional error handling for non-fatal errors
app.use( function( err, req, res, next ) {
  console.error( "Non-Fatal Error:", err.stack );
  report( err );

  res.statusCode = 500;
  res.setHeader( 'content-type', 'text/plain' );
  res.end( 'There was an error.' );
});

// XXX: Testing crash handlers
app.get( '/fatal-crash', function( req, res ) {
  // Domain bound crash
  var fs = require('fs');
  fs.readFile('somefile.txt', function (err, data) {
    if (err) throw err;
    res.send( 200, 'Worked');
  });
});
app.get( '/nonfatal-crash', function( req, res ) {
  // Localized crash
  var o = {};
  o.nothere();
});

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
