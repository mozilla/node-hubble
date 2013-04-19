var assert = require( "assert" ),
    fork = require( "child_process" ).fork,
    request = require( "request" ),
    child;

var util = require('util');

var repoURL = "http://github.com/humphd/node-hubble",
    repoURLHref = "https://github.com/humphd/node-hubble",
    repoURLContentType = "text/html; charset=utf-8",
    host = "http://localhost:8888",
    api = host + "/url/";

function startServer( callback ) {
  // Spin-up the server as a child process
  child = fork( "server.js", null, {} );
  child.on( "message", function( msg ) {
    if ( msg === "Started" ) {
      callback();
    }
  });
}

function stopServer() {
  child.kill();
}

describe( "/url/* API (depends on network)", function() {

  // Do a JSON request of the given <url>, i.e., http://localhost:8888/url/<url>
  function apiHelper( url, callback ) {
    request.get({ uri: api + url, json: true }, callback );
  }

  before( function( done ) {
    startServer( done );
  });

  after( function() {
    stopServer();
  });

  it( "should get error when no URL is sent with request", function( done ) {
    apiHelper( "", function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 500 );
      assert.equal( "Expected url param, found none.", body.error );
      done();
    });
  });

  it( "should get error when bogus URL is sent with request", function( done ) {
    apiHelper( "bogus", function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 500 );
      assert.equal( "Unable to determine content type.", body.error );
      done();
    });
  });

  it( "should get href and contentType when URL is valid", function( done ) {
    apiHelper( "http://google.com", function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 200 );
      assert.ok( !!body.href );
      assert.ok( !!body.contentType );
      done();
    });
  });

  it( "should follow redirects and get href and contentType when URL is valid", function( done ) {
    apiHelper( repoURL, function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 200 );
      // Github will redirect HTTP to HTTPS
      assert.equal( body.href, repoURLHref );
      assert.equal( body.contentType, repoURLContentType );
      // First hit on this URL shouldn't come from cache
      assert.ok( !( "cached" in body ) );
      done();
    });
  });

  it( "should get values from cache this time, if configured for caching", function( done ) {
    // If using a cache, configure the environment to have EXPECT_CACHED=1
    var expectCached = process.env.EXPECT_CACHED === '1';

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

describe( "/healthcheck", function() {

  // Do a JSON request of the given <url>, i.e., http://localhost:8888/url/<url>
  function apiHelper( url, callback ) {
    request.get({ uri: api + url, json: true }, callback );
  }

  before( function( done ) {
    startServer( done );
  });

  after( function() {
    stopServer();
  });

  it( "should give a 200 for /healthcheck", function( done ) {
    request.get( { url: host + '/healthcheck', json: true }, function( err, res, body ) {
      assert.ok( !err );
      assert.equal( res.statusCode, 200 );
      done();
    });
  });

});