'use strict'

const dnsEqual = require('dns-equal')

module.exports = function (a, b) {
	a = Array.isArray(a) ? a.join('.') : a;
	b = Array.isArray(b) ? b.join('.') : b;
	return dnsEqual(a, b)
}
