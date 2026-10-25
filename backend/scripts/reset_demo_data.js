// Restore the local demo deals to their seed state: node backend/scripts/reset_demo_data.js
import { DATA_PATH } from '../config.js';
import { createRepository } from '../repository.js';

await createRepository().reset();
console.log(`Reset demo data at ${DATA_PATH}`);
