
/*	TODO:
	use jQuery Deferred objects for promises...
	var promise = (function() {
		var deferred = $.Deferred();
		setTimeout(function() {
			deferred.resolve({objects_processed: 3});
		}, 5000);
		return deferred.promise();
	})();
	promise.done(function(result) {
		console.log('objects processed: ' + result.objects_processed);
	});
*/

(function() {
	var checkInterval = null,
		intervalLength = null;
	
	var icons = {
		idle: 'mspa_face.gif',
		updates: 'whatpumpkin.gif'
	};

	var badgeColour = '#00AA00';
	if (jmtyler.settings.get('is_debug_mode')) {
		badgeColour = '#BB0000';
	}
	
	var _main = function()
	{
		jmtyler.log('executing _main()');
		
		intervalLength = jmtyler.settings.map('check_frequency').seconds * 1000;
		
		var lastPageRead    = jmtyler.memory.get('last_page_read'),
			latestUpdate    = jmtyler.memory.get('latest_update'),
			doShowPageCount = jmtyler.settings.get('show_page_count');
		
		if (lastPageRead == null) {
			lastPageRead = "https://www.homestuck.com/story/1";  // Default to the first page of Homestuck
			jmtyler.memory.set('last_page_read', lastPageRead);
		}
		
		// After startup, make sure the browser action still looks as it should with context.
		chrome.browserAction.setTitle({title: lastPageRead});
		chrome.browserAction.setIcon({path: icons.idle});
		if (lastPageRead == latestUpdate) {
			chrome.browserAction.setBadgeText({text: ''});
		} else if (latestUpdate !== false && doShowPageCount) {
			// TODO: Should probably start storing the unread pages count so we don't have to do this.
			var lastPageReadId = parseInt(lastPageRead.substr(lastPageRead.length - 6), 10);
			var latestUpdatePageId = parseInt(latestUpdate.substr(latestUpdate.length - 6), 10);
			var unreadPageCount = latestUpdatePageId - lastPageReadId;
			
			chrome.browserAction.setBadgeBackgroundColor({color: badgeColour});
			chrome.browserAction.setBadgeText({text: unreadPageCount.toString()});
		}
		
		chrome.browserAction.onClicked.addListener(_gotoMspa);
		
		chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
			switch (request.method) {
				case 'forceCheck':
					jmtyler.memory.clear('http_last_modified');
					jmtyler.memory.clear('latest_update');
					_checkForUpdates();
					break;
			}
		});
		
		chrome.contextMenus.create({
			title: "Mark as my Last Read page",
			documentUrlPatterns: ["https://www.homestuck.com/*"],
			contexts: ['page', 'frame', 'link', 'image', 'video', 'audio']  // Pretty much as long as it is on the MSPA website.
		});
		chrome.contextMenus.onClicked.addListener(function(info, tab) {
			var pageUrl = info.pageUrl;
			jmtyler.memory.set('last_page_read', pageUrl);
			chrome.browserAction.setTitle({title: pageUrl});
			
			var latestUpdate = jmtyler.memory.get('latest_update');
			if (latestUpdate !== false && doShowPageCount) {
				var lastPageReadId = parseInt(pageUrl.substr(pageUrl.length - 6), 10);
				var latestUpdatePageId = parseInt(latestUpdate.substr(latestUpdate.length - 6), 10);
				var unreadPageCount = latestUpdatePageId - lastPageReadId;
				
				chrome.browserAction.setBadgeBackgroundColor({color: badgeColour});
				chrome.browserAction.setBadgeText({text: unreadPageCount.toString()});
			}
			// Considered forcing a recheck after setting your new page, but decided there's no point.
			// Leaving this here in case I change my mind, but I'll probably remove it after a few commits.
			//jmtyler.memory.clear('http_last_modified');
			//jmtyler.memory.clear('latest_update');
			//_checkForUpdates();
		});
		
		chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
			if (typeof changeInfo.url == "undefined") {
				return;
			}
			
			var currentPageUrl = changeInfo.url;
			
			// This listener isn't triggered AFTER a regex filter like the context menu, so must do it ourselves.
			var currentPage = currentPageUrl.match(/^https:\/\/www\.homestuck\.com\/([a-z/-]+)($|\/([0-9]+))/);
			if (currentPage === null) {
				// This is not an MSPA comic page, so we don't care about it.
				return;
			}

			var savedPageUrl = jmtyler.memory.get('last_page_read');
			var savedPage = savedPageUrl.match(/^https:\/\/www\.homestuck\.com\/([a-z/-]+)($|\/([0-9]+))/);
			
			// Strip the page IDs off this page's URL and our saved page's URL, then compare them.
			var currentStory = currentPage[1];
			var currentPageId = parseInt(currentPage[3] || '1', 10);
			var savedStory = savedPage[1];
			var savedPageId = parseInt(savedPage[3] || '1', 10);
			if (currentStory === savedStory && currentPageId > savedPageId) {
				// This page is LATER than the last page we've read, so this is the new one!
				jmtyler.memory.set('last_page_read', currentPageUrl);
				chrome.browserAction.setTitle({title: currentPageUrl});
				chrome.browserAction.setIcon({path: icons.idle});
				
				var latestUpdate = jmtyler.memory.get('latest_update');
				if (latestUpdate !== false && doShowPageCount) {
					var latestUpdatePageId = parseInt(latestUpdate.substr(latestUpdate.length - 6), 10);
					var unreadPageCount = latestUpdatePageId - currentPageId;
					chrome.browserAction.setBadgeBackgroundColor({color: badgeColour});
					chrome.browserAction.setBadgeText({text: unreadPageCount.toString()});
				}
			}
		});
		
		// Make some key functions globally accessible for debug mode.
		if (jmtyler.settings.get('is_debug_mode')) {
			window.gotoMspa = function(){ _gotoMspa(); };
			window.checkForUpdates = function(){ _checkForUpdates(); };
			window.playSound = function(){ _playSound(); };
			window.clearData = function(){ _clearData(); };
			
			return;  // Don't want the interval running during debug mode.
		}
		
		// Kick it all off!
		checkInterval = setInterval(_checkForUpdates, intervalLength);
		_checkForUpdates();
	};
	
	/**
	 * Set button icon as idle, open a new tab with the last page read,
	 * and set the new 'last page read' as the latest update available.
	 */
	var _gotoMspa = function()
	{
		try {
			var latestUpdate = jmtyler.memory.get('latest_update'),
				lastPageRead = jmtyler.memory.get('last_page_read') || "https://www.homestuck.com";
			
			jmtyler.log('executing _gotoMspa()', latestUpdate, lastPageRead);
			
			chrome.tabs.create({url: lastPageRead});
		} catch (e) {
			jmtyler.log('failed to open new tab for MSPA', e);
		}
		
		return;
	};
	
	/**
	 * Queries the MSPA RSS feed.  Changes the button icon if there is an error
	 * or if there are new updates available.  If there are updates, adds a count
	 * onto the button.
	 */
	var _checkForUpdates = function()
	{
		jmtyler.log('executing _checkForUpdates()');
		
		var areNotificationsOn = jmtyler.settings.get('notifications_on'),
			doShowPageCount    = jmtyler.settings.get('show_page_count'),
			newIntervalLength  = jmtyler.settings.map('check_frequency').seconds * 1000;
		
		// Interval length setting has been changed, so set a new interval.
		// TODO: Changes to interval length should take effect immediately.
		if (newIntervalLength != intervalLength && !jmtyler.settings.get('is_debug_mode')) {
			intervalLength = newIntervalLength;
			if (checkInterval != null) {
				clearInterval(checkInterval);
			}
			checkInterval = setInterval(_checkForUpdates, intervalLength);
		}
		
		var lastPageRead = jmtyler.memory.get('last_page_read'),
			latestUpdate = jmtyler.memory.get('latest_update');
		
		// TODO: All the following XHR crap is incredibly grotesque... put some time into encapsulating & simplifying it.
		
		var feedUri = "http://mspaintadventures.com/rss/rss.xml",
			pingRequest = new XMLHttpRequest();
		
		pingRequest.onload = function()
		{
			var myLastModified    = jmtyler.memory.get('http_last_modified'),
				theirLastModified = pingRequest.getResponseHeader('Last-Modified');
			
			jmtyler.log('completed ping request', lastPageRead, latestUpdate, myLastModified, theirLastModified);
			
			if (myLastModified == theirLastModified) {
				// No updates.
				return;
			}
			
			jmtyler.memory.set('http_last_modified', theirLastModified);
			
			var contentRequest = new XMLHttpRequest();
			contentRequest.onload = function()
			{
				jmtyler.log('completed content request', contentRequest.responseXML);
				
				var xml = contentRequest.responseXML;
				if (!xml) {
					console.log('invalid rss feed received.');
					return;
				}
				
				var pages = xml.getElementsByTagName('item');
				var count = Math.min(pages.length, 40);
				var unreadPagesCount = 0;
				
				var item = pages.item(0);
				var guid = item.getElementsByTagName('guid')[0];
				var newLatestUpdate = guid ? guid.textContent : null;
				
				if (newLatestUpdate === null) {
					console.log('could not find guid on first rss item');
					return;
				}
				
				// No need to pop up the notification more than once for the same update!
				if (newLatestUpdate == latestUpdate) {
					return;
				}
				
				var lastPageReadId = parseInt(lastPageRead.substr(lastPageRead.length - 6), 10);
				var latestUpdatePageId = parseInt(newLatestUpdate.substr(newLatestUpdate.length - 6), 10);
				var unreadPagesCount = latestUpdatePageId - lastPageReadId;
				if (unreadPagesCount < 1) {
					chrome.browserAction.setIcon({path: icons.idle});
					chrome.browserAction.setBadgeText({text: ''});
					return;
				}
				
				var unreadPagesText = unreadPagesCount.toString();
				
				// Update button for new updates.
				if (latestUpdate !== false) {
					chrome.browserAction.setIcon({path: icons.updates});
				}
				if (doShowPageCount) {
					chrome.browserAction.setBadgeBackgroundColor({color: badgeColour});
					chrome.browserAction.setBadgeText({text: unreadPagesText});
				}
				jmtyler.memory.set('latest_update', newLatestUpdate);
				
				if (areNotificationsOn) {
					// Show notification for new updates.
					var toastIcon    = jmtyler.settings.get('toast_icon_uri'),
						toastTitle   = "New MSPA Update!",
						toastMessage = "Click here to start reading!" + (doShowPageCount ? ("\n" + unreadPagesText + " new pages") : "");
					
					_playSound();
					
					var notification = new Notification(toastTitle, {
						icon: toastIcon,
						body: toastMessage
					});
					notification.onclick = function()
					{
						this.close();
						_gotoMspa();
					};
					
					setTimeout(function() {
						notification.close();
					}, 10000);
				}
			};
			
			contentRequest.onerror = function()
			{
				// TODO: Seriously have to improve my error reporting.
				console.log('something went wrong, brotha.');
				return;
			};
			
			jmtyler.log('starting content request');
			
			contentRequest.open('GET', feedUri, true);
			contentRequest.setRequestHeader('Cache-Control', 'no-cache');
			contentRequest.send(null);
			
			return;
		};
		
		pingRequest.onerror = function()
		{
			console.log('something went wrong, brotha.');
			return;
		};
		
		jmtyler.log('starting ping request');
		
		pingRequest.open('HEAD', feedUri, true);
		pingRequest.setRequestHeader('Cache-Control', 'no-cache');
		pingRequest.send(null);
		
		return;
	};
	
	var _playSound = function()
	{
		var toastSoundUri = jmtyler.settings.get('toast_sound_uri');
		if (toastSoundUri == null) {
			return;
		}
		
		// Get the existing <audio /> element from the page, if one's already been created ...
		var audio = document.getElementsByTagName('audio');
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
	
	var _clearData = function()
	{
		jmtyler.settings.clear();
		jmtyler.memory.clear();
		chrome.browserAction.setIcon({path: icons.idle});
		chrome.browserAction.setBadgeText({text: ''});
	};
	
	var _currentVersion = chrome.runtime.getManifest().version;
	
	chrome.runtime.onInstalled.addListener(function(details) {
		jmtyler.log('executing onInstalled()', _currentVersion, details);
		if (_currentVersion == details.previousVersion) {
			jmtyler.log('  new version is same as old version... aborting');
			return;
		}
		
		// If the latest version has already been fully installed, don't do anything. (Not sure how we got here, though.)
		if (jmtyler.version.isInstalled(_currentVersion)) {
			jmtyler.log('  new version has already been installed... aborting');
			return;
		}
		
		// Install the latest version, performing any necessary migrations.
		if (details.reason == "install") {
			jmtyler.log('  extension is newly installed');
			jmtyler.version.install(_currentVersion);
		} else if (details.reason == "update" || details.reason == "chrome_update") {
			jmtyler.log('  extension is being updated');
			jmtyler.version.update(details.previousVersion, _currentVersion);
		} else {
			jmtyler.log('  extension is in some unhandled state... [' + details.reason + ']');
		}
		
		jmtyler.log('  done migration, ready to run _main()');
		
		// Now that we've finished any migrations, we can run the main process.
		_main();
	});
	
	jmtyler.log('checking if current version has been installed...' + (jmtyler.version.isInstalled(_currentVersion) ? 'yes' : 'no'));
	
	// Only run the main process immediately if the latest version has already been fully installed.
	if (jmtyler.version.isInstalled(_currentVersion)) {
		jmtyler.log('current version is installed, running _main() immediately');
		_main();
	}
})();
