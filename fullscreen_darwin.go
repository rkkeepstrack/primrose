//go:build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa

#import <Cocoa/Cocoa.h>

// The window uses TitleBarHiddenInset (transparent titlebar over full-size
// content). In fullscreen macOS auto-reveals the titlebar on hover at the
// top of the screen; a transparent one shows the webview through it and
// flickers. Make it solid while in fullscreen, transparent again after.
static void installFullscreenTitlebarFix(void) {
	dispatch_async(dispatch_get_main_queue(), ^{
		NSWindow *win = [NSApp mainWindow] ?: [[NSApp windows] firstObject];
		if (win == nil) {
			return;
		}
		NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];
		[nc addObserverForName:NSWindowWillEnterFullScreenNotification
						object:win
						 queue:[NSOperationQueue mainQueue]
					usingBlock:^(NSNotification *note) {
			win.titlebarAppearsTransparent = NO;
		}];
		[nc addObserverForName:NSWindowWillExitFullScreenNotification
						object:win
						 queue:[NSOperationQueue mainQueue]
					usingBlock:^(NSNotification *note) {
			win.titlebarAppearsTransparent = YES;
		}];
	});
}
*/
import "C"

func fixFullscreenTitlebar() {
	C.installFullscreenTitlebarFix()
}
