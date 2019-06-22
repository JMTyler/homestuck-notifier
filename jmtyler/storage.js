/**
 * TODO: Use chrome.storage.local/sync.  Further encapsulate details such as defaults and maps.
 */

var jmtyler = jmtyler || {};
jmtyler.storage = (() => {
	let _settings = null;

	const _defaults = {
		'notifications_on': true,
		'show_page_count':  false,
		'toast_icon_uri':   'icons/48.png',
		'is_debug_mode':    false,
		'reading_club':     null,
	};

	const _load = () => {
		_settings = {};
		if (typeof(localStorage['options']) != 'undefined') {
			_settings = JSON.parse(localStorage['options']);
		}

		for (let key in _defaults) {
			if (!_defaults.hasOwnProperty(key)) {
				continue;
			}

			if (typeof(_settings[key]) == 'undefined') {
				_settings[key] = _defaults[key];
			}
		}
	};

	const _save = () => {
		if (_settings === null) {
			// Nothing to save!
			return;
		}

		localStorage['options'] = JSON.stringify(_settings);
	};

	return {
		get(key) {
			_load();

			if (typeof(key) == 'undefined') {
				return _settings;
			}

			if (typeof(_settings[key]) == 'undefined') {
				return null;
			}

			return _settings[key];
		},
		set(key, value) {
			_load();
			_settings[key] = value;
			_save();

			return this;
		},
		clear(key) {
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
	};
})();
