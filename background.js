
const HomestuckURLRegex = /^https:\/\/www\.homestuck\.com\/([a-z/-]+)($|\/([0-9]+))/;

let icons = {
	idle:   { '16': 'icons/16.png', '32': 'icons/32.png' },
	potato: { '16': 'icons/16.png', '32': 'icons/32.png' },
};

/* Main */

const Main = async () => {
	jmtyler.log('executing Main()');

	chrome.browserAction.setBadgeBackgroundColor({ color: '#BB0000' });
	if (await jmtyler.storage.get('isDebugMode')) {
		icons = {
			idle:   { '16': 'icons/2B_16.png', '32': 'icons/2B_32.png' },
			potato: { '16': 'icons/2B_16.png', '32': 'icons/2B_32.png' },
		};
		chrome.browserAction.setBadgeBackgroundColor({ color: '#00AA00' });

		// Make some key functions globally accessible for debug mode.
		window.LaunchTab = () => LaunchTab();
		window.PlaySound = () => PlaySound();
		window.ClearData = () => ClearData();
	}

	// After startup, make sure the browser action still looks as it should with context.
	const story = await GetActiveStory();
	await RenderButton({ icon: 'idle', story, count: (story.target || story.pages) - story.current });

	await InitializeContextMenus();
	RenderContextMenus();

	// TODO: Apparently listeners must be registered synchronously, before we can convert this background script to an event script.
	chrome.contextMenus.onClicked.addListener(OnMenuClick);
	// TODO: If an extension is listening for the tabs.onUpdated event, try using the webNavigation.onCompleted event with filters instead, as the tabs API does not support filters.
	chrome.tabs.onActivated.addListener(OnTabChange);
	chrome.tabs.onUpdated.addListener(OnPageLoad);
	chrome.browserAction.onClicked.addListener(() => LaunchTab());
	chrome.notifications.onClicked.addListener(OnNotificationClick);
	chrome.notifications.onButtonClicked.addListener(OnNotificationClick);
	// TODO: Probably just switch this out for an event emitter or something.
	chrome.runtime.onMessage.addListener(({ method, args = {} }) => (OnMessage[method] ? OnMessage[method](args) : OnMessage.Unknown(method, args)));

	Subscribe('Stories');
	Subscribe('RC_' + await jmtyler.storage.get('readingClub'));

	// TODO: Now that we're using FCM, we should be able to switch to a nonpersistent background script, right?
	chrome.gcm.onMessage.addListener(({ data: { event, ...args } }) => {
		jmtyler.log('received gcm message', event, args);
		if (OnMessage[event]) {
			return OnMessage[event](args);
		}
		return OnMessage.Unknown(event, args);
	});
};

/* Event Handlers */

const OnMessage = {
	async Potato({ endpoint, title, subtitle, pages }) {
		pages = parseInt(pages, 10);

		let toastType = 'new_pages';
		let story = await GetStory(endpoint);
		if (!story) {
			toastType = 'new_story';
			story = {
				endpoint,
				title,
				subtitle,
				pages:   0,
				current: 0,
			};

			const endpoints = await jmtyler.storage.get('stories');
			for (const key of endpoints) {
				const existing = await GetStory(key);
				// HACK: We really should have a more explicit record of known stories vs. arcs.
				if (existing.title == title) {
					toastType = 'new_arc';
					break;
				}
			}
		}

		const potatoSize = pages - story.pages;
		story.pages = pages;
		await jmtyler.storage.set(`stories.${endpoint}`, story);

		await RenderButton({ icon: 'potato' });
		await TouchButton();
		RenderContextMenus();

		await ShowToast(toastType, stories[endpoint], potatoSize);
	},
	async SyncStory(latest) {
		latest.pages = parseInt(latest.pages, 10);
		const story = await GetStory(latest.endpoint);
		Object.assign(story, latest);
		await jmtyler.storage.set(`stories.${latest.endpoint}`, story);

		RenderContextMenus();
		await TouchButton();
	},
	async SetReadingTarget({ endpoint, target }) {
		jmtyler.log('updating page target to', target);

		const story = await GetStory(endpoint);
		story.target = target;
		await jmtyler.storage.set(`stories.${endpoint}`, story);
		await TouchButton();
	},
	async OnSettingsChange({ previous }) {
		const data = await jmtyler.storage.get();

		chrome.contextMenus.update('toggle_page_counts', { checked: data['showPageCount'] });

		if (data['readingClub'] != previous['readingClub']) {
			Unsubscribe('RC_' + previous['readingClub']);
			Subscribe('RC_' + data['readingClub']);

			const endpoints = await jmtyler.storage.get('stories');
			const stories = await jmtyler.storage.get(endpoints.map((key) => `stories.${key}`));
			Object.keys(stories).forEach((key) => {
				stories[key].target = null;
			});
			await jmtyler.storage.set(stories);
		}

		await TouchButton();
	},
	Unknown(method, args) {
		jmtyler.log('An unknown Runtime Message was received and therefore could not be processed:', method, args);
	},
};

