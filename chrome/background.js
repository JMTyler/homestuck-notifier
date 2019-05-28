
const HomestuckURLRegex = /^https:\/\/www\.homestuck\.com\/([a-z/-]+)($|\/([0-9]+))/;

let icons = {
	idle:   { '16': 'icons/16.png', '32': 'icons/32.png' },
	potato: { '16': 'icons/16.png', '32': 'icons/32.png' },
};

/* Main */

const Main = () => {
	jmtyler.log('executing Main()');

	chrome.browserAction.setBadgeBackgroundColor({ color: '#BB0000' });
	if (jmtyler.settings.get('is_debug_mode')) {
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
	const story = GetActiveStory();
	RenderButton({ icon: 'idle', story, count: story.pages - story.current });

	InitializeContextMenus();
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

	// const vapidKey = 'BB0WW0ANGE7CquFTQC0n68DmkVrInd616DEi3pI5Yq8IKHv0v9qhvzkAInBjEw2zNfgx29JB2DAQkV_81ztYpTg';
	// chrome.gcm.register([ vapidKey ], (registrationId) => {
	// TODO: Debug mode should hook into a separate FCM account purely for testing.
	chrome.instanceID.getToken({ authorizedEntity: '710329635775', scope: 'GCM' }, (token) => {
		jmtyler.log('registered with gcm', token || chrome.runtime.lastError.message);

		// Subscribe our new token to FCM.
		jmtyler.request('POST', 'subscribe', { token });
	});

	// TODO: Now that we're using FCM, we should be able to switch to a nonpersistent background script, right?
	// BLOCKER: What happens if we were offline during a ping?  Does it arrive later?  Do we have to fetch explicitly?
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
	Potato({ endpoint, title, subtitle, pages }) {
		pages = parseInt(pages, 10);
		let toastType = 'new_pages';
		const stories = jmtyler.memory.get('stories');
		if (!stories[endpoint]) {
			stories[endpoint] = {
				endpoint,
				title,
				subtitle,
				pages:   0,
				current: 0,
			};

			toastType = 'new_story';
			for (const key in stories) {
				// HACK: We really should have a more explicit record of known stories vs. arcs.
				if (stories[key].title == title) {
					toastType = 'new_arc';
					break;
				}
			}
		}

		const potatoSize = pages - stories[endpoint].pages;
		stories[endpoint].pages = pages;
		jmtyler.memory.set('stories', stories);

		RenderButton({ icon: 'potato' });
		TouchButton();
		RenderContextMenus();

		ShowToast(toastType, stories[endpoint], potatoSize);
	},
	SyncStory(story) {
		story.pages = parseInt(story.pages, 10);
		const stories = jmtyler.memory.get('stories');
		Object.assign(stories[story.endpoint], story);
		jmtyler.memory.set('stories', stories);
		RenderContextMenus();
		TouchButton();
	},
	OnSettingsChange() {
		TouchButton();
		chrome.contextMenus.update('toggle_page_counts', { checked: jmtyler.settings.get('show_page_count') });
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
		const stories = jmtyler.memory.get('stories');
		Object.keys(stories).forEach((key) => {
			const story = stories[key];
			const urlMatcher = new RegExp(`^https://www.homestuck.com/${story.endpoint}`);

			if (urlMatcher.test(pageUrl)) {
				jmtyler.memory.set('active', story.endpoint);
				RenderContextMenus(pageUrl);
				TouchButton();
			}
		});
		return;
	}
	if (menuItemId == 'toggle_page_counts') {
		jmtyler.settings.set('show_page_count', !jmtyler.settings.get('show_page_count'));
		OnMessage.OnSettingsChange();
	}
	if (menuItemId.startsWith('goto_')) {
		const endpoint = menuItemId.substr(5);
		return LaunchTab(endpoint);
	}
	// TODO unknown menu item
};

const OnOverrideLastPageRead = (pageUrl) => {
	const urlParts = pageUrl.match(HomestuckURLRegex);
	const endpoint = urlParts[1];
	const page     = parseInt(urlParts[3] || '0', 10);

	const stories = jmtyler.memory.get('stories');
	if (!stories[endpoint]) {
		// TODO: Should maybe inform the user this is not a comic page.
		return;
	}

	MarkPage(endpoint, page);
	RenderContextMenus(pageUrl);
};

const OnTabChange = ({ tabId }) => {
	chrome.tabs.get(tabId, ({ url }) => {
		RenderContextMenus(url);
	});
};

const OnPageLoad = (_tabId, { url: currentPageUrl }) => {
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

	const stories = jmtyler.memory.get('stories');
	const story = stories[currentEndpoint];
	if (!story) {
		// This page IS on Homestuck.com, but is NOT a comic page.
		return;
	}

	if (currentPage > story.current) {
		MarkPage(currentEndpoint, currentPage);
	}

	RenderContextMenus(currentPageUrl);
};

const OnNotificationClick = (id) => {
	chrome.notifications.clear(id);
	// TODO: Should probably launch whatever story they just clicked.
	LaunchTab();
};

/**
 * Set button icon as idle, open a new tab with the last page read,
 * and set the new 'last page read' as the latest update available.
 */
const LaunchTab = (endpoint = null) => {
	try {
		const story = endpoint ? GetStory(endpoint) : GetActiveStory();
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

const MarkPage = (endpoint, page) => {
	const stories = jmtyler.memory.get('stories');
	stories[endpoint].current = page;
	jmtyler.memory.set('stories', stories);

	const story = GetActiveStory();
	const count = story.pages - story.current;
	RenderButton({ icon: 'idle', count, story });
};

const PlaySound = () => {
	const toastSoundUri = jmtyler.settings.get('toast_sound_uri');
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

const ShowToast = (type, story, count) => {
	if (!jmtyler.settings.get('notifications_on')) {
		return;
	}

	const fullTitle = [story.title, story.subtitle].filter((v) => v).join(': ');

	const iconUrl = jmtyler.settings.get('toast_icon_uri');
	const title   = 'Homestuck.com';
	let message = ({
		'new_story': `There's a brand new story: ${story.title}`,
		'new_arc':   `${story.title} posted a new story: ${story.subtitle}`,
		'new_pages': `There's been an update to ${fullTitle}!!!`,
	})[type];

	if (jmtyler.settings.get('show_page_count')) {
		message += `\n(There are ${count} new pages.)`;
	}

	chrome.notifications.create({ type: 'basic', title, message, iconUrl, silent: false, requireInteraction: true, buttons: [{ title: 'Read Now' }] });

	PlaySound();
};

/* Helpers */

const GetStory = (endpoint) => {
	const stories = jmtyler.memory.get('stories');
	return stories[endpoint];
};

const GetActiveStory = () => {
	const endpoint = jmtyler.memory.get('active');
	return GetStory(endpoint);
};

const RenderButton = ({ icon: iconKey, count, story }) => {
	if (iconKey) {
		chrome.browserAction.setIcon({ path: icons[iconKey] });
	}

	if (!jmtyler.settings.get('show_page_count')) {
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

const TouchButton = () => {
	const story = GetActiveStory();
	RenderButton({ story, count: story.pages - story.current });
};

const RenderContextMenus = (url) => {
	const stories = jmtyler.memory.get('stories');
	const endpoints = Object.keys(stories);

	// HACK: It's super inefficient to do this so often, but we need to release ASAP and we can clean it up later.
	endpoints.reverse().forEach((key) => {
		const story = stories[key];
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

	const activeStory = jmtyler.memory.get('active');
	endpoints.forEach((key) => {
		const story = stories[key];
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

const InitializeContextMenus = () => {
	chrome.contextMenus.create({
		id:       'jump_to',
		title:    'Jump to Story...',
		contexts: ['browser_action'],
	});

	const stories = jmtyler.memory.get('stories');
	const endpoints = Object.keys(stories);
	endpoints.reverse().forEach((key) => {
		const story = stories[key];
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
		checked:  jmtyler.settings.get('show_page_count'),
		id:       'toggle_page_counts',
		title:    'Show Page Count',
		contexts: ['browser_action'],
	});
};

const ClearData = () => {
	jmtyler.settings.clear();
	jmtyler.memory.clear();
	RenderButton({ icon: 'idle', count: 0 });
};

jmtyler.version.migrate().then(() => Main());
