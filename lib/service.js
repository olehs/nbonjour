'use strict';

const os = require('os');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const serviceName = require('multicast-dns-service-types');

const TLD = '.local';

module.exports = Service;

util.inherits(Service, EventEmitter);

function Service(opts) {
	if (!opts.name) throw new Error('Required name not given');
	if (!opts.type) throw new Error('Required type not given');
	if (!opts.port) throw new Error('Required port not given');

	this.name = opts.name;
	this.type = opts.type;
	this.protocol = opts.protocol || 'tcp';
	this.host = opts.host;
	if (!this.host) {
		this.host = os.hostname();
		if(!this.host.endsWith(TLD)) this.host = this.host + TLD;
	}
	this.port = opts.port;
	this.addresses = opts.addresses;
	this.arrFqdn = serviceName.labelify({
		instance: this.name,
		name: this.type,
		protocol: this.protocol,
	});
	this.fqdn = this.arrFqdn.join('.');
	this.subtypes = opts.subtypes || null;
	this.txt = opts.txt || null;
	this.flush = opts.flush || false;
	this.published = false;

	this._activated = false // indicates intent - true: starting/started, false: stopping/stopped
}

Service.prototype._records = function () {
	const records = [rrPtrServices(this), rrPtr(this), rrSrv(this), rrTxt(this)];

	if (this.subtypes) {
		for (let subtypeIndex = 0; subtypeIndex < this.subtypes.length; subtypeIndex += 1) {
			records.push(rrPtr(this, subtypeIndex))
		}
	}

	const self = this;
	if (!this.addresses) {
		const interfaces = os.networkInterfaces();
		Object.keys(interfaces).forEach(function (name) {
			interfaces[name].forEach(function (addr) {
				if (addr.internal) return;
				if (addr.family === 'IPv4') {
					records.push(rrA(self, addr.address))
				} else {
					records.push(rrAaaa(self, addr.address))
				}
			})
		})
	} else {
		if (this.addresses.ipv4) {
			this.addresses.ipv4.forEach(function (addr) {
				records.push(rrA(self, addr))
			})
		}
		if (this.addresses.ipv6) {
			this.addresses.ipv6.forEach(function (addr) {
				records.push(rrAaaa(self, addr))
			})
		}
	}

	return records
};

function rrPtrServices(service) {
	return {
		name: '_services._dns-sd._udp.local',
		type: 'PTR',
		ttl: 28800,
		flush: service.flush,
		data: serviceName.stringify({
			name: service.type,
			protocol: service.protocol,
		}),
	}
}

function rrPtr(service, subtypeIndex) {
	return {
		name: serviceName.stringify({
			name: service.type,
			protocol: service.protocol,
			subtypes: typeof subtypeIndex !== 'undefined' ? service.subtypes[subtypeIndex] : null
		}),
		type: 'PTR',
		ttl: 28800,
		flush: service.flush,
		data: service.arrFqdn
	}
}

function rrSrv(service) {
	return {
		name: service.arrFqdn,
		type: 'SRV',
		ttl: 120,
		flush: service.flush,
		data: {
			port: service.port,
			target: service.host
		}
	}
}

function rrTxt(service) {
	let data = service.txt || {};
	data = Object.keys(data).map(key => {
		if (data[key] === true) return Buffer.from(key);
		else if (Buffer.isBuffer(data[key])) return Buffer.concat([Buffer.from(key + '='), data[key]]);
		else return Buffer.from(key + '=' + data[key]);
	})

	return {
		name: service.arrFqdn,
		type: 'TXT',
		ttl: 4500,
		flush: service.flush,
		data: data.length ? data : Buffer.from([])
	}
}

function rrA(service, ip) {
	return {
		name: service.host,
		type: 'A',
		ttl: 120,
		data: ip
	}
}

function rrAaaa(service, ip) {
	return {
		name: service.host,
		type: 'AAAA',
		ttl: 120,
		data: ip
	}
}
