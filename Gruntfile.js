// A Gruntfile controls how `grunt` is run.
// http://gruntjs.com/getting-started is a pretty great guide

module.exports = function( grunt ) {
  grunt.initConfig({
    pkg: grunt.file.readJSON( "package.json" ),
    jshint: {
      files: [
        "Gruntfile.js",
        "server.js",
        "lib/**/*.js",
        "package.json",
        "test/**/*.js",
        "routes/**/*.js"
      ]
    }
  });

  grunt.loadNpmTasks( "grunt-contrib-jshint" );

  // The default tasks to run when no tasks are passed on the command line
  grunt.registerTask( "default", [ "jshint" ]);
};
