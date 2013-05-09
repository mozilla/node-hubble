var assert = require( 'assert' ),
    fork = require( 'child_process' ).fork,
    request = require( 'request' ),
    child,
    host = 'http://localhost:8888',
    // If using a cache, configure the environment to have EXPECT_CACHED=1
    expectCached = process.env.EXPECT_CACHED === '1';


function startServer( callback ) {
  // Spin-up the server as a child process
  child = fork( 'server.js', null, {} );
  child.on( 'message', function( msg ) {
    if ( msg === 'Started' ) {
      callback();
    }
  });
}

function stopServer() {
  child.kill();
}

describe( '/mime/* API (depends on network)', function() {

  var api = host + '/mime/',
      repoURL = 'http://github.com/humphd/node-hubble',
      repoURLHref = 'https://github.com/humphd/node-hubble',
      repoURLContentType = 'text/html; charset=utf-8';

  // Do a JSON request of the given <url>, i.e., http://localhost:8888/mime/<url>
  function apiHelper( url, callback ) {
    request.get({ uri: api + url, json: true }, callback );
  }

  before( function( done ) {
    startServer( done );
  });

  after( function() {
    stopServer();
  });

  it( 'should get error when no URL is sent with request', function( done ) {
    apiHelper( '', function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 500 );
      assert.equal( 'Expected url param, found none.', body.error );
      done();
    });
  });

  it( 'should get error when bogus URL is sent with request', function( done ) {
    apiHelper( 'bogus', function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 500 );
      assert.equal( 'Unable to determine content type.', body.error );
      done();
    });
  });

  it( 'should get href and contentType when URL is valid', function( done ) {
    apiHelper( 'http://google.com', function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 200 );
      assert.ok( !!body.href );
      assert.ok( !!body.contentType );
      done();
    });
  });

  it( 'should follow redirects and get href and contentType when URL is valid', function( done ) {
    apiHelper( repoURL, function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 200 );
      // Github will redirect HTTP to HTTPS
      assert.equal( body.href, repoURLHref );
      assert.equal( body.contentType, repoURLContentType );
      // First hit on this URL shouldn't come from cache
      assert.ok( !( 'cached' in body ) );
      done();
    });
  });

  it( 'should get values from cache this time, if configured for caching', function( done ) {
    apiHelper( repoURL, function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 200 );
      // Github will redirect HTTP to HTTPS
      assert.equal( body.href, repoURLHref );
      assert.equal( body.contentType, repoURLContentType );
      // Second hit on this URL should from cache
      assert.equal( !!body.cached, expectCached );
      done();
    });
  });

});


