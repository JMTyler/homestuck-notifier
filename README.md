
# Homestuck Notifier

### A Chrome Extension

This extension will automatically track which pages you've seen as you read through the stories on Homestuck.com.  You can then simply click the extension's button to return to the last page you saw.

It will also notify you of new updates when they're posted.  Updates are few and far between these days, which makes the notifier aspect of this extension less of a selling feature, but it's also arguably much more helpful to receive immediate notifications now than it was back when they happened all the time.  There is a [Heroku Golang server](https://github.com/JMTyler/homestuck-api) discovering the updates (now that Homestuck no longer provides a simple RSS feed), which are then published to this extension via FCM.

You can disable the notifications if you wish.  You can also configure a custom icon to appear in the notification, or a custom sound to play when the notification appears.

By default, the notification specifies how many pages were included in the update.  Also, as you work through a story, the extension's button shows how many pages are remaining in that story.  These can also both be disabled, if you wish to keep the mystery alive.
