#!/usr/bin/env node

var https = require('https')
var fs = require('fs');
var crypto = require('crypto')
var path = require('path')
var awssign = require('awssign')
var edit = require('string-editor');
var ini = require('ini');
var argv = require('optimist').argv;
var strlen = require('utf8-length')

if (argv.version) {
    console.log(require('./package.json').version);
    process.exit(0);
}

var s3auth = {bucket: argv._[0]};
var filepath = path.join('/', argv._[1]);
var filename = path.parse(filepath).base

if (!s3auth.bucket || !filepath) {
    console.error('Usage: s3edit bucket file [options]');
    console.error('');
    console.error('Required:');
    console.error('  bucket\tthe containing S3 bucket');
    console.error('  file\t\tthe file to open');
    console.error('');
    console.error('Options:');
    console.error('  --key\t\tS3 access key (defaults to default in ~/.aws/config)');
    console.error('  --secret\tS3 secret key (defaults to default in ~/.aws/config)');
    console.error('  --profile\tLoad profile from ~/.aws/config');
    console.error('  --readonly\tDoes not write file back to the server');
    console.error('  --version\tDoes nothing but displays s3edit version');
    console.error('');
    console.error('Version: v'+require('./package.json').version);
    process.exit(1);
}

if (fs.existsSync(process.env.HOME+'/.aws/config')) {
    var configFile = fs.readFileSync(process.env.HOME+'/.aws/config', 'utf8');
    var config = ini.parse(configFile);

    if (argv.profile) {
        if (config['profile '+argv.profile]) {
            s3auth.key = config['profile '+argv.profile].aws_access_key_id;
            s3auth.secret = config['profile '+argv.profile].aws_secret_access_key;
        } else {
            console.error('Unknown profile');
            process.exit(1);
        }
    } else if (config.default) {
        s3auth.key = config.default.aws_access_key_id;
        s3auth.secret = config.default.aws_secret_access_key;
    }
}

if (argv.key) s3auth.key = argv.key;
if (argv.secret) s3auth.secret = argv.secret;

awssign.setup(null, null, 'eu-west-1')

var getOptions = {
    hostname: s3auth.bucket +'.s3.amazonaws.com',
    port: 443,
    path: filepath,
    method: 'GET',
    headers: {}
}

awssign.signature(getOptions)

var req = https.request(getOptions, function(res) {
    res.setEncoding('utf8')
    var body = ''
    res.on('data', function(chunk) {
        body += chunk
    })
    res.on('end', function() {
        if (res.statusCode !== 200) {
            console.error(body)
            process.exit(res.statusCode)
        }
        edit(body, filename, function(err, result) {
            if (!argv.readonly) putfile(result)
            else process.exit(0)
        })
    })

})

req.on('error', function(err) {
    throw err
})

req.end()

function putfile(newtext) {
    var putOptions = {
        hostname: s3auth.bucket+'.s3.amazonaws.com',
        port: 443,
        path: filepath,
        method: 'PUT',
        headers: {
            'Content-Type': 'text/plain; charset=utf8',
            'Content-Length': strlen(newtext)
        }
    }
    awssign.signature(putOptions, hash(newtext))
    var req = https.request(putOptions, function(res) {
        if (res.statusCode === 200) process.exit(0)
        res.setEncoding('utf8')
        var body = ''
        res.on('data', function(chunk) {
            body += chunk
        })
        res.on('end', function() {
            console.error(body)
            process.exit(res.statusCode)
        })
    })
    
    req.on('error', function(err) {
        throw err
    })

    req.write(newtext)
    req.end()
}

function hash(str) {
    return crypto.createHash('sha256').update(str, 'utf8').digest('hex')
}
