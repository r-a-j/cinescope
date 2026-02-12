# Cinescope

An Android mobile application built with **Ionic**, **Angular**, and **Capacitor** that helps users track movies and TV series they have watched or plan to watch. The app integrates with the **TMDB API** to fetch metadata, including posters, titles, summaries, and reviews.


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