const OnMenuClick = async ({ menuItemId, pageUrl }) => {
	if (!pageUrl) {
		// HACK: `pageUrl` doesn't exist if they click the menu via the browser action. FML.
		await new Promise((resolve) => {
			// This is how chrome.tabs.getCurrent() _should_ work, but apparently I have to do it myself.
			chrome.tabs.query({ active: true, currentWindow: true }, ([{ url }]) => {
				// TODO: Prooobably shouldn't assume this will find a tab in 100% of cases.
				pageUrl = url;
				return resolve();
			});
		});
	}

	if (menuItemId == 'set_current_page') {
		return OnOverrideLastPageRead(pageUrl);
	}
	if (menuItemId == 'set_active_story') {
		const endpoints = await jmtyler.storage.get('stories');
		for (const endpoint of endpoints) {
			const urlMatcher = new RegExp(`^https://www.homestuck.com/${endpoint}`);

			if (urlMatcher.test(pageUrl)) {
				await jmtyler.storage.set('active', endpoint);
				RenderContextMenus(pageUrl);
				await TouchButton();
				break;
			}
		}
		return;
	}
	if (menuItemId == 'toggle_page_counts') {
		const previous = await jmtyler.storage.get();
		await jmtyler.storage.set('showPageCount', !previous['showPageCount']);
		OnMessage.OnSettingsChange({ previous });
	}
	if (menuItemId.startsWith('goto_')) {
		const endpoint = menuItemId.substr(5);
		return await LaunchTab(endpoint);
	}
	// TODO unknown menu item
};

const OnOverrideLastPageRead = async (pageUrl) => {
	const urlParts = pageUrl.match(HomestuckURLRegex);
	const endpoint = urlParts[1];
	const page     = parseInt(urlParts[3] || '0', 10);

	const story = await GetStory(endpoint);
	if (!story) {
		// TODO: Should maybe inform the user this is not a comic page.
		return;
	}

	await MarkPage(endpoint, page);
	RenderContextMenus(pageUrl);
};

const OnTabChange = ({ tabId }) => {
	chrome.tabs.get(tabId, ({ url }) => {
		RenderContextMenus(url);
	});
};

const OnPageLoad = async (_tabId, { url: currentPageUrl }) => {
	if (!currentPageUrl) {
		return;
	}

	// This listener isn't triggered AFTER a regex filter like the context menu, so we must validate it ourselves.
	const urlParts = currentPageUrl.match(HomestuckURLRegex);
	if (!urlParts) {
		// This is not a Homestuck page, so we don't care about it.
		return;
	}

	const currentEndpoint = urlParts[1];
	const currentPage     = parseInt(urlParts[3] || '0', 10);

	const story = await GetStory(currentEndpoint);
	if (!story) {
		// This page IS on Homestuck.com, but is NOT a comic page.
		return;
	}

	if (currentPage > story.current) {
		await MarkPage(currentEndpoint, currentPage);
	}

	RenderContextMenus(currentPageUrl);
};

const OnNotificationClick = async (id) => {
	chrome.notifications.clear(id);
	// TODO: Should probably launch whatever story they just clicked.
	await LaunchTab();
};

/**
 * Set button icon as idle, open a new tab with the last page read,
 * and set the new 'last page read' as the latest update available.
 */
const LaunchTab = async (endpoint = null) => {
	try {
		const story = endpoint ? await GetStory(endpoint) : await GetActiveStory();
		jmtyler.log('executing LaunchTab()', story.endpoint);

		let url = `https://www.homestuck.com/${story.endpoint}`;
		if (story.current) {
			url += `/${story.current}`;
		}
		chrome.tabs.create({ url });
	} catch (e) {
		jmtyler.log('failed to open new tab', e);
	}
};

/* Core Functions */

const MarkPage = async (endpoint, page) => {
	const story = await GetStory(endpoint);
	story.current = page;
	await jmtyler.storage.set(`stories.${endpoint}`, story);

	const story = await GetActiveStory();
	const count = (story.target || story.pages) - story.current;
	await RenderButton({ icon: 'idle', count, story });
};

