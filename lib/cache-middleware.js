/**
 * A simple wrapper around Redis and Memcached for caching URL data.
 * The user configures one or the other via environment variables:
 *
 *  - REDIS_URL or REDISCLOUD_URL or REDISTOGO_URL: redis server IP.
 *    The REDIS*_URL should be a single IP or hostname, not a list.
 *    You can also provide a port and password.
 *
 *  - MEMCACHED_URL: the Memcached server URL(s). This should be a
 *    single IP or hostname, or a comma-separated list. It can include
 *    the port, e.g., <hostname>:<port>.
 *
 *  NOTE: use only one of the above, not both.
 *
 *  - CACHE_EXPIRE: the time in seconds to keep data in the cache.
 *                  The default is 1 hour.
 *
 * The module provides two methods:
 *
 *  1) cache( url, data )
 *
 *    Use this to cache data about a given url. The data object should
 *    be of the form: { href: "url", contentType: "mime-type" }.  The
 *    cache will hold this data, keyed on the URL until CACHE_EXPIRE.
 *
 *  2) cacheCheck( req, res, next )
 *
 *    Use this function in a the Express route that accepts the URL
 *    param. It will take a given URL and attempt to pull the URL data
 *    from cache, otherwise passing it along to the next handler.
 */

var url = require( 'url' ),
    util = require( 'util' ),
    cacheExpire = process.env.CACHE_EXPIRE || 60 * 60, // one hour
    redisURL = process.env.REDIS_URL ||
               process.env.REDISCLOUD_URL ||
               process.env.REDISTOGO_URL,
    memcachedURL = process.env.MEMCACHED_URL,
    cacheWrapper;

/**
 * Setup a Redis cache, wrapped in cacheWrapper.
 */
function setupRedisCache() {
  var redis;
  util.log( 'Using Redis cache with ' + redisURL );

  try {
    redisURL = url.parse( redisURL );

    // Depending on the format of the host, we may not get a proper hostname (e.g.,
    // 'localhost' vs. 'http://localhost'. Assume localhost if missing.
    redisURL.hostname = redisURL.hostname || 'localhost';
    redisURL.port = redisURL.port || 6379;
    redis = require( 'redis' ).createClient( redisURL.port, redisURL.hostname );

    // If there's an error, kill the cacheWrapper
    redis.on( 'error', function ( err ) {
      util.error( 'Redis Error: ' + err );
      cacheWrapper = null;
    });

    // Wait til we get a ready signal from the server to set the cacheWrapper
    redis.on( 'ready', function( err ) {
      cacheWrapper = {
        write: function( url, data ) {
          redis.multi()
            .setex( url + ':href', cacheExpire, data.href )
            .setex( url + ':contentType', cacheExpire, data.contentType )
            .exec();
        },
        read: function( url, callback ) {
          redis.mget( [ url + ':href', url + ':contentType' ], function( err, res ) {
            if ( err ) {
              callback( { error: err } );
              return;
            }

            // If we get values, return them, otherwise, send null
            // to indicate that we don't know.
            if ( res[ 0 ] && res[ 1 ] ) {
              callback( null, {
                href: res[ 0 ],
                contentType: res[ 1 ]
              });
            } else {
              callback( null, null );
            }
          });
        }
      };
    });

    // If the connection drops on the other end, kill the cacheWrapper
    redis.on( 'end', function() {
      util.error( 'Redis Connection Closed.' );
      cacheWrapper = null;
    });

    if ( redisURL.auth ) {
      redis.auth ( redisURL.auth.split( ':' )[ 1 ] );
    }
  } catch ( ex ) {
    util.error( 'Failed to load Redis:' + ex );
  }
}

/**
 * Setup a Memcached cache, wrapped in cacheWrapper
 */
function setupMemcachedCache() {
  var memcached;
  util.log( 'Using Memcached cache with ' + memcachedURL );

  try {
    // We can take a comma-separated list of IPs/domains. Unlike Redis,
    // the memcache node module expects a <hostname>:<port>? vs. a full URL.
    var urlList = memcachedURL.split( ',' ).map( function( host ) {
      var hostElems = host.split( ':' ),
          hostname = hostElems[ 0 ] || 'localhost',
          port = hostElems[ 1 ] || 11211;
      return hostname + ':' + port;
    });

    memcached = new ( require( 'mc' ) ).Client( urlList );
    memcached.connect( function() {
      cacheWrapper = {
        write: function( url, data ) {
          var options = { exptime: cacheExpire },
              callback = function(){};

          memcached.set( url + ':href', data.href, options, callback );
          memcached.set( url + ':contentType', data.contentType, options, callback );
        },
        read: function( url, callback ) {
          var hrefKey = url + ':href',
              contentTypeKey = url + ':contentType';

          memcached.get( [ hrefKey, contentTypeKey ], function( err, res ) {
            if ( err ) {
              if ( err.type === 'NOT_FOUND' ) {
                // Nothing in cache for these keys, return null URL data.
                callback( null, null );
                return;
              } else {
                util.log( 'Memcached Error: ' + util.inspect(err) );
                callback( { error: err } );
                return;
              }
            }
            callback( null, {
              href: res[ hrefKey ],
              contentType: res[ contentTypeKey ]
            });
          });
        }
      };
    });
  } catch ( ex ) {
    util.error( 'Failed to load Memcached:' + ex );
  }
}

/**
 * Check for config info for Redis and Memcached, use one or the other
 */
if ( redisURL ) {
  setupRedisCache();
} else if ( memcachedURL ) {
  setupMemcachedCache();
}

/**
 * Caching middleware
 */
function cacheCheck( req, res, next ) {
  var url = req.params ? req.params[ 0 ] : null;

  if ( !cacheWrapper || !url ) {
    return process.nextTick(function() {
      next();
    });
  }

  cacheWrapper.read( url, function( err, response ) {
    // If we get an error back, or a null cache object (not found), bail
    if ( err || !response ) {
      process.nextTick(function() {
        next();
      });
      return;
    }

    // Flag this as a cache hit and return
    response.cached = true;
    res.jsonp( response );
  });
}

/**
 * Provide a way to cache data, even if a noop, and middleware
 * for reading values out of cache.
 */
module.exports.cache = function( url, data ) {
  if ( cacheWrapper ) {
    cacheWrapper.write( url, data );
  }
};
module.exports.cacheCheck = cacheCheck;
