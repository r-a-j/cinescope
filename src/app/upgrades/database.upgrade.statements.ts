export class DatabaseUpgradeStatements {
  databaseUpgrades = [
    {
      toVersion: 1,
      statements: [
        `CREATE TABLE IF NOT EXISTS users(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          active INTEGER DEFAULT 1
        );`
      ]
    },
    {
      toVersion: 2,
      statements: [
        `CREATE TABLE IF NOT EXISTS settings(
           key TEXT PRIMARY KEY,
           value TEXT
         );`
      ]
    },
    {
      toVersion: 3,
      statements: [
        `CREATE TABLE IF NOT EXISTS movie_list(
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           movieId INTEGER NOT NULL,
           listType TEXT NOT NULL,
           movieData TEXT,
           UNIQUE(movieId, listType)
         );`
      ]
    }
  ];
}
