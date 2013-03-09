
var express = require( 'express' ),
    config = require( 'config' ),
    request = require( 'request' ),
    http = require( 'http' ),
    urlParser = require( 'url' ),
    app = express(),
    ip = process.env.IP || config.server.bindIP,
    port = process.env.PORT || config.server.bindPort,
    server;

/**
 * Given http://bit.ly/abc, find and return full URL
 */
function unshortenUrl( url, callback ) {
  request({
    method: "HEAD",
    url: url,
    followAllRedirects: true
  },
  function( err, res ) {
    if ( err ) {
      return callback( err );
    }
    callback( null, res.request.href );
  });
}

/**
 * Discover the mime type for a given resource
 */
function getContentType( url, callback ) {
  var parsedUrl = urlParser.parse( url );

  http.get({
    method: 'HEAD',
    host: parsedUrl.hostname,
    port: parsedUrl.port,
    path: parsedUrl.path
  },
  function( res ) {
    callback( null, res );
  })
  .on( 'error', function( err ) {
    callback( err );
  });
}

app.get( '/api/url/*', function( req, res ) {
  var url = req.params[ 0 ];
  if ( !url ) {
    res.json( { error: "Expected url param, found none." }, 500 );
    return;
  }

  unshortenUrl( url, function( err, href ) {
    if ( err ) {
      res.json( { error: "Unable to use url." }, 500 );
      return;
    }

    getContentType( href, function( err, result ) {
      if ( err ) {
        res.json( { error: "Unable to determin content type." }, 500 );
        return;
      }

      res.json({
        href: href,
        contentType: result.headers[ 'content-type' ]
      });
    });
  });
});

server = app.listen( port, ip, function() {
  var addy = server.address();
  console.log( 'HTTP Server started on http://' + config.server.bindIP + ':' + addy.port );
  console.log( 'Press Ctrl+C to stop' );
});
