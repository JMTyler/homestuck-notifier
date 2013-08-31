window.jmtyler = window.jmtyler || {};
window.jmtyler.memory = (function()
{
	var _memory = null;
	
	var _defaults = {
		'latest_update': false
	};
	
	return {
		get: function(key)
		{
			if (_memory === null) {
				this.load();
			}
			
			if (typeof(_memory[key]) == 'undefined') {
				return null;
			}
			
			return _memory[key];
		},
		set: function(key, value)
		{
			if (_memory === null) {
				this.load();
			}
			
			_memory[key] = value;
			localStorage['memory'] = JSON.stringify(_memory);
			
			return this;
		},
		load: function()
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
			
			return this;
		},
		clear: function(key)
		{
			if (typeof(key) == 'undefined' || key === null) {
				_memory = {};
				localStorage['memory'] = JSON.stringify(_memory);
				return this;
			}
			
			if (_memory === null) {
				this.load();
			}
			
			delete _memory[key];
			
			return this;
		}
	};
})();
