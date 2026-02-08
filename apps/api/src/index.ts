import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './app';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env if present
dotenv.config({ path: path.join(__dirname, '../../../.env') });
// Fallback to local .env
dotenv.config();

const app = createApp();

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Schema Snap API running on ${port}`);
});
