# Cinescope

An Android mobile application built with **Ionic**, **Angular**, and **Capacitor** that helps users track movies and TV series they have watched or plan to watch. The app integrates with the **TMDB API** to fetch metadata, including posters, titles, summaries, and reviews.

## Table of Contents

- [Cinescope](#cinescope)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the App](#running-the-app)
  - [Building for Android](#building-for-android)
  - [Usage](#usage)
  - [Contributing](#contributing)
  - [License](#license)
  - [Misc Info](#misc-info)
    - [Capacitor Plugins](#capacitor-plugins)
    - [Dependencies](#dependencies)
      - [Maintenance Score](#maintenance-score)
    - [Nonstandard naming](#nonstandard-naming)


## Features

* Search for movies and TV series by title
* View detailed information, including posters, summaries, ratings, and reviews
* Track "Watched" and "To Watch" lists
* Responsive, mobile-first UI design


## Prerequisites

Before you begin, ensure you have met the following requirements:

* Node.js (>= 14.x)
* npm (comes with Node.js)
* Ionic CLI
* A TMDB API key (you can get one by creating an account on [TMDB](https://www.themoviedb.org/) and navigating to [API settings](https://www.themoviedb.org/settings/api))


## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/r-a-j/cinescope.git
   cd cinescope
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. If you don't have the Ionic CLI installed, install it globally:

   ```bash
   npm install -g @ionic/cli
   ```


## Running the App

To start the development server and view the app in your browser or emulator, run:

```bash
ionic serve
```


## Building for Android

1. Add the Android platform:

   ```bash
   ionic capacitor add android
   ```

2. Build the web assets:

   ```bash
   ionic build
   ```

3. Sync Capacitor:

   ```bash
   ionic capacitor sync android
   ```

4. Open the Android project in Android Studio:

   ```bash
   ionic capacitor open android
   ```

5. From Android Studio, build and run on an emulator or physical device.


## Usage

* Navigate to settings page and save the API key.
* Restart App.
* Use the search bar to find movies or TV series.
* Tap on an Movie/TV to view details.
* Mark Movie/TV as "Watched" or "To Watch" using the buttons on the detail page.
* Access your tracked lists from the side menu.


## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/YourFeature`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature/YourFeature`).
5. Open a pull request.

Please ensure your code adheres to the existing style.


## License

This project is licensed under the MIT License **with the Commons Clause**, which prohibits commercial sale. See the [LICENSE](LICENSE) file for details.


## Misc Info

### Capacitor Plugins

- 🟩 [@capacitor/app@7.0.0](https://github.com/ionic-team/capacitor-plugins.git) - (Latest 7.0.1)
- 🟩 [@capacitor/clipboard@7.0.1](https://github.com/ionic-team/capacitor-plugins.git)
- 🟩 [@capacitor/dialog@7.0.1](https://github.com/ionic-team/capacitor-plugins.git)
- 🟩 [@capacitor/haptics@7.0.0](https://github.com/ionic-team/capacitor-plugins.git) - (Latest 7.0.1)
- 🟩 [@capacitor/keyboard@7.0.0](https://github.com/ionic-team/capacitor-plugins.git) - (Latest 7.0.1)
- 🟩 [@capacitor/preferences@7.0.1](https://github.com/ionic-team/capacitor-plugins.git)
- 🟩 [@capacitor/status-bar@7.0.0](https://github.com/ionic-team/capacitor-plugins.git) - (Latest 7.0.1)
- 🟩 [@capacitor/toast@7.0.1](https://github.com/ionic-team/capacitor-plugins.git)


### Dependencies

- 🟩 [@angular-devkit/build-angular@19.2.5](https://github.com/angular/angular-cli.git) - (Latest 19.2.9)
- 🟩 [@angular-eslint/builder@19.3.0](https://github.com/angular-eslint/angular-eslint.git)
- 🟩 [@angular-eslint/eslint-plugin@19.3.0](https://github.com/angular-eslint/angular-eslint.git)
- 🟩 [@angular-eslint/eslint-plugin-template@19.3.0](https://github.com/angular-eslint/angular-eslint.git)
- 🟩 [@angular-eslint/schematics@19.3.0](https://github.com/angular-eslint/angular-eslint.git)
- 🟩 [@angular-eslint/template-parser@19.3.0](https://github.com/angular-eslint/angular-eslint.git)
- 🟩 [@angular/animations@19.2.4](https://github.com/angular/angular.git) - (Latest 19.2.8)
- 🟩 [@angular/cli@19.2.5](https://github.com/angular/angular-cli.git) - (Latest 19.2.9)
- 🟩 [@angular/common@19.2.4](https://github.com/angular/angular.git) - (Latest 19.2.8)
- 🟩 [@angular/compiler@19.2.4](https://github.com/angular/angular.git) - (Latest 19.2.8)
- 🟩 [@angular/compiler-cli@19.2.4](https://github.com/angular/angular.git) - (Latest 19.2.8)
- 🟩 [@angular/core@19.2.4](https://github.com/angular/angular.git) - (Latest 19.2.8)
- 🟩 [@angular/forms@19.2.4](https://github.com/angular/angular.git) - (Latest 19.2.8)
- 🟩 [@angular/language-service@19.2.4](https://github.com/angular/angular.git) - (Latest 19.2.8)
- 🟩 [@angular/platform-browser@19.2.4](https://github.com/angular/angular.git) - (Latest 19.2.8)
- 🟩 [@angular/platform-browser-dynamic@19.2.4](https://github.com/angular/angular.git) - (Latest 19.2.8)
- 🟩 [@angular/router@19.2.4](https://github.com/angular/angular.git) - (Latest 19.2.8)
- 🟩 [@capacitor/android@7.1.0](https://github.com/ionic-team/capacitor.git) - (Latest 7.2.0)
- 🟩 [@capacitor/cli@7.1.0](https://github.com/ionic-team/capacitor.git) - (Latest 7.2.0)
- 🟩 [@capacitor/core@7.1.0](https://github.com/ionic-team/capacitor.git) - (Latest 7.2.0)
- 🟩 [@ionic/angular@8.5.2](https://github.com/ionic-team/ionic-framework.git) - (Latest 8.5.5)
- 🟩 [@ionic/angular-toolkit@12.1.1](https://github.com/ionic-team/angular-toolkit.git) - (Latest 12.2.0)
- 🟩 [@types/jasmine@5.1.7](https://github.com/DefinitelyTyped/DefinitelyTyped.git)
- 🟩 [@typescript-eslint/eslint-plugin@8.28.0](https://github.com/typescript-eslint/typescript-eslint.git) - (Latest 8.31.0)
- 🟩 [@typescript-eslint/parser@8.28.0](https://github.com/typescript-eslint/typescript-eslint.git) - (Latest 8.31.0)
- 🟥 [animate.css@4.1.1](https://github.com/animate-css/animate.css.git) - Unmaintained (4.8 years since last release)
- 🟩 [eslint@9.23.0](https://github.com/eslint/eslint.git) - (Latest 9.25.1)
- 🟩 [eslint-plugin-import@2.31.0](https://github.com/import-js/eslint-plugin-import.git)
- 🟧 [eslint-plugin-jsdoc@48.11.0](https://github.com/gajus/eslint-plugin-jsdoc.git) - (Latest 50.6.10) - Is behind 2 major versions.
- 🟥 [eslint-plugin-prefer-arrow@1.2.2](https://github.com/TristonJ/eslint-plugin-prefer-arrow.git) - (Latest 1.2.3) - Unmaintained (4.4 years since last release)
- 🟩 [ionicons@7.4.0](https://github.com/ionic-team/ionicons.git)
- 🟩 [jasmine-core@5.1.2](https://github.com/jasmine/jasmine.git) - (Latest 5.6.0)
- 🟧 [jasmine-spec-reporter@5.0.2](https://github.com/bcaudan/jasmine-spec-reporter.git) - (Latest 7.0.0) - Is behind 2 major versions.
- 🟩 [karma@6.4.4](https://github.com/karma-runner/karma.git)
- 🟥 [karma-chrome-launcher@3.2.0](https://github.com/karma-runner/karma-chrome-launcher.git) - Unmaintained (2.2 years since last release)
- 🟧 [karma-coverage@2.2.1](https://github.com/karma-runner/karma-coverage.git) - May be unmaintained (2 years since last release)
- 🟥 [karma-jasmine@5.1.0](https://github.com/karma-runner/karma-jasmine.git) - Unmaintained (3 years since last release)
- 🟥 [karma-jasmine-html-reporter@2.1.0](https://github.com/dfederm/karma-jasmine-html-reporter.git) - Unmaintained (2 years since last release)
- 🟩 [rxjs@7.8.2](https://github.com/reactivex/rxjs.git)
- 🟩 [tslib@2.8.1](https://github.com/Microsoft/tslib.git)
- 🟩 [typescript@5.6.3](https://github.com/microsoft/TypeScript.git) - (Latest 5.8.3)
- 🟩 [zone.js@0.15.0](https://github.com/angular/angular.git)


#### Maintenance Score
42 out of 50 dependencies were up to date without issues.



### Nonstandard naming
The following files and folders do not follow the standard naming convention:


