
// TODO: Really have to go through this and comment... it's confusing as heck.  But it works!

window.jmtyler = window.jmtyler || {};
window.jmtyler.version = (function()
{
	var _init = function()
	{
		_addUpdate({
			from: '1.0.1',
			to:   '1.1.0',
			with: function() {
				if (typeof localStorage['check_frequency'] != 'undefined') {
					jmtyler.settings.set('check_frequency', localStorage['check_frequency']);
					delete localStorage['check_frequency'];
				}
				
				if (typeof localStorage['notifications_on'] != 'undefined') {
					jmtyler.settings.set('notifications_on', localStorage['notifications_on']);
					delete localStorage['notifications_on'];
				}
				
				if (typeof localStorage['last_page_read'] != 'undefined') {
					jmtyler.memory.set('last_page_read', localStorage['last_page_read']);
					delete localStorage['last_page_read'];
				}
				
				if (typeof localStorage['latest_update'] != 'undefined') {
					jmtyler.memory.set('latest_update', localStorage['latest_update']);
					delete localStorage['latest_update'];
				}
			}
		});
		
		return;
	};
	
	var _updates = {};
	var _addUpdate = function(details)
	{
		_updates[details.to] = {
			run: function() {
				details.with();
				jmtyler.memory.set('version', details.to);
			},
			next: function() {
				return false;
			}
		};
		
		if (typeof _updates[details.from] == 'undefined') {
			_updates[details.from] = {
				run: function() {
					jmtyler.memory.set('version', details.from);
				}
			};
		}
		
		_updates[details.from].next = function() {
			return _updates[details.to];
		};
	};
	var _getUpdate = function(version)
	{
		if (typeof _updates[version] == 'undefined') {
			return false;
		}
		
		return _updates[version];
	};
	
	_init();
	
	return {
		install: function(version)
		{
		},
		update: function(fromVersion)
		{
			var update = _getUpdate(fromVersion);
			
			while (update = update.next()) {
				update.run();
			}
		},
		isInstalled: function(version)
		{
			if (jmtyler.memory.get('version') == version) {
				return true;
			}
			
			return false;
		}
	};
})();
