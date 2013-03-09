
var express = require( 'express' ),
    config = require( 'config' ),
    request = require( 'request' ),
    app = express(),
    ip = process.env.IP || config.server.bindIP,
    port = process.env.PORT || config.server.bindPort,
    server;

/**
 * Discover the mime type for a given resource, following redirects
 */
function getContentType( url, callback ) {
  request({
    method: "HEAD",
    url: url,
    followAllRedirects: true
  },
  function( err, res ) {
    if ( err ) {
      callback( err );
      return;
    }

    callback( null, { href: res.request.href, contentType: res.headers[ 'content-type' ] } );
  });
}

app.get( '/api/url/*', function( req, res ) {
  var url = req.params[ 0 ];
  if ( !url ) {
    res.json( { error: "Expected url param, found none." }, 500 );
    return;
  }

  getContentType( url, function( err, result ) {
    if ( err ) {
      res.json( { error: "Unable to determine content type." }, 500 );
      return;
    }

    res.json( result );
  });
});

server = app.listen( port, ip, function() {
  var addy = server.address();
  console.log( 'HTTP Server started on http://' + config.server.bindIP + ':' + addy.port );
  console.log( 'Press Ctrl+C to stop' );
});
