// cmdline_parser.js
// small utility to help setup a config file.  It 
//  - parses options from the commandline


(function()
{
  var PATH = require('path');
  var fs = require('fs');
  var lib = require('./lib.js');
  var print = lib.print;
  var println = lib.println;

  // 
  var exename = process.argv[1].substring( process.argv[1].lastIndexOf('/')+1, process.argv[1].length);


  function check_flag( flag, next )
  {
    var start_ind = next ? next : 2;

    for ( var i = start_ind; i < process.argv.length; i++ ) {
      if ( flag === process.argv[i] ) {
        return i;
      }
    }

    return false;
  }


  // flags checked for (and must be skipped later) in check_cmdline
  var early_flags = ['-c','-k','-nc'];

  function check_cmdline( config )
  {
    function print_help()
    {
      print( exename + ":\n" );
      var p = function(s) { println( ' ' + s ) };
      p( '-c <config_path>  read the config from this location' );
      p( '-k <key> <val>    manually set key:value pairs in the config.' );
      p( '--help, -h        print this menu' );
      p( '-ci <id> <id2>    change index' );
      p( '-d                dump list of files' );
      p( '-dw               dump list of watched file' );
      p( '<#>               play movie with index <#>' );
      p( '-a <file> [dir]   add file, dir is optional' );
      p( '-l                play last played' );
      p( '-s <id>           set directory file is in' );
      p( '-nc               force-start a new config' );
      p( '-w                show files most watched' );
      p( '-rn <id> <name>   sets files display_name to <name>' );
      p( '-pc               print current config' );
      p( '-lp               print last played' );
      process.exit(0);
    }

debugger;
    //
    // entry point
    //
    if ( check_flag( '--help' ) || check_flag('-h') ) 
      print_help();

    var p = 0;
    if ( (p=check_flag( '-c' )) ) {
      if ( !process.argv[p+1] ) {
        println( '-c expects argument: <config_path>' );
        process.exit(-1);
      }
      config['config_path'] = process.argv[p+1];
      println('setting config_path to "'+config.config_path+'"');

      process.argv.splice(p+1,1);
      process.argv.splice(p+0,1);
    }

    if ( (p=check_flag('-nc')) ) {
      config.config_path = undefined;
      process.argv.splice(p,1);
    }

  } // check_cmdline
  exports.check_cmdline = check_cmdline;


  // cmdline args that do something
  function execute_commands( db, menu, config )
  {
    var v = process.argv;
    var ind = 0;
    var arg1, arg2;
debugger;

    // override config 
    if ( check_flag('-k') ) {
      var p = 2;
      while ( (p=check_flag('-k')) ) {
        if ( !process.argv[p+1] || !process.argv[p+2] ) {
          println( '-k expects two arguments: <key> <value>' );
          process.exit(-1);
        }
        var key = process.argv[p+1];
        var val = process.argv[p+2];

        var num = Number(val);
        if ( !isNaN(num) ) {
          config[ key ] = num;
        } else {
          config[ key ] = val;
        }
        println('setting config key: "'+key+'" to "'+val+'"');

        process.argv.splice(p+2,1);
        process.argv.splice(p+1,1);
        process.argv.splice(p+0,1);
      }
    }


    // -ci == change index
    if ( (ind=check_flag("-ci")) ) 
    {
      var pid1 = Number( v[ ind + 1 ] );
      var pid2 = Number( v[ ind + 2 ] );

      if ( !pid1 || !pid2 || isNaN(pid1) || isNaN(pid2) ) {
        println( "-ci: expects 2 args: from INDEX and INDEX to insert before" );
        process.exit(0);
      }

      if ( pid1 < 1 || pid1 > menu.highestUnwatchedPid() || pid2 < 1 || pid2 > menu.highestUnwatchedPid() ) {
        println ( "values out of range" );
        process.exit(0);
      }

      // last unset if indexes futzed with
      db.remove({lastMoviePid:{$exists:true}});

      var index1 = menu.indexFromPid(pid1);
      var index2 = menu.indexFromPid(pid2);

      // get _id for index1, _id for index2
      //var id1 = menu.movies[index1]._id;
      //var id2 = menu.movies[index2]._id;

      println( 'inserting ['+pid1+'] "' + menu.movies[index1].name() + '" before ['+pid2+'] "' + menu.movies[index2].name() + '"' );

      function row_by_pid( row_pid ) {
        var i = 0, l = db.master.length;
        for (; i < l; i++ ) {
          var t = db.master[i];
          if ( !t.watched || t.watched === false )
            if ( t.file && t.pid && t.pid === row_pid )
              return i;
        }
        return -1;
      }

      var start_row = row_by_pid( pid1 );
      //var end_row = row_by_pid( pid2 );

      /*
      - go down all rows of master; look for not watched
      - if not watched and pid >= pid2, then increment
      */
      // increment every unwatched pid greater than and including pid2
      var row = db.master.length;
      while ( --row >= 0 ) {
        var t = db.master[row];
        if ( !t.watched || t.watched === false )
          if ( t.file && t.pid && t.pid >= pid2 )
            t.pid++;
      }

      // set index index1's pid to pid2, (now that pid2 is out of the way)
      db.master[start_row].pid = pid2;

      // sort by _id asc, and take gaps out of _id
      db.master = db.master.sort(function(a,b){return a._id - b._id});
      db.renormalize();

      // take gaps out of Unwatched pid in db
      menu.renormalizeUnwatchedPid();
      db.save()

      process.exit(0);
    }


    // -a   add
    else if ( (ind=check_flag('-a')) ) 
    {
      arg1 = v[ ind + 1 ];
      arg2 = v[ ind + 2 ];

      if ( !arg1 ) {
        println( exename + ': -a add\'s a new movie. Expects a filename argument and optional search directory' );
        process.exit(0);
      }

      var mov_arg = arg1;
      var dir_arg = arg2;

      function finish( filename, dirname )
      {
        // report if filename already exists, but dont block insertion 
        var res = db.find( {file:filename} );
        if ( res.length > 0 ) {
          var xtra = res.length > 1 ? res.length + ' times': '';
          println( "\n ****WARNING: filename: \"" + filename + '" already exists ' + xtra + "\n" );
        }

        var new_pid = menu.highestUnwatchedPid() + 1;
        db.insert( {file:filename, dir:dirname, added:db.now(), pid: new_pid} );
        db.save();
        dirname = dirname ? ', dir: "'+dirname+'"' : '';
        println( 'file: "' + filename + '"'+dirname+' added' );
        process.exit(0);
      }

      // 1 - if the dir argument is supplied, just add file:arg1, dir:arg2 - no questions asked
      if ( dir_arg ) {
        finish( mov_arg, dir_arg );
      }

      // no second argument, resolve arg1
      var fullpath = PATH.resolve(arg1);
      var dirname = PATH.dirname(fullpath);
      var basename = PATH.basename(fullpath);

      // 1b - if PATH.resolve(file) doesn't stat(), just add the unedited original string argument AS IS
      try {
        fs.statSync( fullpath );
      } catch(e) {
        finish( mov_arg );
      }

      // 2 - see if its dirname is in the pathlist; if it is, just add basename
      if ( config.search_paths.indexOf( dirname ) > -1 ) {
        finish( basename );
      }

      // 
      // 3 - else 
      //        try to clip off /last_dir/ of dirname
      var last_dir = '';
      var dirname2 = '';
      if ( dirname.lastIndexOf('/') !== -1 ) {
        last_dir = dirname.slice( dirname.lastIndexOf('/') );
        dirname2 = dirname.slice( 0, dirname.lastIndexOf('/') );
        if ( last_dir.charAt(0) === '/' )
          last_dir = last_dir.slice(1);
        if ( last_dir.charAt(last_dir.length-1) === '/' )
          last_dir = last_dir.slice(0,last_dir.length-1);
      }

      // 4 - if fails: add file:basename, dir:dirname
      else {
        finish( basename, dirname );
      }

      // 5 - else (it succeeds, producing:  dirname ==> dirname2 + last_dir )
      //   - see if dirname2 is in pathlist; 
      //     - if it is, add file:basename with "dir":"last_dir"
      if ( config.search_paths.indexOf( dirname2 ) > -1 ) {
        finish( basename, last_dir );
      }

      // - else 
      //      add file:basename with "dir":"dirname"
      finish( basename, dirname );
    }

    // -dw dump watched
    else if ( check_flag('-dw') ) 
    {
      var watched = db.find( {watched:true} ).sort( {pid:1} );
      for ( var index = 0, length = watched.count(); index < length; index++ ) {
        var name = watched._data[index].display_name ? watched._data[index].display_name : watched._data[index].file;
        println( watched._data[index].pid +"\t"+ name );
      }
      process.exit(0);
    } 

    // -d dump
    else if ( check_flag('-d') ) {
      var tab = "\t";
      for ( var index = 0, length = menu.movies.length; index < length; index++ ) {
        if ( menu.lastMov == menu.movies[index].pid ) 
          tab = "+\t";
        else
          tab = "\t";
        println( menu.movies[index].pid + tab + menu.movies[index].name() );
      }
      process.exit(0);
    } 

    // -l ==> last
    else if ( check_flag('-l') ) 
    {
      if ( menu.lastMov === -1 ) {
        println( "no movie played yet" );
      } else {
        menu.play_movie( menu.lastMov, menu.lastSec );
        return false;
      }
    }

    // -s ==> set
    else if ( (ind=check_flag('-s')) ) 
    {
      var pid       = Number( v[ ind + 1 ] );
      var new_name  = v[ ind + 2 ];

      if ( !pid || isNaN(pid) || pid < 1 || pid > menu.highestUnwatchedPid() ) {
        println ( "first value out of range, or not a number." );
        println( "-s: expects 1 or 2 arguments" );
        process.exit(0);
      }

      var index = menu.indexFromPid( pid );

      if ( !new_name ) {
        println( "directory for file [" + pid + '] "' + menu.movies[index].file + '" --> "' + menu.movies[index].dir + '"' );
        process.exit(0);
      }

      println( 'setting directory for file "' + menu.movies[index].file +'" from "' + menu.movies[index].dir + '" to "' + new_name + '"' );

      db.update( {_id: menu.movies[index]._id}, {'$set':{"dir":new_name}} );
      db.save();
      process.exit(0);
    }

    // give the file a different name for displaying, without changing its actual filename
    else if ( (ind=check_flag('-rn')) )
    {
      arg1 = Number( v[ ind + 1 ] );
      arg2 = v[ ind + 2 ];
      if ( isNaN(arg1) || !arg1 || !arg2 || arg1<1 || arg1>menu.highestUnwatchedPid() ) {
        println( 'usage: '+exename+' -rn <id> <name_file_to_this>' );
        process.exit(0);
      }

      // get current displaying name 
      var res = db.find( {pid:arg1, $or:[{watched:false},{watched:{$exists:false}}]} );
      var m = res._data[0];
      var before = m.display_name ? m.display_name : m.file; 
      
      // change
      db.update( {pid:arg1, $or:[{watched:false},{watched:{$exists:false}}]} , {'$set':{display_name:arg2}} );
      db.save();

      // report
      res = db.find( {pid:arg1,display_name:arg2} );
      m = res._data[0];
      println( 'changed: "'+before+'" to: "'+m.display_name+'"' );

      process.exit(0);
    }

    // show watched seconds, sorting by longest watched
    else if ( check_flag('-w') )
    {
      var res = db.find( {sec_watched:{$exists:true}}).sort( { sec_watched: -1 } );
      var tot = 0;
      for ( var i = 0, l = res._data.length; i < l; i++ ) {
        var o = res._data[i];
        tot += o.sec_watched;
        var name = o.display_name ? o.display_name : o.file;
        var tab = o.watched ? '  w  ' : '     ';
        if ( menu.lastMov == o.pid ) 
          tab = '  L  ';
        println( i + tab + lib.secToHMS(o.sec_watched) + "\t["+ o.pid + '] ' + name );
      }
      println("----------------------------------");
      println('  ' + lib.secToHMS(tot) + ' total time watched' );
      println("----------------------------------");
      process.exit(0);
    }

    // this shows all last played last played
    else if ( check_flag( '-lp' ) )
    {
      var res = db.find( {last_played:{$exists:true}} ).sort({last_played:-1});
      if ( res && res._data && res.length > 0 ) {
        res._data.forEach(function(x,i){
          var tab = x.watched ? '  w  ' : '     ';
          if ( menu.lastMov == x.pid ) 
            tab = '  L  ';
          i++;
        
          println(lib.unixToAlpha(x.last_played)+tab+'['+x.pid+'] '+(x.display_name?x.display_name:x.file));
        });
      } else
        println( "none played" );
      process.exit(0);
    }

    // spit out the config to stdout
    else if ( check_flag('-pc') ) {
      println( JSON.stringify(config,null,'  ') );
      process.exit(0);
    }

    // try to play movie by number if valid movie[index] given
    else 
    {
      if ( !v[2] )
        return true;

      var pid = Number( v[2] );
      if ( !isNaN(pid) && pid >= 1 && pid <= menu.highestUnwatchedPid() ) {
        var k = menu.indexFromPid( pid );
        menu.play_movie( pid, menu.movies[k].resumeSec ? menu.movies[k].resumeSec : 0 );
        return false;
      }
      else
      {
        // if flags already checked for, run normally
        for ( var i = 0; i < early_flags.length; i++ ) {
          if ( v[2].match( early_flags[i] ) )
            return true;
        }

        println( "dont know that one" );
        process.exit(0);
      }
    }

    return true;

  } // execute_commands
  exports.execute_commands = execute_commands;

})();
