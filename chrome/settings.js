/**
 * TODO: Auto-save, like memory.  Use chrome.storage.local/sync.  Further encapsulate details such as defaults and maps.
 */

window.jmtyler = window.jmtyler || {};
window.jmtyler.settings = (function()
{
	var _settings = null;
	
	var _defaults = {
		'notifications_on' : true,
		'show_page_count'  : true,
		'check_frequency'  : 3
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
	
	return {
		get: function(key)
		{
			if (_settings === null) {
				this.load();
			}
			
			if (typeof(_settings[key]) == 'undefined') {
				return null;
			}
			
			return _settings[key];
		},
		set: function(key, value)
		{
			if (_settings === null) {
				this.load();
			}
			
			_settings[key] = value;
			
			return this;
		},
		load: function()
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
			
			return this;
		},
		save: function()
		{
			if (_settings === null) {
				// Nothing to save!
				return this;
			}
			
			localStorage['options'] = JSON.stringify(_settings);
			
			return this;
		},
		clear: function()
		{
			// TODO: copy memory
			_settings = {};
			this.save();
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
