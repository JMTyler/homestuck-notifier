
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
	var isDebugMode = false,
		checkInterval = null,
		intervalLength = null;  // defaults to 5 minutes
	
	var icons = {
		idle: 'mspa_face.gif',
		error: 'mspa_reader.gif',
		updates: 'whatpumpkin.gif'
	};
	
	
	intervalLength = jmtyler.settings.map('check_frequency').seconds * 1000;
	
	/**
	 * Set button icon as idle, open a new tab with the last page read,
	 * and set the new 'last page read' as the latest update available.
	 */
	var _gotoMspa = function()
	{
		var latestUpdate = jmtyler.memory.get('latest_update'),
			lastPageRead = jmtyler.memory.get('last_page_read') || "http://mspaintadventures.com";
		
		chrome.browserAction.setIcon({path: icons.idle});
		chrome.browserAction.setBadgeText({text: ''});
		chrome.tabs.create({url: lastPageRead});
		
		if (latestUpdate) {
			jmtyler.memory.set('last_page_read', latestUpdate);
			jmtyler.memory.clear('latest_update');
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
		var areNotificationsOn = jmtyler.settings.get('notifications_on'),
			doShowPageCount    = jmtyler.settings.get('show_page_count'),
			newIntervalLength  = jmtyler.settings.map('check_frequency').seconds * 1000;
		
		// Interval length setting has been changed, so reset the interval.
		if (newIntervalLength != intervalLength) {
			intervalLength = newIntervalLength;
			if (checkInterval != null) {
				clearInterval(checkInterval);
			}
			checkInterval = setInterval(_checkForUpdates, intervalLength);
		}
		
		var lastPageRead = jmtyler.memory.get('last_page_read'),
			latestUpdate = jmtyler.memory.get('latest_update');
		
		var feedUri = "http://mspaintadventures.com/rss/rss.xml",
			request = new XMLHttpRequest();
		
		request.onload = function()
		{
			var xml = request.responseXML;
			if (!xml) {
				console.log('invalid rss feed received.');
				chrome.browserAction.setIcon({path: icons.error});
				return;
			}
			
			var pages = xml.getElementsByTagName('item');
			var count = Math.min(pages.length, 40);
			var item, guid, newLatestUpdate = null;
			var unreadPagesCount = 0;
			for (var i = 0; i < count; i += 1) {
				item = pages.item(i);
				
				guid = item.getElementsByTagName('guid')[0];
				if (guid) {
					guid = guid.textContent;
				}
				
				if (lastPageRead == null) {
					lastPageRead = guid;
					jmtyler.memory.set('last_page_read', guid);
				}
				
				if (guid == lastPageRead) {
					break;
				}
				
				if (newLatestUpdate == null) {
					newLatestUpdate = guid;
				}
				
				unreadPagesCount++;
			}
			
			if (unreadPagesCount < 1) {
				chrome.browserAction.setIcon({path: icons.idle});
				return;
			}
			
			// No need to pop up the notification more than once for the same update!
			if (newLatestUpdate == latestUpdate) {
				return;
			}
			
			var unreadPagesText = unreadPagesCount + (unreadPagesCount == 40 ? '+' : '');
			
			// Update button for new updates.
			jmtyler.memory.set('latest_update', newLatestUpdate);
			chrome.browserAction.setIcon({path: icons.updates});
			if (doShowPageCount) {
				chrome.browserAction.setBadgeBackgroundColor({color: '#00AA00'});
				chrome.browserAction.setBadgeText({text: unreadPagesText});
			}
			
			if (areNotificationsOn) {
				// Show notification for new updates.
				var notification = window.webkitNotifications.createNotification(
					'48.png',
					"New MSPA Update!",
					"Click here to start reading!" + (doShowPageCount ? ("\n" + unreadPagesText + " pages") : "")
				);
				notification.onclick = function()
				{
					this.close();
					_gotoMspa();
					return;
				};
				notification.show();
				setTimeout(function() {
					notification.close();
				}, 10000);
			}
			
			return;
		};
		
		request.onerror = function()
		{
			console.log('something went wrong, brotha.')
			chrome.browserAction.setIcon({path: icons.error});
			return;
		};
		
		request.open('GET', feedUri, true);
		request.send(null);
		
		return;
	};
	
	var _clearData = function()
	{
		jmtyler.settings.clear();
		jmtyler.memory.clear();
		chrome.browserAction.setIcon({path: icons.idle});
		chrome.browserAction.setBadgeText({text: ''});
	};
	
	if (isDebugMode) {
		window.gotoMspa = function(){ _gotoMspa(); };
		window.checkForUpdates = function(){ _checkForUpdates(); };
		window.clearData = function(){ _clearData(); };
	}
	
	_checkForUpdates();
	checkInterval = setInterval(_checkForUpdates, intervalLength);
	chrome.browserAction.onClicked.addListener(_gotoMspa);
})();