describe( '/meta/* API', function() {

  var api = host + '/meta/',
      port = 9000,
      testUrl = 'http://localhost:' + port + '/test-files/',
      server;

  before( function( done ) {
    startServer( function() {
      // Spin-up a second server to use for grabbing sample HTML pages with
      // metadata.  See test/test-files/* for all the pages we'll use.
      var express = require( 'express' ),
          path = require( 'path' ),
          app = express();
      app.use( '/test-files', express.static( path.join( __dirname, 'test-files' ) ) );
      server = app.listen( port, done );
    });
  });

  after( function() {
    server.close();
    stopServer();
  });

  // Do a JSON request of the given <url>, i.e., http://localhost:8888/meta/<url>
  function apiHelper( url, callback ) {
    request.get({ uri: api + testUrl + url, json: true }, callback );
  }

  it( 'should give OpenGraph data', function( done ) {
    var file = 'og.html';

    apiHelper( file, function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 200 );
      assert.deepEqual( body, {
        href: testUrl + file,
        contentType: 'text/html; charset=UTF-8',
        meta: {
          og: {
            'og:title': 'The Rock',
            'og:type': 'video.movie',
            'og:url': 'http://www.imdb.com/title/tt0117500/',
            'og:image': 'http://ia.media-imdb.com/images/rock.jpg'
          },
          title: 'The Rock (1996)'
        }
      });
      done();
    });
  });

  it( 'should give Twitter Card data', function( done ) {
    var file = 'twitter-card.html';

    apiHelper( file, function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 200 );
      assert.deepEqual( body, {
        href: testUrl + file,
        contentType: 'text/html; charset=UTF-8',
        meta: {
          twitter: {
            'twitter:card': 'summary',
            'twitter:site': '@nytimes',
            'twitter:creator': '@SarahMaslinNir',
            'twitter:title': 'Parade of Fans for Houston\'s Funeral',
            'twitter:description': 'NEWARK - The guest list...'
          }
        }
      });
      done();
    });
  });

  it( 'should give non-social metadata', function( done ) {
    var file = 'no-social.html';

    apiHelper( file, function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 200 );
      assert.deepEqual( body, {
        href: testUrl + file,
        contentType: 'text/html; charset=UTF-8',
        meta: {
          dc: {
            'dc.date': '2008-09-01'
          },
          title: 'No Social'
        }
      });
      done();
    });
  });

  it( 'should give OG + Twitter when both are present', function( done ) {
    var file = 'og-twitter.html';

    apiHelper( file, function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 200 );
      assert.deepEqual( body, {
        href: testUrl + file,
        contentType: 'text/html; charset=UTF-8',
        meta: {
          og: {
            'og:title': 'WebVTT',
            'og:type': 'website',
            'og:image': 'https://developer.mozilla.org/media/img/mdn-logo-sm.png',
            'og:site_name': 'Mozilla Developer Network',
            'og:url': 'https://developer.mozilla.org/en-US/docs/HTML/WebVTT',
            'og:description': 'WebVTT is a format for displaying timed text tracks (e.g. subtitles) with the track element. The primary purpose of WebVTT files is to add subtitles to a video.'
          },
          twitter: {
            'twitter:card': 'summary',
            'twitter:url': 'https://developer.mozilla.org/en-US/docs/HTML/WebVTT',
            'twitter:title': 'WebVTT',
            'twitter:image': 'https://developer.cdn.mozilla.net/media/img/mdn-logo-sm.png',
            'twitter:site': '@mozhacks',
            'twitter:creator': '@mozhacks',
            'twitter:description': 'WebVTT is a format for displaying timed text tracks (e.g. subtitles) with the track element. The primary purpose of WebVTT files is to add subtitles to a video.'
          },
          title: 'WebVTT - HTML | MDN'
        }
      });
      done();
    });
  });

  it( 'should give Dublin Core data', function( done ) {
    var file = 'dublin-core.html';

    apiHelper( file, function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 200 );
      assert.deepEqual( body, {
        href: testUrl + file,
        contentType: 'text/html; charset=UTF-8',
        meta: {
          dc: {
            'dc.date': '2008-01-01',
            'dc.title': 'A title'
          },
          dcterms: {
            'dcterms.creator': 'Dave',
            'dcterms.description': 'A Description'
          },
          title: 'Dublin Core'
        }
      });
      done();
    });
  });

  it( 'should get values from cache this time, if configured for caching', function( done ) {
    var file = 'cache-test.html';

    apiHelper( file, function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 200 );
      assert.deepEqual( body, {
        href: testUrl + file,
        contentType: 'text/html; charset=UTF-8',
        meta: {
          title: 'Cache Test'
        }
      });
      // First hit shouldn't be cached
      assert.ok( !( 'cached' in body ) );

      // Do a second hit, make sure this one is cached
      apiHelper( file, function( err2, res2, body2 ) {
        assert.ok( !err2 );
        assert.equal( res2.statusCode, 200 );
        // The second hit should be cached if we're expecting it
        assert.equal( !!body2.cached, expectCached );
        delete body2.cached;
        assert.deepEqual( body2, {
          href: testUrl + file,
          contentType: 'text/html; charset=UTF-8',
          meta: {
            title: 'Cache Test'
          }
        });
        done();
      });
    });
  });

});


describe( '/img/* API', function() {

  var api = host + '/img/',
      port = 9001,
      imageUrl = 'http://localhost:' + port + '/images/',
      server;

  before( function( done ) {
    startServer( function() {
      // Spin-up a second server to use for grabbing images. See
      // test/test-files/images/* for all the images we'll use.
      var express = require( 'express' ),
          path = require( 'path' ),
          app = express();
      app.use( '/images', express.static( path.join( __dirname, 'test-files/images' ) ) );
      server = app.listen( port, done );
    });
  });

  after( function() {
    server.close();
    stopServer();
  });

  // Do a JSON request of the given <url>, i.e., http://localhost:8888/img/<url>
  function apiHelper( url, callback ) {
    request.get({ uri: api + imageUrl + url, json: true }, callback );
  }

  function doImgTypeTest( imgInfo, contentType, done ) {
    apiHelper( imgInfo.filename, function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 200 );
      assert.deepEqual( body, {
        href: imageUrl + imgInfo.filename,
        contentType: contentType,
        size: {
          width: imgInfo.width,
          height: imgInfo.height
        }
      });

      done();
    });
  }

  /**
   * If one of these image decoder types is failing, it might mean your
   * build environment is missing libraries node-canvas needs to link.
   * See https://github.com/LearnBoost/node-canvas/wiki/_pages for
   * platform specific install details.
   */
  it( 'should give proper sizes for PNG files', function( done ) {
    doImgTypeTest({ filename: '100x100.png', width: 100, height: 100 },
                  'image/png', done );
  });
  it( 'should give proper sizes for JPEG files', function( done ) {
    doImgTypeTest({ filename: '100x100.jpg', width: 100, height: 100 },
                  'image/jpeg', done );
  });
  it( 'should give proper sizes for GIF files', function( done ) {
    doImgTypeTest({ filename: '100x100.gif', width: 100, height: 100 },
                  'image/gif', done );
  });

});


describe( '/healthcheck', function() {

  function apiHelper( url, callback ) {
    request.get({ uri: api + url, json: true }, callback );
  }

  before( function( done ) {
    startServer( done );
  });

  after( function() {
    stopServer();
  });

  it( 'should give a 200 for /healthcheck', function( done ) {
    request.get( { url: host + '/healthcheck', json: true }, function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 200 );
      done();
    });
  });

});