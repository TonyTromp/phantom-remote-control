/**
 * phantom-remote-control
 * HTTP Adapter to remote control Devialet Phantom sound system
 *               (Play, Pause, Volume etc.)
 * 
 * @french Contrôlez les enceintes Devialet via une API HTTP. (Lecture, Pause, Volume etc.)
 * @package phantom-remote-control
 * @author https://github.com/VanVan
 */


const config = require('./config.json');
if (config.debug) {
	const dotenv = require('dotenv');
	dotenv.config();
}
var ssdp = require('node-ssdp').Client
var parseUri = require('parseuri');
var client = new ssdp();
var http = require('http');
var url = require('url');
var request = require('request');
var MediaRendererClient = require('upnp-mediarenderer-client');
var clientMedia=null;
var devialetDevice = {};


create_http_server();

client.on('response', function inResponse(headers, code, rinfo) {
	console.log('Detected device ip: '+rinfo.address);
	if (typeof headers.LOCATION != 'undefined' && headers.LOCATION) { // Download file
		var http_options = {
			hostname: parseUri(headers.LOCATION).host,
			port: parseUri(headers.LOCATION).port,
			path: parseUri(headers.LOCATION).path,
			method: 'GET'
		  }
		  
		  var req = http.request(http_options, (res) => {
			res.setEncoding('utf8');
  
			res.on('data', (data) => {
			  if (data.includes('Devialet UPnP Renderer')) {
				clientMedia = new MediaRendererClient(headers.LOCATION);
				devialetDevice.host = parseUri(headers.LOCATION).host;
				devialetDevice.port = parseUri(headers.LOCATION).port;
				console.log("Devialet found : "+devialetDevice.host+":"+devialetDevice.port);
			  }
			});
		  });
		   
		  req.on('error', (e) => {
			console.log(`get Location xml problem with request: ${e.message}`);
		  });
		  
		  req.end();
	}
	if(rinfo.address == config.devialet_ipaddress) {
		devialetDevice.host = parseUri(headers.LOCATION).host;
		devialetDevice.port = parseUri(headers.LOCATION).port;
	}
		
});


/**
 * Set volume of Devialet speaker
 * @param {int} volumeLevel
 * @returns {Promise} Returns new volume level
 */
function setVolume(volumeLevel)
{
	return new Promise(function(resolve, reject) {
		var xml = '<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">'+
		'<s:Body>'+
			'<u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:2">'+
			'<InstanceID>0</InstanceID>'+
			'<Channel>Master</Channel>'+
			'<DesiredVolume>'+volumeLevel+'</DesiredVolume>'+
			'</u:SetVolume>'+
		'</s:Body>'+
	'</s:Envelope>';

	var http_options = {
	method: 'POST',
	path: '/Control/LibRygelRenderer/RygelRenderingControl',
	hostname: devialetDevice.host,
	port: devialetDevice.port,
	headers: {
	'Content-Type': 'application/x-www-form-urlencoded',
	'SOAPACTION': 'urn:schemas-upnp-org:service:RenderingControl:2#SetVolume',
	'Content-Length': xml.length
	}
	}

	var req = http.request(http_options, (res) => {
		res.setEncoding('utf8');

		res.on('data', (data) => {
			if (data.includes('SetVolumeResponse')) {
				console.log(' -> Success');
				resolve(volumeLevel);
			}
			else {
				console.log(' -> Error: volume unchanged');
				reject(volumeLevel);
			}
		});
	});

	req.on('error', (e) => {
		console.log(`Volume cannot be set: ${e.message}`);
		reject(volumeLevel);
	});
	
	req.write(xml); 
	req.end();

	process.stdout.write("Trying to set Volume to "+volumeLevel+"%");
	});
}

/**
 * Get Volume of Devialet Speaker
 * @returns {Promise} Returns current volume level
 */
function getVolume()
{
	return new Promise(function(resolve, reject) {		
		var http_options = {
		  method: 'POST',
		  path: '/Control/LibRygelRenderer/RygelRenderingControl',
		  hostname: devialetDevice.host,
		  port: devialetDevice.port,
		  headers: {
		    'Content-Type': 'text/xml',
		    'SOAPACTION': 'urn:schemas-upnp-org:service:RenderingControl:2#GetVolume',
		    'Content-Length': 350
		  }
		}
		
		var req = http.request(http_options, (res) => {
		  res.setEncoding('utf8');

		  res.on('data', (data) => {
			resolve(data);
			console.log(data);
		  });
		});
		 
		req.on('error', (e) => {
		  console.log(`Volume cannot be retrieved: ${e.message}`);
		  reject(e);
		});
		req.end();	

		process.stdout.write("Trying to get Volume");
	});
}

/**
 * Search Devialet system on network
 */
function searchDevialetSpeaker()
{
	if (devialetDevice.host) {
		console.log('Updating device ...');
	}
	else
		console.log('Trying to detect, please wait ...');

	client.search('urn:schemas-upnp-org:service:RenderingControl:2');
	setTimeout(function() {
  		searchDevialetSpeaker();
	}, config.ssdp_detection_interval);
}


/**
 * Create HTTP server to listen request
 */
function create_http_server() {

	http.createServer(function (req, res) {

	res.writeHead(200, {'Content-Type': 'text/html'});

	var q = url.parse(req.url, true).query;

	
	
	}).listen(config.http_local_port);
}



console.log("Searching for Devialet Phantom or Dialog ...");
console.log("This may take several minutes");

//On force
if (config.devialet_port && config.devialet_ipaddress && config.devialet_port != 'autodetect' && config.devialet_ipaddress != 'autodetect') {
	devialetDevice.host = config.devialet_ipaddress;
	devialetDevice.port = config.devialet_port;
	console.log('Detection forced from config file to be '+config.devialet_ipaddress+':'+config.devialet_port+' -> Only set volume usable');
}
else if (config.devialet_device_description_xml && config.devialet_device_description_xml != 'autodetect') {
	clientMedia = new MediaRendererClient(config.devialet_device_description_xml);
	devialetDevice.host = parseUri(config.devialet_device_description_xml).host;
	devialetDevice.port = parseUri(config.devialet_device_description_xml).port;
	console.log('Detection forced from config device description to be '+devialetDevice.host+':'+devialetDevice.port);
}
else
	searchDevialetSpeaker();