
// TODO: Really have to go through this and comment... it's confusing as heck.  But it works!

const jmtyler = jmtyler || {};
jmtyler.version = (() => {
	const init = () => {
		addUpdate({
			from: '1.0.1',
			to:   '1.1.0',
			with: () => {
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
			},
		});

		addUpdate({
			from: '1.2.1',
			to:   '1.3.0',
			with: () => {
				jmtyler.memory.clear('is_gigapause_over');
			},
		});

		addUpdate({
			from: '1.4.2',
			to:   '2.0.0',
			with: () => {
				const lastPageRead = jmtyler.memory.get('last_page_read');
				const matches = lastPageRead ? lastPageRead.match(/^http:\/\/www\.mspaintadventures\.com\/?.*\?s=6&p=(\d+)/) : null;
				if (matches !== null) {
					const mspaPage = parseInt(matches[1], 10);
					const homestuckPage = mspaPage - 1900;

					jmtyler.memory.set('active', '/story');
					jmtyler.memory.set('stories', {
						'/story': {
							title:    'Homestuck',
							subtitle: null,
							pages:    8130,
							current:  homestuckPage,
						},
					});
				}

				jmtyler.memory.clear('latest_update');
				jmtyler.memory.clear('last_page_read');
				jmtyler.settings.clear('check_frequency');
			},
		});
	};

	const updates = {};
	const addUpdate = (details) => {
		updates[details.to] = {
			run: () => {
				jmtyler.log('      updating to version [' + details.to + ']', localStorage);

				details.with();
				jmtyler.memory.set('version', details.to);

				jmtyler.log('      finished updating', localStorage);
			},
			next: () => {
				return false;
			},
		};

		if (typeof updates[details.from] == 'undefined') {
			updates[details.from] = {
				run: () => {
					jmtyler.log('      no changes for version [' + details.from + ']');
					jmtyler.memory.set('version', details.from);
				},
			};
		}

		updates[details.from].next = () => {
			return updates[details.to];
		};
	};

	const getUpdate = (version) => {
		if (typeof updates[version] == 'undefined') {
			return false;
		}

		return updates[version];
	};

	init();

	return {
		install(version) {
			jmtyler.log('fresh install', version);
			jmtyler.memory.set('version', version);
		},
		update(fromVersion, toVersion) {
			jmtyler.log('    updating extension...', fromVersion, toVersion);

			let update = getUpdate(fromVersion);
			if (update) {
				while (update = update.next()) {
					update.run();
				}
			}
			jmtyler.memory.set('version', toVersion);

			jmtyler.log('    finished updating extension');
		},
		isInstalled(version) {
			if (jmtyler.memory.get('version') == version) {
				return true;
			}
			return false;
		},
	};
})();