const PlaySound = async () => {
	const toastSoundUri = await jmtyler.storage.get('toastSoundUri');
	if (!toastSoundUri) {
		return;
	}

	// TODO: This MIGHT not work anymore once we switch to a nonpersistent background script...
	// Get the existing <audio /> element from the page, if one's already been created ...
	let audio = document.getElementsByTagName('audio');
	if (audio.length > 0) {
		audio = audio[0];
	} else {
		// ... if not, create it.
		audio = document.createElement('audio');
		document.body.appendChild(audio);
		audio.autoplay = true;
		audio.controls = false;
		audio.volume = 1.0;
	}

	// Bam.  Audio automatically plays when you set the 'src' property, apparently.
	audio.src = toastSoundUri;
};

const ShowToast = async (type, story, count) => {
	if (!await jmtyler.storage.get('notificationsOn')) {
		return;
	}

	const fullTitle = [story.title, story.subtitle].filter((v) => v).join(': ');

	const iconUrl = await jmtyler.storage.get('toastIconUri');
	const title   = 'Homestuck.com';
	let message = ({
		'new_story': `There's a brand new story: ${story.title}`,
		'new_arc':   `${story.title} posted a new story: ${story.subtitle}`,
		'new_pages': `There's been an update to ${fullTitle}!!!`,
	})[type];

	if (await jmtyler.storage.get('showPageCount')) {
		message += `\n(There are ${count} new pages.)`;
	}

	chrome.notifications.create({ type: 'basic', title, message, iconUrl, silent: false, requireInteraction: true, buttons: [{ title: 'Read Now' }] });

	PlaySound();
};

/* Helpers */

const GetStory = async (endpoint) => {
	return await jmtyler.storage.get(`stories.${endpoint}`);
};

const GetActiveStory = async () => {
	const endpoint = await jmtyler.storage.get('active');
	return await GetStory(endpoint);
};

const RenderButton = async ({ icon: iconKey, count, story }) => {
	if (iconKey) {
		chrome.browserAction.setIcon({ path: icons[iconKey] });
	}

	if (!await jmtyler.storage.get('showPageCount')) {
		chrome.browserAction.setBadgeText({ text: '' });
	} else if (typeof count != 'undefined') {
		chrome.browserAction.setBadgeText({ text: (count > 0 ? count.toString() : '') });
	}

	if (story) {
		const fullTitle = [story.title, story.subtitle].filter((v) => v).join(' - ');
		const status = `Currently reading: ${fullTitle}\nOn Page #${story.current}`;
		// chrome.browserAction.setTitle({ title: chrome.runtime.getManifest().name + '\n\n' + status });
		chrome.browserAction.setTitle({ title: status });
	}
};

const TouchButton = async () => {
	const story = await GetActiveStory();
	await RenderButton({ story, count: (story.target || story.pages) - story.current });
};

const RenderContextMenus = (url) => {
	const endpoints = await jmtyler.storage.get('stories');

	// HACK: It's super inefficient to do this so often, but we need to release ASAP and we can clean it up later.
	endpoints.reverse().forEach(async (key) => {
		const story = await GetStory(key);
		const fullTitle = [story.title, story.subtitle].filter((v) => v).join(': ');
		chrome.contextMenus.remove(`goto_${story.endpoint}`, () => {
			// TODO: There will be console errors here since we're not checking runtime.lastError.
			chrome.contextMenus.create({
				parentId: 'jump_to',
				id:       `goto_${story.endpoint}`,
				title:    `${fullTitle} (pg. ${story.current})`,
				contexts: ['browser_action'],
			});
		});
	});

	// HACK: Same as above; need to do this less often.
	// Refresh the allowable URLs in case we've discovered any new stories.
	chrome.contextMenus.update('set_active_story', { documentUrlPatterns: endpoints.map((endpoint) => `https://www.homestuck.com/${endpoint}/*`) });
	chrome.contextMenus.update('set_current_page', { documentUrlPatterns: endpoints.map((endpoint) => `https://www.homestuck.com/${endpoint}/*`) });

	if (!url) {
		return;
	}

	// TODO: Could use this same regex to pull out the matching endpoint, instead of looping through stories below.
	const isStoryPage = new RegExp(`^https://www.homestuck.com/(${endpoints.join('|')})`).test(url);
	if (!isStoryPage) {
		// HACK: Annoyingly, despite including this regex in the context menu's documentUrlPatterns, it still renders on the browser action.
		chrome.contextMenus.update('set_active_story', { visible: false });
		chrome.contextMenus.update('set_current_page', { visible: false });
		return;
	}

	const activeStory = await jmtyler.storage.get('active');
	endpoints.forEach(async (key) => {
		const story = await GetStory(key);
		// TODO: Add urlMatcher to story object.  Make it easy to lookup/match story by URL.  Make it easy to convert a URL into its equivalent story object.
		const urlMatcher = new RegExp(`^https://www.homestuck.com/${story.endpoint}`);

		if (urlMatcher.test(url)) {
			if (story.endpoint == activeStory) {
				chrome.contextMenus.update('set_active_story', { visible: false });
			} else {
				const fullTitle = [story.title, story.subtitle].filter((v) => v).join(': ');
				chrome.contextMenus.update('set_active_story', { visible: true, title: `Set "${fullTitle}" as Default Story` });
			}

			let { groups: { page } } = url.match(/^https:\/\/www.homestuck.com[^\d]*(?<page>\d*)$/);
			page = parseInt(page || "0", 10);
			if (story.current == page) {
				chrome.contextMenus.update('set_current_page', { visible: false });
			} else {
				chrome.contextMenus.update('set_current_page', { visible: true });
			}
		}
	});
};

