#!/usr/bin/env node

var fs = require('fs');
var request = require('request');
var edit = require('string-editor');
var ini = require('ini');
var argv = require('optimist').argv;

var s3auth = {bucket: argv._[0]};
var file = argv._[1];
if (!s3auth.bucket || !file) {
    console.error('Usage: s3edit bucket file [options]');
    console.error('');
    console.error('Required:');
    console.error('\tbucket\t\tthe containing S3 bucket');
    console.error('\tfile\t\tthe file to open');
    console.error('');
    console.error('Options:');
    console.error('\t--key\t\tS3 access key (defaults to default in ~/.aws/config)');
    console.error('\t--secret\tS3 secret key (defaults to default in ~/.aws/config)');
    console.error('\t--profile\tLoad profile from ~/.aws/config');
    console.error('\t--readonly\tDoes not write file back to the server');
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

var s3path = 'https://'+s3auth.bucket+'.s3.amazonaws.com/'+file;

var onResponse = function(fn) {
    return function(err, response, body) {
        if (err) throw err;
        if (response.statusCode !== 200) {
            body = '';
        }
        if (fn) fn(body);
    }
};

var filename = s3path.split('/').pop();

request.get(s3path, {
    aws: s3auth,
}, onResponse(function(body) {
    edit(body, filename, function(err, text) {
        var options = {
            aws: s3auth,
            body: text
        };
        if (argv.public) options.headers = {'x-amz-acl':'public-read'};
        if (!argv.readonly) request.put(s3path, options, onResponse());       
    });
}));


