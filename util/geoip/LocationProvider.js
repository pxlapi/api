const ConfigManager = require('../config/Manager');
const fetch = require('../fetch/Fetch');

class LocationProvider {
	static async geoipLookup(ipAddress) {
		if (Array.isArray(ipAddress))
			ipAddress = ipAddress[0];

		const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
		if (!response.ok)
			return null;

		const result = await response.json();

		return [result.city, result.region, result.countryCode]
			.filter(v => v)
			.join(', ') || null;
	}
}

module.exports = LocationProvider;