const InitializeContextMenus = async () => {
	chrome.contextMenus.create({
		id:       'jump_to',
		title:    'Jump to Story...',
		contexts: ['browser_action'],
	});

	const endpoints = await jmtyler.storage.get('stories');
	endpoints.reverse().forEach(async (key) => {
		const story = await GetStory(key);
		const fullTitle = [story.title, story.subtitle].filter((v) => v).join(': ');
		chrome.contextMenus.create({
			parentId: 'jump_to',
			id:       `goto_${story.endpoint}`,
			title:    `${fullTitle} (pg. ${story.current})`,
			contexts: ['browser_action'],
		});
	});

	chrome.contextMenus.create({
		type:     'separator',
		contexts: ['browser_action'],
	});

	chrome.contextMenus.create({
		id:                  'set_current_page',
		title:               'Save as My Current Page',
		documentUrlPatterns: endpoints.map((endpoint) => `https://www.homestuck.com/${endpoint}/*`),
		contexts:            ['all', ],
		visible:             false,
	});

	chrome.contextMenus.create({
		id:                  'set_active_story',
		title:               'Set "???" as Default Story',
		documentUrlPatterns: endpoints.map((endpoint) => `https://www.homestuck.com/${endpoint}/*`),
		contexts:            ['all'],
		visible:             false,
	});

	chrome.contextMenus.create({
		type:     'checkbox',
		checked:  await jmtyler.storage.get('showPageCount'),
		id:       'toggle_page_counts',
		title:    'Show Page Count',
		contexts: ['browser_action'],
	});
};

const Subscribe = (topic, retries = 20) => {
	// HACK: Definitely need a cleaner systemic way to handle an empty reading club. Maybe post- React refactor?
	if (!topic || topic == 'RC_') {
		return;
	}

	if (retries == 0) {
		jmtyler.log('failed to register with gcm (FOR THE LAST TIME!):', chrome.runtime.lastError.message);
		return;
	}

	// TODO: Debug mode should hook into a separate FCM account purely for testing.
	chrome.instanceID.getToken({ authorizedEntity: '710329635775', scope: 'GCM' }, (token) => {
		if (!token) {
			jmtyler.log('failed to register with gcm (retrying):', chrome.runtime.lastError.message);
			return Subscribe(topic, --retries);
		}
		jmtyler.request('POST', 'subscribe', { topic, token });
	});
};

const Unsubscribe = (topic, retries = 20) => {
	if (!topic || topic == 'RC_') {
		return;
	}

	if (retries == 0) {
		jmtyler.log('failed to register with gcm (FOR THE LAST TIME!):', chrome.runtime.lastError.message);
		return;
	}

	chrome.instanceID.getToken({ authorizedEntity: '710329635775', scope: 'GCM' }, (token) => {
		if (!token) {
			jmtyler.log('failed to register with gcm (retrying):', chrome.runtime.lastError.message);
			return Unsubscribe(topic, --retries);
		}
		jmtyler.request('POST', 'unsubscribe', { topic, token });
	});
};

const ClearData = async () => {
	await jmtyler.storage.clear();
	await RenderButton({ icon: 'idle', count: 0 });
};

jmtyler.version.migrate().then(() => Main()).catch((err) => {
	console.error(err);
	chrome.browserAction.setBadgeText({ text: '!' });
	chrome.browserAction.setTitle({ title: 'Error! Please report a bug via the Chrome Webstore!' });
});
