
// TODO: Really have to go through this and comment.

var jmtyler = jmtyler || {};
jmtyler.version = (() => {
	const migrations = {
		'1557880371381 - 2.0.0 - Migrate from MSPA to Homestuck.com': async () => {
			await new Promise((resolve, reject) => {
				jmtyler.log(`[REQUEST] GET http://127.0.0.1/v1/stories`);
				const req = new XMLHttpRequest();
				// TODO: Debug mode should point to a separate Staging API (or even ngrok if I can manage it).
				// BLOCKER: Remember to point this to the production Heroku server before launch.
				req.open('GET', 'http://127.0.0.1/v1/stories', true);
				req.addEventListener('load', () => {
					jmtyler.log(`[REQUEST] ↳ Raw Payload:`, req.response);
					let stories = JSON.parse(req.response);
					jmtyler.log(`[REQUEST] ↳ Parsed Payload:`, stories);
					stories = stories.reduce((acc, { endpoint, story: title, arc: subtitle, page: pages }) => {
						acc[endpoint] = { endpoint, title, subtitle, pages, current: 0 };
						return acc;
					}, {});
					jmtyler.memory.set('stories', stories);
					jmtyler.memory.set('active', 'story');
					return resolve();
				});
				req.addEventListener('error',   (ev) => console.error('[REQUEST] ↳ Error:', ev, req));
				req.addEventListener('abort',   (ev) => console.error('[REQUEST] ↳ Abort:', ev, req));
				req.addEventListener('timeout', (ev) => console.error('[REQUEST] ↳ Timeout:', ev, req));
				req.send();
			});

			const lastPageRead = jmtyler.memory.get('last_page_read');
			const matches = lastPageRead ? lastPageRead.match(/^http:\/\/www\.mspaintadventures\.com\/?.*\?s=6&p=(\d+)/) : null;
			if (matches !== null) {
				const mspaPage = parseInt(matches[1], 10);
				const homestuckPage = mspaPage - 1900;

				const stories = jmtyler.memory.get('stories');
				stories['story'].current = homestuckPage;
				jmtyler.memory.set('stories', stories);
			}

			if (jmtyler.settings.get('toast_icon_uri') == '48.png') {
				jmtyler.settings.set('toast_icon_uri', 'icons/48.png');
			}

			jmtyler.memory.clear('http_last_modified');
			jmtyler.memory.clear('latest_update');
			jmtyler.memory.clear('last_page_read');
			jmtyler.settings.clear('check_frequency');
		},
	};

	const runFreshInstall = () => {
		return new Promise((resolve, reject) => {
			jmtyler.log(`[REQUEST] GET http://127.0.0.1/v1/stories`);
			const req = new XMLHttpRequest();
			// TODO: Debug mode should point to a separate Staging API (or even ngrok if I can manage it).
			// BLOCKER: Remember to point this to the production Heroku server before launch.
			req.open('GET', 'http://127.0.0.1/v1/stories', true);
			req.addEventListener('load', () => {
				jmtyler.log(`[REQUEST] ↳ Raw Payload:`, req.response);
				let stories = JSON.parse(req.response);
				jmtyler.log(`[REQUEST] ↳ Parsed Payload:`, stories);
				stories = stories.reduce((acc, { endpoint, story: title, arc: subtitle, page: pages }) => {
					acc[endpoint] = { endpoint, title, subtitle, pages, current: 0 };
					return acc;
				}, {});
				jmtyler.memory.set('stories', stories);
				jmtyler.memory.set('active', 'story');
				return resolve();
			});
			req.addEventListener('error',   (ev) => console.error('[REQUEST] ↳ Error:', ev, req));
			req.addEventListener('abort',   (ev) => console.error('[REQUEST] ↳ Abort:', ev, req));
			req.addEventListener('timeout', (ev) => console.error('[REQUEST] ↳ Timeout:', ev, req));
			req.send();
		});
	};

	const runMigrations = async () => {
		const finishedMigrations = jmtyler.memory.get('migrations') || [];
		const migrationsToRun = Object.keys(migrations).filter((id) => !finishedMigrations.includes(id)).sort();

		// TODO: This would be much easier if we just use bluebird.
		await migrationsToRun.reduce(async (flow, id) => {
			await flow;

			jmtyler.log('* migrating:', id, { settings: jmtyler.settings.get(), memory: jmtyler.memory.get() });

			await migrations[id]();
			finishedMigrations.push(id);
			jmtyler.memory.set('migrations', finishedMigrations);

			jmtyler.log('** finished:', id, { settings: jmtyler.settings.get(), memory: jmtyler.memory.get() });
		}, Promise.resolve());
	};

	return {
		isInstalled(version) {
			return jmtyler.memory.get('version') == version;
		},
		async install(version) {
			jmtyler.log('fresh install at', version);
			await runFreshInstall();
			jmtyler.memory.set('migrations', Object.keys(migrations));
		},
		async update(version) {
			jmtyler.log('updating extension to', version);
			await runMigrations();
		},
		migrate() {
			return new Promise((resolve, reject) => {
				const version = chrome.runtime.getManifest().version;
				jmtyler.log('checking if current version has been installed... ' + (this.isInstalled(version) ? 'yes' : 'no'));

				if (this.isInstalled(version)) {
					// Only run the main process immediately if the latest version has already been fully installed.
					jmtyler.log('current version is already installed, running Main() immediately');
					return resolve();
				}

				chrome.runtime.onInstalled.addListener(async ({ reason }) => {
					jmtyler.log('onInstalled triggered', { previous: jmtyler.memory.get('version'), current: version, reason });

					// If the latest version has already been fully installed, don't do anything. (Not sure how we got here, though.)
					if (this.isInstalled(version)) {
						jmtyler.log('new version has already been installed... aborting');
						return;
					}

					// Install the latest version, performing any necessary migrations.
					if (reason == 'install') {
						await this.install(version);
						jmtyler.memory.set('version', version);
					}

					if (reason == 'update') {
						await this.update(version);
						jmtyler.memory.set('version', version);
					}

					jmtyler.log('finished migration, running Main()');

					// Now that we've finished any migrations, we can run the main process.
					return resolve();
				});
			});
		},
	};
})();
