// Migrations are bundled as text (Vite `?raw`), so the app needs no migrations folder at runtime.
declare module '*.sql?raw' {
  const sql: string;
  export default sql;
}
