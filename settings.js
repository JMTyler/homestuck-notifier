/**
 * TODO: Use chrome.storage.local/sync.  Further encapsulate details such as defaults and maps.
 */

var jmtyler = jmtyler || {};
jmtyler.settings = (function()
{
	var _settings = null;

	var _defaults = {
		'notifications_on': true,
		'show_page_count':  false,
		'toast_icon_uri':   'icons/48.png',
		'is_debug_mode':    false,
		'reading_club':     null,
	};

	var _load = function()
	{
		_settings = {};
		if (typeof(localStorage['options']) != 'undefined') {
			_settings = JSON.parse(localStorage['options']);
		}

		for (var key in _defaults) {
			if (!_defaults.hasOwnProperty(key)) {
				continue;
			}

			if (typeof(_settings[key]) == 'undefined') {
				_settings[key] = _defaults[key];
			}
		}
	};

	var _save = function()
	{
		if (_settings === null) {
			// Nothing to save!
			return;
		}

		localStorage['options'] = JSON.stringify(_settings);
	};

	return {
		get: function(key)
		{
			_load();

			if (typeof(key) == 'undefined') {
				return _settings;
			}

			if (typeof(_settings[key]) == 'undefined') {
				return null;
			}

			return _settings[key];
		},
		set: function(key, value)
		{
			_load();
			_settings[key] = value;
			_save();

			return this;
		},
		clear: function(key)
		{
			if (typeof(key) == 'undefined' || key === null) {
				_settings = {};
				_save();
				return this;
			}

			_load();
			delete _settings[key];
			_save();

			return this;
		},
		map: function(key, value)
		{
			if (typeof(_maps[key]) == 'undefined') {
				return null;
			}

			if (typeof(value) == 'undefined' || value === null) {
				value = this.get(key);
			}

			if (typeof(_maps[key][value]) == 'undefined') {
				return null;
			}

			return _maps[key][value];
		}
	};
})();

// HACK: TODO: Move these to a better spot, but they still must realistically depend on jmtyler.settings
jmtyler.log = (...args) => {
	// TODO: Add a production-debug mode that uploads logs to me.
	if (jmtyler.settings.get('is_debug_mode')) {
		console.log(...args);
	}
};

jmtyler.api = (endpoint) => {
	// TODO: Debug mode in-the-wild could point to a separate Staging API (or even ngrok if I can manage it).
	const baseUrl = jmtyler.settings.get('is_debug_mode') ? 'http://127.0.0.1/v1' : 'https://homestuck.herokuapp.com/v1';
	return `${baseUrl}/${endpoint}`;
};

jmtyler.request = (method, endpoint, payload) => {
	const url = jmtyler.api(endpoint);
	payload = JSON.stringify(payload || {});

	jmtyler.log(`[REQUEST] ${method} ${url} -- ${payload}`);

	const MAX_TRIES = 125;
	const tryRequest = (attempt = 1) => {
		return new Promise((resolve, reject) => {
			const req = new XMLHttpRequest();

			req.open(method, url + '?attempt=' + attempt, true);

			const captureError = (issue, ev) => {
				jmtyler.log(`[REQUEST] ↳ ${issue}:`, ev);
				const err = new Error(`Request ${issue}`);
				err.event = ev;
				return reject(err);
			};

			// TODO: Clean up all this exponential backoff logic.  It'll do for now, but it's spaghetti all the way down.
			const retry = async (reason) => {
				let seconds = (attempt ** 2);
				// Add some randomness (proportional to the original waiting period) to reduce collisions with other retrying clients.
				seconds += seconds * (Math.random() / 2);
				jmtyler.log(`[REQUEST] ↳ Attempt #${attempt} ${reason}, waiting ${seconds}s...`);
				await Promise.delay(seconds * 1000);
				jmtyler.log(`[REQUEST] ↳ Retrying...`);
				return tryRequest(attempt + 1).then(resolve).catch(reject);
			};

			req.addEventListener('abort', (ev) => captureError('Aborted', ev));
			req.addEventListener('error', (ev) => {
				if (attempt < MAX_TRIES) {
					return retry('got all jacked up');
				}
				return captureError('Error', ev);
			});
			req.addEventListener('timeout', (ev) => {
				if (attempt < MAX_TRIES) {
					return retry('timed out');
				}
				return captureError('Timed Out', ev);
			});

			req.addEventListener('load', () => {
				if (req.status != 200) {
					if (attempt < MAX_TRIES) {
						return retry(`failed (status ${req.status})`);
					}

					jmtyler.log(`[REQUEST] ↳ Failed: (Status ${req.status}), (Response: "${req.response}")`, req);
					const err = new Error('Request Failed');
					err.status = req.status;
					err.response = req.response;
					return reject(err);
				}

				try {
					jmtyler.log(`[REQUEST] ↳ Raw Payload:`, req.response);
					const res = JSON.parse(req.response || '{}');
					jmtyler.log(`[REQUEST] ↳ Parsed Payload:`, res);
					return resolve(res);
				} catch (err) {
					jmtyler.log(`[REQUEST] ↳ Failed to Parse Response:`, err, req);
					return reject(err);
				}
			});

			req.setRequestHeader('Cache-Control', 'no-cache');
			req.setRequestHeader('Content-Type', 'application/json');
			req.send(payload);
		});
	};
	return tryRequest();
};

Promise.delay = (ms) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};
