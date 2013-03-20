
var express = require( 'express' ),
    request = require( 'request' ),
    cacheMiddleware = require( './lib/cache-middleware' ),
    cache = cacheMiddleware.cache,
    util = require( 'util' ),
    app = express(),
    port = process.env.PORT || 8888,
    server;

/**
 * Discover the mime type for a given resource, following redirects
 */
function getContentType( url, callback ) {
  request({
    method: 'HEAD',
    url: url,
    followAllRedirects: true
  },
  function( err, res ) {
    if ( err ) {
      callback( err );
      return;
    }

    callback( null, {
      href: res.request.href,
      contentType: res.headers[ 'content-type' ]
    });
  });
}

/**
 * http://localhost:8888/url/<url>
 */
app.get( '/url/*', cacheMiddleware.cacheCheck, function( req, res ) {
  var url = req.params[ 0 ];

  if ( !url ) {
    res.jsonp( { error: 'Expected url param, found none.' }, 500 );
    return;
  }

  getContentType( url, function( err, result ) {
    if ( err ) {
      res.jsonp( { error: 'Unable to determine content type.' }, 500 );
      return;
    }

    cache( url, result );
    res.jsonp( result );
  });
});

server = app.listen( port, function() {
  var addy = server.address();
  util.log( 'HTTP Server started on port ' + addy.port );
  util.log( 'Press Ctrl+C to stop' );

  // If we're running as a child process, let our parent know we're ready.
  if ( process.send ) {
    process.send( 'Started' );
  }
});
