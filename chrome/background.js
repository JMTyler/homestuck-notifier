
const HomestuckURLRegex = /^https:\/\/www\.homestuck\.com(\/[a-z/-]+)($|\/([0-9]+))/;

const icons = {
	idle:   { '16': 'icons/16.png', '32': 'icons/32.png' },
	potato: { '16': 'icons/16.png', '32': 'icons/32.png' },
};

/* Main */

const Main = () => {
	jmtyler.log('executing Main()');

	chrome.browserAction.setBadgeBackgroundColor({ color: '#BB0000' });
	if (jmtyler.settings.get('is_debug_mode')) {
		Object.assign(icons, {
			idle:   { '16': 'icons/2B_16.png', '32': 'icons/2B_32.png' },
			potato: { '16': 'icons/2B_16.png', '32': 'icons/2B_32.png' },
		});
		chrome.browserAction.setBadgeBackgroundColor({ color: '#00AA00' });

		// Make some key functions globally accessible for debug mode.
		window.LaunchTab = () => LaunchTab();
		window.PlaySound = () => PlaySound();
		window.ClearData = () => ClearData();
	}

	// After startup, make sure the browser action still looks as it should with context.
	// TODO: Remember to handle first install, when we don't have any data yet.
	const story = GetActiveStory();
	RenderButton({ icon: 'idle', story, count: story.pages - story.current });

	chrome.contextMenus.create({
		id:       'jump_to',
		title:    'Jump to Story...',
		contexts: ['browser_action'],
	});

	// TODO: Reverse the order of these badbois.  Also have to update their titles whenever their current page changes.
	const stories = jmtyler.memory.get('stories');
	Object.keys(stories).forEach((key) => {
		const story = stories[key];
		const fullTitle = [story.title, story.subtitle].filter((v) => v).join(': ');
		chrome.contextMenus.create({
			parentId: 'jump_to',
			id:       `goto_${story.endpoint}`,
			title:    `${fullTitle} (pg. ${story.current})`,
			contexts: ['browser_action'],
		});
	});

	// chrome.contextMenus.create({
	// 	type:     'separator',
	// 	id:       'separator',
	// 	contexts: ['browser_action'],
	// });

	// TODO: Force this to match ONLY story pages, and remove/re-create the context menu when new stories appear.
	// TODO: Maybe call Sync after this, to make sure their initial value respects the initial tab state?
	chrome.contextMenus.create({
		id:                  'set_current',
		title:               'Save as My Current Page',
		documentUrlPatterns: ['https://www.homestuck.com/*'],
		contexts:            ['all'],
	});

	chrome.contextMenus.create({
		id:                  'set_active',
		title:               `Set "Problem Sleuth" as Default Story`,
		documentUrlPatterns: ['https://www.homestuck.com/*'],
		contexts:            ['all'],
	});

	chrome.contextMenus.create({
		type:     'separator',
		contexts: ['browser_action'],
	});

	chrome.contextMenus.create({
		id:       'toggle_page_counts',
		title:    `${jmtyler.settings.get('show_page_count') ? 'Hide' : 'Show'} Page Count`,
		contexts: ['browser_action'],
	});

	chrome.contextMenus.onClicked.addListener(OnMenuClick);
	chrome.tabs.onActivated.addListener(OnTabChange);
	chrome.tabs.onUpdated.addListener(OnPageLoad);
	chrome.browserAction.onClicked.addListener(() => LaunchTab());
	chrome.notifications.onClicked.addListener(OnNotificationClick);
	chrome.notifications.onButtonClicked.addListener(OnNotificationClick);
	// TODO: Probably just switch this out for an event emitter or something.
	chrome.runtime.onMessage.addListener(({ method, args = {} }) => (OnMessage[method] ? OnMessage[method](args) : OnMessage.Unknown()));

	// const vapidKey = 'BB0WW0ANGE7CquFTQC0n68DmkVrInd616DEi3pI5Yq8IKHv0v9qhvzkAInBjEw2zNfgx29JB2DAQkV_81ztYpTg';
	// chrome.gcm.register([ vapidKey ], (registrationId) => {
	// TODO: Debug mode should hook into a separate FCM account purely for testing.
	chrome.instanceID.getToken({ authorizedEntity: '710329635775', scope: 'GCM' }, (token) => {
		console.log('registered with gcm', token || chrome.runtime.lastError.message);

		// Upload token to server, subscribing to the FCM topic.
		const req = new XMLHttpRequest();
		req.addEventListener('load', (ev) => console.log('load event:', ev.target));
		req.addEventListener('error' /* abort, timeout */, (ev) => console.error('error event:', ev.target));
		// TODO: Debug mode should point to a separate Staging API (or even ngrok if I can manage it).
		// TODO: Remember to point this to the production Heroku server before launch.
		req.open('POST', 'http://127.0.0.1/subscribe', true);
		// req.send(JSON.stringify({ token }));

		// TODO: Now that we're using FCM, we should be able to switch to a nonpersistent background script, right?
		// TODO: For some features, we must specify a lowest supported Chrome version.  Will that allow us to use ES6 features too?
		// TODO: What happens if we were offline during a ping?  Does it arrive later?  Do we have to fetch explicitly?
		chrome.gcm.onMessage.addListener(({ data }) => {
			console.log('received gcm message', data);
			OnMessage.Potato(data);
		});
	});
};

