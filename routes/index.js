var request = require( 'request' ),
    cache = require( '../lib/cache.js' ),
    meta = require( '../lib/meta.js' ),
    imgStream = require( '../lib/img-stream.js' ),
    util = require( 'util' );

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
 * keySuffix - Cache key suffix (e.g., ':meta' or ':mime')
 * fn - The function to call for this route
 * logger - the logger to use for errors
 * errMsg - The error message to use if fn fails.
 */
function buildRoute( keySuffix, fn, logger, errMsg ) {
  return function( req, res ) {
    var url = req.params[ 0 ];

    if ( !url ) {
      logger.error( "Missing url param" );
      res.jsonp( 500, { error: 'Expected url param, found none.' } );
      return;
    }

    var cacheKey = url + keySuffix;

    cache.read( cacheKey, function( err, cachedResult ) {
      if ( err && err !== "No Cache" ) {
        logger.error( "Cache Read Error: " + util.inspect( err ) );
      }

      if ( cachedResult ) {
        res.jsonp( cachedResult );
        return;
      }

      fn( url, function( err, result ) {
        if ( err ) {
          logger.error( "Error [" + keySuffix + ", " + url + "]: " + err );
          res.jsonp( 500, { error: errMsg } );
          return;
        }

        cache.write( cacheKey, result );
        res.jsonp( result );
      });
    });
  };
}


module.exports = function( logger ) {
  return {
    /**
     * Get the MIME type (content-type) for a given resource:
     *
     * http://localhost:8888/mime/<url>
     */
    mime: buildRoute( ':mime', getContentType, logger,
                      'Unable to determine content type.' ),

    /**
     * Get the Social Graph and Metadata for a given resource:
     *
     * http://localhost:8888/meta/<url>
     */
    meta: buildRoute( ':meta', getMeta, logger,
                      'Unable to read Social Graph or metadata for URL.' ),

    /**
     * Get the image dimensions for a given resource:
     *
     * http://localhost:8888/img/<url>
     */
    img: buildRoute( ':img', getImgSize, logger,
                     'Unable to read img info for URL.' ),

    /**
     * http://localhost:8888/healthcheck
     */
    healthcheck: function( req, res ) {
      res.json({
        http: "okay"
      });
    }
  };
};
