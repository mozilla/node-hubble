var cache = require( '../lib/cache.js' ),
    request = require( 'request' ),
    meta = require( '../lib/meta.js' );

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
 * Get the Social Graph and other metadata at a given URL
 */
function getMeta( url, callback ) {
  request({
    url: url,
    followAllRedirects: true
  },
  function( err, res, body ) {
    if ( err ) {
      callback( err );
      return;
    }

    if ( res.headers[ 'content-type' ].indexOf( 'text/html' ) !== 0 ) {
      callback( 'Expected HTML' );
      return;
    }

    callback( null, {
      href: res.request.href,
      contentType: res.headers[ 'content-type' ],
      meta: meta.parse( body )
    });
  });
}

/**
 * Build a route function (mime and meta are mostly the same)
 *
 * keySuffix - Cache key suffix (':meta' or ':mime')
 * fn - The function to call for this route
 * errMsg - The error message to use if fn fails.
 */
function buildRoute( keySuffix, fn, errMsg ) {
  return function( req, res ) {
    var url = req.params[ 0 ];

    if ( !url ) {
      res.jsonp( { error: 'Expected url param, found none.' }, 500 );
      return;
    }

    var cacheKey = url + keySuffix;

    cache.read( cacheKey, function( err, cachedResult ) {
      if ( cachedResult ) {
        res.jsonp( cachedResult );
        return;
      }

      fn( url, function( err, result ) {
        if ( err ) {
          res.jsonp( { error: errMsg }, 500 );
          return;
        }

        cache.write( cacheKey, result );
        res.jsonp( result );
      });
    });
  };
}

/**
 * Get the MIME type (content-type) for a given resource:
 *
 * http://localhost:8888/mime/<url>
 */
exports.mime = buildRoute( ':mime', getContentType,
                           'Unable to determine content type.' );

/**
 * Get the Social Graph and Metadata for a given resource:
 *
 * http://localhost:8888/meta/<url>
 */
exports.meta = buildRoute( ':meta', getMeta,
                           'Unable to read Social Graph or metadata for URL.' );

/**
 * http://localhost:8888/healthcheck
 */
exports.healthcheck = function( req, res ) {
  res.json({
    http: "okay"
  });
};