/* Event Handlers */

const OnMessage = {
	Potato({ story: title, arc: subtitle, endpoint, page }) {
		let toastType = 'new_pages';
		// TODO: Probably don't want to distract the user if this potato isn't new *for them* (though it should be new for everyone now).
		const stories = jmtyler.memory.get('stories');
		if (!stories[endpoint]) {
			// TODO: brand new story/arc!
			toastType = 'new_story';  // TODO: Also need to differentiate between new_story and new_arc.
			stories[endpoint] = {
				endpoint,
				title,
				subtitle: subtitle || null,
				pages:    0,
				current:  0,
			};
		}

		const potatoSize = page - stories[endpoint].pages;
		stories[endpoint].pages = page;
		jmtyler.memory.set('stories', stories);

		// TODO: Shouldn't push the story into the button unless it's the user's active story.
		RenderButton({ icon: 'potato', story: stories[endpoint] });
		ShowToast(toastType, stories[endpoint], potatoSize);
	},
	OnSettingsChange() {
		TouchButton();
		chrome.contextMenus.update('toggle_page_counts', { title: `${jmtyler.settings.get('show_page_count') ? 'Hide' : 'Show'} Page Count` });
	},
	Unknown() {
		jmtyler.log('An unknown Runtime Message was received and therefore could not be processed.');
	},
};

const OnMenuClick = ({ menuItemId, ...info }) => {
	if (menuItemId == 'set_current') {
		return OnOverrideLastPageRead(info);
	}
	if (menuItemId == 'set_active') {
		const stories = jmtyler.memory.get('stories');
		Object.keys(stories).forEach((key) => {
			const story = stories[key];
			const urlMatcher = new RegExp(`^https://www.homestuck.com${story.endpoint}`);

			if (urlMatcher.test(info.pageUrl)) {
				// TODO: Update browser action title with new active story info.
				jmtyler.memory.set('active', story.endpoint);
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

const OnOverrideLastPageRead = ({ pageUrl }) => {
	// TODO: We should check which menu item was clicked.  We'll probably end up with more menu items soon.

	const urlParts = pageUrl.match(HomestuckURLRegex);
	const endpoint = urlParts[1];
	const page     = parseInt(urlParts[3] || '0', 10);

	const stories = jmtyler.memory.get('stories');
	if (!stories[endpoint]) {
		// TODO: Should maybe inform the user this is not a comic page.
		return;
	}

	MarkPage(endpoint, page);
};

const OnTabChange = ({ tabId }) => {
	chrome.tabs.get(tabId, ({ url }) => {
		SyncContextMenu(url);
	});
};

const OnPageLoad = (_tabId, { url: currentPageUrl }) => {
	if (!currentPageUrl) {
		console.log('no page url');
		return;
	}

	SyncContextMenu(currentPageUrl);

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
};

const OnNotificationClick = (id) => {
	chrome.notifications.clear(id);
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

		let url = `https://www.homestuck.com${story.endpoint}`;
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

	chrome.notifications.create({ type: 'basic', title, message, iconUrl, silent: false, requireInteraction: true, buttons: [{ title: 'Read Now' }] }, (id) => {
		// TODO: This doesn't seem to have an effect.  The toast is clearing itself automatically.
		// TODO: I think I'd actually like to keep the toast up persistently until they close it.
		// setTimeout(() => chrome.notifications.clear(id), 10000);
	});

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
		chrome.browserAction.setTitle({ title: chrome.runtime.getManifest().name + '\n' + status });
	}
};

const TouchButton = () => {
	const story = GetActiveStory();
	RenderButton({ story, count: story.pages - story.current });
};

const SyncContextMenu = (url) => {
	const activeStory = jmtyler.memory.get('active');
	const stories = jmtyler.memory.get('stories');

	console.log(`^https://www.homestuck.com(${Object.keys(stories).join('|')})`);
	const visible = new RegExp(`^https://www.homestuck.com(${Object.keys(stories).join('|')})`).test(url);
	chrome.contextMenus.update('set_current', { visible });

	if (!visible) {
		chrome.contextMenus.update('set_active', { visible });
	} else {
		Object.keys(stories).forEach((key) => {
			const story = stories[key];
			// TODO: Add urlMatcher to story object.  Make it easy to lookup/match story by URL.  Make it easy to convert a URL into its equivalent story object.
			const urlMatcher = new RegExp(`^https://www.homestuck.com${story.endpoint}`);

			if (urlMatcher.test(url)) {
				// TODO: Also check the page # against story.current to hide the other menu item as well.
				if (story.endpoint == activeStory) {
					chrome.contextMenus.update('set_active', { visible: false });
				} else {
					const fullTitle = [story.title, story.subtitle].filter((v) => v).join(': ');
					chrome.contextMenus.update('set_active', { visible, title: `Set "${fullTitle}" as Default Story` });
				}
			}
		});
	}
};

const ClearData = () => {
	jmtyler.settings.clear();
	jmtyler.memory.clear();
	RenderButton({ icon: 'idle', count: 0 });
};

jmtyler.version.migrate().then(() => Main());
