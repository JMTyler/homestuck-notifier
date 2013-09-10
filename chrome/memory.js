window.jmtyler = window.jmtyler || {};
window.jmtyler.memory = (function()
{
	var _memory = null;
	
	var _defaults = {
		'latest_update': false
	};
	
	var _load = function()
	{
		_memory = {};
		if (typeof(localStorage['memory']) != 'undefined') {
			_memory = JSON.parse(localStorage['memory']);
		}
		
		for (var key in _defaults) {
			if (!_defaults.hasOwnProperty(key)) {
				continue;
			}
			
			if (typeof(_memory[key]) == 'undefined') {
				_memory[key] = _defaults[key];
			}
		}
	};
	
	var _save = function()
	{
		if (_memory === null) {
			// Nothing to save!
			return;
		}
		
		localStorage['memory'] = JSON.stringify(_memory);
	};
	
	return {
		get: function(key)
		{
			_load();
			
			if (typeof(key) == 'undefined') {
				return _memory;
			}
			
			if (typeof(_memory[key]) == 'undefined') {
				return null;
			}
			
			return _memory[key];
		},
		set: function(key, value)
		{
			_load();
			_memory[key] = value;
			_save();
			
			return this;
		},
		clear: function(key)
		{
			if (typeof(key) == 'undefined' || key === null) {
				_memory = {};
				_save();
				return this;
			}
			
			_load();
			delete _memory[key];
			_save();
			
			return this;
		}
	};
})();
