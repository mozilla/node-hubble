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
 *  - CACHE_TIMEOUT_DELAY_MS: the time in ms to wait on a cache read
 *                            before giving up and assuming it's dead.
 *                            This protects against a bad cache server
 *                            locking up the route forever. The default
 *                            is 200ms.
 *
 * The module provides two methods:
 *
 *  1) write( url, data )
 *
 *    Use this to cache data about a given url. The data should be
 *    an Object. The cache will hold this data, keyed on the URL
 *    until CACHE_EXPIRE.
 *
 *  2) read( url, callback )
 *
 *    This will take a given URL and attempt to pull the URL data
 *    from cache, otherwise giving back null in the callback.
 */

var url = require( 'url' ),
    util = require( 'util' ),
    cacheExpire = process.env.CACHE_EXPIRE || 60 * 60, // one hour
    redisURL = process.env.REDIS_URL ||
               process.env.REDISCLOUD_URL ||
               process.env.REDISTOGO_URL,
    memcachedURL = process.env.MEMCACHED_URL,
    timeoutDelay = process.env.CACHE_TIMEOUT_DELAY_MS || 200, // wait 200ms for cache reads
    cacheWrapper;

/**
 * Turn a stringified Object back into an Object.
 */
function toObject( str ) {
  try {
    return JSON.parse( str );
  } catch ( err ) {
    return null;
  }
}

/**
 * Run a cache read operation function, but make sure it
 * completes within a certain time.
 */
function monitorCacheFn( fn, callback ) {
  // Don't call the callback more than once
  var callbackCalled = false;

  function timeout() {
    if( callbackCalled ) {
      return;
    }
    callback( 'Error: cache read failed to complete within expected time' );
    callbackCalled = true;
  }
  var id = setTimeout( timeout, timeoutDelay );
  id.unref();

  function clear( err, res ) {
    clearTimeout( id );
    callback( err, res );
    callbackCalled = true;
  }
  fn(clear);
}

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
          redis.setex( url , cacheExpire, data );
        },
        read: function( url, callback ) {

          function readCallback( err, res ) {
            if ( err ) {
              callback( err );
              return;
            }

            // If we get values, return them, otherwise, send null
            // to indicate that we don't know.
            if ( res ) {
              callback( null, toObject( res ) );
            } else {
              callback( null, null );
            }
          }

          function cacheRead( cb ) {
            redis.get( url, cb );
          }

          monitorCacheFn( cacheRead, readCallback );
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
          memcached.set( url, data, { exptime: cacheExpire }, function(){} );
        },
        read: function( url, callback ) {

          function readCallback( err, res ) {
            if ( err ) {
              if ( err.type === 'NOT_FOUND' ) {
                // Nothing in cache for these keys, return null URL data.
                callback( null, null );
                return;
              } else {
                util.log( 'Memcached Error: ' + util.inspect(err) );
                callback( err );
                return;
              }
            }
            callback( null, toObject( res[ url ] ) );
          }

          function cacheRead( cb ) {
            memcached.get( url, cb );
          }

          monitorCacheFn( cacheRead, readCallback );
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

exports.write = function( url, data ) {
  if ( cacheWrapper ) {
    // Flatten our data into a string for storage
    data = JSON.stringify( data );
    cacheWrapper.write( url, data );
  }
};

exports.read = function( url, callback ) {
  if ( !cacheWrapper ) {
    callback( 'No Cache' );
    return;
  }

  if ( !url ) {
    callback( 'No URL' );
    return;
  }

  cacheWrapper.read( url, function( err, response ) {
    // If we get an error back, or a null cache object (not found), bail
    if ( err || !response ) {
      callback( err, response );
      return;
    }

    // Flag this as a cache hit and hand back
    response.cached = true;
    callback( null, response );
  });
};
