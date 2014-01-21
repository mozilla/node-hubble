var request = require( 'request' ),
    cache = require( '../lib/cache.js' ),
    meta = require( '../lib/meta.js' ),
    imgStream = require( '../lib/img-stream.js' ),
    url = require( 'url' );

/**
 * Validate URLs for allowed ports (prevent cross protocol exploits)
 * and and disallowed hosts (e.g., localhost). Extend the list of things
 * allowed/disallowed by setting env variables as follows:
 *
 * - WHITELISTED_PORTS: comma separated list of ports to allow.
 *                      Defaults to "80, 443, 8080". If you provide your own
 *                      list make sure you include the defaults manually
 *                      where applicable (i.e., no defaults will be added).
 *
 * - BLACKLISTED_HOSTS: comma separated list of hosts to disallow.
 *                      Defaults to "localhost, 127.0.0.1". If you provide
 *                      your own list make sure you include the defaults
 *                      manually where applicable (i.e., no defaults will be
 *                      added).
 */
var whitelistedPorts = ( function( whitelist ) {
  if ( !whitelist ) {
    return {
      80: 1,
      443: 1,
      8080: 1
    };
  }
  var list = {};
  whitelist.split( /\s*,\s*/ ).forEach( function( port ) {
    list[ port|0 ] = 1;
  });
  return list;
}( process.env.WHITELISTED_PORTS ));

var blacklistedHosts = ( function( blacklist ) {
  if ( !blacklist ) {
    return {
      'localhost': 1,
      '127.0.0.1': 1
    };
  }
  var list = {};
  blacklist.split( /\s*,\s*/ ).forEach( function( host ) {
    list[ host ] = 1;
  });
  return list;
}( process.env.BLACKLISTED_HOSTS ));

function validateUrl( urlString ) {
  // Make sure host is not blacklisted and port is allowed.
  var urlObject = url.parse( urlString );
  // Deal with port being null
  urlObject.port = ( urlObject.port || 80 )|0;
  return (
    ( whitelistedPorts[ urlObject.port ] === 1 ) &&
    ( blacklistedHosts[ urlObject.hostname ] !== 1 )
  );
}

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
 * Get the size (i.e., dimensions) of an image at the given URL
 */
function getImgSize( url, callback ) {
  getContentType( url, function( err, res ) {
    if ( err ) {
      callback( err );
      return;
    }

    if ( res.contentType.indexOf( 'image/' ) !== 0 ) {
      callback( 'Expected image' );
      return;
    }

    request( res.href ).pipe( imgStream.createSizeStream( function( err, size ) {
      if ( err ) {
        callback( err );
        return;
      }

      callback( null, {
        href: res.href,
        contentType: res.contentType,
        size: size
      });
    }));
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
      res.jsonp( 500, { error: 'Expected url param, found none.' } );
      return;
    }

    // Make sure this URL doesn't include a bad port or host
    if ( ! validateUrl( url ) ) {
      // Indicate we aren't going to provide info for this url, without exact details.
      res.send( 404 );
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
          res.jsonp( 500, { error: errMsg } );
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
 * Get the image dimensions for a given resource:
 *
 * http://localhost:8888/img/<url>
 */
exports.img = buildRoute( ':img', getImgSize,
                          'Unable to read img info for URL.' );

/**
 * http://localhost:8888/healthcheck
 */
exports.healthcheck = function( req, res ) {
  res.json({
    http: "okay"
  });
};
