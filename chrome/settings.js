/**
 * TODO: Use chrome.storage.local/sync.  Further encapsulate details such as defaults and maps.
 */

var jmtyler = jmtyler || {};
jmtyler.settings = (function()
{
	var _settings = null;
	
	var _defaults = {
		'notifications_on' : true,
		'show_page_count'  : true,
		'check_frequency'  : 3,
		'toast_icon_uri'   : '48.png',
		'is_debug_mode'    : false
	};
	
	var _maps = {
		'check_frequency': {
			1:  {
				seconds: 60,
				readable: "1 minute"
			},
			2:  {
				seconds: 120,
				readable: "2 minutes"
			},
			3:  {
				seconds: 300,
				readable: "5 minutes"
			},
			4:  {
				seconds: 600,
				readable: "10 minutes"
			},
			5:  {
				seconds: 1800,
				readable: "30 minutes"
			},
			6:  {
				seconds: 3600,
				readable: "1 hour"
			},
			7:  {
				seconds: 7200,
				readable: "2 hours"
			},
			8:  {
				seconds: 18000,
				readable: "5 hours"
			},
			9:  {
				seconds: 43200,
				readable: "12 hours"
			},
			10: {
				seconds: 86400,
				readable: "24 hours"
			}
		}
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

// TODO: Move this to a better spot, but it still must realistically depend on jmtyler.settings
jmtyler.log = function()
{
	if (jmtyler.settings.get('is_debug_mode')) {
		console.log.apply(console, arguments);
	}
};
