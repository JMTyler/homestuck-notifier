
// TODO: Really have to go through this and comment... it's confusing as heck.  But it works!

var jmtyler = jmtyler || {};
jmtyler.version = (function()
{
	var _init = function()
	{
		_addUpdate({
			from: '1.0.1',
			to:   '1.1.0',
			with: function() {
				if (typeof localStorage['check_frequency'] != 'undefined') {
					jmtyler.settings.set('check_frequency', JSON.parse(localStorage['check_frequency']));
					delete localStorage['check_frequency'];
				}

				if (typeof localStorage['notifications_on'] != 'undefined') {
					jmtyler.settings.set('notifications_on', JSON.parse(localStorage['notifications_on']));
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

		_addUpdate({
			from: '1.2.1',
			to:   '1.3.0',
			with: function() {
				jmtyler.memory.clear('is_gigapause_over');
			}
		});

		_addUpdate({
			from: '1.4.2',
			to:   '1.5.0',
			with: function() {
				// TODO: Delete `check_frequency` setting.
				var lastPageRead = jmtyler.memory.get('last_page_read');
				var matches = lastPageRead.match(/^http:\/\/www\.mspaintadventures\.com\/?.*\?s=6&p=(\d+)/);
				if (matches === null) {
					return;
				}

				var mspaPageId = parseInt(matches[1], 10);
				var homestuckPageId = mspaPageId - 1900;
				jmtyler.memory.set('last_page_read', 'https://www.homestuck.com/story/' + homestuckPageId);
			}
		});

		return;
	};

	var _updates = {};
	var _addUpdate = function(details)
	{
		_updates[details.to] = {
			run: function() {
				jmtyler.log('      updating to version [' + details.to + ']', localStorage);

				details.with();
				jmtyler.memory.set('version', details.to);

				jmtyler.log('      finished updating', localStorage);
			},
			next: function() {
				return false;
			}
		};

		if (typeof _updates[details.from] == 'undefined') {
			_updates[details.from] = {
				run: function() {
					jmtyler.log('      no changes for version [' + details.from + ']');
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
			jmtyler.log('fresh install', version);
			jmtyler.memory.set('version', version);
		},
		update: function(fromVersion, toVersion)
		{
			jmtyler.log('    updating extension...', fromVersion, toVersion);

			var update = _getUpdate(fromVersion);
			if (update) {
				while (update = update.next()) {
					update.run();
				}
			}
			jmtyler.memory.set('version', toVersion);

			jmtyler.log('    finished updating extension');
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
