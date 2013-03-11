
var express = require( 'express' ),
    request = require( 'request' ),
    app = express(),
    port = process.env.PORT || 8888,
    cacheExpire = process.env.CACHE_EXPIRE || 60 * 60, // one hour
    server,
    redis;

var redisURL = process.env.REDIS_URL ||
               process.env.REDISCLOUD_URL ||
               process.env.REDISTOGO_URL;

if ( redisURL ) {
  console.log( 'Using Redis cache with ' + redisURL );

  try {
    redisURL = require( 'url' ).parse( redisURL );
    redis = require( 'redis' ).createClient( redisURL.port, redisURL.hostname );

    if ( redisURL.auth ) {
      redis.auth ( redisURL.auth.split( ':' )[ 1 ] );
    }
  } catch ( ex ) {
    console.warning( 'Failed to load Redis:' + ex );
    redis = null;
  }
}

/**
 * Redis caching middleware
 */
function cacheCheck( req, res, next ) {
  var url = req.params ? req.params[ 0 ] : null;

  if ( !url ) {
    return process.nextTick(function() {
      next();
    });
  }

  redis.mget( [ url + ':href', url + ':contentType' ], function( err, response ) {
    if ( response[ 0 ] && response[ 1 ] ) {
      res.jsonp({ href: response[ 0 ], contentType: response[ 1 ] });
    } else {
      process.nextTick(function() {
        next();
      });
    }
  });
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

    callback( null, { href: res.request.href, contentType: res.headers[ 'content-type' ] } );
  });
}

var middleware = [];

if ( redis ) {
  middleware.push( cacheCheck );
}

app.get( '/api/url/*', middleware, function( req, res ) {
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

    res.jsonp( result );
    if ( redis ) {
      redis.multi()
        .setex( url + ':href', cacheExpire, result.href )
        .setex( url + ':contentType', cacheExpire, result.contentType )
        .exec();
    }
  });
});

server = app.listen( port, function() {
  var addy = server.address();
  console.log( 'HTTP Server started on port ' + addy.port );
  console.log( 'Press Ctrl+C to stop' );
});
