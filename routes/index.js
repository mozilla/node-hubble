var cache = require( '../lib/cache.js' ),
    request = require( 'request' );

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
exports.url = function( req, res ) {
  var url = req.params[ 0 ];

  if ( !url ) {
    res.jsonp( { error: 'Expected url param, found none.' }, 500 );
    return;
  }

  cache.read( url, function( err, cachedResult ) {
    if ( cachedResult ) {
      res.jsonp( cachedResult );
      return;
    }

    getContentType( url, function( err, result ) {
      if ( err ) {
        res.jsonp( { error: 'Unable to determine content type.' }, 500 );
        return;
      }

      cache.write( url, result );
      res.jsonp( result );
    });
  });
};

/**
 * http://localhost:8888/healthcheck
 */
exports.healthcheck = function( req, res ) {
  res.json({
    http: "okay"
  });
};
