var assert = require( "assert" ),
    fork = require( "child_process" ).fork,
    request = require( "request" );

describe( "/url/* API (depends on network)", function() {

  var child,
      host = "http://localhost:8888",
      api = host + "/url/";

  // Do a JSON request of the given <url>, i.e., http://localhost:8888/url/<url>
  function apiHelper( url, callback ) {
    request.get({ uri: api + url, json: true }, callback );
  }

  before( function( done ) {
    // Spin-up the server as a child process
    child = fork( "server.js", null, {} );
    child.on( "message", function( msg ) {
      if ( msg === "Started" ) {
        done();
      }
    });
  });

  after( function() {
    child.kill();
  });

  it( "should get error when no URL is sent with request", function( done ) {
    apiHelper( "", function( err, res, body ) {
      assert.equal( res.statusCode, 500 );
      assert.equal( "Expected url param, found none.", body.error );
      done();
    });
  });

  it( "should get error when bogus URL is sent with request", function( done ) {
    apiHelper( "bogus", function( err, res, body ) {
      assert.equal( res.statusCode, 500 );
      assert.equal( "Unable to determine content type.", body.error );
      done();
    });
  });

  it( "should get href and contentType when URL is valid", function( done ) {
    apiHelper( "http://google.com", function( err, res, body ) {
      assert.equal( res.statusCode, 200 );
      assert.ok( !!body.href );
      assert.ok( !!body.contentType );
      done();
    });
  });

  it( "should follow redirects and get href and contentType when URL is valid", function( done ) {
    apiHelper( "http://github.com/humphd/web-dna", function( err, res, body ) {
      assert.equal( res.statusCode, 200 );
      // Github will redirect HTTP to HTTPS
      assert.equal( body.href, "https://github.com/humphd/web-dna" );
      assert.equal( body.contentType, "text/html; charset=utf-8" );
      done();
    });
  });

});
