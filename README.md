# 🎬 Movie Tracker App 📺

An android mobile application built with **Ionic, Angular, and Capacitor** that helps users track movies and TV series they have watched or plan to watch. The app integrates with the **TMDB API** to fetch metadata, including posters, titles, summaries, and reviews.

## 📸 Screenshots

<img src="https://github.com/r-a-j/cine-scope/blob/master/screenshots/1.jpg" width="300"> <img src="https://github.com/r-a-j/cine-scope/blob/master/screenshots/2.jpg" width="300">
<img src="https://github.com/r-a-j/cine-scope/blob/master/screenshots/3.jpg" width="300"> <img src="https://github.com/r-a-j/cine-scope/blob/master/screenshots/4.jpg" width="300">
<img src="https://github.com/r-a-j/cine-scope/blob/master/screenshots/6.jpg" width="300"> <img src="https://github.com/r-a-j/cine-scope/blob/master/screenshots/7.jpg" width="300">
<img src="https://github.com/r-a-j/cine-scope/blob/master/screenshots/5.jpg" width="300">

## 🚀 Features

- 📌 **Add & Remove** movies/TV shows from your watchlist
- 🔍 **Search** movies and TV series by title
- 🖼️ **Fetch metadata** (poster, summary, ratings) using **TMDB API**
- 🏷️ **Categorize** movies/TV shows as **Watched** or **To Watch**
- 📱 **Modern UI** built with **Ionic + Tailwind CSS**
- 🔔 **Push notifications** for upcoming releases (planned)

## 🛠️ Tech Stack

- **Ionic Framework** (Angular, Capacitor)
- **TMDB API** (for fetching movie/TV data)
- **Tailwind CSS** (for styling)
- **LocalStorage** (for saving watchlists)

## 📖 Setup & Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/r-a-j/cine-scope.git
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up API Key** (Get your TMDB API key [here](https://www.themoviedb.org/))
   - Create a `.env` file in the root directory and add:
     ```
     TMDB_API_KEY=your_api_key_here
     ```

4. **Run the app**
   ```bash
   ionic serve
   ```

5. **Build for Android/iOS**
   ```bash
   ionic capacitor add android
   ionic build
   ```

## 📌 Roadmap

- [x] Basic movie/TV show tracking
- [x] TMDB API integration
- [ ] Cross-device sync
- [ ] Notification reminders for upcoming releases

## 🤝 Contributing

Contributions are welcome! Feel free to **fork** the repository and submit a **pull request**.

## 📜 License

This project is licensed under the **MIT License**.

---

⭐ **Enjoy tracking your movies & TV series with CINESCOPE**
