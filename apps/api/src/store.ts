import fs from 'fs/promises';
import path from 'path';

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const dataFile = path.join(dataDir, 'state.json');

export const readState = async (): Promise<any | null> => {
  try {
    const raw = await fs.readFile(dataFile, 'utf-8');
    return JSON.parse(raw);
  } catch (err: any) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
};

export const writeState = async (state: any) => {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(state, null, 2));
};

export const clearState = async () => {
  try {
    await fs.unlink(dataFile);
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }
};
