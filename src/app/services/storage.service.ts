import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Injectable } from '@angular/core';
import { SQLiteService } from './sqlite.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../models/user';
import { DbnameVersionService } from './dbname-version.service';
import { MovieDetails, RecommendationsResult } from 'src/app/models/movie-details.model';
import { DatabaseUpgradeStatements } from '../upgrades/database.upgrade.statements';

@Injectable()
export class StorageService {
  public userList: BehaviorSubject<User[]> = new BehaviorSubject<User[]>([]);
  private databaseName: string = "";
  private uUpdStmts: DatabaseUpgradeStatements = new DatabaseUpgradeStatements();
  private versionUpgrades;
  private loadToVersion;
  private db!: SQLiteDBConnection;
  private isUserReady: BehaviorSubject<boolean> = new BehaviorSubject(false);

  constructor(
    private sqliteService: SQLiteService,
    private dbVerService: DbnameVersionService
  ) {
    this.versionUpgrades = this.uUpdStmts.databaseUpgrades;
    // Use the highest version number from the upgrades array.
    this.loadToVersion = this.versionUpgrades[this.versionUpgrades.length - 1].toVersion;
  }

  async initializeDatabase(dbName: string) {
    this.databaseName = dbName;
    // Create upgrade statements for users, settings, and movie_list.
    await this.sqliteService.addUpgradeStatement({
      database: this.databaseName,
      upgrade: this.versionUpgrades
    });
    // Open (or create) the database.
    this.db = await this.sqliteService.openDatabase(
      this.databaseName,
      false,
      'no-encryption',
      this.loadToVersion,
      false
    );
    this.dbVerService.set(this.databaseName, this.loadToVersion);
    await this.getUsers();
  }

  userState() {
    return this.isUserReady.asObservable();
  }
  fetchUsers(): Observable<User[]> {
    return this.userList.asObservable();
  }

  async loadUsers() {
    const users: User[] = (await this.db.query('SELECT * FROM users;')).values as User[];
    this.userList.next(users);
  }
  async getUsers() {
    await this.loadUsers();
    this.isUserReady.next(true);
  }
  async addUser(name: string) {
    const sql = `INSERT INTO users (name) VALUES (?);`;
    await this.db.run(sql, [name]);
    await this.getUsers();
  }

  async updateUserById(id: string, active: number) {
    const sql = `UPDATE users SET active=? WHERE id=?`;
    await this.db.run(sql, [active, id]);
    await this.getUsers();
  }
  async deleteUserById(id: string) {
    const sql = `DELETE FROM users WHERE id=?`;
    await this.db.run(sql, [id]);
    await this.getUsers();
  }

  // Methods for Settings
  async getSetting(key: string): Promise<string | null> {
    const sql = 'SELECT value FROM settings WHERE key = ?';
    const res = await this.db.query(sql, [key]);
    if (res.values && res.values.length > 0) {
      return res.values[0].value;
    }
    return null;
  }

  async saveSetting(key: string, value: string): Promise<void> {
    const sql = 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)';
    await this.db.run(sql, [key, value]);
  }

  // Methods for Movie Lists (Watchlist and Watched)
  async addMovieToList(movie: MovieDetails, listType: string): Promise<void> {
    const sql = `INSERT OR REPLACE INTO movie_list (movieId, listType, movieData) VALUES (?, ?, ?)`;
    const movieData = JSON.stringify(movie);
    await this.db.run(sql, [movie.id, listType, movieData]);
  }

  async removeMovieFromList(movie: MovieDetails, listType: string): Promise<void> {
    const sql = `DELETE FROM movie_list WHERE movieId = ? AND listType = ?`;
    await this.db.run(sql, [movie.id, listType]);
  }

  async getMoviesFromList(listType: string): Promise<MovieDetails[]> {
    const sql = `SELECT movieData FROM movie_list WHERE listType = ?`;
    const res = await this.db.query(sql, [listType]);
    if (res.values && res.values.length > 0) {
      return res.values.map((row: any) => JSON.parse(row.movieData));
    }
    return [];
  }

  async getWatchlist(): Promise<MovieDetails[]> {
    return this.getMoviesFromList('watchlist');
  }

  async getWatchedList(): Promise<MovieDetails[]> {
    return this.getMoviesFromList('watched');
  }
}
