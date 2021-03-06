//
// lib.js - collection of helper functions & classes 
//

(function() 
{
    var fs = require('fs');
    var util = require('util');
    var path = require('path');


    function println(str) {
      if ( !str )
        process.stdout.write( "\n" );
      else
        process.stdout.write( str + "\n" );
    }
    exports.println = println;

    function print(str) {
      process.stdout.write( str );
    }
    exports.print = print;


    function type_of( v ) {
        var s = typeof v;
        switch( s ) {
        case "object":
            if ( util.isDate( v ) ) {
                return "date";
            }
            else if ( util.isArray( v ) ) {
                return "array";
            }
            else if ( util.isRegExp( v ) ) {
                return "regexp";
            }
            return "object";
        default:
            return s;
        }
    }
    exports.type_of = type_of;


    function trunc_string(str,n) {
        if ( str.length <= n )
            return str;
        return str.substring(0,n).trim() + '...';
    }
    exports.trunc_string = trunc_string;


    function pobj( a1, a2 ) 
    {
        if ( arguments.length > 1 )
        {
            this.name = a1;
            this.obj = a2;
        }
        else if ( arguments.length === 1 )
        {
            this.name = '';
            this.obj = a1;
        }
        else
            return undefined;


        var p = function(s) { console.log(s); };

        if ( arguments.length === 0 ) {
            return undefined;
        }

        var s = this.name + ' ['+ typeof(this.obj) + ']: ';
        s += JSON.stringify(this.obj);
        p( s );
        return s;
    }
    exports.pobj = pobj;


    function read_file( filename )
    {
        try {
            return fs.readFileSync( filename, {encoding:'utf8',flag:'r'} );
        }
        catch(e) {
            return null;
        }
    }
    exports.read_file = read_file;


    function write_file( filename, data, mode )
    {
        var _mode = mode || 0666;
        try {
            fs.writeFileSync( filename, data, {encoding:"utf8",mode:_mode,flag:'w'} );
            return 1;
        }
        catch(e) {
            return null;
        }
    }
    exports.write_file = write_file;


    function append_file( filename, data, mode )
    {
        var _mode = mode || 0666;
        try {
            fs.writeFileSync( filename, data, {encoding:"utf8",mode:_mode,flag:'a'} );
            return 1;
        }
        catch(e) {
            return null;
        }
    }
    exports.append_file = append_file;


    // takes an object and sorts it by its keys, alphabetically
    function sortObjectByKeys( O )
    {
        if ( typeof O !== "object" || (O instanceof Array) )
            return O;

        var keys = [];

        for ( i in O ) {
            if ( O.hasOwnProperty(i) ) {
                keys.push( {key:i,value:O[i]} );
            }
        }
        if ( keys.length === 0 )
            return O;

        keys.sort( function(a,b) { return a.key < b.key ? -1 : 1; } );
        
        var nO = {};

        keys.forEach( function(item) {
            nO[item.key] = item.value;
        });

        return nO;
    }
    exports.sortObjectByKeys = sortObjectByKeys;

    function list_dir( _dir ) 
    {
        function ls_dir ( dir_path, set )
        {
            try {
                var stat = fs.statSync( dir_path );
            } catch(e) {
                process.stderr.write( "error: \""+dir_path+'" not found' +"\n" );
                return null;
            }

            if ( !stat.isDirectory() )
                set.push( dir_path );
            else
            {  
                var dir = fs.readdirSync( dir_path );

                for ( var i = 0, l = dir.length ; i < l; i++ ) {
                    dir[i] = path.resolve( dir_path, dir[i] );

                    stat = fs.statSync( dir[i] );
                    if ( stat.isDirectory() )
                        ls_dir( dir[i], set );
                    else
                        set.push( dir[i] );
                }
            }
        }

        var set = [];
        ls_dir( path.resolve(_dir), set );
        return set;
    }
    exports.list_dir = list_dir;

    // expects a CALLBACK(), and, space-separated string like an actual commandline
    function system( commandline, callback )
    {
      if ( arguments.length < 1 ) {
        process.stdout.write( 'error: usage: system( cmdline, callback );' );
        return;
      }

      var args = '';
      if ( arguments[0] instanceof Array )
        args += ' ' + arguments[0].join(' ');
      else
        args += ' ' + arguments[0];
      args = args.trim().split(/\s+/);

      var res = [];
      var spawn = require('child_process').spawn;
      var child = spawn( args[0], args.slice(1), { env: process.env });
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      child.stdout.on('data', function (data) {
        res.push( data );
      });

      child.stderr.on('data', function (data) {
        process.stdout.write( 'stderr: ' + data );
      });

      child.on('close', function (code) {
        if ( callback )
          return callback(res.join(' '));
      });
    }
    exports.system = system;
    //eg: system( 'ls -ltr', function(s) { process.stdout.write(s) } );


    function objIsEmpty(obj) {
      if ( Object && Object.keys )
        return Object.keys(obj).length === 0;
      for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
          return false;
      }
      return true;
    }
    exports.objIsEmpty = objIsEmpty;

    function lz(n) {
      n = n + '';
      if ( n && n.length === 1 )
        return '0'+n;
      return n;
    }

    function secToHMS( sec, expand ) {
      var m = Math.floor(sec / 60);
      var s = sec - m * 60;
      var h = Math.floor(m / 60);
      if ( h > 0 ) 
        m = m - h * 60;

      if ( expand )
        return lz(h)+':'+lz(m)+':'+lz(s);
      if ( h > 0 )
        return h+':'+lz(m)+':'+lz(s);
      return m+':'+lz(s);
    }
    exports.secToHMS = secToHMS;

    // test
    //[47,87,247,1223,1247,4700,8743].forEach(function(x){println(x +"\t"+secToHMS(x));});

    // expects seconds from the Unix Epoch (not millisec)
    // returns YYMMDD_HHMMSS
    function unixToAlpha( u ) {
      var d = new Date( u * 1000 );

      //var YY = d.getFullYear();
      var YY = d.getFullYear() - 2000;
      var MM = (d.getMonth()+1);
      var DD = d.getDate();

      var HH = d.getHours();
      var mi = d.getMinutes();
      var SS = d.getSeconds();

      return lz(YY)+lz(MM)+lz(DD)+'_'+lz(HH)+lz(mi)+lz(SS);
    }
    exports.unixToAlpha = unixToAlpha;

    var MONSAR = [31,28,31,30,31,30,31,31,30,31,30,31];

    // Takes Month index: 0-11 and returns the # of days in the months
    //  preceding, but not including, it. Eg. Jan = 0, Feb = 31, Mar = 59
    function daysBefore( mm ) {
      return !mm || mm == 0 ? 0 : MONSAR.slice(0,mm).reduce(function(x,y){return x+y});
    }

    function daynum( dateobj ) {
      var d = !dateobj ? new Date() : dateobj;
      var Y = d.getFullYear();
      var M = d.getMonth(); // starting with 0: m == {0,11}
      var D = d.getDate(); // starting with 1
      return Y * 365 + daysBefore(M) + D - 1;
    }
    exports.daynum = daynum;

    function daynumToDate( dn ) {
      var yy = Math.floor(dn/365);
      var dd = dn - 365 * yy;
      var mm = 0; // jan

      while ( mm < 12 )
      {
        if ( dd < MONSAR[mm] ) 
          break;
        else
        {
          dd -= MONSAR[mm++];
        }
      }

      return yy+'-'+lz(mm+1)+'-'+lz(dd+1);
    }
    exports.daynumToDate = daynumToDate;

    // test
    //[735109,735110,735141].forEach(function(x){println(daynumToDate(x));});

})();


