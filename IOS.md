# Red West for iPhone and iPad

The iOS app is the same game wrapped with [Capacitor](https://capacitorjs.com/): `npm run build` produces
`dist/`, and Capacitor copies it into a native Xcode project in `ios/`. The game ships inside the app, so it
runs offline and makes no network requests (fonts included).

What the app does natively:
- Landscape only, full screen, no status bar; the home indicator fades out and edge swipes need a second
  swipe so thumbs on the sticks don't leave the game (`GameViewController` in `ios/App/App/SceneDelegate.swift`).
- Sheriff-star app icon and a dark launch screen (`ios/App/App/Assets.xcassets`).
- Twin-stick touch controls, the same as the phone web build.

CI (`.github/workflows/ios.yml`) compiles the app for the iOS Simulator on every push to `main`, without signing.
Signing, device testing and App Store submission need a Mac.

## What you need

- A Mac with the latest Xcode from the Mac App Store.
- Node.js 20.19+ or 22.12+.
- An [Apple Developer Program](https://developer.apple.com/programs/) membership (USD 99 per year) to put the
  app on your own iPhone for more than 7 days, on TestFlight, or on the App Store.

## Build and run on your iPhone

```sh
npm ci
npm run ios:sync   # build the game and copy it into the Xcode project
npm run ios:open   # open ios/App/App.xcodeproj in Xcode
```

In Xcode:
1. Select the **App** target → **Signing & Capabilities** → choose your **Team**. If Xcode says the bundle
   identifier is taken, change `com.bruceglez.redwest` to something unique (also in `capacitor.config.json`).
2. Plug in your iPhone (or pick a simulator) and press **Run**.

Run `npm run ios:sync` again after any change to the game before building in Xcode.

## TestFlight and the App Store

1. In [App Store Connect](https://appstoreconnect.apple.com/), create the app with the same bundle identifier.
2. In Xcode, set **Version** and **Build** (App target → General), choose **Any iOS Device**, then
   **Product → Archive** → **Distribute App** → **App Store Connect**.
3. The build appears under **TestFlight** after processing; add yourself and playtesters.
4. For review, App Store Connect needs:
   - **Screenshots** of the game in landscape at the required sizes. Take them on a large iPhone and
     iPad simulator; Apple lists the current sizes in App Store Connect.
   - **App Privacy:** *Data Not Collected*. Scores, names, settings and the playtest log stay on the device.
   - **Age rating:** the questionnaire will ask about violence; the game has frequent cartoon/fantasy gun
     violence against human-looking characters, so answer honestly and Apple assigns the rating.
   - **Category:** Games → Action. Description, keywords, support URL and a privacy policy URL.
   - **Export compliance** is pre-answered (`ITSAppUsesNonExemptEncryption = NO`).

## Before a public App Store release

- The **playtest log** (COPY / CLEAR on the start screen) is useful on TestFlight but looks like debug UI to
  store players; hide it for the store build.
- App Review expects a complete game, not a prototype. REFACTOR_PLAN.md's Stage 2–4 gates (full bounty run,
  more content, polish) are the realistic bar for a paid release; TestFlight is the right place for the
  current Stage 1 build.
- Consider iOS extras players expect from App Store games: haptics on hits and Heat changes, Game Center
  leaderboards, and game-controller support.
